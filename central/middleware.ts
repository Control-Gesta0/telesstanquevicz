import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE, verificar } from '@/lib/sessao'

/** Primeira porta: sem sessão válida, página vai para /login e API leva 401. As rotas conferem de novo. */
export async function middleware(req: NextRequest) {
  const perfil = await verificar(req.cookies.get(COOKIE)?.value, process.env.SESSAO_SECRET || '')
  if (perfil) return NextResponse.next()
  if (req.nextUrl.pathname.startsWith('/api/')) return NextResponse.json({ ok: false, erro: 'sessão expirada' }, { status: 401 })
  const url = new URL('/login', req.url)
  if (req.nextUrl.pathname !== '/') url.searchParams.set('volta', req.nextUrl.pathname + req.nextUrl.search)
  return NextResponse.redirect(url)
}

export const config = { matcher: ['/((?!login|api/login|_next/|favicon|icon|robots.txt).*)'] }
