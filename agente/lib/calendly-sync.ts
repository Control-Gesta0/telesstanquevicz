import crypto from 'crypto'
import { CRM_MAP } from './crm-map'
import { logExec } from './execlog'
import { addLeadNote, addLeadTask, kommoGet, updateLeadFields, updateLeadStatus, type KommoLead } from './kommo'
import { k, redis } from './redis'

/**
 * Calendly → Kommo (14/10/2026). O Calendly tem ~3x mais reuniões que o campo "Reunião" do Kommo;
 * sem esta ponte, lembrete e relatório só enxergam um terço delas.
 *   invitee.created  → acha o lead (telefone dígito a dígito, depois e-mail), grava Reunião + link,
 *                      leva para SDR › Reunião agendada (se estiver no SDR e não ganho, ou no CLOSER › Atendimento direto), nota no card
 *   invitee.canceled → limpa Reunião se for a mesma, nota e tarefa "reagendar" (remarcação não conta)
 * Lead não encontrado: não cria (evita duplicata); vai para o diário.
 * Funções de casamento são puras (rodam em `npm test`).
 */

/** DDD + 8 últimos dígitos: casa "+55 48 99966-1278", "5548999661278" e "48 9966-1278" (sem o 9 extra). */
export function chaveTelefone(raw: string): string | null {
  let d = String(raw || '').replace(/\D/g, '').replace(/^0+/, '')
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2)
  if (d.length < 10 || d.length > 11) return null
  return d.slice(0, 2) + d.slice(-8)
}

export interface Candidato { id: number; pipelineId: number; statusId: number; updatedAt: number }

/** Lead preferido do contato: aberto no SDR > qualquer no SDR (inclui perdido) > aberto em outro funil. Mais recente primeiro. */
export function escolherLead(leads: Candidato[]): Candidato | null {
  const sdr = CRM_MAP.negocio.pipelineId
  const aberto = (l: Candidato) => l.statusId !== 142 && l.statusId !== 143
  const rec = (a: Candidato, b: Candidato) => b.updatedAt - a.updatedAt
  return [...leads.filter(l => l.pipelineId === sdr && aberto(l))].sort(rec)[0]
    || [...leads.filter(l => l.pipelineId === sdr && l.statusId !== 142)].sort(rec)[0]
    || [...leads.filter(aberto)].sort(rec)[0]
    || null
}

/** Header Calendly-Webhook-Signature: "t=1700000000,v1=<hex>" = HMAC-SHA256(chave, `${t}.${corpo}`). Tolerância de 5 min. */
export function assinaturaValida(header: string, corpo: string, chave: string, agoraS = Math.floor(Date.now() / 1000)): boolean {
  const partes = Object.fromEntries(String(header || '').split(',').map(p => p.trim().split('=') as [string, string]))
  const t = Number(partes.t)
  if (!t || !partes.v1 || !chave || Math.abs(agoraS - t) > 300) return false
  const esperado = crypto.createHmac('sha256', chave).update(`${t}.${corpo}`).digest('hex')
  return esperado.length === partes.v1.length && crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(partes.v1))
}

// ---------- Runtime ----------

interface Convidado {
  uri: string; email?: string; name?: string; status?: string; rescheduled?: boolean
  questions_and_answers?: Array<{ question: string; answer: string }>
  scheduled_event?: { uri?: string; start_time?: string; location?: { join_url?: string } }
  cancellation?: { reason?: string; canceled_by?: string }
}

const telefoneDe = (c: Convidado) => (c.questions_and_answers || []).find(q => /telefone|whats|celular|phone/i.test(q.question))?.answer || ''

async function contatosPorBusca(termo: string): Promise<any[]> {
  if (!termo) return []
  const j = await kommoGet<any>(`/api/v4/contacts?limit=50&with=leads&query=${encodeURIComponent(termo)}`)
  return j._embedded?.contacts || []
}

async function acharLead(c: Convidado): Promise<{ lead: Candidato; via: string } | null> {
  const mapeado = await redis.get<number>(k('cal-invitee', c.uri))
  const ids = new Set<number>()
  let via = ''
  if (mapeado) { ids.add(Number(mapeado)); via = 'reserva da IA' }
  const chave = chaveTelefone(telefoneDe(c))
  if (!ids.size && chave) {
    for (const ct of await contatosPorBusca(chave.slice(-8))) {
      const fones = (ct.custom_fields_values || []).filter((f: any) => f.field_code === 'PHONE').flatMap((f: any) => (f.values || []).map((v: any) => v.value))
      if (fones.some((f: string) => chaveTelefone(f) === chave)) (ct._embedded?.leads || []).forEach((l: any) => ids.add(l.id))
    }
    if (ids.size) via = 'telefone'
  }
  if (!ids.size && c.email) {
    for (const ct of await contatosPorBusca(c.email)) {
      const emails = (ct.custom_fields_values || []).filter((f: any) => f.field_code === 'EMAIL').flatMap((f: any) => (f.values || []).map((v: any) => String(v.value).toLowerCase()))
      if (emails.includes(c.email.toLowerCase())) (ct._embedded?.leads || []).forEach((l: any) => ids.add(l.id))
    }
    if (ids.size) via = 'e-mail'
  }
  if (!ids.size) return null
  const q = [...ids].slice(0, 50).map((id, i) => `filter[id][${i}]=${id}`).join('&')
  const ls = ((await kommoGet<any>(`/api/v4/leads?limit=50&${q}`))._embedded?.leads || []) as KommoLead[]
  const lead = escolherLead(ls.map(l => ({ id: l.id, pipelineId: l.pipeline_id, statusId: l.status_id, updatedAt: (l as any).updated_at || 0 })))
  return lead ? { lead, via } : null
}

const quandoBR = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })

export async function sincronizarConvidado(evento: 'invitee.created' | 'invitee.canceled', c: Convidado): Promise<string> {
  const inicio = c.scheduled_event?.start_time
  if (!c.uri || !inicio) return 'payload incompleto'
  if ((await redis.set(k('cal-evt', evento, c.uri), '1', { nx: true, ex: 30 * 86400 })) !== 'OK') return 'duplicado'
  const achado = await acharLead(c)
  const neg = CRM_MAP.negocio
  if (!achado) {
    await logExec({ tipo: 'automacao', leadId: 0, nome: c.name, detalhe: `calendly ${evento === 'invitee.created' ? 'marcou' : 'cancelou'} ${quandoBR(inicio)}: lead NÃO encontrado no Kommo (sem telefone/e-mail que bata)` })
    return 'sem lead'
  }
  const { lead, via } = achado
  await redis.set(k('cal-invitee', c.uri), lead.id, { ex: 60 * 86400 })
  const inicioS = Math.floor(Date.parse(inicio) / 1000)

  if (evento === 'invitee.created') {
    const writes = [{ field_id: neg.reuniao.fieldId, values: [{ value: inicioS }] }, ...(c.scheduled_event?.location?.join_url ? [{ field_id: neg.reuniao.linkFieldId, values: [{ value: c.scheduled_event.location.join_url }] }] : [])]
    await updateLeadFields(lead.id, writes)
    let mov = ''
    // Do SDR (menos ganho) ou do CLOSER › Atendimento direto (o closer marcou): vai para SDR › Reunião agendada,
    // onde o closer confere a agenda do dia (pedido do Dr., 20/10/2026). Responsável mantido.
    const doDireto = lead.pipelineId === neg.atendimentoDireto.pipelineId && lead.statusId === neg.atendimentoDireto.statusId
    if (doDireto || (lead.pipelineId === neg.pipelineId && lead.statusId !== 142 && lead.statusId !== neg.etapaQualificado.id)) {
      await updateLeadStatus(lead.id, neg.etapaQualificado.id, neg.pipelineId)
      mov = ` Movido para ${neg.etapaQualificado.name}.`
    }
    await addLeadNote(lead.id, `📅 Reunião marcada no Calendly para ${quandoBR(inicio)}${c.rescheduled ? ' (remarcação)' : ''} por ${c.name || '?'} (${c.email || 'sem e-mail'}).${mov}`)
    await logExec({ tipo: 'automacao', leadId: lead.id, nome: c.name, detalhe: `calendly marcou ${quandoBR(inicio)} (achado por ${via})${mov}` })
    return 'marcada'
  }

  // invitee.canceled
  if (c.rescheduled) {
    await logExec({ tipo: 'automacao', leadId: lead.id, nome: c.name, detalhe: `calendly: remarcação de ${quandoBR(inicio)} (a nova data chega no invitee.created)` })
    return 'remarcação'
  }
  const atual = Number(((await kommoGet<KommoLead>(`/api/v4/leads/${lead.id}`)).custom_fields_values || []).find(f => f.field_id === neg.reuniao.fieldId)?.values?.[0]?.value || 0)
  if (atual === inicioS) await updateLeadFields(lead.id, [{ field_id: neg.reuniao.fieldId, values: null as any }, { field_id: neg.reuniao.linkFieldId, values: null as any }])
  const motivo = c.cancellation?.reason ? ` Motivo: ${c.cancellation.reason.slice(0, 200)}` : ''
  await addLeadNote(lead.id, `❌ Reunião de ${quandoBR(inicio)} cancelada no Calendly${c.cancellation?.canceled_by ? ` por ${c.cancellation.canceled_by}` : ''}.${motivo}`)
  const resp = (await kommoGet<KommoLead>(`/api/v4/leads/${lead.id}`)).responsible_user_id || neg.responsavelPadrao
  await addLeadTask(lead.id, `Reagendar: a reunião de ${quandoBR(inicio)} foi cancelada no Calendly.`, resp, Math.floor(Date.now() / 1000) + 3600, neg.tarefaTipo)
  await logExec({ tipo: 'automacao', leadId: lead.id, nome: c.name, detalhe: `calendly cancelou ${quandoBR(inicio)}${atual === inicioS ? ' · campo Reunião limpo' : ''} · tarefa reagendar` })
  return 'cancelada'
}
