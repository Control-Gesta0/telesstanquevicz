'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Fonte } from './tipos'

/**
 * Busca uma seção da Central. Enquanto não chega: `carregando` (a tela mostra esqueleto).
 * Erro de rede ou de fonte vira `erro` explícito, nunca dado zerado.
 */
export function useSecao<T>(secao: string, intervaloMs = 0) {
  const [dados, setDados] = useState<T | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const vivo = useRef(true)

  const carregar = useCallback(async (fresco = false) => {
    setCarregando(true)
    try {
      const r = await fetch(`/api/dados?secao=${secao}${fresco ? '&fresco=1' : ''}`, { cache: 'no-store' })
      if (r.status === 401) { window.location.href = '/login'; return }
      const j = await r.json()
      if (!vivo.current) return
      if (secao === 'visao') { setDados(j as T); setErro(r.ok ? null : j.erro || `erro ${r.status}`) }
      else if (j.ok) { setDados(j.dados as T); setErro(null) }
      else setErro(j.erro || `erro ${r.status}`)
    } catch (e) {
      if (vivo.current) setErro(e instanceof Error ? e.message : 'sem conexão')
    } finally {
      if (vivo.current) setCarregando(false)
    }
  }, [secao])

  useEffect(() => {
    vivo.current = true
    carregar()
    const t = intervaloMs ? setInterval(() => carregar(), intervaloMs) : null
    return () => { vivo.current = false; if (t) clearInterval(t) }
  }, [carregar, intervaloMs])

  return { dados, erro, carregando, atualizar: carregar }
}

export const dadosDe = <T,>(f: Fonte<T> | undefined | null): T | null => (f && f.ok ? f.dados : null)

export async function acao<T>(corpo: Record<string, unknown>): Promise<T> {
  const r = await fetch('/api/acao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
  if (r.status === 401) { window.location.href = '/login'; throw new Error('sessão expirada') }
  const j = await r.json()
  if (!r.ok || j.ok === false) throw new Error(j.erro || j.error || `erro ${r.status}`)
  return j as T
}
