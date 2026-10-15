import { CRM_MAP } from './crm-map'
import { logExec } from './execlog'
import { addLeadNote, getLead, leadTags, perderLead, setLeadTags, updateLeadStatus, type KommoLead } from './kommo'
import { k, redis } from './redis'

/**
 * Automações do SDR que saíram do Kommo em 15/10/2026 (decisão do mestre):
 *  1. RETORNO: o lead escreveu → card em Leads de entrada ou Follow-up volta para Em atendimento.
 *     Reunião agendada, No-show e outros funis ficam onde estão (o Kommo tirava até da DIRETORIA).
 *  2. FOLLOW-UP ESGOTADO: 5 dias em Follow-up sem nenhuma mensagem do lead → perdido
 *     (Lead Desaparecido) + etiqueta Desqualificado. Só para quem entrou em Follow-up a partir de
 *     15/10: o estoque de 9.938 cards fica para decisão separada.
 * Puro (testado) separado do que fala com Kommo e Redis.
 */

const C = CRM_MAP.automacoes.sdr

export function deveVoltar(lead: Pick<KommoLead, 'pipeline_id' | 'status_id'>): boolean {
  return lead.pipeline_id === C.pipelineId && C.retorno.de.includes(lead.status_id)
}

/** Quem venceu o prazo do Follow-up. `ultimoContato` é a última mensagem do lead (ms) ou 0. */
export function venceu(entradaMs: number, ultimoContatoMs: number, agoraMs: number): 'perder' | 'reiniciar' | 'esperar' {
  const prazo = C.followUp.dias * 86400_000
  if (ultimoContatoMs > entradaMs) return ultimoContatoMs + prazo <= agoraMs ? 'perder' : 'reiniciar'
  return entradaMs + prazo <= agoraMs ? 'perder' : 'esperar'
}

// ─────────────── retorno ───────────────

export async function registrarContato(leadId: number): Promise<void> {
  await redis.set(k('ultimo-in', leadId), Date.now(), { ex: 30 * 86400 })
}

/** Chamado a cada mensagem que o lead manda (qualquer lead, com ou sem a Stela). */
export async function lidarComRetorno(leadId: number): Promise<string> {
  // Rajada de mensagens (texto + áudio + foto) vira uma conferência só
  if ((await redis.set(k('retorno', leadId), '1', { nx: true, ex: 120 })) !== 'OK') return 'recente'
  const lead = await getLead(leadId)
  if (!deveVoltar(lead)) return 'fica'
  const de = lead.status_id === C.followUp.statusId ? 'Follow-up' : 'Leads de entrada'
  try {
    await updateLeadStatus(leadId, C.retorno.para, C.pipelineId)
  } catch (e) {
    // "Leads de entrada" do Kommo (lead não aceito) às vezes recusa mudança pela API
    console.warn(`[retorno] lead ${leadId} em ${de} não pôde ser movido:`, e)
    return 'recusado'
  }
  await redis.zrem(k('fu-entrada'), leadId).catch(() => {})
  await logExec({ tipo: 'automacao', leadId, nome: lead.name, detalhe: `retorno: lead respondeu → Em atendimento (vinha de ${de})` })
  return 'voltou'
}

// ─────────────── follow-up esgotado ───────────────

export async function marcarEntradaFollowUp(leadId: number, emMs = Date.now()): Promise<void> {
  await redis.zadd(k('fu-entrada'), { score: emMs, member: String(leadId) })
}

/** Varredura (relógio de 15 min). Lote pequeno: entrada em massa vira perda espalhada, não de uma vez. */
export async function varrerFollowUp(agoraMs = Date.now()): Promise<{ verificados: number; perdidos: number; reiniciados: number; sairam: number }> {
  const prazo = C.followUp.dias * 86400_000
  const ids = await redis.zrange<string[]>(k('fu-entrada'), 0, agoraMs - prazo, { byScore: true, offset: 0, count: C.followUp.lote })
  const r = { verificados: ids.length, perdidos: 0, reiniciados: 0, sairam: 0 }
  for (const id of ids) {
    const leadId = Number(id)
    try {
      const entrada = Number((await redis.zscore(k('fu-entrada'), id)) || 0)
      const lead = await getLead(leadId)
      if (lead.pipeline_id !== C.pipelineId || lead.status_id !== C.followUp.statusId) {
        await redis.zrem(k('fu-entrada'), id); r.sairam++; continue
      }
      const ultimo = Number((await redis.get(k('ultimo-in', leadId))) || 0)
      const v = venceu(entrada, ultimo, agoraMs)
      if (v === 'reiniciar') { await marcarEntradaFollowUp(leadId, ultimo); r.reiniciados++; continue }
      if (v !== 'perder') continue
      await perderLead(leadId, C.pipelineId, C.followUp.motivoPerda)
      const tags = leadTags(lead)
      if (!tags.some(t => t.toLowerCase() === C.followUp.tag.toLowerCase())) await setLeadTags(leadId, [...tags, C.followUp.tag]).catch(e => console.error('[fu] tag falhou:', e))
      await addLeadNote(leadId, `Sem resposta por ${C.followUp.dias} dias em Follow-up. Movido para perdido (Lead Desaparecido) pela automação. Se o lead voltar a escrever, reabra o card.`).catch(() => {})
      await redis.zrem(k('fu-entrada'), id)
      await logExec({ tipo: 'automacao', leadId, nome: lead.name, detalhe: `follow-up esgotado: ${C.followUp.dias} dias sem resposta → perdido (Lead Desaparecido)` })
      r.perdidos++
    } catch (e) {
      console.error(`[fu] lead ${leadId}:`, e)
      await logExec({ tipo: 'erro', leadId, detalhe: `follow-up esgotado: ${(e instanceof Error ? e.message : String(e)).slice(0, 200)}` })
    }
  }
  return r
}

export async function filaFollowUp(agoraMs = Date.now()): Promise<{ naFila: number; vencidos: number }> {
  const [naFila, vencidos] = await Promise.all([
    redis.zcard(k('fu-entrada')),
    redis.zcount(k('fu-entrada'), 0, agoraMs - C.followUp.dias * 86400_000),
  ])
  return { naFila, vencidos }
}
