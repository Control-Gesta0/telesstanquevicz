import { liberadoParaStela } from './gate'
import crypto from 'crypto'
import { adoptToken, currentToken, debounceAndClaim, releaseLock, renewLock } from './buffer'
import { CONFIG } from './config'
import { emptyUsage, logExec } from './execlog'
import {
  alreadyAnswered, appendMessage, getHistory, humanSpokeRecently, lastInbound, markAnswered, type ChatMsg,
} from './history'
import { CRM_MAP, portaById } from './crm-map'
import { fieldValue, getLead, leadTags } from './kommo'
import { createBrain } from './llm'
import { kommoPort } from './port'
import { respostasDoFormulario } from './roteamento'
import { rotearTurno } from './triagem'
import { comApresentacao } from './router'
import { agendarFollowup, cancelarFollowup } from './followup'
import { clearState, getState, patchState } from './state'
import { aplicarFinalizacao, type ToolCtx } from './tools'
import { sendReply } from './transport'

/**
 * Núcleo: gate → buffer → roteador (código) → cérebro (LLM) → travas → envio.
 * A mensagem inbound JÁ está no histórico quando chega aqui.
 */

const MAX_ROUNDS = 3

const brain = createBrain({ apiKey: CONFIG.openaiApiKey, model: CONFIG.llmModel })

/** Bloco atual do lead: inbounds depois da última outbound. */
function blocoAtual(history: ChatMsg[]): ChatMsg[] {
  const i = history.map(m => m.dir).lastIndexOf('out')
  return history.slice(i + 1).filter(m => m.dir === 'in')
}

async function enviar(leadId: number, text: string): Promise<string> {
  const detail = await sendReply(leadId, text)
  await appendMessage(leadId, { id: crypto.randomUUID(), dir: 'out', text, ts: Date.now() })
  return detail
}

export async function processLead(leadId: number, webhookId: string): Promise<void> {
  const t0 = Date.now()
  let lockOwner: string | undefined
  let nome = ''
  const pular = async (motivo: string, registrar = true) => {
    console.log(`[agente] PULOU lead ${leadId} (${nome}): ${motivo}`)
    if (registrar) await logExec({ tipo: 'pulou', leadId, nome, detalhe: motivo })
  }
  try {
    const lead = await getLead(leadId)
    nome = lead.name || ''
    const tags = leadTags(lead).map(t => t.toLowerCase())
    // Gate: etiqueta de liberação ou modo "todos os leads novos" (lib/gate.ts). Sem liberação, silêncio
    // e sem poluir o diário (a conta inteira manda add_message)
    const gate = liberadoParaStela(lead, tags)
    if (!gate.sim) return pular(gate.porque, false)
    const pelaEtiqueta = !!CONFIG.gateTag && tags.includes(CONFIG.gateTag)
    if (await humanSpokeRecently(leadId)) return pular('humano falou pelo Kommo nas últimas 6h — a IA não atropela')

    // Tag de gate de volta num lead já finalizado = novo ciclo (lead voltou a entrar)
    const st0 = await getState(leadId)
    // Modo "todos": atendimento já encerrado fica com a equipe (só a etiqueta de volta reabre o ciclo)
    if (st0.finalizado && !pelaEtiqueta) return pular('atendimento da Stela já encerrado: segue com a equipe', false)
    if (st0.finalizado) {
      await clearState(leadId)
      console.log(`[agente] lead ${leadId} voltou com a tag de gate — novo ciclo`)
    }

    const claim = await debounceAndClaim(leadId, webhookId)
    if (!claim.proceed) { console.log(`[debounce] lead ${leadId}: ${claim.reason}`); return }
    lockOwner = claim.lockOwner
    let myToken = webhookId

    for (let round = 0; round < MAX_ROUNDS; round++) {
      await renewLock(leadId, lockOwner!)
      const history = await getHistory(leadId)
      const target = lastInbound(history)
      if (!target) return
      if (await alreadyAnswered(leadId, target.id)) return

      const bloco = blocoAtual(history)
      const textoTurno = bloco.map(m => m.text).join('\n')
      const state = await getState(leadId)

      // 1. Roteador: palavra-chave em código; se não bastar, triagem por IA. Sem menu numerado.
      //    Antes de entender o assunto, lê TUDO o que o lead já disse ("Marcos" + "é do meu carro").
      const usoTriagem = emptyUsage()
      const textoDoLead = state.porta ? textoTurno : history.filter(m => m.dir === 'in').slice(-6).map(m => m.text).join('\n')
      const rota = await rotearTurno(state, textoDoLead, usoTriagem)
      if (rota.tipo === 'triagem') return
      if (rota.tipo === 'mensagem') {
        await patchState(leadId, rota.patch)
        const detail = await enviar(leadId, rota.texto)
        await markAnswered(leadId, target.id)
        await logExec({ tipo: 'menu', leadId, nome, ms: Date.now() - t0, usage: usoTriagem.calls ? usoTriagem : undefined, detalhe: `${detail} · ${rota.texto.slice(0, 60)}` })
        await agendarFollowup(leadId, 0).catch(e => console.error('[followup] falha ao agendar:', e))
        return
      }
      if (rota.tipo === 'encerrar') {
        // Assunto que parece não bancário: não recusa; etiqueta "Conferir escopo" e tarefa para a equipe conferir
        const geral = portaById(CRM_MAP.abertura.portaOutros)!
        await patchState(leadId, { ...rota.patch, porta: geral.id, portaEm: target.ts })
        const ctxFora: ToolCtx = { port: kommoPort(leadId), porta: geral, gateTag: CONFIG.gateTag, leadText: textoDoLead, lastLeadText: textoTurno, lastAgentText: '' }
        await aplicarFinalizacao(ctxFora, rota.motivo, `Assunto fora do escopo (não bancário). O lead disse: ${textoDoLead.slice(0, 300)}`)
        const detail = await enviar(leadId, rota.texto)
        await markAnswered(leadId, target.id)
        await logExec({ tipo: 'finalizou', leadId, nome, ms: Date.now() - t0, usage: usoTriagem.calls ? usoTriagem : undefined, detalhe: `fora do escopo · ${detail}` })
        await cancelarFollowup(leadId).catch(() => {})
        return
      }
      const porta = rota.porta
      if (rota.travou) {
        // RCPCC: o que o lead já respondeu no formulário do anúncio não é perguntado de novo
        const form = porta.id === 'rcpcc' ? respostasDoFormulario(CRM_MAP.negocio.formulario.campos.map(id => fieldValue(lead, id))) : {}
        const respostas = { ...form, ...(state.respostas || {}), ...(rota.patch?.respostas || {}) }
        await patchState(leadId, { porta: porta.id, portaEm: bloco[0]?.ts ?? target.ts, ...(Object.keys(respostas).length ? { respostas } : {}) })
        console.log(`[roteador] lead ${leadId} → porta ${porta.id}${Object.keys(form).length ? ` · formulário: ${Object.keys(form).join(', ')}` : ''}`)
      }
      const portaEm = (await getState(leadId)).portaEm ?? 0
      const conversa = history.filter(m => m.ts >= portaEm)

      const port = kommoPort(leadId)
      const iLast = conversa.map(m => m.dir).lastIndexOf('in')
      const ctx: ToolCtx = {
        port, porta, gateTag: CONFIG.gateTag,
        leadText: conversa.filter(m => m.dir === 'in').map(m => m.text).join('\n'),
        lastLeadText: textoTurno,
        lastAgentText: [...conversa.slice(0, Math.max(iLast, 0))].reverse().find(m => m.dir === 'out')?.text || '',
      }

      // 2. Porta sem agente: mensagem fixa e finaliza (sem LLM)
      if (!porta.ativa) {
        // Já é cliente (triagem ou palavra-chave): vai para o JURÍDICO com tarefa, não para o SDR
        const cliente = rota.motivo === 'cliente_do_escritorio' || !!CRM_MAP.alertas.find(a => a.nome === 'cliente do escritório')?.re.test(textoDoLead)
        const fixo = cliente ? CRM_MAP.abertura.clienteDoEscritorio : porta.mensagemSemAgente || 'Anotei aqui. Alguém da equipe continua a conversa com você por aqui.'
        const texto = rota.travou ? comApresentacao(state, rota.patch?.respostas?.nome || state.respostas?.nome || '', fixo) : fixo
        await aplicarFinalizacao(ctx, cliente ? 'cliente_do_escritorio' : 'porta_sem_agente', `${cliente ? 'Cliente do escritório' : `Assunto: ${porta.label}`}. Primeira mensagem: ${textoTurno.slice(0, 300)}`)
        const detail = await enviar(leadId, texto)
        await markAnswered(leadId, target.id)
        await logExec({ tipo: 'finalizou', leadId, nome, porta: porta.id, ms: Date.now() - t0, detalhe: `porta sem agente · ${detail}` })
        await cancelarFollowup(leadId).catch(() => {})
        return
      }

      // 3. Cérebro
      const primeiroContatoDaPorta = !conversa.some(m => m.dir === 'out')
      const reply = await brain.generateReply(ctx, { nomeContato: nome, primeiroContatoDaPorta }, conversa)
      if (!reply?.text) {
        await logExec({ tipo: 'erro', leadId, nome, porta: porta.id, detalhe: 'modelo não gerou resposta' })
        return
      }

      // Chegou mensagem nova durante a geração? Reprocessa com o contexto novo
      // (exceto se a IA já finalizou: a tag saiu, a despedida precisa sair)
      const tok = await currentToken(leadId)
      if (tok && tok !== myToken && !reply.handoff) {
        myToken = tok
        await adoptToken(leadId, myToken)
        continue
      }

      const detail = await enviar(leadId, reply.text)
      await markAnswered(leadId, target.id)
      if (usoTriagem.calls) for (const k of ['input', 'cached', 'output', 'calls'] as const) reply.usage[k] += usoTriagem[k]
      await logExec({
        tipo: reply.handoff ? 'finalizou' : 'resposta', leadId, nome, porta: porta.id, ms: Date.now() - t0,
        tools: reply.toolsUsed, guard: reply.guard, usage: reply.usage, urgente: reply.urgente || undefined, detalhe: detail,
      })
      if (reply.handoff) await cancelarFollowup(leadId).catch(() => {})
      else await agendarFollowup(leadId, 0).catch(e => console.error('[followup] falha ao agendar:', e))
      console.log(`[agente] RESPONDEU lead ${leadId} (${porta.id}) em ${Date.now() - t0}ms · tools: ${reply.toolsUsed.join(', ') || '—'}${reply.guard.length ? ` · trava: ${reply.guard.join(' | ')}` : ''}`)
      return
    }
    await pular('MAX_ROUNDS: lead mandando rápido demais — o próximo webhook responde')
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300)
    console.error(`[agente] ERRO lead ${leadId} após ${Date.now() - t0}ms: ${msg}`, e)
    await logExec({ tipo: 'erro', leadId, nome, ms: Date.now() - t0, detalhe: msg })
  } finally {
    await releaseLock(leadId, lockOwner)
  }
}
