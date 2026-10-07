import { CRM_MAP } from './crm-map'

/**
 * Agenda real do escritório (Calendly, tipo "ATENDIMENTO GERAL", Google Meet).
 * A IA só oferece horário que a API devolveu como livre e só diz "marcado"
 * depois que o POST /invitees respondeu 201. Horário em America/Sao_Paulo.
 *
 * As funções de escolha e rótulo são puras (rodam em `npm test`).
 */

const TZ = 'America/Sao_Paulo'
const API = 'https://api.calendly.com'

export interface Slot { iso: string; label: string }

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, ...opts }).format(new Date(iso))

/** "2026-10-09T12:15:00Z" → "sexta, 09/10, às 9h15" */
export function rotulo(iso: string): string {
  const dia = fmt(iso, { weekday: 'long' }).replace('-feira', '')
  const data = fmt(iso, { day: '2-digit', month: '2-digit' })
  const [h, m] = fmt(iso, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).split(':')
  return `${dia}, ${data}, às ${Number(h)}h${m === '00' ? '' : m}`
}

const horaLocal = (iso: string) => Number(fmt(iso, { hour: '2-digit', hourCycle: 'h23' }))
const diaLocal = (iso: string) => fmt(iso, { year: 'numeric', month: '2-digit', day: '2-digit' })

export interface Preferencia { periodo?: 'manha' | 'tarde'; dia?: string }

/**
 * Escolhe até `n` horários bem distribuídos: só minutos 00/15/30/45, a partir
 * da antecedência mínima, no máximo um por período (manhã/tarde) de cada dia.
 */
export function escolherOpcoes(isos: string[], agora: Date, pref: Preferencia = {}, n = CRM_MAP.calendly.opcoes): Slot[] {
  const minimo = agora.getTime() + CRM_MAP.calendly.antecedenciaMinHoras * 3600_000
  const usados = new Set<string>()
  const out: Slot[] = []
  const candidatos = isos
    .filter(iso => new Date(iso).getTime() >= minimo)
    .filter(iso => [0, 15, 30, 45].includes(new Date(iso).getUTCMinutes()))
    .filter(iso => !pref.periodo || (pref.periodo === 'manha' ? horaLocal(iso) < 12 : horaLocal(iso) >= 12))
    .filter(iso => !pref.dia || diaLocal(iso) === pref.dia || fmt(iso, { weekday: 'long' }).startsWith(pref.dia.toLowerCase()))
    .sort()
  for (const iso of candidatos) {
    const chave = `${diaLocal(iso)}:${horaLocal(iso) < 12 ? 'm' : 't'}`
    if (usados.has(chave)) continue
    usados.add(chave)
    out.push({ iso, label: rotulo(iso) })
    if (out.length >= n) break
  }
  return out
}

/** O lead escolheu qual das opções? Casa por hora ("9h15", "9:15", "às 9") e, se preciso, pelo dia. */
export function casarEscolha(texto: string, opcoes: Slot[], agora = new Date()): Slot | null {
  const t = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const porOrdem = t.match(/\b(primeir|segund|terceir)[oa]\b/)
  if (porOrdem) return opcoes[{ primeir: 0, segund: 1, terceir: 2 }[porOrdem[1] as 'primeir']] || null
  const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
  const hoje = diaLocal(agora.toISOString())
  const amanha = diaLocal(new Date(agora.getTime() + 86400_000).toISOString())
  const doDia = opcoes.filter(o => t.includes(semAcento(fmt(o.iso, { weekday: 'long' }).replace('-feira', ''))) || t.includes(fmt(o.iso, { day: '2-digit', month: '2-digit' }))
    || (/\bhoje\b/.test(t) && diaLocal(o.iso) === hoje) || (/\bamanha\b/.test(t) && diaLocal(o.iso) === amanha))
  // Citou um dia que não está entre as opções ("sexta às 9h15" quando só há quinta): não chuta
  if (!doDia.length && /\b(segunda|terca|quarta|quinta|sexta|sabado|domingo|amanha|hoje|\d{1,2}\/\d{1,2})\b/.test(t)) return null
  const base = doDia.length ? doDia : opcoes
  const casam = base.filter(o => {
    const [h, m] = fmt(o.iso, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).split(':').map(Number)
    const mm = String(m).padStart(2, '0')
    const pats = m === 0
      ? [`\\b0?${h}\\s*(h|hs|horas?)\\b(?!\\s*\\d)`, `\\b0?${h}:00\\b`, `\\bas 0?${h}\\b(?!\\s*[:h]?\\s*[1-5]\\d)`]
      : [`\\b0?${h}\\s*(h|hs|:)\\s*${mm}\\b`, `\\b0?${h} e ${m}\\b`]
    return pats.some(p => new RegExp(p).test(t))
  })
  if (casam.length === 1) return casam[0]
  return !casam.length && doDia.length === 1 ? doDia[0] : null
}

// ---------- API ----------

async function calendly<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = process.env.CALENDLY_TOKEN
  if (!token) throw new Error('CALENDLY_TOKEN ausente')
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new CalendlyError(res.status, text.slice(0, 400))
  return (text ? JSON.parse(text) : {}) as T
}

export class CalendlyError extends Error {
  constructor(public status: number, public body: string) { super(`Calendly ${status}: ${body}`) }
  /** horário ocupado entre a oferta e a reserva: ofereça de novo */
  get ocupado() { return /not available|no longer available|unavailable|already booked|indispon/i.test(this.body) }
}

/** Evals e testes: CALENDLY_FAKE=1 nunca toca a agenda real (reservar de verdade marcaria reunião no escritório). */
const FAKE = () => process.env.CALENDLY_FAKE === '1'

function slotsFalsos(agora: Date): string[] {
  const out: string[] = []
  for (let d = 0; d < 6; d++) {
    const base = new Date(agora.getTime() + d * 86400_000)
    const dia = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(base)
    const semana = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(base)
    if (semana === 'Sat' || semana === 'Sun') continue
    for (const hm of ['09:15', '10:30', '14:00', '16:15']) out.push(new Date(`${dia}T${hm}:00-03:00`).toISOString())
  }
  return out
}

/** Horários livres nos próximos dias (a API aceita janelas de até 7 dias). */
export async function horariosLivres(agora = new Date()): Promise<string[]> {
  if (FAKE()) return slotsFalsos(agora)
  const inicio = new Date(agora.getTime() + 60_000).toISOString()
  const fim = new Date(agora.getTime() + Math.min(CRM_MAP.calendly.diasAFrente, 6.9) * 86400_000).toISOString()
  const r = await calendly<{ collection?: Array<{ start_time: string; status: string }> }>('GET', `/event_type_available_times?event_type=${encodeURIComponent(CRM_MAP.calendly.eventType)}&start_time=${inicio}&end_time=${fim}`)
  return (r.collection || []).filter(s => s.status === 'available').map(s => s.start_time)
}

interface Pergunta { name: string; position: number; type: string; enabled: boolean; required: boolean }
let perguntasCache: Pergunta[] | null = null

async function perguntas(): Promise<Pergunta[]> {
  if (!perguntasCache) {
    const r = await calendly<{ resource: { custom_questions?: Pergunta[] } }>('GET', `/event_types/${CRM_MAP.calendly.eventType.split('/').pop()}`)
    perguntasCache = (r.resource.custom_questions || []).filter(q => q.enabled)
  }
  return perguntasCache
}

export interface Reserva { iso: string; label: string; inviteeUri: string; eventUri: string; joinUrl?: string }

/** Telefone do Kommo ("+5511999998888", "5511...", "11999...") → "+55 11 99999-8888" */
export function telefoneBR(raw: string): string {
  const d = raw.replace(/\D/g, '').replace(/^0+/, '')
  const n = d.startsWith('55') && d.length >= 12 ? d.slice(2) : d
  if (n.length < 10) return raw
  return `+55 ${n.slice(0, 2)} ${n.slice(2, n.length - 4)}-${n.slice(-4)}`
}

export async function reservar(p: { iso: string; nome: string; email: string; telefone: string; motivo: string; notas: string }): Promise<Reserva> {
  if (FAKE()) return { iso: p.iso, label: rotulo(p.iso), inviteeUri: 'fake:invitee', eventUri: 'fake:event', joinUrl: 'https://meet.google.com/fake-link' }
  const qs = await perguntas()
  const respostas = qs.map(q => {
    const nome = q.name.toLowerCase()
    const answer = /telefone|phone|whats/.test(nome) || q.type === 'phone_number' ? telefoneBR(p.telefone)
      : /motivo/.test(nome) ? p.motivo
      : p.notas
    return { question: q.name, answer, position: q.position }
  }).filter(a => a.answer)
  const r = await calendly<{ resource: { uri: string; event: string } }>('POST', '/invitees', {
    event_type: CRM_MAP.calendly.eventType,
    start_time: p.iso,
    invitee: { name: p.nome, email: p.email, timezone: TZ },
    location: { kind: 'google_conference' },
    questions_and_answers: respostas,
  })
  let joinUrl: string | undefined
  try {
    const ev = await calendly<{ resource: { location?: { join_url?: string } } }>('GET', `/scheduled_events/${r.resource.event.split('/').pop()}`)
    joinUrl = ev.resource.location?.join_url
  } catch { /* o link também vai no e-mail do Calendly */ }
  return { iso: p.iso, label: rotulo(p.iso), inviteeUri: r.resource.uri, eventUri: r.resource.event, joinUrl }
}
