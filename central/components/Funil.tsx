'use client'

import { useState } from 'react'
import { Bot, ExternalLink, Users, Zap } from 'lucide-react'
import { linkLead } from '@/lib/cliente'
import { brl, num, plural } from '@/lib/formato'
import type { DadosFunil, Etapa } from '@/lib/tipos'
import { Barra } from './ui'

const PAPEL = {
  gabi: { rotulo: 'Gabi', classe: 'cyan', Icon: Bot },
  automacao: { rotulo: 'Automático', classe: 'purple', Icon: Zap },
  time: { rotulo: 'Equipe', classe: '', Icon: Users },
} as const

export function PapelChip({ papel }: { papel: Etapa['papel'] }) {
  const p = PAPEL[papel]
  return <span className={`chip ${p.classe}`} style={{ fontSize: 9 }}><p.Icon size={10} /> {p.rotulo}</span>
}

/** Resumo em barras (Visão Geral): os dois funis lado a lado, todas as etapas sem rolar. */
export function FunilBarras({ dados }: { dados: DadosFunil }) {
  return (
    <div className="funis">
      {dados.funis.map(f => {
        const max = Math.max(...f.etapas.map(e => e.n), 1)
        return (
          <div key={f.id} className="panel pad">
            <div className="row between"><h3 style={{ fontSize: 15 }}>{f.nome}</h3><span className="mono small muted num">{num(f.n)} ativos</span></div>
            <div className="stack-sm" style={{ marginTop: 14 }}>
              {f.etapas.map(e => (
                <div key={e.id}>
                  <div className="row between small" style={{ marginBottom: 6 }}>
                    <span className="row" style={{ gap: 8 }}><span className={e.papel === 'time' ? 'muted' : 'ink'}>{e.nome}</span><PapelChip papel={e.papel} /></span>
                    <span className="mono muted num">{num(e.n)}</span>
                  </div>
                  <Barra valor={e.n} max={max} cor={e.papel === 'gabi' ? 'cyan' : e.papel === 'automacao' ? 'purple' : 'faint'} />
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Funil completo (Operação): cada etapa é um cartão; clicar mostra quem está parado. */
export function FunilCompleto({ dados }: { dados: DadosFunil }) {
  const [sel, setSel] = useState<number | null>(null)
  const etapaSel = dados.funis.flatMap(f => f.etapas).find(e => e.id === sel) || null
  return (
    <div className="stack">
      <div className="funis">
        {dados.funis.map(f => (
          <section key={f.id}>
            <div className="row between" style={{ marginBottom: 10 }}>
              <h3 style={{ fontSize: 16 }}>{f.nome}</h3>
              <span className="mono small muted num">{plural(f.n, 'lead ativo', 'leads ativos')}{f.valor ? ` · ${brl(f.valor, 0)}` : ''}</span>
            </div>
            <div className="etapas">
              {f.etapas.map(e => (
                <button key={e.id} className={`etapa clickable ${sel === e.id ? 'sel' : ''}`} onClick={() => setSel(sel === e.id ? null : e.id)} aria-pressed={sel === e.id}>
                  <div className="row between top">
                    <div className="grow">
                      <div className="row" style={{ gap: 8 }}><b className="ink" style={{ fontSize: 13.5 }}>{e.nome}</b><PapelChip papel={e.papel} /></div>
                      <div className="tiny muted" style={{ marginTop: 4 }}>{e.como}</div>
                    </div>
                    <div className="n">{num(e.n)}</div>
                  </div>
                  <div className="row wrap tiny mono" style={{ gap: 12, marginTop: 9 }}>
                    <span className={e.novos7d ? 'cyan' : 'faint'}>+{num(e.novos7d)} em 7 dias</span>
                    <span className={e.parados && e.radar ? 'warn' : 'faint'}>{num(e.parados)} parados 7d+</span>
                    {e.valor > 0 && <span className="ok">{brl(e.valor, 0)}</span>}
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      {etapaSel && <Parados etapa={etapaSel} />}
    </div>
  )
}

export function Parados({ etapa }: { etapa: Etapa }) {
  return (
    <div className="panel">
      <div className="pad-sm" style={{ borderBottom: '1px solid var(--line-soft)' }}>
        <div className="eyebrow">{etapa.nome}</div>
        <div className="small ink" style={{ marginTop: 4 }}>{etapa.parados ? `${plural(etapa.parados, 'card sem mudança', 'cards sem mudança')} há 7 dias ou mais. Os maiores primeiro:` : 'Nenhum card parado há 7 dias ou mais nesta etapa.'}</div>
        {!etapa.radar && <div className="tiny faint" style={{ marginTop: 4 }}>Esta etapa é estacionamento: ficar parado aqui é o normal, por isso ela não entra no radar.</div>}
      </div>
      {etapa.amostras.map(a => (
        <a key={a.id} href={linkLead(a.id)} target="_blank" rel="noreferrer" className="lista-item clickable">
          <span className="grow small"><b className="ink">{a.nome}</b> <span className="muted">· {plural(a.dias, 'dia', 'dias')} parado{a.responsavel ? ` · ${a.responsavel}` : ''}{a.valor ? ` · ${brl(a.valor, 0)}` : ''}</span></span>
          <span className="link">abrir no Kommo <ExternalLink size={11} /></span>
        </a>
      ))}
    </div>
  )
}
