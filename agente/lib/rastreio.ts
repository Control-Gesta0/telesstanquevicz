import crypto from 'crypto'
import { CRM_MAP } from './crm-map'
import { logExec } from './execlog'
import { getHistory } from './history'
import { addLeadTags, kommoGet, updateLeadFields, updateLeadStatus, type KommoFieldValue, type KommoLead } from './kommo'
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
/** Origem pela frase pronta do anúncio (sem código). Puro: testado. A campanha sai do assunto da frase. */
export function etiquetasPorFrase(texto: string): string[] {
  const f = CRM_MAP.rastreio.frases.find(x => x.re.test(texto || ''))
  const o = origemPorFrase(texto)
  if (!f || !o || !f.etiqueta) return []
  const assunto = o.utm_campaign ? CRM_MAP.rastreio.etiquetasAssunto[o.utm_campaign] : ''
  return [f.etiqueta, ...(assunto ? [assunto] : [])]
}

export function origemPorFrase(texto: string): Origem | null {
  const f = CRM_MAP.rastreio.frases.find(x => x.re.test(texto || ''))
  if (!f) return null
  const campanha = /busca e apreens/i.test(texto) ? 'dba' : /financiamento|ve[ií]culo/i.test(texto) ? 'rcv' : /juros|d[ií]vida|empr[eé]stimo|cart[aã]o/i.test(texto) ? 'rcpcc' : ''
  return { slug: `frase-${f.deOnde.toLowerCase()}${campanha ? `-${campanha}` : ''}`, deOnde: f.deOnde, utm_source: f.utm_source, utm_medium: f.utm_medium, ...(campanha ? { utm_campaign: campanha } : {}) }
}

/** A mensagem é só "quero" (com pontuação ou emoji)? Puro: testado. */
export function ehQueroDaLive(texto: string): boolean {
  return CRM_MAP.rastreio.live.re.test((texto || '').trim())
}

/** Etapas de onde o lead da live pode ir para Social Seller: Leads de entrada e Em atendimento (o gatilho do Kommo
 *  "lead escreveu → Em atendimento" pode chegar antes). Card em outra etapa fica onde está. */
const ANTES_DO_SOCIAL = [72104583, 72186399]

/** Lead da live: SDR › Social Seller + etiquetas. */
async function marcarLive(leadId: number, etiquetas: string[], lead?: KommoLead): Promise<void> {
  const L = CRM_MAP.rastreio.live
  await addLeadTags(leadId, [...new Set(etiquetas)])
  const atual = lead || await kommoGet<KommoLead>(`/api/v4/leads/${leadId}`)
  if (atual.pipeline_id === L.etapa.pipelineId && ANTES_DO_SOCIAL.includes(atual.status_id)) {
    await updateLeadStatus(leadId, L.etapa.statusId, L.etapa.pipelineId)
  }
}

/**
 * Mensagens do chat do lead (eventos do Kommo): canal da 1ª recebida e se alguém já escreveu para ele.
 * O Kommo não devolve evento de chat filtrando por lead: lê a janela desde a criação do lead e filtra aqui.
 */
export async function chatDoLead(leadId: number, desdeSeg: number): Promise<{ canal: string; recebidas: number; enviadas: number }> {
  type Ev = { type: string; entity_id: number; value_after?: Array<{ message?: { origin?: string } }> }
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const evs: Ev[] = []
    for (let page = 1; page <= 3; page++) {
      const d = await kommoGet<{ _embedded?: { events?: Ev[] } }>(
        `/api/v4/events?filter%5Btype%5D=incoming_chat_message,outgoing_chat_message&filter%5Bcreated_at%5D%5Bfrom%5D=${desdeSeg - 60}&limit=100&page=${page}`).catch(() => null)
      const lote = d?._embedded?.events || []
      evs.push(...lote.filter(e => e.entity_id === leadId))
      if (lote.length < 100) break
    }
    const recebidas = evs.filter(e => e.type === 'incoming_chat_message')
    if (recebidas.length) return { canal: recebidas[recebidas.length - 1].value_after?.[0]?.message?.origin || '', recebidas: recebidas.length, enviadas: evs.length - recebidas.length }
    await new Promise(r => setTimeout(r, 1500))
  }
  return { canal: '', recebidas: 0, enviadas: 0 }
}

/**
 * "QUERO" da live (pedido de 29/10/2026). Vale só para lead criado há pouco, ainda em Leads de entrada e sem
 * conversa guardada: "quero" no meio de um atendimento é resposta comum. Devolve o texto que a Stela lê, ou null.
 */
async function queroDaLive(leadId: number, texto: string): Promise<string | null> {
  if (!ehQueroDaLive(texto)) return null
  const L = CRM_MAP.rastreio.live
  const lead = await kommoGet<KommoLead>(`/api/v4/leads/${leadId}`)
  const novo = Date.now() - (lead.created_at || 0) * 1000 <= L.leadNovoMin * 60_000
  const naEntrada = lead.pipeline_id === L.etapa.pipelineId && [...ANTES_DO_SOCIAL, L.etapa.statusId].includes(lead.status_id)
  if (!novo || !naEntrada || (await getHistory(leadId)).length) return null
  // Primeira mensagem da conversa: ninguém escreveu antes para ele ("quer agendar?" → "quero" não é live)
  const chat = await chatDoLead(leadId, lead.created_at || 0)
  if (chat.enviadas > 0 || chat.recebidas > 1) return null
  if ((await redis.set(k('rastro-live', leadId), '1', { nx: true, ex: 30 * 86400 })) !== 'OK') return L.textoParaStela
  const canal = chat.canal
  const etiquetaCanal = L.etiquetaCanal[canal]
  await marcarLive(leadId, [L.etiqueta, ...(etiquetaCanal ? [etiquetaCanal] : [])], lead)
  const temOrigem = (lead.custom_fields_values || []).some(f => f.field_id === CRM_MAP.rastreio.deOnde.fieldId && f.values?.length)
  const o: Origem = { slug: `live-${etiquetaCanal ? etiquetaCanal.toLowerCase() : 'direct'}`, deOnde: canal === 'instagram_business' ? 'Instagram' : '', utm_source: canal === 'instagram_business' ? 'instagram' : canal || 'direct', utm_medium: 'live', utm_campaign: 'rcpcc' }
  if (!temOrigem) await updateLeadFields(leadId, camposDaOrigem(o))
  const dia = new Date().toISOString().slice(0, 10)
  await redis.incr(k('rastro-leads', dia, o.slug || '?'))
  await redis.expire(k('rastro-leads', dia, o.slug || '?'), 120 * 86400)
  await logExec({ tipo: 'automacao', leadId, detalhe: `live: QUERO${canal ? ` pelo ${canal}` : ''} → ${L.etapa.name} · etiquetas ${[L.etiqueta, etiquetaCanal].filter(Boolean).join(' + ')}` })
  return L.textoParaStela
}

export async function aplicarRastreio(leadId: number, texto: string): Promise<string> {
  const m = lerMarca(texto)
  if (!m.tipo) {
    try {
      const live = await queroDaLive(leadId, texto)
      if (live) return live
    } catch (e) {
      console.error('[rastreio] live falhou:', e)
    }
    const o = origemPorFrase(texto)
    // Uma vez por lead, e só se "De onde" ainda estiver vazio (não sobrescreve origem melhor)
    if (o && (await redis.set(k('rastro-frase', leadId), '1', { nx: true, ex: 30 * 86400 })) === 'OK') {
      try {
        const etiquetas = etiquetasPorFrase(texto)
        if (etiquetas.length) await addLeadTags(leadId, etiquetas)
        const lead = await kommoGet<KommoLead>(`/api/v4/leads/${leadId}`)
        const temOrigem = (lead.custom_fields_values || []).some(f => f.field_id === CRM_MAP.rastreio.deOnde.fieldId && f.values?.length)
        if (!temOrigem) {
          await updateLeadFields(leadId, camposDaOrigem(o))
          const dia = new Date().toISOString().slice(0, 10)
          await redis.incr(k('rastro-leads', dia, o.slug || '?'))
          await redis.expire(k('rastro-leads', dia, o.slug || '?'), 120 * 86400)
          await logExec({ tipo: 'automacao', leadId, detalhe: `rastreio pela frase do anúncio${etiquetas.length ? ` · etiquetas ${etiquetas.join(' + ')}` : ''}: De onde ${o.deOnde} · ${o.utm_source}/${o.utm_medium}/${o.utm_campaign || '—'}` })
        }
      } catch (e) {
        console.error('[rastreio] frase falhou:', e)
      }
    }
    return texto
  }
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
    const link = o.slug ? CRM_MAP.rastreio.links[o.slug] : undefined
    if (link?.live) await marcarLive(leadId, link.etiquetas || [CRM_MAP.rastreio.live.etiqueta]).catch(e => console.error('[rastreio] live (link) falhou:', e))
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
  const pares: Array<{ slug: string; tipo: 'cliques' | 'leads'; chave: string }> = []
  for (let d = 0; d < dias; d++) {
    const dia = new Date(Date.now() - d * 86400_000).toISOString().slice(0, 10)
    for (const s of slugs) for (const tipo of ['cliques', 'leads'] as const) pares.push({ slug: s, tipo, chave: k(`rastro-${tipo}`, dia, s) })
  }
  // uma ida ao Redis por lote (eram 2 por dia por link: 55 s para 30 dias)
  for (let i = 0; i < pares.length; i += 200) {
    const lote = pares.slice(i, i + 200)
    const vals = await redis.mget<Array<number | null>>(...lote.map(p => p.chave))
    lote.forEach((p, j) => {
      const n = Number(vals[j] || 0)
      if (!n) return
      out[p.slug] ||= { cliques: 0, leads: 0 }
      out[p.slug][p.tipo] += n
    })
  }
  return out
}
