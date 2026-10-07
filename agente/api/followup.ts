import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Receiver } from '@upstash/qstash'
import { logExec } from '../lib/execlog'
import { executarFollowup } from '../lib/followup'

/**
 * Callback do QStash (hora marcada de cada toque). Só aceita mensagem assinada
 * pelo QStash. Responde 200 também quando o toque ficou obsoleto: retry não
 * conserta "o lead já respondeu".
 */

export const config = { api: { bodyParser: false } }

async function rawBody(req: VercelRequest): Promise<string> {
  if (typeof req.body === 'string') return req.body
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(typeof c === 'string' ? Buffer.from(c) : c)
  return Buffer.concat(chunks).toString('utf-8')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true, service: 'followup' })
  const body = await rawBody(req)
  const receiver = new Receiver({ currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || '', nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '' })
  const valido = await receiver.verify({ signature: String(req.headers['upstash-signature'] || ''), body }).catch(() => false)
  if (!valido) return res.status(401).json({ error: 'assinatura inválida' })

  let msg: { leadId?: number; toque?: number; token?: string }
  try { msg = JSON.parse(body) } catch { return res.status(400).json({ error: 'json inválido' }) }
  const leadId = Number(msg.leadId)
  const toque = Number(msg.toque) as 1 | 2 | 3
  if (!leadId || ![1, 2, 3].includes(toque) || !msg.token) return res.status(400).json({ error: 'payload incompleto' })

  try {
    const resultado = await executarFollowup(leadId, toque, msg.token)
    console.log(`[followup] lead ${leadId} toque ${toque}: ${resultado}`)
    return res.status(200).json({ ok: true, resultado })
  } catch (e) {
    const detalhe = (e instanceof Error ? e.message : String(e)).slice(0, 300)
    console.error(`[followup] erro lead ${leadId}:`, e)
    await logExec({ tipo: 'erro', leadId, detalhe: `followup toque ${toque}: ${detalhe}` })
    return res.status(500).json({ ok: false })
  }
}
