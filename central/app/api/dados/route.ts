import { NextResponse, type NextRequest } from 'next/server'
import { chamarAgente, perfilAtual } from '@/lib/servidor'

export const dynamic = 'force-dynamic'

const SECOES = new Set(['visao', 'funil', 'resultados', 'origem', 'agenda', 'diario', 'retomada', 'regras', 'ensino', 'saude'])

export async function GET(req: NextRequest) {
  const perfil = await perfilAtual()
  if (!perfil) return NextResponse.json({ ok: false, erro: 'sessão expirada' }, { status: 401 })
  const secao = req.nextUrl.searchParams.get('secao') || 'visao'
  if (!SECOES.has(secao)) return NextResponse.json({ ok: false, erro: 'seção desconhecida' }, { status: 400 })
  const q = new URLSearchParams({ secao })
  if (req.nextUrl.searchParams.get('fresco') === '1') q.set('fresco', '1')
  const r = await chamarAgente(perfil, { query: q.toString() })
  return NextResponse.json(r.json, { status: r.status, headers: { 'Cache-Control': 'no-store' } })
}
