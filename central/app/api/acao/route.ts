import { NextResponse, type NextRequest } from 'next/server'
import { chamarAgente, perfilAtual } from '@/lib/servidor'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ACOES = new Set(['ensino', 'ensino-status', 'laboratorio'])

export async function POST(req: NextRequest) {
  const perfil = await perfilAtual()
  if (!perfil) return NextResponse.json({ ok: false, erro: 'sessão expirada' }, { status: 401 })
  const origem = req.headers.get('origin')
  if (origem && new URL(origem).host !== req.headers.get('host')) return NextResponse.json({ ok: false, erro: 'origem inválida' }, { status: 403 })
  const corpo = await req.json().catch(() => ({})) as Record<string, unknown>
  if (!ACOES.has(String(corpo.acao))) return NextResponse.json({ ok: false, erro: 'ação desconhecida' }, { status: 400 })
  if (corpo.acao === 'ensino-status' && perfil !== 'agencia') return NextResponse.json({ ok: false, erro: 'só a equipe técnica muda o status' }, { status: 403 })
  const r = await chamarAgente(perfil, { corpo })
  return NextResponse.json(r.json, { status: r.status })
}
