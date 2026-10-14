import { CRM_MAP } from './crm-map'
import { logExec } from './execlog'
import { addLeadNote, addLeadTags, getLead, updateLeadStatus } from './kommo'
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

export type Automacao = 'contratoPago' | 'reuniaoRealizada'
const AUTOMACOES: Automacao[] = ['contratoPago', 'reuniaoRealizada']

/** Qual automação esta mudança dispara (null = nenhuma). */
export function decidir(m: MudancaEtapa): Automacao | null {
  for (const nome of AUTOMACOES) {
    const a = CRM_MAP.automacoes[nome]
    if (m.pipelineId === a.de.pipelineId && m.statusId === a.de.statusId && !(m.oldPipelineId === a.de.pipelineId && m.oldStatusId === a.de.statusId)) return nome
  }
  return null
}

export async function executar(m: MudancaEtapa): Promise<string> {
  const nome = decidir(m)
  if (!nome) return 'nenhuma'
  const a = CRM_MAP.automacoes[nome]
  // Webhook repetido (o Kommo reenvia em falha) não move duas vezes
  if ((await redis.set(k('auto', nome, m.leadId, m.oldStatusId), '1', { nx: true, ex: 3600 })) !== 'OK') return 'duplicado'
  // Trava de massa: limpeza de funil (centenas de "ganhos" de uma vez) não é venda nem reunião
  const lim = CRM_MAP.automacoes.limiteEmMassa
  const n = await redis.incr(k('auto', nome, 'janela'))
  if (n === 1) await redis.expire(k('auto', nome, 'janela'), lim.janelaSeg)
  if (n > lim.eventos) {
    await logExec({ tipo: 'automacao', leadId: m.leadId, detalhe: `${nome} PAUSADO: mais de ${lim.eventos} em ${lim.janelaSeg / 60} min (movimentação em massa?). Lead não movido.` })
    return 'pausado (massa)'
  }
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
