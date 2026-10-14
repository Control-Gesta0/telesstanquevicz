'use client'

import { Suspense, useState } from 'react'
import { AlertTriangle, BarChart3, CalendarCheck, CircleDollarSign, FileText, MapPin, Printer, Radar, SlidersHorizontal, Users } from 'lucide-react'
import { useCentral } from '@/components/Shell'
import { Parados } from '@/components/Funil'
import { Atualizar, Barra, Esqueleto, ErroFonte, FocusNav, Metric, PageIntro, SectionTitle, Vazio, useAba, type FocusItem } from '@/components/ui'
import { CLIENTE } from '@/lib/cliente'
import { brl, num, pct, plural } from '@/lib/formato'
import { montarRadar } from '@/lib/inteligencia'
import type { DadosDiario, DadosOrigem, Marco, OrigemJanela } from '@/lib/tipos'
import { dadosDe, useSecao } from '@/lib/useDados'

type Aba = 'resumo' | 'radar' | 'origem' | 'ese' | 'recibo'
const ABAS: FocusItem<Aba>[] = [
  { id: 'resumo', label: 'Resumo', description: 'Reuniões, contratos e custo', icon: BarChart3 },
  { id: 'radar', label: 'Dinheiro parado', description: 'Quem não anda há 7 dias', icon: Radar },
  { id: 'origem', label: 'Origem', description: 'De onde vêm os leads', icon: MapPin },
  { id: 'ese', label: 'E se?', description: 'Simule metas', icon: SlidersHorizontal },
  { id: 'recibo', label: 'Recibo de valor', description: 'Para imprimir ou PDF', icon: FileText },
]

function serie30(porDia: Record<string, number>): Array<{ dia: string; n: number }> {
  const out: Array<{ dia: string; n: number }> = []
  for (let i = 29; i >= 0; i--) {
    const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(Date.now() - i * 86400_000))
    out.push({ dia, n: porDia[dia] || 0 })
  }
  return out
}

function Resumo() {
  const { visao } = useCentral()
  if (!visao) return <div className="panel pad"><Esqueleto linhas={6} /></div>
  if (!visao.resultados.ok) return <ErroFonte fonte="Os resultados do Kommo" erro={visao.resultados.erro} />
  const marcos = visao.resultados.dados.marcos
  const mm = (id: Marco['id']) => marcos.find(x => x.id === id)!
  const ag = mm('agendadas'); const re = mm('realizadas'); const ns = mm('noshow'); const ct = mm('contratos')
  const massa = marcos.reduce((s, x) => s + x.emMassa, 0)
  const m = dadosDe(visao.diario)?.metricas
  const s = serie30(ag.porDia)
  const max = Math.max(...s.map(x => x.n), 1)
  return (
    <div className="stack">
      <section>
        <SectionTitle eyebrow="Últimos 30 dias, no Kommo" title="Do agendamento ao contrato." description="Cada número conta lead distinto que entrou na etapa. Movimentação em massa (limpeza de funil) não conta." />
        <div className="grid g4">
          <Metric icon={CalendarCheck} label={ag.nome} value={num(ag.trintaDias)} hint={`${num(ag.seteDias)} nos últimos 7 dias`} color="#3b82f6" />
          <Metric icon={Users} label={`${re.nome} (ganho no SDR)`} value={num(re.trintaDias)} hint={`${num(re.seteDias)} nos últimos 7 dias`} color="#a78bfa" />
          <Metric icon={AlertTriangle} label={ns.nome} value={num(ns.trintaDias)} hint={`${num(ns.seteDias)} nos últimos 7 dias`} color="#f59e0b" />
          <Metric icon={CircleDollarSign} label={`${ct.nome} (venda ganha)`} value={num(ct.trintaDias)} hint={`${num(ct.seteDias)} nos últimos 7 dias`} color="#22c55e" featured={ct.seteDias > 0} />
        </div>
        {(massa > 0 || re.trintaDias > ag.trintaDias) && (
          <p className="tiny faint" style={{ marginTop: 10 }}>
            {massa > 0 ? `${num(massa)} mudanças feitas em massa no período ficaram de fora. ` : ''}
            {re.trintaDias > ag.trintaDias ? 'Há mais "realizadas" do que "marcadas" porque o SDR marca ganho também em cards que não passaram por Reunião agendada. O número mostra o que foi marcado no Kommo.' : ''}
          </p>
        )}
      </section>
      <section className="panel pad">
        <div className="row between wrap"><h3 style={{ fontSize: 15 }}>Reuniões marcadas por dia</h3><span className="tiny faint mono">30 dias · lead distinto</span></div>
        <div className="cols" style={{ marginTop: 16 }} role="img" aria-label="Reuniões marcadas por dia nos últimos 30 dias">
          {s.map(x => <div key={x.dia} className={x.n ? '' : 'zero'} style={{ height: `${Math.max(2, (x.n / max) * 100)}%` }} title={`${x.dia.split('-').reverse().slice(0, 2).join('/')}: ${x.n}`} />)}
        </div>
        <div className="row between tiny faint mono" style={{ marginTop: 6 }}><span>{s[0].dia.split('-').reverse().slice(0, 2).join('/')}</span><span>hoje</span></div>
      </section>
      <section>
        <SectionTitle eyebrow={`A ${CLIENTE.agente} e a IA`} title="Atendimento e custo." description="Contado a partir do diário de execuções da Central." />
        {m ? (
          <div className="grid g4">
            <Metric icon={Users} label="Conversas em 30 dias" value={num(m.d30.conversas)} hint={`${num(m.d7.conversas)} em 7 dias`} />
            <Metric icon={CalendarCheck} label={`Reuniões marcadas pela ${CLIENTE.agente}`} value={num(m.d30.reunioesGabi)} hint="reserva confirmada no Calendly" color="#3b82f6" />
            <Metric icon={Users} label="Passou para a equipe" value={num(m.d30.passouEquipe)} hint="pediu pessoa, cliente, pagamento…" color="#a78bfa" />
            <Metric icon={CircleDollarSign} label="Custo da IA em 30 dias" value={brl(m.d30.custoBrl)} hint={m.d30.execucoesComCusto ? `${brl(m.d30.custoBrl / m.d30.execucoesComCusto, 3)} por resposta` : 'aparece na primeira conversa real'} color="#22c55e" />
          </div>
        ) : <ErroFonte fonte="O diário" erro="sem resposta" />}
        <p className="tiny faint" style={{ marginTop: 10 }}>Custo estimado por execução, com o câmbio de {brl(dadosDe(visao.saude)?.usdBrl || 5.4)} por dólar. A fatura do provedor de IA fecha o valor.</p>
      </section>
    </div>
  )
}

function RadarAba() {
  const { visao } = useCentral()
  const [aberto, setAberto] = useState<number | null>(null)
  if (!visao) return <div className="panel pad"><Esqueleto linhas={6} /></div>
  if (!visao.funil.ok) return <ErroFonte fonte="O funil do Kommo" erro={visao.funil.erro} />
  const sinais = montarRadar(visao.funil.dados)
  if (!sinais.length) return <Vazio icon={Radar} titulo="Nada parado" texto="Nenhum card sem mudança há 7 dias ou mais nas etapas que contam." />
  const [a, b, ...resto] = sinais
  const Cartao = ({ s, i }: { s: typeof a; i: number }) => (
    <div className="panel">
      <button className="pad clickable" style={{ width: '100%', textAlign: 'left' }} onClick={() => setAberto(aberto === i ? null : i)} aria-expanded={aberto === i}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: '.13em', color: s.tom === 'critico' ? 'var(--danger)' : 'var(--success)' }}>{s.tom === 'critico' ? 'PERTO DO CONTRATO' : 'OPORTUNIDADE'} · {s.funil}</div>
        <h3 style={{ fontSize: 17, marginTop: 8 }}>{s.titulo}</h3>
        <p className="small" style={{ marginTop: 6 }}>{s.explicacao}</p>
        <span className="link" style={{ marginTop: 10 }}>{aberto === i ? 'esconder' : 'ver os cards'}</span>
      </button>
      {aberto === i && <div style={{ borderTop: '1px solid var(--line-soft)' }}><Parados etapa={s.etapa} /></div>}
    </div>
  )
  return (
    <div className="stack">
      <p className="small muted">Etapas com card sem mudança há 7 dias ou mais. As duas que mais pedem ação primeiro. O Follow-up fica de fora: ali, parado é o normal.</p>
      <div className="grid g2">{a && <Cartao s={a} i={0} />}{b && <Cartao s={b} i={1} />}</div>
      {resto.length > 0 && (
        <details className="panel">
          <summary className="pad-sm row clickable"><span className="small ink grow">Ver mais {resto.length} {resto.length === 1 ? 'etapa' : 'etapas'}</span><span className="gira faint">▷</span></summary>
          <div className="pad-sm stack-sm" style={{ borderTop: '1px solid var(--line-soft)' }}>{resto.map((s, j) => <Cartao key={s.etapa.id} s={s} i={j + 2} />)}</div>
        </details>
      )}
    </div>
  )
}

function Barras({ dados, total }: { dados: Record<string, number>; total: number }) {
  const itens = Object.entries(dados).sort((a, b) => b[1] - a[1])
  const max = Math.max(...itens.map(i => i[1]), 1)
  return (
    <div className="stack-sm">
      {itens.map(([k, v]) => (
        <div key={k}>
          <div className="row between small" style={{ marginBottom: 6 }}><span className={/sem origem/i.test(k) ? 'muted' : 'ink'}>{k}</span><span className="mono muted num">{num(v)} · {pct(total ? v / total : 0)}</span></div>
          <Barra valor={v} max={max} cor={/sem origem/i.test(k) ? 'faint' : 'cyan'} />
        </div>
      ))}
    </div>
  )
}

function Origem() {
  const { dados, erro, carregando, atualizar } = useSecao<DadosOrigem>('origem')
  const [jan, setJan] = useState<'trintaDias' | 'seteDias'>('trintaDias')
  if (erro && !dados) return <ErroFonte fonte="A origem dos leads" erro={erro} onTentar={() => atualizar()} />
  if (carregando && !dados) return <div className="panel pad"><Esqueleto linhas={6} /></div>
  if (!dados) return null
  const j: OrigemJanela = dados[jan]
  const sem = j.deOnde['Sem origem registrada'] || 0
  const links = Object.entries(dados.links)
  return (
    <div className="stack">
      <div className="row between wrap">
        <div className="row" style={{ gap: 6 }}>
          {(['seteDias', 'trintaDias'] as const).map(x => <button key={x} className={`chip ${jan === x ? 'cyan' : ''}`} style={{ textTransform: 'none', letterSpacing: 0, fontSize: 12, padding: '6px 11px' }} onClick={() => setJan(x)}>{x === 'seteDias' ? '7 dias' : '30 dias'}</button>)}
        </div>
        <span className="small muted">{plural(j.total, 'lead criado', 'leads criados')} no período</span>
      </div>
      <div className="grid g2">
        <section className="panel pad">
          <h3 style={{ fontSize: 15 }}>De onde (campo do card)</h3>
          <div style={{ marginTop: 14 }}><Barras dados={j.deOnde} total={j.total} /></div>
          {sem / Math.max(1, j.total) > 0.3 && <p className="tiny faint" style={{ marginTop: 12 }}>{pct(sem / Math.max(1, j.total))} sem origem: desde o fim de setembro os leads do WhatsApp entram sem UTM. Os links rastreados da Central resolvem isso quando entrarem nos anúncios.</p>}
        </section>
        <section className="panel pad">
          <h3 style={{ fontSize: 15 }}>Campanhas</h3>
          {Object.keys(j.campanhas).length ? <div style={{ marginTop: 14 }}><Barras dados={j.campanhas} total={j.total} /></div> : <p className="small muted" style={{ marginTop: 10 }}>Nenhum lead com campanha registrada neste período.</p>}
        </section>
      </div>
      <section className="panel pad">
        <div className="row between wrap"><h3 style={{ fontSize: 15 }}>Links rastreados (30 dias)</h3><span className={`chip ${dados.linksLigados ? 'ok' : 'warn'}`}>{dados.linksLigados ? 'ligados' : 'aguardando o número do WhatsApp'}</span></div>
        {links.length ? (
          <table className="tabela" style={{ marginTop: 10 }}>
            <thead><tr><th>Link</th><th>Cliques</th><th>Viraram lead</th></tr></thead>
            <tbody>{links.map(([k, v]) => <tr key={k}><td className="ink mono">{k}</td><td className="num">{num(v.cliques)}</td><td className="num">{num(v.leads)}</td></tr>)}</tbody>
          </table>
        ) : <p className="small muted" style={{ marginTop: 10 }}>Nenhum clique ainda. Cada anúncio ganha um link próprio; quem chega por ele vem com a origem e a campanha gravadas no card.</p>}
      </section>
    </div>
  )
}

interface Base { leads: number; marca: number; comparece: number; fecha: number; honorario: number; fonte: string }

function ESe() {
  const { visao } = useCentral()
  const { dados: org } = useSecao<DadosOrigem>('origem')
  const r = dadosDe(visao?.resultados)
  if (!r || !org) return <div className="panel pad"><Esqueleto linhas={6} /></div>
  const ag = r.marcos.find(x => x.id === 'agendadas')?.trintaDias || 0
  const ns = r.marcos.find(x => x.id === 'noshow')?.trintaDias || 0
  const leads = org.trintaDias.total
  const base: Base = {
    leads, marca: leads ? Math.round(Math.min(60, (ag / leads) * 100)) : 15,
    comparece: ag ? Math.round(Math.max(40, Math.min(100, (1 - ns / ag) * 100))) : 80, fecha: 30, honorario: 0,
    fonte: `${num(leads)} leads criados e ${num(ag)} reuniões marcadas nos últimos 30 dias; comparecimento pelos ${num(ns)} no-shows do período.`,
  }
  return <ESeConta key={`${base.leads}-${base.marca}-${base.comparece}`} base={base} />
}

function ESeConta({ base }: { base: Base }) {
  const [p, setP] = useState(base)
  const reunioes = p.leads * p.marca / 100
  const feitas = reunioes * p.comparece / 100
  const contratos = feitas * p.fecha / 100
  const mais5 = p.leads * (p.marca + 5) / 100 * p.comparece / 100 * p.fecha / 100 - contratos
  const Campo = ({ k, rotulo, sufixo, max }: { k: 'leads' | 'marca' | 'comparece' | 'fecha' | 'honorario'; rotulo: string; sufixo: string; max: number }) => (
    <label className="small" style={{ display: 'block' }}>
      <div className="row between"><span>{rotulo}</span><b className="ink num">{num(p[k])}{sufixo}</b></div>
      <input type="range" min={0} max={max} step={k === 'leads' ? 10 : k === 'honorario' ? 500 : 1} value={p[k]} onChange={e => setP({ ...p, [k]: Number(e.target.value) })} style={{ width: '100%', marginTop: 6, accentColor: 'var(--cyan-strong)' }} />
    </label>
  )
  return (
    <div className="grid g2">
      <section className="panel pad stack-sm">
        <h3 style={{ fontSize: 15 }}>Premissas</h3>
        <Campo k="leads" rotulo="Leads novos por mês" sufixo="" max={2000} />
        <Campo k="marca" rotulo="Marcam reunião" sufixo="%" max={60} />
        <Campo k="comparece" rotulo="Comparecem" sufixo="%" max={100} />
        <Campo k="fecha" rotulo="Fecham contrato" sufixo="%" max={100} />
        <Campo k="honorario" rotulo="Honorário médio (opcional)" sufixo="" max={20000} />
        <p className="tiny faint">Ponto de partida, lido do Kommo: {base.fonte} A taxa de fechamento é sugestão: ajuste para a realidade do escritório. Isto é conta, não previsão.</p>
        <button className="link" onClick={() => setP(base)}>voltar ao ponto de partida</button>
      </section>
      <section className="panel pad stack-sm">
        <h3 style={{ fontSize: 15 }}>Resultado por mês</h3>
        <div className="grid g3">
          <div><div className="eyebrow">Reuniões</div><div className="ink num" style={{ fontSize: 26, fontFamily: 'Manrope', fontWeight: 700 }}>{num(Math.round(reunioes))}</div></div>
          <div><div className="eyebrow">Realizadas</div><div className="ink num" style={{ fontSize: 26, fontFamily: 'Manrope', fontWeight: 700 }}>{num(Math.round(feitas))}</div></div>
          <div><div className="eyebrow">Contratos</div><div className="ok num" style={{ fontSize: 26, fontFamily: 'Manrope', fontWeight: 700 }}>{num(Math.round(contratos))}</div></div>
        </div>
        {p.honorario > 0 && <p className="small">Em honorários: <b className="ink">{brl(contratos * p.honorario, 0)}</b> por mês, nessas premissas.</p>}
        <div className="panel pad-sm alt small"><b className="ink">Sensibilidade:</b> cada 5 pontos a mais na taxa de marcação somam cerca de {num(Math.round(mais5 * 10) / 10)} {Math.round(mais5) === 1 ? 'contrato' : 'contratos'} por mês{p.honorario ? ` (${brl(mais5 * p.honorario, 0)})` : ''}. É a taxa em que a {CLIENTE.agente} mais atua.</div>
      </section>
    </div>
  )
}

function Recibo() {
  const { visao } = useCentral()
  const { dados: diario } = useSecao<DadosDiario>('diario')
  const [minutos, setMinutos] = useState(6)
  const m = diario?.metricas.d30
  const r = dadosDe(visao?.resultados)
  if (!m || !r) return <div className="panel pad"><Esqueleto linhas={6} /></div>
  const auto = (diario?.execs || []).filter(e => (e.categoria === 'automacao' || e.categoria === 'agenda' || e.categoria === 'origem') && Date.now() - Date.parse(e.at) < 30 * 86400_000 && !/nada feito|PAUSADO|SOMBRA|não encontrado/.test(e.detalhe)).length
  const horas = (m.conversas * minutos + auto * 1) / 60
  const ag = r.marcos.find(x => x.id === 'agendadas')!
  const ct = r.marcos.find(x => x.id === 'contratos')!
  const Linha = ({ k, v, nota }: { k: string; v: string; nota?: string }) => (
    <div className="row between" style={{ padding: '10px 0', borderBottom: '1px solid var(--line-soft)' }}><span className="small">{k}{nota && <span className="tiny faint"> · {nota}</span>}</span><b className="ink num">{v}</b></div>
  )
  return (
    <div className="stack-sm">
      <div className="row between wrap no-print">
        <label className="small row" style={{ gap: 8 }}>Minutos que a equipe gastaria por conversa: <input type="number" min={1} max={60} value={minutos} onChange={e => setMinutos(Math.max(1, Number(e.target.value) || 1))} className="campo" style={{ width: 80 }} /></label>
        <button className="btn primary" onClick={() => window.print()}><Printer size={14} /> Imprimir ou salvar PDF</button>
      </div>
      <section className="panel pad recibo">
        <div className="eyebrow">Recibo de valor · últimos 30 dias</div>
        <h2 style={{ fontSize: 22, marginTop: 6 }}>{CLIENTE.nomeCompleto}</h2>
        <p className="tiny faint" style={{ marginTop: 4 }}>Emitido em {new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} pela Central de IA.</p>
        <div style={{ marginTop: 14 }}>
          <Linha k={`Conversas atendidas pela ${CLIENTE.agente}`} v={num(m.conversas)} />
          <Linha k={`Reuniões marcadas pela ${CLIENTE.agente}`} v={num(m.reunioesGabi)} nota="reserva confirmada" />
          <Linha k="Reuniões marcadas no total (Kommo)" v={num(ag.trintaDias)} nota="lead distinto" />
          <Linha k="Contratos pagos (Kommo)" v={num(ct.trintaDias)} nota="venda ganha no CLOSER" />
          <Linha k="Ações feitas sozinhas" v={num(auto)} nota="cards movidos, agenda e origem gravadas" />
          <Linha k="Tempo da equipe poupado" v={`${num(Math.round(horas * 10) / 10)} h`} nota={`estimativa: ${minutos} min por conversa + 1 min por ação`} />
          <Linha k="Custo da IA" v={brl(m.custoBrl)} nota="estimado por execução" />
        </div>
        <p className="tiny faint" style={{ marginTop: 12 }}>Premissas: reunião marcada não é contrato e contrato não é receita recebida. O tempo poupado é estimativa ajustável acima. Movimentações em massa no Kommo não contam.</p>
      </section>
    </div>
  )
}

function Conteudo() {
  const { visao, carregandoVisao, atualizarVisao } = useCentral()
  const [aba, setAba] = useAba(ABAS.map(a => a.id), 'resumo')
  return (
    <div className="stack">
      <PageIntro eyebrow="Resultados" title="O valor que a operação" accent="produziu." description="Números do Kommo e do diário da Central, com a fonte e a regra de contagem sempre à vista."
        action={<Atualizar onClick={() => atualizarVisao(true)} carregando={carregandoVisao} em={dadosDe(visao?.resultados)?._em} />} />
      <FocusNav items={ABAS} value={aba} onChange={setAba} />
      {aba === 'resumo' && <Resumo />}
      {aba === 'radar' && <RadarAba />}
      {aba === 'origem' && <Origem />}
      {aba === 'ese' && <ESe />}
      {aba === 'recibo' && <Recibo />}
    </div>
  )
}

export default function Resultados() {
  return <Suspense fallback={<Esqueleto linhas={6} />}><Conteudo /></Suspense>
}
