'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Lock } from 'lucide-react'
import { CLIENTE } from '@/lib/cliente'

function Formulario() {
  const sp = useSearchParams()
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const volta = (() => { const v = sp.get('volta') || '/'; return v.startsWith('/') && !v.startsWith('//') ? v : '/' })()

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnviando(true); setErro('')
    try {
      const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ senha }) })
      const j = await r.json()
      if (j.ok) { window.location.href = volta; return }
      setErro(j.erro || 'Não deu para entrar.')
    } catch { setErro('Sem conexão. Tente de novo.') }
    setEnviando(false)
  }

  return (
    <form onSubmit={entrar} className="panel pad stack-sm" style={{ padding: 28 }}>
      <span className="ic" style={{ color: 'var(--cyan)', borderColor: 'var(--cyan-line)', background: 'var(--cyan-soft)' }}><Lock size={15} /></span>
      <div>
        <div className="eyebrow cyan">Central de IA</div>
        <h1 style={{ fontSize: 24, marginTop: 8 }}>{CLIENTE.nomeCompleto}</h1>
        <p className="small muted" style={{ marginTop: 6 }}>A {CLIENTE.agente}, o funil e as automações do escritório, ao vivo.</p>
      </div>
      <label className="small ink" htmlFor="senha" style={{ display: 'block', marginTop: 6 }}>Senha</label>
      <input id="senha" className="campo" type="password" autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)} autoFocus required />
      {erro && <p className="small bad" role="alert">{erro}</p>}
      <button className="btn primary" disabled={enviando || !senha} style={{ width: '100%', justifyContent: 'center' }}>{enviando ? 'Conferindo…' : 'Entrar'}</button>
      <p className="tiny faint">A sessão dura 12 horas neste aparelho.</p>
    </form>
  )
}

export default function Login() {
  return (
    <div className="login-wrap">
      <div className="login"><Suspense fallback={<div className="panel pad skel" style={{ height: 320 }} />}><Formulario /></Suspense></div>
    </div>
  )
}
