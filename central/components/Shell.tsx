'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, BarChart3, GraduationCap, LayoutDashboard, LogOut, Moon, Settings2, Sun } from 'lucide-react'
import { CLIENTE } from '@/lib/cliente'
import { montarBriefing } from '@/lib/inteligencia'
import type { Perfil } from '@/lib/sessao'
import type { Visao } from '@/lib/tipos'
import { useSecao } from '@/lib/useDados'
import Pergunte from './Pergunte'

const NAV = [
  { href: '/', label: 'Visão Geral', hint: 'saúde e decisões', Icon: LayoutDashboard },
  { href: '/operacao', label: 'Operação', hint: 'agora, funil e agenda', Icon: Activity },
  { href: '/cerebro', label: 'Ensinar', hint: 'testar e corrigir', Icon: GraduationCap },
  { href: '/resultados', label: 'Resultados', hint: 'valor, origem e custo', Icon: BarChart3 },
  { href: '/configuracoes', label: 'Configurações', hint: 'regras e sistema', Icon: Settings2 },
]

interface Ctx { perfil: Perfil; visao: Visao | null; erroVisao: string | null; carregandoVisao: boolean; atualizarVisao: (fresco?: boolean) => void }
const CentralCtx = createContext<Ctx | null>(null)

export function useCentral(): Ctx {
  const c = useContext(CentralCtx)
  if (!c) throw new Error('useCentral fora do Shell')
  return c
}

function ToggleTema() {
  const [tema, setTema] = useState<'dark' | 'light' | null>(null)
  useEffect(() => { setTema((document.documentElement.getAttribute('data-theme') as 'dark' | 'light') || 'dark') }, [])
  const trocar = () => {
    const novo = tema === 'light' ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', novo)
    try { localStorage.setItem('tema', novo) } catch { /* modo privado */ }
    setTema(novo)
  }
  return (
    <button className="icon-btn" onClick={trocar} aria-label={tema === 'light' ? 'Usar tema escuro' : 'Usar tema claro'} title="Trocar tema">
      {tema === 'light' ? <Moon size={14} /> : <Sun size={14} />}
    </button>
  )
}

function ativo(path: string, href: string) {
  return href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`)
}

function Status({ visao, carregando }: { visao: Visao | null; carregando: boolean }) {
  const b = montarBriefing(visao, CLIENTE.agente)
  const tipo = !visao || carregando && !visao ? '' : b.estado === 'atencao' ? 'warn' : 'ok'
  const texto = !visao ? 'VERIFICANDO' : b.estado === 'atencao' ? 'PEDE ATENÇÃO' : b.estado === 'quase' ? 'QUASE NO AR' : 'OPERANDO'
  const cor = !visao ? 'var(--muted)' : b.estado === 'atencao' ? 'var(--warning)' : 'var(--success)'
  return (
    <div className={`status-pill ${tipo}`}>
      <div className="row" style={{ gap: 8, color: cor }}>
        <span className={`dot ${visao ? 'pulse' : ''}`} />
        <span className="mono" style={{ fontSize: 9.5, letterSpacing: '.14em' }}>{texto}</span>
      </div>
      <div className="tiny muted" style={{ marginTop: 5 }}>
        {!visao ? 'lendo Kommo, diário e agenda' : b.estado === 'quase' ? `falta ligar o envio da ${CLIENTE.agente}` : b.estado === 'atencao' ? 'abra a Visão Geral' : 'fontes respondendo'}
      </div>
    </div>
  )
}

export default function Shell({ perfil, children }: { perfil: Perfil; children: ReactNode }) {
  const path = usePathname()
  const { dados, erro, carregando, atualizar } = useSecao<Visao>('visao', 120_000)

  return (
    <CentralCtx.Provider value={{ perfil, visao: dados, erroVisao: erro, carregandoVisao: carregando, atualizarVisao: atualizar }}>
      <div className="app">
        <aside className="side">
          <div className="side-head">
            <div>
              <div className="marca">{CLIENTE.nome}<span>.</span></div>
              <div className="eyebrow" style={{ fontSize: 8.5, marginTop: 6 }}>Central de IA</div>
            </div>
            <ToggleTema />
          </div>
          <Status visao={dados} carregando={carregando} />
          <nav className="nav">
            {NAV.map(({ href, label, hint, Icon }) => (
              <Link key={href} href={href} className={ativo(path, href) ? 'active' : ''}>
                <Icon size={16} strokeWidth={2} />
                <span><span className="label">{label}</span><span className="hint">{hint}</span></span>
              </Link>
            ))}
          </nav>
          <div className="side-foot">
            <div className="row between">
              <span className={`chip ${perfil === 'agencia' ? 'purple' : 'cyan'}`}>{perfil === 'agencia' ? 'equipe técnica' : 'escritório'}</span>
              <form action="/api/sair" method="post"><button className="icon-btn" aria-label="Sair" title="Sair"><LogOut size={14} /></button></form>
            </div>
            <div className="mono faint" style={{ fontSize: 9, marginTop: 12, letterSpacing: '.06em' }}>{CLIENTE.versao} · {dados?.versao || '…'}</div>
          </div>
        </aside>

        <div className="topbar">
          <div className="row between" style={{ marginBottom: 10 }}>
            <div className="marca" style={{ fontSize: 14 }}>{CLIENTE.nome}<span>.</span></div>
            <div className="row" style={{ gap: 6 }}>
              <ToggleTema />
              <form action="/api/sair" method="post"><button className="icon-btn" aria-label="Sair"><LogOut size={14} /></button></form>
            </div>
          </div>
          <nav>
            {NAV.map(({ href, label, Icon }) => (
              <Link key={href} href={href} className={ativo(path, href) ? 'active' : ''}><Icon size={13} /> {label}</Link>
            ))}
          </nav>
        </div>

        <main className="main">{children}</main>
        <Pergunte visao={dados} />
      </div>
    </CentralCtx.Provider>
  )
}
