import crypto from 'crypto'
import { Client } from '@upstash/qstash'
import { CONFIG } from './config'
import { CRM_MAP, portaById } from './crm-map'
import { logExec } from './execlog'
import { dentroDoHorario, JANELA_META_MS, MARGEM_JANELA_MS, proximoToque } from './followup-tempo'
import { appendMessage, getHistory, humanSpokeRecently } from './history'
import { getLead, leadTags, updateLeadStatus } from './kommo'
import { k, redis } from './redis'
import { getState, type LeadState } from './state'
import { prontoParaAgendar, snapshot } from './tools'
import { sendReply } from './transport'

/**
 * Follow-up dentro das 24h da Meta (Desenho A: texto livre só dentro da janela).
 *
 * Cada toque é UMA mensagem QStash com hora marcada. O estado `fu:{lead}` guarda
 * o token do toque vigente: qualquer mensagem do lead apaga o estado, então o
 * QStash que chegar depois é ignorado. Claim atômico por token: QStash pode
 * entregar duas vezes (comum/PEGADINHAS §10), o toque sai uma vez só.
 *
 * Textos fixos e aprovados: sem custo de modelo e sem risco de promessa.
 */

interface FuState { token: string; toque: 1 | 2 | 3; em: number; msgId?: string }

const selfUrl = () => (process.env.SELF_URL || '').replace(/\/+$/, '')
let client: Client | null = null
const qstash = () => (client ||= new Client({ token: process.env.QSTASH_TOKEN || '', baseUrl: process.env.QSTASH_URL || undefined }))
const ativo = () => !!(process.env.QSTASH_TOKEN && selfUrl())

export async function cancelarFollowup(leadId: number): Promise<void> {
  const fu = await redis.get<FuState>(k('fu', leadId))
  if (!fu) return
  await redis.del(k('fu', leadId))
  if (fu.msgId && ativo()) await qstash().messages.delete(fu.msgId).catch(() => { /* já entregue ou expirado */ })
}

/** depoisDe: 0 = depois de resposta da IA · 1 = depois do toque 1 · 2 = depois do toque 2 */
export async function agendarFollowup(leadId: number, depoisDe: 0 | 1 | 2): Promise<void> {
  if (!ativo()) { console.warn('[followup] SELF_URL ou QSTASH_TOKEN ausente — follow-up desligado'); return }
  const hist = await getHistory(leadId)
  const ultimoLead = [...hist].reverse().find(m => m.dir === 'in')?.ts
  const ultimaIa = [...hist].reverse().find(m => m.dir === 'out')?.ts
  if (!ultimoLead || !ultimaIa) return
  const plano = proximoToque(depoisDe, ultimaIa, ultimoLead, Date.now())
  if (!plano) return
  await cancelarFollowup(leadId)
  const token = crypto.randomUUID()
  const r = await qstash().publishJSON({
    url: `${selfUrl()}/api/followup`,
    body: { leadId, toque: plano.toque, token },
    notBefore: Math.floor(plano.em / 1000),
    retries: 2,
  })
  await redis.set(k('fu', leadId), { token, toque: plano.toque, em: plano.em, msgId: r.messageId } satisfies FuState, { ex: 3 * 86400 })
  console.log(`[followup] lead ${leadId}: toque ${plano.toque} em ${new Date(plano.em).toISOString()}`)
}

/** Texto do toque. Puro (exportado para o teste). */
export function textoDoToque(toque: 1 | 2, state: LeadState): string {
  if (toque === 2) return 'Vou deixar aqui: a reunião com o Dr. Carlos Eduardo é sem custo e dá para fazer pelo celular, com a câmera fechada se preferir. Se fizer sentido, me responde que eu vejo um horário.'
  const porta = portaById(state.porta)
  if (!porta || !porta.ativa) return 'Oi! Me conta qual é o seu caso, pode ser por texto ou áudio, que eu já te ajudo por aqui.'
  if (state.horariosOferecidos?.length && !state.reuniao) return 'Oi! Algum daqueles horários fica bom para você? Se preferir outro dia, me fala que eu vejo.'
  if (prontoParaAgendar(porta, state)) return 'Oi! Quer que eu veja um horário para você conversar sem custo com o Dr. Carlos Eduardo?'
  const pergunta = snapshot(porta, state).abertos[0]?.pergunta
  return pergunta ? `Oi! Só para a gente seguir com o seu caso: ${pergunta}` : 'Oi! Conseguiu ver minha última mensagem?'
}

export async function executarFollowup(leadId: number, toque: 1 | 2 | 3, token: string): Promise<string> {
  const fu = await redis.get<FuState>(k('fu', leadId))
  if (!fu || fu.token !== token) return 'obsoleto (lead respondeu ou outro toque assumiu)'
  if ((await redis.set(k('fu-claim', token), '1', { nx: true, ex: 2 * 86400 })) !== 'OK') return 'duplicado (claim já tomado)'

  const lead = await getLead(leadId)
  const tags = leadTags(lead).map(t => t.toLowerCase())
  const state = await getState(leadId)
  const parar = async (motivo: string) => { await redis.del(k('fu', leadId)); return motivo }
  if (tags.includes(CONFIG.humanTag)) return parar(`tag ${CONFIG.humanTag}`)
  if (CONFIG.gateTag && !tags.includes(CONFIG.gateTag)) return parar('sem a tag de gate')
  if (state.finalizado) return parar('atendimento finalizado')
  if (await humanSpokeRecently(leadId)) return parar('humano falou nas últimas 6h')

  const hist = await getHistory(leadId)
  const ultima = hist[hist.length - 1]
  if (!ultima || ultima.dir === 'in') return parar('a última mensagem é do lead (a IA responde)')
  const ultimoLead = [...hist].reverse().find(m => m.dir === 'in')?.ts || 0

  if (toque === 3) {
    const neg = CRM_MAP.negocio
    await redis.del(k('fu', leadId))
    const podeMover = lead.pipeline_id === neg.pipelineId && !CRM_MAP.etapasProtegidas.includes(lead.status_id) && ![neg.etapaQualificado.id, neg.etapaFollowUp.id].includes(lead.status_id)
    if (podeMover) await updateLeadStatus(leadId, neg.etapaFollowUp.id, neg.pipelineId)
    await logExec({ tipo: 'followup', leadId, nome: lead.name, detalhe: podeMover ? `esgotou: movido para ${neg.etapaFollowUp.name}` : 'esgotou: etapa mantida (fora do funil SDR ou etapa do time)' })
    return 'esgotou'
  }
  if (Date.now() > ultimoLead + JANELA_META_MS - MARGEM_JANELA_MS) { await agendarFollowup(leadId, 2); return 'janela da Meta fechou: só falta o esgotou' }
  if (!dentroDoHorario(Date.now())) { await agendarFollowup(leadId, (toque - 1) as 0 | 1); return 'fora do horário: reagendado' }

  const texto = textoDoToque(toque, state)
  const detalhe = await sendReply(leadId, texto)
  await appendMessage(leadId, { id: crypto.randomUUID(), dir: 'out', text: texto, ts: Date.now() })
  await logExec({ tipo: 'followup', leadId, nome: lead.name, porta: state.porta, detalhe: `toque ${toque} · ${detalhe}` })
  await agendarFollowup(leadId, toque)
  return `toque ${toque} enviado`
}
