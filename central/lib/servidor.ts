import 'server-only'
import { cookies } from 'next/headers'
import { COOKIE, verificar, type Perfil } from './sessao'

/** Toda rota confere a sessão de novo (o middleware é a primeira porta, não a única). */
export async function perfilAtual(): Promise<Perfil | null> {
  return verificar(cookies().get(COOKIE)?.value, process.env.SESSAO_SECRET || '')
}

export async function chamarAgente(perfil: Perfil, opts: { query?: string; corpo?: unknown }): Promise<{ status: number; json: unknown }> {
  const base = (process.env.AGENT_URL || '').replace(/\/+$/, '')
  if (!base || !process.env.CENTRAL_SECRET) return { status: 503, json: { ok: false, erro: 'Central sem AGENT_URL ou CENTRAL_SECRET' } }
  const r = await fetch(`${base}/api/central${opts.query ? `?${opts.query}` : ''}`, {
    method: opts.corpo ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${process.env.CENTRAL_SECRET}`, 'x-central-perfil': perfil, ...(opts.corpo ? { 'Content-Type': 'application/json' } : {}) },
    body: opts.corpo ? JSON.stringify(opts.corpo) : undefined,
    cache: 'no-store',
  })
  const texto = await r.text()
  try { return { status: r.status, json: JSON.parse(texto) } } catch { return { status: 502, json: { ok: false, erro: `agente respondeu ${r.status}` } } }
}
