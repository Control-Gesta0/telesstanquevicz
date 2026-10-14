'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, MessageCircleQuestion, X } from 'lucide-react'
import { CLIENTE } from '@/lib/cliente'
import { responder, type Resposta } from '@/lib/inteligencia'
import type { Visao } from '@/lib/tipos'

const SUGESTOES = ['O que falta ligar?', 'Quanto a IA custou?', 'Teve falha hoje?', 'Quem está parado?', 'Quantas reuniões vêm aí?', 'Como está o funil?']

/** Pergunte à Central: respostas calculadas aqui, sem modelo e sem custo. */
export default function Pergunte({ visao }: { visao: Visao | null }) {
  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState('')
  const [r, setR] = useState<{ pergunta: string; resposta: Resposta } | null>(null)
  const campo = useRef<HTMLInputElement>(null)

  useEffect(() => { if (aberto) campo.current?.focus() }, [aberto])
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setAberto(a => !a) }
      if (e.key === 'Escape') setAberto(false)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [])

  const perguntar = (p: string) => { if (p.trim()) { setR({ pergunta: p, resposta: responder(p, visao, CLIENTE.agente) }); setTexto('') } }

  return (
    <>
      {aberto && (
        <div className="cmd" role="dialog" aria-label="Pergunte à Central">
          <div className="pad-sm row between" style={{ borderBottom: '1px solid var(--line-soft)' }}>
            <div>
              <div className="eyebrow cyan">Pergunte à Central</div>
              <div className="tiny faint" style={{ marginTop: 3 }}>Resposta calculada na hora, sem usar IA.</div>
            </div>
            <button className="icon-btn" onClick={() => setAberto(false)} aria-label="Fechar"><X size={14} /></button>
          </div>
          <div className="pad-sm stack-sm">
            <form onSubmit={e => { e.preventDefault(); perguntar(texto) }}>
              <input ref={campo} className="campo" value={texto} onChange={e => setTexto(e.target.value)} placeholder="Ex.: quanto a IA custou na semana?" />
            </form>
            {r ? (
              <div className="panel pad-sm alt">
                <div className="tiny faint">{r.pergunta}</div>
                <p className="ink" style={{ marginTop: 6, fontSize: 13.5 }}>{r.resposta.resposta}</p>
                {r.resposta.evidencias.length > 0 && (
                  <ul className="small muted" style={{ margin: '8px 0 0', paddingLeft: 16 }}>
                    {r.resposta.evidencias.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
                {r.resposta.href && <Link href={r.resposta.href} onClick={() => setAberto(false)} className="link" style={{ marginTop: 10 }}>{r.resposta.rotulo} <ArrowRight size={12} /></Link>}
              </div>
            ) : null}
            <div className="row wrap" style={{ gap: 6 }}>
              {SUGESTOES.map(s => <button key={s} className="chip" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 11.5 }} onClick={() => perguntar(s)}>{s}</button>)}
            </div>
          </div>
        </div>
      )}
      <button className="fab no-print" onClick={() => setAberto(a => !a)} aria-expanded={aberto}>
        <MessageCircleQuestion size={16} /> <span className="txt">Pergunte à Central</span> <span className="mono faint txt" style={{ fontSize: 10 }}>⌘K</span>
      </button>
    </>
  )
}
