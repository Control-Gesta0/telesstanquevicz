'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import {
  ArrowRight, BarChart3, CalendarCheck, CheckCircle2, Circle, GitBranch, GraduationCap, MessageSquareText,
  MousePointerClick, PlugZap, Sparkles, Activity, Wallet, CalendarClock,
} from 'lucide-react'
import { useCentral } from '@/components/Shell'
import { FunilBarras } from '@/components/Funil'
import { Atualizar, Esqueleto, ErroFonte, FocusNav, Ic, Metric, PageIntro, SectionTitle, useAba, type FocusItem } from '@/components/ui'
import { CLIENTE } from '@/lib/cliente'
import { brl, num } from '@/lib/formato'
import { montarBriefing, type Decisao, type Tom } from '@/lib/inteligencia'
import { dadosDe } from '@/lib/useDados'

type Foco = 'agir' | 'funil' | 'ligado'
const FOCOS: FocusItem<Foco>[] = [
  { id: 'agir', label: 'Próximos passos', description: 'Escolha o que fazer', icon: MousePointerClick },
  { id: 'funil', label: 'Funil agora', description: 'SDR e CLOSER lado a lado', icon: GitBranch },
  { id: 'ligado', label: 'O que está ligado', description: 'Cada peça da operação', icon: PlugZap },
]

const TOM: Record<Tom, { cor: string; rotulo: string }> = {
  calmo: { cor: 'var(--success)', rotulo: 'AGENDA' },
  atencao: { cor: 'var(--warning)', rotulo: 'ATENÇÃO' },
  critico: { cor: 'var(--danger)', rotulo: 'URGENTE' },
  oportunidade: { cor: 'var(--success)', rotulo: 'OPORTUNIDADE' },
  aprendizado: { cor: 'var(--purple)', rotulo: 'EM TESTE' },
}

function CartaoDecisao({ d, principal = false }: { d: Decisao; principal?: boolean }) {
  const t = TOM[d.tom]
  return (
    <Link href={d.href} className="pad clickable" style={{ minHeight: principal ? 180 : 140 }}>
      <div className="mono" style={{ fontSize: 9, letterSpacing: '.13em', color: t.cor }}>{t.rotulo}</div>
      <h3 style={{ fontSize: principal ? 18 : 15, marginTop: 10 }}>{d.titulo}</h3>
      <p className="small" style={{ marginTop: 8 }}>{d.evidencia}</p>
      {principal && <p className="tiny faint" style={{ marginTop: 6 }}>{d.impacto}</p>}
      <span className="link" style={{ marginTop: 12 }}>{d.acao} <ArrowRight size={12} /></span>
    </Link>
  )
}

function Conteudo() {
  const { visao, carregandoVisao, atualizarVisao, erroVisao } = useCentral()
  const [foco, setFoco] = useAba(['agir', 'funil', 'ligado'] as const, 'agir', 'foco')
  const b = montarBriefing(visao, CLIENTE.agente)
  const [principal, ...outras] = b.decisoes
  const m = dadosDe(visao?.diario)?.metricas
  const agenda = dadosDe(visao?.agenda)
  const marcadas = dadosDe(visao?.resultados)?.marcos.find(x => x.id === 'agendadas')
  const funil = dadosDe(visao?.funil)
  const saude = dadosDe(visao?.saude)
  const accent = !visao ? 'sendo verificada.' : b.estado === 'atencao' ? 'pedindo atenção.' : b.estado === 'quase' ? 'quase no ar.' : 'operando bem.'

  return (
    <div className="stack">
      <PageIntro eyebrow="Visão geral" title={`A ${CLIENTE.agente} está`} accent={accent}
        description="Primeiro o que pede decisão. O detalhe só aparece quando você escolher abrir."
        action={<Atualizar onClick={() => atualizarVisao(true)} carregando={carregandoVisao} em={funil?._em} />} />

      {erroVisao && !visao && <ErroFonte fonte="A Central" erro={erroVisao} onTentar={() => atualizarVisao()} />}

      <section className="panel" style={{ overflow: 'hidden' }}>
        <div className="pad row top" style={{ gap: 16, borderBottom: '1px solid var(--line-soft)' }}>
          <Ic icon={Sparkles} color={b.estado === 'atencao' ? '#f59e0b' : '#06b6d4'} size={17} />
          <div className="grow">
            <div className="eyebrow cyan">Resumo da Central · calculado, sem IA</div>
            <h2 style={{ fontSize: 21, marginTop: 8 }}>{b.saudacao}</h2>
            <p className="small" style={{ marginTop: 6 }}>{b.resumo}</p>
          </div>
        </div>
        {!visao ? <div className="pad"><Esqueleto linhas={3} /></div> : principal ? (
          <>
            <div className="split">
              <CartaoDecisao d={principal} principal />
              <div className="pad border-l" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div className="eyebrow">{b.estado === 'bem' ? 'Operação protegida' : 'Estado atual'}</div>
                <p className="small" style={{ marginTop: 8 }}>
                  {b.estado === 'quase'
                    ? `Funil novo, automações, ponte com o Calendly e rastreio de origem já rodam. A ${CLIENTE.agente} começa a responder quando o robô de envio for ligado no Kommo.`
                    : b.estado === 'atencao' ? 'Há pontos que pedem conferência antes de seguir. Comece pelo cartão ao lado.'
                    : `A ${CLIENTE.agente} está respondendo e nada falhou nas últimas 24 horas.`}
                </p>
                <Link href="/operacao" className="link" style={{ marginTop: 12 }}>Ver a operação <ArrowRight size={12} /></Link>
              </div>
            </div>
            {outras.length > 0 && (
              <details style={{ borderTop: '1px solid var(--line-soft)' }}>
                <summary className="pad-sm row clickable"><span className="small ink grow">Ver mais {outras.length} {outras.length === 1 ? 'sinal' : 'sinais'}</span><span className="gira faint">▷</span></summary>
                <div className={`grid ${outras.length > 1 ? 'g3' : ''}`} style={{ gap: 0, borderTop: '1px solid var(--line-soft)' }}>
                  {outras.map((d, i) => <div key={d.id} className={i ? 'border-l' : ''}><CartaoDecisao d={d} /></div>)}
                </div>
              </details>
            )}
          </>
        ) : <div className="pad small muted">Nada pede decisão agora.</div>}
      </section>

      <section>
        <SectionTitle eyebrow="O que importa hoje" title="Atendimento, agenda e custo." />
        <div className="grid g4">
          <Metric icon={MessageSquareText} label={`Conversas da ${CLIENTE.agente} em 24h`} value={m ? num(m.h24.conversas) : '—'} carregando={!visao}
            hint={m?.h24.conversas ? `${num(m.h24.respostas)} respostas` : saude?.prontidao.find(i => i.id === 'gabi')?.ok ? 'nenhuma conversa nova' : 'começa quando o envio for ligado'} />
          <Metric icon={CalendarClock} label="Reuniões nos próximos 7 dias" value={agenda ? num(agenda.seteDias) : '—'} carregando={!visao} color="#a78bfa"
            hint={agenda ? `${num(agenda.hoje)} hoje · ${num(agenda.amanha)} amanhã` : undefined} featured={!!agenda?.hoje} />
          <Metric icon={CalendarCheck} label="Reuniões marcadas na semana" value={marcadas ? num(marcadas.seteDias) : '—'} carregando={!visao} color="#3b82f6"
            hint={marcadas ? `${num(marcadas.trintaDias)} em 30 dias, lead distinto` : undefined} />
          <Metric icon={Wallet} label="Custo da IA hoje" value={m ? brl(m.h24.custoBrl) : '—'} carregando={!visao} color="#22c55e"
            hint={m?.h24.execucoesComCusto ? `${brl(m.h24.custoBrl / m.h24.execucoesComCusto, 3)} por resposta` : 'medido a cada resposta da IA'} />
        </div>
      </section>

      <section>
        <SectionTitle eyebrow="Aprofunde se precisar" title="Uma pergunta por vez." description="Escolha um assunto. Só o detalhe dele aparece." />
        <FocusNav items={FOCOS} value={foco} onChange={setFoco} />
      </section>

      {foco === 'agir' && (
        <section className="grid g3">
          {[
            { href: '/operacao', Icon: Activity, cor: '#06b6d4', titulo: 'Acompanhar a operação', texto: 'O que a Stela e as automações fizeram agora, o funil e a agenda.' },
            { href: '/cerebro', Icon: GraduationCap, cor: '#a78bfa', titulo: `Testar e ensinar a ${CLIENTE.agente}`, texto: 'Converse como se fosse um lead, aponte o que ficou torto e diga como deveria ser.' },
            { href: '/resultados', Icon: BarChart3, cor: '#22c55e', titulo: 'Ver os resultados', texto: 'Reuniões, contratos, origem dos leads e quanto a IA custou.' },
          ].map(q => (
            <Link key={q.href} href={q.href} className="panel pad clickable">
              <Ic icon={q.Icon} color={q.cor} />
              <h3 style={{ fontSize: 15, marginTop: 16 }}>{q.titulo}</h3>
              <p className="small" style={{ marginTop: 6 }}>{q.texto}</p>
              <span className="link" style={{ marginTop: 12 }}>Abrir <ArrowRight size={12} /></span>
            </Link>
          ))}
        </section>
      )}

      {foco === 'funil' && (funil ? <FunilBarras dados={funil} /> : visao?.funil.ok === false ? <ErroFonte fonte="O funil do Kommo" erro={visao.funil.erro} /> : <div className="panel pad"><Esqueleto linhas={6} /></div>)}

      {foco === 'ligado' && (saude ? (
        <section className="panel divide">
          {saude.prontidao.map(i => (
            <div key={i.id} className="lista-item">
              {i.ok ? <CheckCircle2 size={17} className="ok" style={{ marginTop: 1 }} /> : <Circle size={17} className="warn" style={{ marginTop: 1 }} />}
              <div className="grow">
                <div className="small ink">{i.nome}</div>
                <div className="tiny muted" style={{ marginTop: 2 }}>{i.estado}{i.oQueFalta ? ` · ${i.oQueFalta}` : ''}</div>
              </div>
            </div>
          ))}
        </section>
      ) : <div className="panel pad"><Esqueleto linhas={5} /></div>)}
    </div>
  )
}

export default function VisaoGeral() {
  return <Suspense fallback={<Esqueleto linhas={6} />}><Conteudo /></Suspense>
}
