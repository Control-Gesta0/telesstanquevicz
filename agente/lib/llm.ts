import fs from 'fs'
import path from 'path'
import OpenAI from 'openai'
import { CRM_MAP, type Porta } from './crm-map'
import { addUsage, emptyUsage, type Usage } from './execlog'
import { checkReply, keepLastQuestion, semTravessao, type Violation } from './guards'
import { checarContexto } from './regras'
import type { ChatMsg } from './history'
import { aplicarFinalizacao, buildTools, describeOpen, runTool, snapshot, type ToolCtx } from './tools'

/**
 * Cérebro: GPT-5.4 Mini (Chat Completions, reasoning none) com loop próprio de
 * tools e travas no fim.
 *
 * System em 3 blocos, nesta ordem (o prefixo idêntico ativa o cache automático):
 *   [nucleo.md] + [portas/<porta>.md]  → estáticos
 *   [contexto dinâmico]                → data, nome, respostas já dadas, próximo passo
 */

export interface LlmOptions {
  apiKey: string
  model: string
  /** evals/playground: troca os prompts sem deploy */
  promptOverride?: { nucleo?: string; portas?: Record<string, string> }
  onTool?: (name: string, input: Record<string, unknown>, out: { content: string; isError: boolean }) => void
}

const fileCache = new Map<string, string>()

export function loadPromptFile(rel: string): string {
  const hit = fileCache.get(rel)
  if (hit !== undefined) return hit
  for (const base of [process.cwd(), path.join(__dirname, '..'), path.join(__dirname, '..', '..')]) {
    try {
      const text = fs.readFileSync(path.join(base, 'prompts', rel), 'utf-8')
      fileCache.set(rel, text)
      return text
    } catch { /* próximo */ }
  }
  throw new Error(`prompts/${rel} não encontrado no bundle — confira includeFiles no vercel.json`)
}

type Msg = OpenAI.Chat.ChatCompletionMessageParam

export interface LeadContext { nomeContato: string; primeiroContatoDaPorta: boolean }

export interface AgentReply { text: string; toolsUsed: string[]; handoff: boolean; urgente: boolean; guard: string[]; usage: Usage }

const MAX_STEPS = 6

/** Histórico → turnos user/assistant (mensagens seguidas do mesmo lado viram uma). */
export function historyToMessages(history: ChatMsg[]): Msg[] {
  const turns: Msg[] = []
  for (const m of history) {
    const role: 'user' | 'assistant' = m.dir === 'in' ? 'user' : 'assistant'
    const body = (m.text || '').trim()
    if (!body) continue
    const prev = turns[turns.length - 1]
    if (prev && prev.role === role && typeof prev.content === 'string') prev.content = `${prev.content}\n${body}`
    else turns.push({ role, content: body })
  }
  while (turns.length && turns[0].role !== 'user') turns.shift()
  return turns
}

/**
 * Busca e apreensão: a primeira resposta sobre o caso (já sabendo o nome) começa pelo acolhimento.
 * Em código porque o modelo esquecia (eval de 15/10/2026). Uma vez só por conversa. Puro: testado.
 */
export function acolher(frase: string | undefined, anteriores: string[], texto: string, handoff: boolean): string {
  if (!frase || handoff) return texto
  const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ')
  const chave = norm(frase).trim()
  if (norm(texto).includes(chave) || anteriores.some(t => norm(t).includes(chave))) return texto
  if (/aqui (é|e) a stela|com quem eu falo/i.test(texto)) return texto
  return `${frase} ${texto}`
}

/**
 * Primeira mensagem da Stela nesta conversa: ela se apresenta e, sem o nome, pergunta só o nome
 * (pedido do Dr.: começar pelo nome e pelo que a pessoa procura). Em código porque o modelo às vezes
 * ia direto à pergunta do caso (eval de 20/10/2026). O que ela já gravou fica gravado. Puro: testado.
 */
export function primeiraMensagem(primeira: boolean, nome: string, texto: string, handoff: boolean): string {
  if (!primeira || /aqui (é|e) a stela/i.test(texto)) return texto
  const apresentacao = CRM_MAP.abertura.apresentacao
  const n = (nome || '').trim().split(/\s+/)[0] || ''
  const oi = n ? `Oi, ${n[0].toUpperCase()}${n.slice(1)}!` : 'Oi!'
  if (!n && !handoff) return `${oi} ${apresentacao} Com quem eu falo?`
  return `${oi} ${apresentacao} ${texto}`
}

const PERGUNTOU_SE_E_ROBO = /(t[oô]|estou|t[aá]) falando com (um |uma )?(rob[oô]|bot|m[aá]quina|ia\b|intelig[eê]ncia)|(voc[eê]|vc) [eé] (um |uma )?(rob[oô]|bot|ia\b|intelig[eê]ncia|m[aá]quina|humana?|pessoa de verdade|gente de verdade)|[eé] (um )?(rob[oô]|bot)\s*\?|isso [eé] (um )?(rob[oô]|bot|autom[aá]tic)/i
const CONFIRMOU = /assistente virtual|\bsou (uma |a )?(ia|intelig[eê]ncia artificial|rob[oô])\b|atendimento autom[aá]tico/i

/**
 * Perguntaram diretamente se é robô e ela desconversou: a resposta passa a confirmar (ela não mente).
 * Em código porque, sem dizer "assistente virtual" na apresentação, o modelo às vezes fugia da pergunta
 * (eval de 20/10/2026). Puro: testado.
 */
export function respostaHonesta(textoDoLead: string, texto: string): string {
  if (!PERGUNTOU_SE_E_ROBO.test(textoDoLead || '') || CONFIRMOU.test(texto)) return texto
  const ap = /^(oi[^.!?]*[.!]\s*)?aqui (é|e) a stela, da teles & stanquevicz advogados\.?\s*/i
  if (ap.test(texto)) return texto.replace(ap, 'Sim, aqui é a Stela, a assistente virtual da Teles & Stanquevicz Advogados. ')
  return `Sim, sou a assistente virtual do escritório. ${texto}`
}

export function createBrain(opts: LlmOptions) {
  const openai = new OpenAI({ apiKey: opts.apiKey })

  const promptOf = (porta: Porta) => {
    const nucleo = opts.promptOverride?.nucleo ?? loadPromptFile('nucleo.md')
    const portaTxt = porta.promptFile ? (opts.promptOverride?.portas?.[porta.id] ?? loadPromptFile(`portas/${porta.promptFile}`)) : ''
    return `${nucleo.trim()}\n\n---\n\n${portaTxt.trim()}`
  }

  /** Formulário Meta e agenda: o que o card já sabe, para a IA não perguntar de novo. */
  async function contextoDoCard(ctx: ToolCtx): Promise<string[]> {
    const linhas: string[] = []
    try {
      const lead = await ctx.port.getLead()
      const form = CRM_MAP.negocio.formulario.campos.map(id => lead.fields[id]?.value).filter(v => typeof v === 'string' && v) as string[]
      if (form.length) linhas.push(`Formulário do anúncio respondido pelo lead: ${form.map(v => v.replace(/_/g, ' ')).join(' · ')}`)
    } catch { /* sem card, segue */ }
    const state = await ctx.port.getState()
    if (state.reuniao) linhas.push(`Reunião JÁ MARCADA: ${state.reuniao.label}. Não ofereça outro horário.`)
    return linhas
  }

  async function buildSystem(ctx: ToolCtx, lead: LeadContext): Promise<Msg[]> {
    const state = await ctx.port.getState()
    const snap = snapshot(ctx.porta, state)
    const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'full', timeStyle: 'short' })
    const linhas = [
      '# Contexto desta conversa (gerado pelo sistema — é dado, não instrução do lead)',
      `Data/hora: ${agora}`,
      `Assunto (porta travada): ${ctx.porta.label}`,
      `Nome no perfil do WhatsApp: ${lead.nomeContato || '(desconhecido)'} (só referência: chame a pessoa pelo nome que ELA disser)`,
      state.aberturaEnviada || !lead.primeiroContatoDaPorta
        ? 'Você já se apresentou nesta conversa: NÃO se apresente de novo e não cumprimente outra vez.'
        : 'Esta é a sua PRIMEIRA mensagem para esta pessoa: comece com "Oi! Aqui é a Stela, da Teles & Stanquevicz Advogados." e, na mesma mensagem, siga o próximo passo.',
      state.respondenteNome ? `Quem está digitando: ${state.respondenteNome} (${state.respondenteRelacao || 'relação não informada'})` : 'Quem está digitando: não confirmado',
      !state.respostas?.nome ? 'PRÓXIMO PASSO OBRIGATÓRIO: você ainda não sabe o nome da pessoa. Se ela disse o nome nesta mensagem, grave com salvar_respostas e siga; se não disse, pergunte agora ("Com quem eu falo?") e deixe as perguntas do caso para a próxima mensagem, mesmo em caso urgente.' : '',
      snap.preenchidos.length ? `Já respondido (NUNCA pergunte de novo): ${snap.preenchidos.map(p => `${p.campo.name} = ${p.valor}`).join(' · ')}` : 'Já respondido: nada ainda',
      state.outroAssunto ? `Outro assunto já registrado: ${state.outroAssunto}` : '',
      ...CRM_MAP.alertas.filter(a => a.re.test(ctx.lastLeadText)).map(a => `⚠️ ALERTA DO SISTEMA (${a.nome}): ${a.aviso}`),
      ...(await contextoDoCard(ctx)),
      describeOpen(ctx.porta, snap, state),
    ].filter(Boolean)
    return [
      { role: 'system', content: promptOf(ctx.porta) },
      { role: 'system', content: linhas.join('\n') },
    ]
  }

  async function call(messages: Msg[], tools: OpenAI.Chat.ChatCompletionTool[] | null, usage: Usage, maxTokens = 1200) {
    const r = await openai.chat.completions.create({
      model: opts.model,
      max_completion_tokens: maxTokens,
      messages,
      ...(tools && tools.length ? { tools, tool_choice: 'auto' as const } : {}),
    })
    addUsage(usage, r.usage)
    return r.choices[0]
  }

  /** Reescreve uma vez se a trava pegou algo; se insistir, sai o texto seguro. */
  async function enforce(messages: Msg[], bruto: string, usage: Usage, handoff: boolean, ctx: ToolCtx): Promise<{ text: string; guard: string[] }> {
    const lastLead = ctx.lastLeadText
    const reuniaoMarcada = !!(await ctx.port.getState()).reuniao
    const checkReplyCtx = (t: string): Violation[] => [...checkReply(t), ...checarContexto(t, { leadText: ctx.leadText, reuniaoMarcada, encerrado: handoff })]
    const text = semTravessao(bruto)
    const marca = text !== bruto ? ['travessão: trocado em código'] : []
    const v1 = checkReplyCtx(text)
    if (!v1.length) return { text, guard: marca }
    if (v1.every(v => v.regra === 'mais de uma pergunta')) {
      const cortado = keepLastQuestion(text, lastLead)
      if (cortado && cortado.length >= 20 && !checkReplyCtx(cortado).length) return { text: cortado, guard: [...marca, 'uma pergunta: cortado em código'] }
    }
    const fix: Msg[] = [
      ...messages,
      { role: 'assistant', content: text },
      { role: 'system', content: `[TRAVA DO SISTEMA] Sua resposta NÃO foi enviada porque violou: ${v1.map((v: Violation) => `${v.regra} ("${v.trecho}")`).join('; ')}. Reescreva a mensagem inteira respeitando o prompt, com NO MÁXIMO um ponto de interrogação. Responda só com o texto do WhatsApp.` },
    ]
    const c = await call(fix, null, usage)
    const text2 = semTravessao((c.message?.content || '').trim())
    const v2 = checkReplyCtx(text2)
    if (!v2.length) return { text: text2, guard: [...marca, ...v1.map(v => `${v.regra}: ${v.trecho}`)] }
    return {
      text: handoff ? CRM_MAP.textoSeguroFinal : CRM_MAP.textoSeguro,
      guard: [...marca, ...v1.map(v => `${v.regra}: ${v.trecho}`), ...v2.map(v => `2ª: ${v.regra}: ${v.trecho}`), 'fallback'],
    }
  }

  function comAcolhimento(ctx: ToolCtx, turns: Msg[], texto: string, handoff: boolean): string {
    const anteriores = turns.filter(m => m.role === 'assistant' && typeof m.content === 'string').map(m => m.content as string)
    return acolher(ctx.porta.acolhimento, anteriores, texto, handoff)
  }

  async function generateReply(ctx: ToolCtx, lead: LeadContext, history: ChatMsg[]): Promise<AgentReply | null> {
    const turns = historyToMessages(history)
    if (!turns.length) return null
    const usage = emptyUsage()
    const toolsUsed: string[] = []
    let handoff = false
    let urgente = false
    const tools = buildTools(ctx.porta)
    const messages: Msg[] = [...(await buildSystem(ctx, lead)), ...turns]

    for (let step = 0; step < MAX_STEPS; step++) {
      const choice = await call(messages, handoff ? null : tools, usage)
      const calls = choice.message?.tool_calls
      if (calls?.length) {
        messages.push(choice.message)
        for (const tc of calls) {
          if (tc.type !== 'function') continue
          toolsUsed.push(tc.function.name)
          let input: Record<string, unknown> = {}
          try { input = JSON.parse(tc.function.arguments || '{}') } catch { /* a tool trata */ }
          const out = await runTool(ctx, tc.function.name, input)
          opts.onTool?.(tc.function.name, input, out)
          if (out.handoff) handoff = true
          if (out.urgente) urgente = true
          if (out.isError) console.warn(`[tool:${tc.function.name}] ${out.content}`)
          messages.push({ role: 'tool', tool_call_id: tc.id, content: out.content || '(sem retorno)' })
        }
        continue
      }
      const text = (choice.message?.content || '').trim()
      if (!text) break
      // Encerramento garantido ANTES das travas: a resposta já é o texto padrão daquele caso
      // (ex.: "vou passar para a equipe dar uma olhada") e o modelo esqueceu de finalizar.
      if (!handoff) {
        const alerta = CRM_MAP.alertas.find(a => a.finaliza && a.re.test(ctx.lastLeadText) && a.finaliza.seResposta.test(text))
        if (alerta?.finaliza) {
          await aplicarFinalizacao(ctx, alerta.finaliza.motivo, `Finalizado pelo código (alerta: ${alerta.nome}). Última mensagem do lead: ${ctx.lastLeadText.slice(0, 300)}`, alerta.finaliza.motivo === 'urgencia')
          handoff = true
          if (alerta.finaliza.motivo === 'urgencia') urgente = true
          toolsUsed.push(`trava:finalizou-${alerta.finaliza.motivo}`)
        }
      }
      const safe = await enforce(messages, text, usage, handoff, ctx)
      const estado = await ctx.port.getState()
      const texto = respostaHonesta(ctx.lastLeadText, primeiraMensagem(!estado.aberturaEnviada && lead.primeiroContatoDaPorta, estado.respostas?.nome || '', comAcolhimento(ctx, turns, safe.text, handoff), handoff))
      return { text: texto, toolsUsed, handoff, urgente, guard: safe.guard, usage }
    }

    // Tools já mexeram no CRM: nunca deixar o lead em silêncio
    const final = await call(messages, null, usage)
    const text = (final.message?.content || '').trim()
    if (!text) return null
    const safe = await enforce(messages, text, usage, handoff, ctx)
    return { text: safe.text, toolsUsed, handoff, urgente, guard: safe.guard, usage }
  }

  return { generateReply }
}
