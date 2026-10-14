import type { VercelRequest, VercelResponse } from '@vercel/node'
import { waitUntil } from '@vercel/functions'
import crypto from 'crypto'
import { CONFIG } from '../lib/config'
import { decidir, executar, parseStatusLead } from '../lib/crm-eventos'
import { logExec } from '../lib/execlog'

/**
 * Webhook "status_lead" do Kommo → automações de funil (lib/crm-eventos.ts).
 * Recebe TODA mudança de etapa da conta: filtra rápido e responde 200 na hora.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') return res.status(200).json({ ok: true, service: 'crm-eventos' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })
  const provided = crypto.createHash('sha256').update(String(req.query.secret || '')).digest()
  if (!crypto.timingSafeEqual(provided, crypto.createHash('sha256').update(CONFIG.webhookSecret).digest())) return res.status(401).json({ error: 'unauthorized' })

  const { accountId, mudancas } = parseStatusLead(req.body)
  if (accountId && accountId !== CONFIG.kommoAccountId) return res.status(200).json({ ok: false, reason: 'outra conta' })
  const relevantes = mudancas.filter(m => decidir(m))
  if (relevantes.length) {
    waitUntil(Promise.all(relevantes.map(m => executar(m).catch(async e => {
      const detalhe = (e instanceof Error ? e.message : String(e)).slice(0, 300)
      console.error(`[crm-eventos] lead ${m.leadId}:`, e)
      await logExec({ tipo: 'erro', leadId: m.leadId, detalhe: `automação: ${detalhe}` })
    }))))
  }
  return res.status(200).json({ ok: true, recebidas: mudancas.length, acionadas: relevantes.length })
}
