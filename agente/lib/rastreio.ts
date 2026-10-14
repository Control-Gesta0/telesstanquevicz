import crypto from 'crypto'
import { CRM_MAP } from './crm-map'
import { logExec } from './execlog'
import { updateLeadFields, type KommoFieldValue } from './kommo'
import { k, redis } from './redis'

/**
 * Rastreador de origem e campanha. Puro: códigos, link do WhatsApp, leitura e limpeza do texto.
 * Runtime: guarda o clique (Redis, 7 dias, uso único) e grava a origem no lead na 1ª mensagem.
 */

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sem O/0/I/1: o lead não confunde ao digitar
export const novoCodigo = () => Array.from(crypto.randomBytes(4), b => ALFABETO[b % ALFABETO.length]).join('')

export interface Origem { slug?: string; deOnde: string; utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_content?: string; utm_term?: string; fbclid?: string; gclid?: string; referrer?: string }

/** Slug + parâmetros da URL (o anúncio manda utm_*, fbclid, gclid) → origem. Parâmetro da URL vence o padrão do slug. */
export function origemDoLink(slug: string, query: Record<string, unknown>): Origem | null {
  const base = CRM_MAP.rastreio.links[slug]
  if (!base) return null
  const q = (nome: string) => { const v = query[nome]; const s = Array.isArray(v) ? v[0] : v; return typeof s === 'string' && s.trim() ? s.trim().slice(0, 200) : undefined }
  return {
    slug, deOnde: base.deOnde,
    utm_source: q('utm_source') || base.utm_source, utm_medium: q('utm_medium') || base.utm_medium, utm_campaign: q('utm_campaign') || base.utm_campaign,
    utm_content: q('utm_content'), utm_term: q('utm_term'), fbclid: q('fbclid'), gclid: q('gclid'), referrer: q('ref_url'),
  }
}

export function linkWhatsapp(numero: string, texto: string, codigo: string): string {
  return `https://wa.me/${numero.replace(/\D/g, '')}?text=${encodeURIComponent(`${texto} (cód. ${codigo})`)}`
}

const RE_COD = /\(\s*c[oó]d\.?\s*([A-Z2-9]{4})\s*\)/i
const RE_REF = /\(\s*ref\.?\s*([A-Z0-9]{3,8})\s*\)/i

/** Código encontrado na mensagem e o texto sem ele (é isso que a IA vê). */
export function lerMarca(texto: string): { tipo: 'cod' | 'ref' | null; codigo: string; limpo: string } {
  const c = texto.match(RE_COD)
  if (c) return { tipo: 'cod', codigo: c[1].toUpperCase(), limpo: texto.replace(RE_COD, '').replace(/\s{2,}/g, ' ').trim() }
  const r = texto.match(RE_REF)
  if (r && CRM_MAP.rastreio.refs[r[1].toUpperCase()]) return { tipo: 'ref', codigo: r[1].toUpperCase(), limpo: texto.replace(RE_REF, '').replace(/\s{2,}/g, ' ').trim() }
  return { tipo: null, codigo: '', limpo: texto }
}

/** Origem → campos do lead (tracking_data por texto, De onde por enum_id). */
export function camposDaOrigem(o: Origem): KommoFieldValue[] {
  const cfg = CRM_MAP.rastreio
  const out: KommoFieldValue[] = []
  for (const [nome, id] of Object.entries(cfg.campos)) {
    const v = (o as unknown as Record<string, string | undefined>)[nome]
    if (v) out.push({ field_id: id, values: [{ value: v }] })
  }
  const en = cfg.deOnde.enums[o.deOnde]
  if (en) out.push({ field_id: cfg.deOnde.fieldId, values: [{ enum_id: en }] })
  return out
}

// ---------- Runtime ----------

export async function registrarClique(o: Origem): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const codigo = novoCodigo()
    if ((await redis.set(k('rastro', codigo), o, { nx: true, ex: CRM_MAP.rastreio.validadeCodigoDias * 86400 })) === 'OK') {
      const dia = new Date().toISOString().slice(0, 10)
      await redis.incr(k('rastro-cliques', dia, o.slug || '?'))
      await redis.expire(k('rastro-cliques', dia, o.slug || '?'), 120 * 86400)
      return codigo
    }
  }
  throw new Error('não consegui gerar código único')
}

/** Lê o código da 1ª mensagem, grava a origem no lead e devolve o texto limpo. Nunca derruba o inbound. */
export async function aplicarRastreio(leadId: number, texto: string): Promise<string> {
  const m = lerMarca(texto)
  if (!m.tipo) return texto
  try {
    let o: Origem | null = null
    if (m.tipo === 'cod') {
      o = await redis.get<Origem>(k('rastro', m.codigo))
      if (o) await redis.del(k('rastro', m.codigo)) // uso único: código repassado adiante não atribui duas vezes
    } else {
      const r = CRM_MAP.rastreio.refs[m.codigo]
      o = { slug: `ref-${m.codigo}`, ...r }
    }
    if (!o) {
      await logExec({ tipo: 'automacao', leadId, detalhe: `rastreio: código ${m.codigo} não encontrado (vencido ou já usado)` })
      return m.limpo
    }
    await updateLeadFields(leadId, camposDaOrigem(o))
    const dia = new Date().toISOString().slice(0, 10)
    await redis.incr(k('rastro-leads', dia, o.slug || '?'))
    await redis.expire(k('rastro-leads', dia, o.slug || '?'), 120 * 86400)
    await logExec({ tipo: 'automacao', leadId, detalhe: `rastreio: ${o.slug} · De onde ${o.deOnde || '—'} · ${o.utm_source}/${o.utm_medium}/${o.utm_campaign}${o.fbclid ? ' · fbclid' : ''}${o.gclid ? ' · gclid' : ''}` })
  } catch (e) {
    console.error('[rastreio] falhou:', e)
  }
  return m.limpo
}

/** Cliques e leads por link nos últimos `dias` (para a Central e para conferir campanha). */
export async function resumoRastreio(dias = 30): Promise<Record<string, { cliques: number; leads: number }>> {
  const out: Record<string, { cliques: number; leads: number }> = {}
  const slugs = [...Object.keys(CRM_MAP.rastreio.links), ...Object.keys(CRM_MAP.rastreio.refs).map(r => `ref-${r}`)]
  for (let d = 0; d < dias; d++) {
    const dia = new Date(Date.now() - d * 86400_000).toISOString().slice(0, 10)
    for (const s of slugs) {
      const [c, l] = await Promise.all([redis.get<number>(k('rastro-cliques', dia, s)), redis.get<number>(k('rastro-leads', dia, s))])
      if (c || l) { out[s] ||= { cliques: 0, leads: 0 }; out[s].cliques += Number(c || 0); out[s].leads += Number(l || 0) }
    }
  }
  return out
}
