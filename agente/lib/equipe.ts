import { kommoGet } from './kommo'
import { k, redis } from './redis'

/**
 * Quem da equipe escreveu no chat de cada lead nas últimas horas, pelos eventos do Kommo.
 * O webhook de mensagem do Kommo não entrega o que a equipe manda (em 3 e 4/11/2026 a Gabi respondeu em
 * vários cards e a Stela nunca percebeu). Mensagem com created_by de um usuário é pessoa; 0 é robô (inclusive
 * a própria Stela). O Kommo não filtra evento de chat por lead: lê a janela inteira e guarda um mapa por 45 s.
 */

const JANELA_S = 6 * 3600
const CACHE_S = 45

interface Ev { entity_id: number; created_by: number; created_at: number }

/** Mapa leadId → hora (s) da última mensagem de uma pessoa da equipe. Puro: testado. */
export function ultimasDaEquipe(eventos: Ev[]): Record<number, number> {
  const out: Record<number, number> = {}
  for (const e of eventos) if (e.created_by > 0 && (!out[e.entity_id] || e.created_at > out[e.entity_id])) out[e.entity_id] = e.created_at
  return out
}

async function mapaDaEquipe(): Promise<Record<number, number>> {
  const cache = await redis.get<{ at: number; mapa: Record<number, number> }>(k('equipe-recente'))
  if (cache && Date.now() / 1000 - cache.at < CACHE_S) return cache.mapa
  const desde = Math.floor(Date.now() / 1000) - JANELA_S
  const eventos: Ev[] = []
  for (let page = 1; page <= 10; page++) {
    const d = await kommoGet<{ _embedded?: { events?: Ev[] } }>(`/api/v4/events?filter%5Btype%5D=outgoing_chat_message&filter%5Bcreated_at%5D%5Bfrom%5D=${desde}&limit=100&page=${page}`)
    const lote = d?._embedded?.events || []
    eventos.push(...lote)
    if (lote.length < 100) break
  }
  const mapa = ultimasDaEquipe(eventos)
  await redis.set(k('equipe-recente'), { at: Math.floor(Date.now() / 1000), mapa }, { ex: 600 })
  return mapa
}

/** Alguém da equipe escreveu para este lead nas últimas 6 h? Em erro de leitura, responde "sim" (melhor calar que atropelar). */
export async function equipeEscreveu(leadId: number): Promise<boolean> {
  try {
    return !!(await mapaDaEquipe())[leadId]
  } catch (e) {
    console.error('[equipe] falha ao ler eventos do Kommo:', e)
    return true
  }
}
