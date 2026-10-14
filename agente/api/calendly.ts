import type { VercelRequest, VercelResponse } from '@vercel/node'
import { waitUntil } from '@vercel/functions'
import { assinaturaValida, sincronizarConvidado } from '../lib/calendly-sync'
import { logExec } from '../lib/execlog'

/** Webhook do Calendly (invitee.created / invitee.canceled), assinado com CALENDLY_WEBHOOK_KEY. */
export const config = { api: { bodyParser: false } }

async function rawBody(req: VercelRequest): Promise<string> {
  if (typeof req.body === 'string') return req.body
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(typeof c === 'string' ? Buffer.from(c) : c)
  return Buffer.concat(chunks).toString('utf-8')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true, service: 'calendly' })
  const body = await rawBody(req)
  if (!assinaturaValida(String(req.headers['calendly-webhook-signature'] || ''), body, process.env.CALENDLY_WEBHOOK_KEY || '')) return res.status(401).json({ error: 'assinatura inválida' })
  let msg: { event?: string; payload?: any }
  try { msg = JSON.parse(body) } catch { return res.status(400).json({ error: 'json inválido' }) }
  if (msg.event !== 'invitee.created' && msg.event !== 'invitee.canceled') return res.status(200).json({ ok: true, ignorado: msg.event })
  waitUntil(sincronizarConvidado(msg.event, msg.payload || {}).catch(async e => {
    console.error('[calendly]', e)
    await logExec({ tipo: 'erro', leadId: 0, detalhe: `calendly ${msg.event}: ${(e instanceof Error ? e.message : String(e)).slice(0, 250)}` })
  }))
  return res.status(200).json({ ok: true })
}
