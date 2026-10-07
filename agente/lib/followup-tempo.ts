/**
 * Relógio do follow-up — arquivo PURO (sem env, sem rede) para rodar em `npm test`.
 *
 * Regras do escritório (07/10/2026):
 *  - toque 1: 2h depois da última mensagem da IA sem resposta;
 *  - toque 2: 20h depois da última mensagem do LEAD;
 *  - tudo dentro da janela de 24h da Meta (contada da última mensagem do lead),
 *    com margem, e só entre 8h e 20h de Brasília;
 *  - toque que cairia fora do horário é antecipado/adiado para dentro dele;
 *    se não couber antes de a janela fechar, é pulado (null).
 */

export const TOQUE1_APOS_IA_MS = 2 * 3600_000
export const TOQUE2_APOS_LEAD_MS = 20 * 3600_000
export const JANELA_META_MS = 24 * 3600_000
export const MARGEM_JANELA_MS = 20 * 60_000
const INICIO_H = 8
const FIM_H = 20
const BRT_OFFSET_MS = -3 * 3600_000 // Brasília sem horário de verão desde 2019

const horaBRT = (ms: number) => new Date(ms + BRT_OFFSET_MS).getUTCHours() + new Date(ms + BRT_OFFSET_MS).getUTCMinutes() / 60
/** ms do dia (em Brasília) de `ms` às `h` horas */
function naHoraBRT(ms: number, h: number): number {
  const d = new Date(ms + BRT_OFFSET_MS)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h) - BRT_OFFSET_MS
}

/** Encaixa `alvo` no horário comercial, sem passar de `limite`. null = não cabe. */
export function encaixar(alvo: number, limite: number, agora: number): number | null {
  let t = Math.max(alvo, agora + 60_000)
  const h = horaBRT(t)
  if (h < INICIO_H) t = naHoraBRT(t, INICIO_H)
  else if (h >= FIM_H) t = naHoraBRT(t + 86400_000, INICIO_H)
  if (t <= limite) return t
  // Adiar estoura a janela: tenta antecipar para o último horário permitido antes do limite
  const hl = horaBRT(limite)
  const ultimo = hl >= FIM_H ? naHoraBRT(limite, FIM_H) - 60_000 : hl < INICIO_H ? naHoraBRT(limite - 86400_000, FIM_H) - 60_000 : limite
  return ultimo > agora + 60_000 && ultimo >= alvo - 6 * 3600_000 ? ultimo : null
}

export interface Plano { toque: 1 | 2 | 3; em: number }

/**
 * Próximo passo da cadência.
 *  depoisDe = 0 → depois de uma resposta da IA (agenda o toque 1)
 *  depoisDe = 1 → depois do toque 1 (agenda o toque 2)
 *  depoisDe = 2 → depois do toque 2 (agenda o "esgotou": vai para FOLLOW UP quando a janela fecha)
 */
export function proximoToque(depoisDe: 0 | 1 | 2, ultimaIa: number, ultimoLead: number, agora: number): Plano | null {
  const limite = ultimoLead + JANELA_META_MS - MARGEM_JANELA_MS
  if (depoisDe === 2) return { toque: 3, em: Math.max(ultimoLead + JANELA_META_MS, agora + 60_000) }
  if (depoisDe === 0) {
    const em = encaixar(ultimaIa + TOQUE1_APOS_IA_MS, limite, agora)
    if (em !== null) return { toque: 1, em }
    // toque 1 não cabe: tenta direto o 2
  }
  const em2 = encaixar(ultimoLead + TOQUE2_APOS_LEAD_MS, limite, agora)
  if (em2 !== null && em2 > agora + 30 * 60_000) return { toque: 2, em: em2 }
  return { toque: 3, em: Math.max(ultimoLead + JANELA_META_MS, agora + 60_000) }
}

export function dentroDoHorario(ms: number): boolean {
  const h = horaBRT(ms)
  return h >= INICIO_H && h < FIM_H
}
