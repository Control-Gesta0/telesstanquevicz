import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Receiver } from '@upstash/qstash'
import { CONFIG } from '../lib/config'
import { logExec } from '../lib/execlog'
import { previa, rodarLembretes } from '../lib/lembretes'

/**
 * Relógio dos lembretes de reunião. POST assinado pelo QStash (agenda a cada 15 min) executa.
 * GET ?secret= só mostra o que venceria agora, sem enviar nada (diagnóstico).
 */
export const config = { api: { bodyParser: false } }

async function rawBody(req: VercelRequest): Promise<string> {
  if (typeof req.body === 'string') return req.body
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(typeof c === 'string' ? Buffer.from(c) : c)
  return Buffer.concat(chunks).toString('utf-8')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    if (String(req.query.secret || '') !== CONFIG.webhookSecret) return res.status(401).json({ error: 'unauthorized' })
    return res.status(200).json({ ok: true, modo: process.env.LEMBRETES_MODO === 'ativo' ? 'ativo' : 'sombra', nota: 'GET não envia nada', ...(await previa()) })
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })
  const body = await rawBody(req)
  const receiver = new Receiver({ currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || '', nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '' })
  const valido = await receiver.verify({ signature: String(req.headers['upstash-signature'] || ''), body }).catch(() => false)
  if (!valido) return res.status(401).json({ error: 'assinatura inválida' })
  try {
    const r = await rodarLembretes()
    return res.status(200).json({ ok: true, ...r })
  } catch (e) {
    const detalhe = (e instanceof Error ? e.message : String(e)).slice(0, 300)
    await logExec({ tipo: 'erro', leadId: 0, detalhe: `lembretes: ${detalhe}` })
    return res.status(500).json({ ok: false })
  }
}
