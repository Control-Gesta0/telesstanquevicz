import { NextResponse, type NextRequest } from 'next/server'
import { chamarAgente } from '@/lib/servidor'
import { assinar, COOKIE, HORAS, type Perfil } from '@/lib/sessao'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { senha } = await req.json().catch(() => ({ senha: '' })) as { senha?: string }
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'desconhecido'
  // o perfil aqui é só o canal; quem decide o perfil é a senha conferida no agente
  const r = await chamarAgente('dono', { corpo: { acao: 'login', senha: String(senha || '').slice(0, 200), ip } })
  const j = r.json as { ok?: boolean; perfil?: Perfil; motivo?: string }
  if (r.status !== 200) return NextResponse.json({ ok: false, erro: 'A Central não conseguiu conferir a senha agora. Tente de novo em instantes.' }, { status: 503 })
  if (!j.ok || !j.perfil) {
    return NextResponse.json({ ok: false, erro: j.motivo === 'bloqueado' ? 'Muitas tentativas. Espere 15 minutos e tente de novo.' : 'Senha incorreta.' }, { status: j.motivo === 'bloqueado' ? 429 : 401 })
  }
  const res = NextResponse.json({ ok: true, perfil: j.perfil })
  res.cookies.set(COOKIE, await assinar(j.perfil, process.env.SESSAO_SECRET || ''), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: HORAS * 3600 })
  return res
}
