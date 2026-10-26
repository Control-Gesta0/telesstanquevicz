import { CONFIG } from './config'
import { CRM_MAP } from './crm-map'
import type { KommoLead } from './kommo'

/**
 * Quem a Stela atende. Duas portas de entrada:
 *  1. etiqueta de liberação (GATE_TAG, ex.: ia-stela): fase de teste e casos escolhidos à mão;
 *  2. modo "todos os leads novos" (ATENDE_NOVOS_DESDE = data ISO da virada): só lead CRIADO a partir
 *     dessa data, no funil SDR, em Leads de entrada, Em atendimento ou Follow-up. Os leads antigos e
 *     os de outros funis (CLOSER, JURÍDICO, FINANCEIRO…) nunca entram por aqui.
 * A etiqueta de atendimento humano sempre vence. Puro: testado.
 */
export function liberadoParaStela(lead: Pick<KommoLead, 'pipeline_id' | 'status_id' | 'created_at'>, tags: string[], agoraCfg = { gateTag: CONFIG.gateTag, humanTag: CONFIG.humanTag, desde: CONFIG.atendeNovosDesde }): { sim: boolean; porque: string } {
  const t = tags.map(x => x.toLowerCase())
  if (t.includes(agoraCfg.humanTag)) return { sim: false, porque: `etiqueta "${agoraCfg.humanTag}"` }
  if (agoraCfg.gateTag && t.includes(agoraCfg.gateTag)) return { sim: true, porque: `etiqueta "${agoraCfg.gateTag}"` }
  if (!agoraCfg.gateTag) return { sim: true, porque: 'sem etiqueta exigida' }
  if (!agoraCfg.desde) return { sim: false, porque: `sem a etiqueta "${agoraCfg.gateTag}"` }
  const novo = (lead.created_at || 0) * 1000 >= agoraCfg.desde
  const etapa = lead.pipeline_id === CRM_MAP.negocio.pipelineId && CRM_MAP.automacoes.sdr.entrada.includes(lead.status_id)
  if (!novo) return { sim: false, porque: 'lead criado antes da virada (fica com a equipe)' }
  if (!etapa) return { sim: false, porque: 'fora das etapas de entrada do SDR' }
  return { sim: true, porque: 'lead novo no SDR' }
}
