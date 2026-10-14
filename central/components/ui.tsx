'use client'

import type { CSSProperties, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export function PageIntro({ eyebrow, title, accent, description, action }: { eyebrow: string; title: string; accent?: string; description: string; action?: ReactNode }) {
  return (
    <header className="intro">
      <div style={{ maxWidth: 760 }}>
        <div className="eyebrow cyan">{eyebrow}</div>
        <h1>{title} {accent && <span className="accent">{accent}</span>}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  )
}

export function SectionTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="sec-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function Ic({ icon: Icon, color, size = 15 }: { icon: LucideIcon; color: string; size?: number }) {
  return <span className="ic" style={{ color, borderColor: `${color}44`, background: `${color}14` }}><Icon size={size} strokeWidth={2} /></span>
}

export function Metric({ icon, label, value, hint, color = '#06b6d4', featured = false, carregando = false }: { icon: LucideIcon; label: string; value: string; hint?: string; color?: string; featured?: boolean; carregando?: boolean }) {
  return (
    <div className={`metric ${featured ? 'featured' : ''}`}>
      <div className="row between top">
        <Ic icon={icon} color={color} />
        {featured && <span className="eyebrow ok" style={{ fontSize: 8.5 }}>destaque</span>}
      </div>
      {carregando ? <div className="skel" style={{ height: 28, width: '55%', marginTop: 18 }} /> : <div className="valor">{value}</div>}
      <div className="rotulo">{label}</div>
      {hint && <div className="dica">{hint}</div>}
    </div>
  )
}

export interface FocusItem<T extends string> { id: T; label: string; description: string; icon: LucideIcon }

/** Uma leitura por vez. A aba fica na URL (?aba=), então o link direto funciona. */
export function useAba<T extends string>(ids: readonly T[], padrao: T, param = 'aba'): [T, (v: T) => void] {
  const sp = useSearchParams()
  const router = useRouter()
  const path = usePathname()
  const atual = sp.get(param) as T | null
  const valor = atual && ids.includes(atual) ? atual : padrao
  const mudar = (v: T) => {
    const q = new URLSearchParams(sp.toString())
    q.set(param, v)
    router.replace(`${path}?${q.toString()}`, { scroll: false })
  }
  return [valor, mudar]
}

export function FocusNav<T extends string>({ items, value, onChange, label = 'Escolha o que ver' }: { items: FocusItem<T>[]; value: T; onChange: (v: T) => void; label?: string }) {
  return (
    <nav className="focus-nav" aria-label={label} style={{ '--cols': items.length } as CSSProperties}>
      {items.map(it => {
        const Icon = it.icon
        return (
          <button key={it.id} type="button" onClick={() => onChange(it.id)} className={it.id === value ? 'active' : ''} aria-current={it.id === value ? 'page' : undefined}>
            <span className="fi"><Icon size={15} /></span>
            <span style={{ minWidth: 0 }}>
              <span className="fl">{it.label}</span>
              <span className="fd">{it.description}</span>
            </span>
          </button>
        )
      })}
    </nav>
  )
}

export function Vazio({ icon: Icon, titulo, texto, children }: { icon: LucideIcon; titulo: string; texto: string; children?: ReactNode }) {
  return (
    <div className="vazio">
      <Ic icon={Icon} color="#8a8f98" />
      <h3>{titulo}</h3>
      <p>{texto}</p>
      {children}
    </div>
  )
}

export function Esqueleto({ linhas = 3, altura = 18 }: { linhas?: number; altura?: number }) {
  return <div className="stack-sm">{Array.from({ length: linhas }, (_, i) => <div key={i} className="skel" style={{ height: altura, width: `${92 - i * 14}%` }} />)}</div>
}

export function ErroFonte({ fonte, erro, onTentar }: { fonte: string; erro: string; onTentar?: () => void }) {
  return (
    <div className="panel pad-sm row" style={{ borderColor: 'color-mix(in srgb, var(--warning) 40%, transparent)' }}>
      <AlertTriangle size={16} className="warn" />
      <div className="grow small"><b className="ink">{fonte} não respondeu.</b> <span className="muted">Os números dessa parte ficam em branco em vez de aparecerem errados. ({erro})</span></div>
      {onTentar && <button className="btn" onClick={onTentar}><RefreshCw size={13} /> Tentar de novo</button>}
    </div>
  )
}

export function Atualizar({ onClick, carregando, em }: { onClick: () => void; carregando: boolean; em?: string | null }) {
  return (
    <div className="row no-print">
      {em && <span className="tiny faint mono">lido {new Date(em).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}</span>}
      <button className="btn" onClick={onClick} disabled={carregando} aria-label="Atualizar">
        <RefreshCw size={13} style={carregando ? { animation: 'spin 1s linear infinite' } : undefined} /> Atualizar
      </button>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}

export function Barra({ valor, max, cor = 'cyan' }: { valor: number; max: number; cor?: 'cyan' | 'ok' | 'purple' | 'faint' }) {
  return <div className="bar"><i className={cor === 'faint' ? '' : cor} style={{ width: `${max ? Math.max(2, Math.min(100, (valor / max) * 100)) : 0}%` }} /></div>
}
