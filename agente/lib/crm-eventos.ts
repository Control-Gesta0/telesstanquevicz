import { CRM_MAP } from './crm-map'
import { logExec } from './execlog'
import { addLeadNote, addLeadTags, addLeadTask, getLead, leadTags, setLeadTags, updateLeadResponsible, updateLeadStatus, type KommoLead } from './kommo'
import { marcarEntradaFollowUp } from './funil-sdr'
import { k, redis } from './redis'

/**
 * Automações de funil na Vercel (substituem os gatilhos do Kommo apagados em 14/10/2026).
 * Entrada: webhook "status_lead" do Kommo (form-urlencoded, chaves em colchetes):
 *   leads[status][0][id|status_id|pipeline_id|old_status_id|old_pipeline_id]
 * O parser e a decisão são puros (rodam em `npm test`); a execução relê o lead antes de agir.
 */

export interface MudancaEtapa { leadId: number; statusId: number; pipelineId: number; oldStatusId: number; oldPipelineId: number }

function pick(body: Record<string, unknown>, flat: string, nested: Array<string | number>): string {
  const v = body[flat]
  if (v !== undefined && v !== null) return String(v)
  let cur: unknown = body
  for (const key of nested) {
    if (cur === null || typeof cur !== 'object') return ''
    cur = (cur as Record<string, unknown>)[String(key)]
  }
  return cur === undefined || cur === null ? '' : String(cur)
}

export function parseStatusLead(raw: unknown): { accountId: string; mudancas: MudancaEtapa[] } {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const mudancas: MudancaEtapa[] = []
  for (let i = 0; i < 250; i++) {
    const p = (f: string) => Number(pick(body, `leads[status][${i}][${f}]`, ['leads', 'status', i, f]) || 0)
    const leadId = p('id')
    if (!leadId) break
    mudancas.push({ leadId, statusId: p('status_id'), pipelineId: p('pipeline_id'), oldStatusId: p('old_status_id'), oldPipelineId: p('old_pipeline_id') })
  }
  return { accountId: pick(body, 'account[id]', ['account', 'id']), mudancas }
}

export type Movimento = 'contratoPago' | 'reuniaoRealizada'
export type Automacao = Movimento | 'etiquetaFollowUp' | 'etiquetaVendaPerdida'
const MOVIMENTOS: Movimento[] = ['contratoPago', 'reuniaoRealizada']

const entrouEm = (m: MudancaEtapa, e: { pipelineId: number; statusId: number }) =>
  m.pipelineId === e.pipelineId && m.statusId === e.statusId && !(m.oldPipelineId === e.pipelineId && m.oldStatusId === e.statusId)

/** Qual automação esta mudança dispara (null = nenhuma). Puro: roda em `npm test`. */
export function decidir(m: MudancaEtapa): Automacao | null {
  for (const nome of MOVIMENTOS) if (entrouEm(m, CRM_MAP.automacoes[nome].de)) return nome
  for (const [nome, e] of Object.entries(CRM_MAP.automacoes.etiquetas)) if (entrouEm(m, e.em)) return nome as Automacao
  return null
}

/**
 * Trava de massa. Grava UMA linha no diário por janela (a primeira que estoura), não uma por
 * card: uma limpeza de mil cards apagaria o diário inteiro (ele guarda as últimas 2.000 linhas).
 */
async function emMassa(nome: string, leadId: number, lim: { eventos: number; janelaSeg: number }, efeito: string): Promise<boolean> {
  const n = await redis.incr(k('auto', nome, 'janela'))
  if (n === 1) await redis.expire(k('auto', nome, 'janela'), lim.janelaSeg)
  if (n <= lim.eventos) return false
  if (n === lim.eventos + 1) await logExec({ tipo: 'automacao', leadId, detalhe: `${nome} PAUSADO: mais de ${lim.eventos} em ${lim.janelaSeg / 60} min (movimentação em massa?). ${efeito}` })
  return true
}

export async function executar(m: MudancaEtapa): Promise<string> {
  const nome = decidir(m)
  if (!nome) return 'nenhuma'
  // Webhook repetido (o Kommo reenvia em falha) não age duas vezes
  if ((await redis.set(k('auto', nome, m.leadId, m.oldStatusId), '1', { nx: true, ex: 3600 })) !== 'OK') return 'duplicado'
  // Entrada em Follow-up começa a contar os 5 dias (antes do teto de etiquetas: em massa também conta)
  if (nome === 'etiquetaFollowUp') await marcarEntradaFollowUp(m.leadId).catch(e => console.error('[fu] entrada não registrada:', e))
  if (nome === 'etiquetaVendaPerdida') {
    // Motivo "Retomar depois": volta para o Follow-up do SDR em vez de ganhar Desqualificado
    const lead = await getLead(m.leadId)
    if (lead.loss_reason_id === CRM_MAP.automacoes.retomarDepois.motivoPerda) return retomarDepois(m, lead)
  }
  if (nome === 'etiquetaFollowUp' || nome === 'etiquetaVendaPerdida') return etiquetar(nome, m)

  const a = CRM_MAP.automacoes[nome]
  // Trava de massa: limpeza de funil (centenas de "ganhos" de uma vez) não é venda nem reunião
  if (await emMassa(nome, m.leadId, CRM_MAP.automacoes.limiteEmMassa, `Os cards desta janela ficam em ${a.de.name}: mova à mão os que forem de verdade.`)) return 'pausado (massa)'
  const lead = await getLead(m.leadId)
  // Fail-closed: só age se o lead AINDA está na etapa de origem (o webhook pode chegar atrasado)
  if (lead.pipeline_id !== a.de.pipelineId || lead.status_id !== a.de.statusId) {
    await logExec({ tipo: 'automacao', leadId: m.leadId, nome: lead.name, detalhe: `${nome}: lead já não está em ${a.de.name}, nada feito` })
    return 'fora da etapa'
  }
  await updateLeadStatus(m.leadId, a.para.statusId, a.para.pipelineId)
  const quando = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
  const valor = lead.price ? ` · valor R$ ${Number(lead.price).toLocaleString('pt-BR')}` : ''
  await addLeadTags(m.leadId, [a.tag]).catch(e => console.error('[automacao] tag falhou:', e))
  await addLeadNote(m.leadId, a.nota.replace('{quando}', quando).replace('{valor}', valor)).catch(e => console.error('[automacao] nota falhou:', e))
  await logExec({ tipo: 'automacao', leadId: m.leadId, nome: lead.name, detalhe: `${nome} → ${a.para.name}` })
  return `movido para ${a.para.name}`
}

/** Etiqueta ao entrar na etapa. Sem nota e sem linha no diário por card: é marcação, não decisão. */
async function etiquetar(nome: 'etiquetaFollowUp' | 'etiquetaVendaPerdida', m: MudancaEtapa): Promise<string> {
  const e = CRM_MAP.automacoes.etiquetas[nome]
  if (await emMassa(nome, m.leadId, CRM_MAP.automacoes.limiteEtiquetas, `Os cards que entraram em ${e.em.name} nesta janela ficam sem a etiqueta "${e.tag}".`)) return 'pausado (massa)'
  const lead = await getLead(m.leadId)
  if (lead.pipeline_id !== e.em.pipelineId || lead.status_id !== e.em.statusId) return 'fora da etapa'
  if (leadTags(lead).some(t => t.toLowerCase() === e.tag.toLowerCase())) return 'já tinha'
  await setLeadTags(m.leadId, [...leadTags(lead), e.tag])
  await redis.incr(k('auto', nome, 'dia', new Date().toISOString().slice(0, 10))).catch(() => {})
  return `etiqueta ${e.tag}`
}

/** CLOSER › Venda perdida com motivo "Retomar depois" → SDR › Follow-up, responsável SDR, tarefa e nota. */
async function retomarDepois(m: MudancaEtapa, lead: KommoLead): Promise<string> {
  const a = CRM_MAP.automacoes.retomarDepois
  if (await emMassa('retomarDepois', m.leadId, CRM_MAP.automacoes.limiteEmMassa, `Os cards desta janela ficam em ${a.de.name}: mova à mão os que forem de verdade.`)) return 'pausado (massa)'
  if (lead.pipeline_id !== a.de.pipelineId || lead.status_id !== a.de.statusId) return 'fora da etapa'
  await updateLeadStatus(m.leadId, a.para.statusId, a.para.pipelineId)
  await updateLeadResponsible(m.leadId, a.responsavel).catch(e => console.error('[retomar] responsável falhou:', e))
  if (!leadTags(lead).some(t => t.toLowerCase() === a.tag.toLowerCase())) await addLeadTags(m.leadId, [a.tag]).catch(e => console.error('[retomar] tag falhou:', e))
  await marcarEntradaFollowUp(m.leadId).catch(e => console.error('[retomar] entrada não registrada:', e))
  const agoraS = Math.floor(Date.now() / 1000)
  await addLeadTask(m.leadId, a.tarefa, a.responsavel, agoraS + a.prazoHoras * 3600).catch(e => console.error('[retomar] tarefa falhou:', e))
  const quando = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
  await addLeadNote(m.leadId, a.nota.replace('{quando}', quando)).catch(e => console.error('[retomar] nota falhou:', e))
  await logExec({ tipo: 'automacao', leadId: m.leadId, nome: lead.name, detalhe: `retomarDepois → ${a.para.name}` })
  return `movido para ${a.para.name}`
}
