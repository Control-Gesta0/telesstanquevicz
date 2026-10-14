/**
 * Sessão da Central: cookie assinado (HMAC-SHA256) com o perfil e a validade.
 * Web Crypto puro: roda igual no middleware (edge) e nas rotas (node).
 */
export type Perfil = 'dono' | 'agencia'
export const COOKIE = 'central_sessao'
export const HORAS = 12

const enc = new TextEncoder()

function b64url(bytes: Uint8Array): string {
  let s = ''
  bytes.forEach(b => { s += String.fromCharCode(b) })
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function deB64url(s: string): string {
  return atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))
}

async function hmac(dados: string, segredo: string): Promise<string> {
  const chave = await crypto.subtle.importKey('raw', enc.encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', chave, enc.encode(dados))))
}

function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

export async function assinar(perfil: Perfil, segredo: string, agoraMs = Date.now()): Promise<string> {
  const corpo = b64url(enc.encode(JSON.stringify({ p: perfil, e: agoraMs + HORAS * 3600_000 })))
  return `${corpo}.${await hmac(corpo, segredo)}`
}

export async function verificar(token: string | undefined, segredo: string, agoraMs = Date.now()): Promise<Perfil | null> {
  if (!token || !segredo) return null
  const [corpo, sig] = token.split('.')
  if (!corpo || !sig || !iguais(sig, await hmac(corpo, segredo))) return null
  try {
    const { p, e } = JSON.parse(deB64url(corpo)) as { p: string; e: number }
    if (typeof e !== 'number' || e < agoraMs) return null
    return p === 'agencia' ? 'agencia' : p === 'dono' ? 'dono' : null
  } catch { return null }
}
