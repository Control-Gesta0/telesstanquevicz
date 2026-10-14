import type { VercelRequest, VercelResponse } from '@vercel/node'
import { CONFIG } from '../lib/config'
import { CRM_MAP } from '../lib/crm-map'
import { linkWhatsapp, origemDoLink, registrarClique, resumoRastreio } from '../lib/rastreio'

/**
 * Link rastreado: /r/<slug>?utm_campaign=...&fbclid=... → 302 para o WhatsApp com a frase + código.
 * GET /api/r?resumo=1&secret= → cliques e leads por link (30 dias).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.query.resumo) {
    if (String(req.query.secret || '') !== CONFIG.webhookSecret) return res.status(401).json({ error: 'unauthorized' })
    return res.status(200).json({ ok: true, links: Object.keys(CRM_MAP.rastreio.links).map(s => `/r/${s}`), refs: Object.keys(CRM_MAP.rastreio.refs).map(r => `(ref. ${r})`), ultimos30dias: await resumoRastreio(30) })
  }
  const slug = String(req.query.l || '').toLowerCase()
  const numero = process.env.WHATSAPP_NUMERO || ''
  const o = origemDoLink(slug, req.query)
  if (!o) return res.status(404).send('Link não encontrado')
  if (!numero) return res.status(503).send('WhatsApp do escritório não configurado')
  let codigo: string
  try { codigo = await registrarClique(o) } catch {
    // Redis fora: manda para o WhatsApp mesmo assim (perde a origem, não perde o lead)
    return res.redirect(302, `https://wa.me/${numero.replace(/\D/g, '')}?text=${encodeURIComponent(CRM_MAP.rastreio.links[slug].texto)}`)
  }
  res.setHeader('Cache-Control', 'no-store')
  return res.redirect(302, linkWhatsapp(numero, CRM_MAP.rastreio.links[slug].texto, codigo))
}
