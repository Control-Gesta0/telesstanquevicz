'use client'

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity, AlertTriangle, ArrowRight, Bell, Bot, CalendarDays, ExternalLink, GitBranch, History, MapPin, RotateCcw, Shield, Zap,
} from 'lucide-react'
import { useCentral } from '@/components/Shell'
import { FunilCompleto } from '@/components/Funil'
import { Atualizar, Esqueleto, ErroFonte, FocusNav, Metric, PageIntro, SectionTitle, Vazio, useAba, type FocusItem } from '@/components/ui'
import { CLIENTE, linkLead } from '@/lib/cliente'
import { brl, daquiA, dataHoraBR, diaSemanaBR, ferramenta, haQuanto, horaBR, num, plural, PORTA } from '@/lib/formato'
import type { Categoria, DadosDiario, DadosRegras, Exec } from '@/lib/tipos'
import { dadosDe, useSecao } from '@/lib/useDados'

type Aba = 'agora' | 'funil' | 'agenda' | 'automacoes' | 'retomada' | 'historico'
const ABAS: FocusItem<Aba>[] = [
  { id: 'agora', label: 'Agora', description: 'Últimos eventos', icon: Activity },
  { id: 'funil', label: 'Funil', description: 'Todas as etapas', icon: GitBranch },
  { id: 'agenda', label: 'Agenda', description: 'Reuniões e lembretes', icon: CalendarDays },
  { id: 'automacoes', label: 'Automações', description: 'O que andou sozinho', icon: Zap },
  { id: 'retomada', label: 'Retomada', description: 'Quem parou', icon: RotateCcw },
  { id: 'historico', label: 'Histórico', description: 'Cada execução', icon: History },
]

const CAT: Record<Categoria, { rotulo: string; cor: string }> = {
  gabi: { rotulo: CLIENTE.agente, cor: 'var(--cyan)' },
  retomada: { rotulo: 'Retomada', cor: 'var(--purple)' },
  automacao: { rotulo: 'Automação', cor: 'var(--purple)' },
  agenda: { rotulo: 'Agenda', cor: 'var(--success)' },
  origem: { rotulo: 'Origem', cor: '#3b82f6' },
  erro: { rotulo: 'Falha', cor: 'var(--danger)' },
}

/** Frase de dono para cada linha do diário. */
function frase(e: Exec): string {
  const d = e.detalhe
  if (e.categoria === 'gabi') {
    if (e.tipo === 'menu') return 'Mandou o menu de boas-vindas.'
    if (e.tipo === 'pulou') return `Não respondeu: ${d}`
    if (e.tools.includes('agendar_reuniao') && e.tipo === 'finalizou') return 'Marcou a reunião e passou o card para o responsável.'
    if (e.tipo === 'finalizou') return 'Encerrou e passou para a equipe.'
    return `Respondeu${e.porta ? ` (${PORTA[e.porta] || e.porta})` : ''}.`
  }
  if (/^retorno: /.test(d)) return `Lead respondeu: card voltou para Em atendimento${(d.match(/vinha de ([^)]+)/) || [])[1] ? ` (estava em ${(d.match(/vinha de ([^)]+)/) || [])[1]})` : ''}.`
  if (/^follow-up esgotado/.test(d)) return 'Follow-up esgotado: 5 dias sem resposta, card foi para perdido (Lead Desaparecido).'
  if (/^reuniaoRealizada → /.test(d)) return 'Reunião realizada: card movido para CLOSER › Proposta.'
  if (/^contrato ?[pP]ago → |^contratoPago → /.test(d)) return 'Contrato pago: card movido para o Jurídico.'
  if (/PAUSADO/.test(d)) return 'Automação pausada: muitas mudanças de uma vez (limpeza de funil).'
  if (/nada feito/.test(d)) return 'Automação conferiu e não precisou mexer.'
  if (/^calendly marcou/.test(d)) return `Calendly: reunião marcada ${d.replace(/^calendly marcou /, '').replace(/ \(achado por [^)]+\)/, '').replace(/Movido para/, '· movido para')}`
  if (/^calendly cancelou/.test(d)) return `Calendly: reunião cancelada ${d.replace(/^calendly cancelou /, '').replace(/ · /g, ' · ')}`
  if (/^calendly: remarca/.test(d)) return 'Calendly: reunião remarcada.'
  if (/^rastreio: código/.test(d)) return 'Origem: código repetido ou vencido, ignorado.'
  if (/^rastreio: /.test(d)) return `Origem gravada: ${d.replace(/^rastreio: /, '')}`
  if (/^SOMBRA: enviaria/.test(d)) return `Lembrete (modo sombra): ${d.replace(/^SOMBRA: enviaria /, 'enviaria ')}`
  if (/^enviado lembrete/.test(d)) return `Lembrete enviado: ${d.replace(/^enviado /, '')}`
  if (/^toque /.test(d)) return `Retomada: ${d.split(' · ')[0]} enviado.`
  if (/^esgotou/.test(d)) return 'Retomada esgotada: card foi para Follow-up.'
  return d
}

function LinhaExec({ e, aberta, onClick }: { e: Exec; aberta: boolean; onClick: () => void }) {
  const c = CAT[e.categoria]
  return (
    <div>
      <button className="lista-item clickable" style={{ width: '100%', textAlign: 'left' }} onClick={onClick} aria-expanded={aberta}>
        <span className="tag-dot" style={{ background: c.cor }} />
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="small ink" style={{ display: 'block' }}>{e.nome ? <b>{e.nome}</b> : null}{e.nome ? ' · ' : ''}{frase(e)}</span>
          <span className="tiny faint mono">{c.rotulo} · {dataHoraBR(e.at)} · {haQuanto(e.at)}{e.urgente ? ' · URGENTE' : ''}</span>
        </span>
        {e.travas.length > 0 && <Shield size={14} className="purple" aria-label="trava acionada" />}
      </button>
      {aberta && (
        <div className="pad-sm alt small" style={{ borderTop: '1px solid var(--line-soft)' }}>
          <div className="grid g3" style={{ gap: 10 }}>
            <div><div className="eyebrow">Quando</div><div className="ink">{dataHoraBR(e.at)}</div></div>
            <div><div className="eyebrow">Duração</div><div className="ink">{e.ms ? `${(e.ms / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s` : '—'}</div></div>
            <div><div className="eyebrow">Custo</div><div className="ink">{e.custoBrl === null ? (e.categoria === 'gabi' ? 'não medido' : 'sem IA') : brl(e.custoBrl, 4)}</div></div>
          </div>
          {e.tools.length > 0 && <p style={{ marginTop: 10 }}><span className="muted">O que fez:</span> {[...new Set(e.tools)].map(ferramenta).join(' · ')}</p>}
          {e.travas.length > 0 && <p style={{ marginTop: 6 }}><span className="muted">Trava de segurança acionada:</span> {e.travas.join(' · ')}. A resposta foi reescrita antes de sair.</p>}
          {e.detalhe && <p className="tiny faint mono" style={{ marginTop: 8 }}>{e.detalhe}</p>}
          {e.leadId > 0 && <a href={linkLead(e.leadId)} target="_blank" rel="noreferrer" className="link" style={{ marginTop: 10 }}>abrir o card no Kommo <ExternalLink size={11} /></a>}
        </div>
      )}
    </div>
  )
}

function ListaExec({ execs, vazio }: { execs: Exec[]; vazio: React.ReactNode }) {
  const [aberta, setAberta] = useState<string | null>(null)
  if (!execs.length) return <>{vazio}</>
  return <div className="panel">{execs.map((e, i) => <LinhaExec key={`${e.at}-${i}`} e={e} aberta={aberta === `${e.at}-${i}`} onClick={() => setAberta(aberta === `${e.at}-${i}` ? null : `${e.at}-${i}`)} />)}</div>
}

function Agora() {
  const { visao } = useCentral()
  const d = dadosDe(visao?.diario)
  const ag = dadosDe(visao?.agenda)
  const fila = dadosDe(visao?.retomada)
  const gabiLigada = dadosDe(visao?.saude)?.prontidao.find(i => i.id === 'gabi')?.ok
  if (!visao) return <div className="panel pad"><Esqueleto linhas={5} /></div>
  return (
    <div className="stack">
      {!gabiLigada && (
        <Vazio icon={Bot} titulo={`A ${CLIENTE.agente} ainda não responde no WhatsApp`} texto="Quando o robô de envio for ligado no Kommo, cada conversa aparece aqui em segundos, com o que ela anotou e o que fez no card. Enquanto isso, abaixo estão as automações que já rodam." />
      )}
      <div className="grid g3">
        <Metric icon={Activity} label="Execuções nas últimas 24h" value={d ? num(d.metricas.h24.respostas + d.metricas.h24.automacoes + d.metricas.h24.agenda + d.metricas.h24.retomadas) : '—'} hint="Gabi, automações, agenda e retomada" />
        <Metric icon={CalendarDays} label="Reuniões hoje" value={ag ? num(ag.hoje) : '—'} color="#a78bfa" hint={ag ? `${num(ag.amanha)} amanhã` : undefined} />
        <Metric icon={RotateCcw} label="Retomadas agendadas" value={fila ? num(fila.total) : '—'} color="#22c55e" hint={fila?.proximas[0] ? `próxima ${daquiA(fila.proximas[0].em)}` : 'nenhuma na fila'} />
      </div>
      <section>
        <SectionTitle eyebrow="Agora" title="O que acabou de acontecer." description="Atualiza sozinho a cada 2 minutos. Clique numa linha para ver o detalhe." />
        {visao.diario.ok ? <ListaExec execs={visao.diario.dados.recentes} vazio={<Vazio icon={Activity} titulo="Nada registrado ainda" texto="A primeira execução da Gabi ou de uma automação aparece aqui." />} /> : <ErroFonte fonte="O diário" erro={visao.diario.erro} />}
      </section>
    </div>
  )
}

function Agenda({ diario }: { diario: DadosDiario | null }) {
  const { visao } = useCentral()
  if (!visao) return <div className="panel pad"><Esqueleto linhas={5} /></div>
  if (!visao.agenda.ok) return <ErroFonte fonte="A agenda" erro={visao.agenda.erro} />
  const a = visao.agenda.dados
  const eventos = (diario?.execs || []).filter(e => e.categoria === 'agenda').slice(0, 12)
  return (
    <div className="stack">
      <div className="grid g3">
        <Metric icon={CalendarDays} label="Hoje" value={num(a.hoje)} color="#a78bfa" featured={a.hoje > 0} />
        <Metric icon={CalendarDays} label="Amanhã" value={num(a.amanha)} color="#a78bfa" />
        <Metric icon={CalendarDays} label="Próximos 7 dias" value={num(a.seteDias)} color="#a78bfa" />
      </div>
      <section>
        <SectionTitle eyebrow="Próximas reuniões" title="Quem vem e quem atende." description="Lidas do campo Reunião dos cards. O Calendly preenche sozinho quando a reunião é marcada lá." />
        {a.proximas.length ? (
          <div className="panel rolagem-x">
            <table className="tabela">
              <thead><tr><th>Quando</th><th>Lead</th><th>Etapa</th><th>Responsável</th><th /></tr></thead>
              <tbody>
                {a.proximas.map(r => (
                  <tr key={r.id}>
                    <td className="ink num" style={{ whiteSpace: 'nowrap' }}>{diaSemanaBR(r.em)} · {horaBR(r.em)} <span className="tiny faint">({daquiA(r.em)})</span></td>
                    <td className="ink">{r.nome}</td>
                    <td className="muted">{r.etapa}</td>
                    <td className="muted">{r.responsavel || '—'}</td>
                    <td><a className="link" href={linkLead(r.id)} target="_blank" rel="noreferrer">Kommo <ExternalLink size={11} /></a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Vazio icon={CalendarDays} titulo="Nenhuma reunião futura" texto="Quando uma reunião for marcada pelo Calendly ou pela Gabi, ela aparece aqui com o responsável." />}
      </section>
      <section className="panel pad">
        <div className="row top" style={{ gap: 14 }}>
          <Bell size={18} className={a.lembretes.modo === 'ativo' ? 'ok' : 'warn'} style={{ marginTop: 2 }} />
          <div className="grow">
            <h3 style={{ fontSize: 15 }}>Lembretes 24h e 2h antes: {a.lembretes.modo === 'ativo' ? 'enviando' : 'modo sombra'}</h3>
            <p className="small" style={{ marginTop: 6 }}>
              {a.lembretes.modo === 'ativo'
                ? 'A Central manda o lembrete pelo modelo aprovado do WhatsApp, uma vez por reunião e por tipo.'
                : 'A Central já calcula quem deve receber cada lembrete e registra, sem enviar. Quem envia hoje ainda são os robôs do Kommo. Na comparação, o Kommo deixou de mandar o lembrete de 2h em duas reuniões; quando o envio passar para cá, isso deixa de acontecer.'}
            </p>
          </div>
        </div>
      </section>
      {eventos.length > 0 && (
        <section>
          <SectionTitle eyebrow="Calendly e lembretes" title="O que mudou na agenda." />
          <ListaExec execs={eventos} vazio={null} />
        </section>
      )}
    </div>
  )
}

function Automacoes({ diario }: { diario: DadosDiario | null }) {
  const { dados: regras } = useSecao<DadosRegras>('regras')
  const eventos = (diario?.execs || []).filter(e => e.categoria === 'automacao' || e.categoria === 'origem')
  const conta = (re: RegExp) => eventos.filter(e => re.test(e.detalhe) && Date.now() - Date.parse(e.at) < 7 * 86400_000).length
  return (
    <div className="stack">
      <div className="grid g3">
        <Metric icon={Zap} label="Reunião realizada → Proposta" value={diario ? num(conta(/^reuniaoRealizada → /)) : '—'} color="#a78bfa" hint="cards movidos em 7 dias" />
        <Metric icon={Zap} label="Contrato pago → Jurídico" value={diario ? num(conta(/^contrato ?[pP]ago|^contratoPago → /)) : '—'} color="#a78bfa" hint="cards movidos em 7 dias" />
        <Metric icon={MapPin} label="Origem gravada no card" value={diario ? num(conta(/^rastreio: (?!código)/)) : '—'} color="#3b82f6" hint="leads de link rastreado, 7 dias" />
      </div>
      <section>
        <SectionTitle eyebrow="Regras que rodam sozinhas" title="Gatilho e efeito." description="Saíram dos robôs do Kommo e rodam na Central. Antes de mexer, cada uma relê o card; se ele já mudou, não faz nada." />
        {regras ? (
          <div className="panel divide">
            {regras.automacoes.map(a => (
              <div key={a.gatilho} className="lista-item">
                <Zap size={15} className="purple" style={{ marginTop: 2 }} />
                <div className="grow small"><b className="ink">{a.gatilho}</b><div className="muted" style={{ marginTop: 2 }}>{a.efeito}</div></div>
              </div>
            ))}
          </div>
        ) : <div className="panel pad"><Esqueleto linhas={5} /></div>}
      </section>
      <section>
        <SectionTitle eyebrow="Últimas execuções" title="O que andou sozinho." />
        <ListaExec execs={eventos.slice(0, 30)} vazio={<Vazio icon={Zap} titulo="Nenhuma automação registrada ainda" texto="A próxima reunião realizada, contrato pago ou lead de link rastreado aparece aqui." />} />
      </section>
    </div>
  )
}

function Retomada({ diario }: { diario: DadosDiario | null }) {
  const { visao } = useCentral()
  const fila = dadosDe(visao?.retomada)
  const m = diario?.metricas
  const eventos = (diario?.execs || []).filter(e => e.categoria === 'retomada')
  return (
    <div className="stack">
      <div className="grid g3">
        <Metric icon={RotateCcw} label="Na fila agora" value={fila ? num(fila.total) : '—'} color="#22c55e" />
        <Metric icon={RotateCcw} label="Toques enviados em 7 dias" value={m ? num(m.d7.retomadas) : '—'} color="#22c55e" />
        <Metric icon={RotateCcw} label="Esgotados em 7 dias" value={diario ? num(eventos.filter(e => /^esgotou/.test(e.detalhe) && Date.now() - Date.parse(e.at) < 7 * 86400_000).length) : '—'} color="#8a8f98" hint="foram para Follow-up" />
      </div>
      <section className="panel pad small">
        <h3 style={{ fontSize: 15 }}>Como funciona</h3>
        <p style={{ marginTop: 6 }}>Quando o lead para de responder, a {CLIENTE.agente} manda até dois toques curtos, sempre dentro da janela de 24 horas do WhatsApp e entre 8h e 20h. Se ele responde, a retomada para na hora. Sem resposta, o card vai para Follow-up e fica com a equipe.</p>
      </section>
      {fila && fila.proximas.length > 0 && (
        <section className="panel">
          {fila.proximas.map(p => (
            <a key={`${p.leadId}-${p.toque}`} href={linkLead(p.leadId)} target="_blank" rel="noreferrer" className="lista-item clickable small">
              <span className="grow ink">Toque {p.toque === 3 ? 'final' : p.toque} · {dataHoraBR(p.em)} <span className="faint">({daquiA(p.em)})</span></span>
              <span className="link">Kommo <ExternalLink size={11} /></span>
            </a>
          ))}
        </section>
      )}
      <ListaExec execs={eventos.slice(0, 30)} vazio={<Vazio icon={RotateCcw} titulo="Nenhuma retomada ainda" texto={`A retomada começa junto com a ${CLIENTE.agente}. O primeiro toque aparece aqui.`} />} />
    </div>
  )
}

const FILTROS: Array<{ id: Categoria | 'todas'; rotulo: string }> = [
  { id: 'todas', rotulo: 'Tudo' }, { id: 'gabi', rotulo: CLIENTE.agente }, { id: 'automacao', rotulo: 'Automações' }, { id: 'agenda', rotulo: 'Agenda' },
  { id: 'origem', rotulo: 'Origem' }, { id: 'retomada', rotulo: 'Retomada' }, { id: 'erro', rotulo: 'Falhas' },
]

function Historico({ diario, erro, carregando, tentar }: { diario: DadosDiario | null; erro: string | null; carregando: boolean; tentar: () => void }) {
  const [filtro, setFiltro] = useAba(FILTROS.map(f => f.id), 'todas', 'filtro')
  const lista = useMemo(() => (diario?.execs || []).filter(e => filtro === 'todas' || e.categoria === filtro), [diario, filtro])
  if (erro && !diario) return <ErroFonte fonte="O diário" erro={erro} onTentar={tentar} />
  return (
    <div className="stack-sm">
      <div className="row wrap" style={{ gap: 6 }}>
        {FILTROS.map(f => <button key={f.id} className={`chip ${filtro === f.id ? 'cyan' : ''}`} style={{ textTransform: 'none', letterSpacing: 0, fontSize: 12, padding: '6px 11px' }} onClick={() => setFiltro(f.id)}>{f.rotulo}</button>)}
      </div>
      <p className="tiny faint">Cada linha é uma execução: o que foi feito, quanto demorou, quanto custou e se alguma trava agiu. Nomes aparecem só pelo primeiro nome; telefone e e-mail nunca aparecem.{diario?.maisAntigo ? ` Registro desde ${dataHoraBR(diario.maisAntigo)}.` : ''}</p>
      {carregando && !diario ? <div className="panel pad"><Esqueleto linhas={6} /></div> : (
        <ListaExec execs={lista.slice(0, 200)} vazio={<Vazio icon={filtro === 'erro' ? AlertTriangle : History} titulo={filtro === 'erro' ? 'Nenhuma falha registrada' : 'Nada neste filtro'} texto={filtro === 'erro' ? 'Quando algo não terminar, aparece aqui com o motivo.' : 'Troque o filtro para ver outras execuções.'} />} />
      )}
    </div>
  )
}

function Conteudo() {
  const { visao, carregandoVisao, atualizarVisao } = useCentral()
  const [aba, setAba] = useAba(ABAS.map(a => a.id), 'agora')
  const precisaDiario = aba === 'historico' || aba === 'automacoes' || aba === 'agenda' || aba === 'retomada'
  return (
    <div className="stack">
      <PageIntro eyebrow="Operação" title="O que está" accent="acontecendo." description="Uma leitura por vez: escolha o assunto abaixo."
        action={<Atualizar onClick={() => atualizarVisao(true)} carregando={carregandoVisao} em={dadosDe(visao?.funil)?._em} />} />
      <FocusNav items={ABAS} value={aba} onChange={setAba} />
      {aba === 'agora' && <Agora />}
      {aba === 'funil' && (visao ? (visao.funil.ok ? (
        <div className="stack-sm">
          <p className="small muted">Todas as etapas dos dois funis numa tela. Clique numa etapa para ver quem está parado há 7 dias ou mais.{visao.funil.dados._velho ? ' Mostrando a última leitura; a nova chega em instantes.' : ''}</p>
          <FunilCompleto dados={visao.funil.dados} />
        </div>
      ) : <ErroFonte fonte="O funil do Kommo" erro={visao.funil.erro} onTentar={() => atualizarVisao(true)} />) : <div className="panel pad"><Esqueleto linhas={8} /></div>)}
      {precisaDiario && <ComDiario aba={aba} />}
      {aba !== 'agora' && aba !== 'historico' && (
        <Link href="/operacao?aba=historico" className="link">Ver o histórico completo <ArrowRight size={12} /></Link>
      )}
    </div>
  )
}

function ComDiario({ aba }: { aba: Aba }) {
  const { dados, erro, carregando, atualizar } = useSecao<DadosDiario>('diario', 120_000)
  if (aba === 'agenda') return <Agenda diario={dados} />
  if (aba === 'automacoes') return <Automacoes diario={dados} />
  if (aba === 'retomada') return <Retomada diario={dados} />
  return <Historico diario={dados} erro={erro} carregando={carregando} tentar={() => atualizar()} />
}

export default function Operacao() {
  return <Suspense fallback={<Esqueleto linhas={6} />}><Conteudo /></Suspense>
}
