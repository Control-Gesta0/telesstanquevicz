'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { ArrowLeft, BookOpen, CheckCircle2, ClipboardList, FlaskConical, MessageSquarePlus, PencilLine, Send, Shield, Sparkles, XCircle } from 'lucide-react'
import { useCentral } from '@/components/Shell'
import { Esqueleto, ErroFonte, Ic, PageIntro, SectionTitle, Vazio, useAba } from '@/components/ui'
import { CLIENTE } from '@/lib/cliente'
import { brl, dataHoraBR } from '@/lib/formato'
import type { DadosRegras, PedidoEnsino, RespostaLab } from '@/lib/tipos'
import { acao, useSecao } from '@/lib/useDados'

type Modo = 'inicio' | 'testar' | 'ensinar' | 'regras' | 'pedidos'
const MODOS = ['inicio', 'testar', 'ensinar', 'regras', 'pedidos'] as const

const ASSUNTOS = [
  { id: 'rcpcc', nome: 'Dívida com banco', texto: 'cartão, cheque especial, empréstimo' },
  { id: 'rcv', nome: 'Financiamento de veículo', texto: 'revisão do contrato' },
  { id: 'dba', nome: 'Busca e apreensão', texto: 'veículo apreendido ou em risco' },
]

const ESCOLHAS: Array<{ id: Exclude<Modo, 'inicio'>; Icon: typeof FlaskConical; cor: string; titulo: string; texto: string }> = [
  { id: 'testar', Icon: FlaskConical, cor: '#06b6d4', titulo: `Testar a ${CLIENTE.agente}`, texto: 'Converse como se fosse um lead. Nada vai para o Kommo nem para a agenda.' },
  { id: 'ensinar', Icon: PencilLine, cor: '#a78bfa', titulo: 'Ensinar uma correção', texto: 'Diga, do seu jeito, o que ela deveria ter feito diferente.' },
  { id: 'regras', Icon: BookOpen, cor: '#22c55e', titulo: 'Ler as regras', texto: 'O que ela faz, o que nunca faz e quando passa para a equipe.' },
  { id: 'pedidos', Icon: ClipboardList, cor: '#3b82f6', titulo: 'Pedidos de ensino', texto: 'Acompanhe cada correção até ser publicada.' },
]

function Jornada() {
  const passos = ['Escolha um exemplo', 'Aponte o que ficou torto', 'Diga como deveria ser', 'A equipe testa antes de publicar']
  return (
    <div className="grid g4">
      {passos.map((p, i) => (
        <div key={p} className="panel pad-sm row" style={{ gap: 12 }}>
          <span className="mono cyan" style={{ fontSize: 18, fontWeight: 600 }}>{i + 1}</span>
          <span className="small ink">{p}</span>
        </div>
      ))}
    </div>
  )
}

// ─────────────── laboratório ───────────────

function Laboratorio({ aoCorrigir }: { aoCorrigir: (ex: { lead: string; gabi: string }) => void }) {
  const [porta, setPorta] = useState<string | null>(null)
  const [lab, setLab] = useState<RespostaLab | null>(null)
  const [eventos, setEventos] = useState<string[]>([])
  const [travas, setTravas] = useState<string[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [custo, setCusto] = useState(0)
  const fim = useRef<HTMLDivElement>(null)

  useEffect(() => { fim.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [lab?.mensagens.length])

  const comecar = async (p: string) => {
    setPorta(p); setErro(''); setEventos([]); setTravas([]); setCusto(0); setLab(null)
    try { setLab(await acao<RespostaLab>({ acao: 'laboratorio', porta: p })) } catch (e) { setErro(e instanceof Error ? e.message : 'falhou') }
  }
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lab || !texto.trim()) return
    const msg = texto.trim()
    setTexto(''); setEnviando(true); setErro('')
    setLab({ ...lab, mensagens: [...lab.mensagens, { dir: 'in', text: msg }] })
    try {
      const r = await acao<RespostaLab>({ acao: 'laboratorio', sessao: lab.sessao, msg })
      setLab(r); setEventos(ev => [...r.eventos, ...ev].slice(0, 40)); setTravas(r.travas); setCusto(c => c + (r.custoBrl || 0))
    } catch (err) { setErro(err instanceof Error ? err.message : 'falhou'); setLab(lab) }
    setEnviando(false)
  }

  if (!porta) {
    return (
      <div className="stack-sm">
        <p className="small">Escolha o assunto do lead que você vai fingir ser. A {CLIENTE.agente} começa como se a pessoa tivesse respondido o menu.</p>
        <div className="grid g3">
          {ASSUNTOS.map(a => (
            <button key={a.id} className="panel pad clickable" style={{ textAlign: 'left' }} onClick={() => comecar(a.id)}>
              <h3 style={{ fontSize: 15 }}>{a.nome}</h3>
              <p className="small muted" style={{ marginTop: 4 }}>{a.texto}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const ultimaGabi = lab ? [...lab.mensagens].reverse().find(m => m.dir === 'out')?.text || '' : ''
  const ultimaLead = lab ? [...lab.mensagens].reverse().find(m => m.dir === 'in')?.text || '' : ''
  return (
    <div className="lab">
      <div className="panel" style={{ minWidth: 0 }}>
        <div className="pad-sm row between" style={{ borderBottom: '1px solid var(--line-soft)' }}>
          <div className="small ink"><b>{ASSUNTOS.find(a => a.id === porta)?.nome}</b> <span className="faint">· teste, nada é salvo no Kommo</span></div>
          <button className="link" onClick={() => setPorta(null)}>trocar assunto</button>
        </div>
        <div className="chat" aria-live="polite">
          {!lab ? <Esqueleto linhas={3} /> : lab.mensagens.map((m, i) => <div key={i} className={`bolha ${m.dir}`}>{m.text}</div>)}
          {enviando && <div className="bolha out faint">digitando…</div>}
          <div ref={fim} />
        </div>
        <form onSubmit={enviar} className="pad-sm row" style={{ borderTop: '1px solid var(--line-soft)' }}>
          <input className="campo grow" value={texto} onChange={e => setTexto(e.target.value)} placeholder={lab?.finalizado ? 'Conversa encerrada. Troque o assunto para recomeçar.' : 'Escreva como o lead escreveria…'} disabled={!lab || enviando || lab.finalizado} maxLength={600} />
          <button className="btn primary" disabled={!lab || enviando || !texto.trim() || lab.finalizado} aria-label="Enviar"><Send size={14} /></button>
        </form>
        {erro && <p className="small bad pad-sm">{erro}</p>}
      </div>
      <div className="stack-sm" style={{ minWidth: 0 }}>
        <div className="panel">
          <div className="pad-sm" style={{ borderBottom: '1px solid var(--line-soft)' }}>
            <div className="eyebrow">No Kommo de verdade, ela…</div>
          </div>
          {eventos.length ? eventos.map((e, i) => <div key={i} className="lista-item small"><Sparkles size={13} className="cyan" style={{ marginTop: 3 }} /><span className="grow">{e}</span></div>)
            : <p className="pad-sm small muted">O que ela anotar, mover ou passar para alguém aparece aqui a cada resposta.</p>}
        </div>
        {travas.length > 0 && (
          <div className="panel pad-sm small" style={{ borderColor: 'color-mix(in srgb, var(--purple) 40%, transparent)' }}>
            <div className="row" style={{ gap: 8 }}><Shield size={14} style={{ color: 'var(--purple)' }} /><b className="ink">Uma trava agiu nesta resposta</b></div>
            <p className="muted" style={{ marginTop: 4 }}>{travas.join(' · ')}. A primeira versão foi barrada e reescrita antes de sair.</p>
          </div>
        )}
        {lab && lab.mensagens.length > 3 && (
          <button className="btn" onClick={() => aoCorrigir({ lead: ultimaLead, gabi: ultimaGabi })} style={{ width: '100%', justifyContent: 'center' }}>
            <MessageSquarePlus size={14} /> A última resposta ficou torta? Ensinar
          </button>
        )}
        <p className="tiny faint">Custo deste teste: {brl(custo, 3)} · restam {lab?.restamHoje ?? '…'} mensagens de teste hoje. A agenda do teste é de mentira e nenhuma reunião é marcada.</p>
      </div>
    </div>
  )
}

// ─────────────── ensinar ───────────────

function Ensinar({ exemplo, aoEnviar }: { exemplo: { lead: string; gabi: string } | null; aoEnviar: () => void }) {
  const [lead, setLead] = useState(exemplo?.lead || '')
  const [gabi, setGabi] = useState(exemplo?.gabi || '')
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [feito, setFeito] = useState<PedidoEnsino | null>(null)
  const [erro, setErro] = useState('')

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnviando(true); setErro('')
    try {
      const r = await acao<{ pedido: PedidoEnsino }>({ acao: 'ensino', texto, exemplo: lead || gabi ? { lead, gabi } : undefined })
      setFeito(r.pedido)
    } catch (err) { setErro(err instanceof Error ? err.message : 'falhou') }
    setEnviando(false)
  }

  if (feito) {
    return (
      <div className="panel pad stack-sm">
        <div className="row" style={{ gap: 10 }}><CheckCircle2 size={18} className="ok" /><h3 style={{ fontSize: 16 }}>Recebido. Destino: {feito.destino}.</h3></div>
        <p className="small">{feito.explicacao}</p>
        <p className="tiny faint">Você acompanha o andamento em Pedidos de ensino. Nada muda no atendimento até a equipe técnica testar e publicar.</p>
        <div className="row"><button className="btn" onClick={() => { setFeito(null); setTexto(''); setLead(''); setGabi('') }}>Ensinar outra</button><button className="btn" onClick={aoEnviar}>Ver pedidos</button></div>
      </div>
    )
  }
  return (
    <form onSubmit={enviar} className="stack-sm">
      <Jornada />
      <div className="panel pad stack-sm">
        <div className="eyebrow">1 · O exemplo (opcional)</div>
        <div className="grid g2">
          <label className="small">O lead escreveu<textarea className="campo" style={{ marginTop: 6 }} value={lead} onChange={e => setLead(e.target.value)} placeholder="Ex.: quanto vocês cobram?" maxLength={600} /></label>
          <label className="small">A {CLIENTE.agente} respondeu<textarea className="campo" style={{ marginTop: 6 }} value={gabi} onChange={e => setGabi(e.target.value)} placeholder="Cole a resposta que ficou torta" maxLength={600} /></label>
        </div>
        <div className="eyebrow" style={{ marginTop: 8 }}>2 e 3 · O que ficou torto e como deveria ser</div>
        <textarea className="campo" value={texto} onChange={e => setTexto(e.target.value)} required minLength={8} maxLength={1500}
          placeholder={`Escreva do seu jeito. Ex.: quando a pessoa diz que está desesperada, a ${CLIENTE.agente} deveria acolher antes de perguntar o valor.`} />
        {erro && <p className="small bad">{erro}</p>}
        <div className="row between wrap">
          <p className="tiny faint" style={{ maxWidth: 520 }}>4 · A equipe técnica transforma em regra, roda os cenários de teste da {CLIENTE.agente} e só publica se todos passarem. Se a correção quebrar outro caso, ela volta para você com o motivo.</p>
          <button className="btn primary" disabled={enviando || texto.trim().length < 8}>{enviando ? 'Enviando…' : 'Enviar correção'}</button>
        </div>
      </div>
    </form>
  )
}

// ─────────────── regras ───────────────

function Regras() {
  const { dados, erro, carregando, atualizar } = useSecao<DadosRegras>('regras')
  if (erro && !dados) return <ErroFonte fonte="As regras" erro={erro} onTentar={() => atualizar()} />
  if (carregando || !dados) return <div className="panel pad"><Esqueleto linhas={8} /></div>
  const Bloco = ({ titulo, itens, Icon, cor }: { titulo: string; itens: string[]; Icon: typeof CheckCircle2; cor: string }) => (
    <div className="panel">
      <div className="pad-sm" style={{ borderBottom: '1px solid var(--line-soft)' }}><h3 style={{ fontSize: 14.5 }}>{titulo}</h3></div>
      {itens.map(i => <div key={i} className="lista-item small"><Icon size={14} style={{ color: cor, marginTop: 3, flexShrink: 0 }} /><span>{i}</span></div>)}
    </div>
  )
  return (
    <div className="stack">
      <section>
        <SectionTitle eyebrow="O que ela pergunta" title="Poucas perguntas, uma por vez." description="Ela pula o que a pessoa já contou, inclusive no formulário do anúncio." />
        <div className="grid g3">
          {dados.assuntos.map(a => (
            <div key={a.id} className="panel">
              <div className="pad-sm" style={{ borderBottom: '1px solid var(--line-soft)' }}><h3 style={{ fontSize: 14 }}>{a.nome}</h3></div>
              <ol className="small" style={{ margin: 0, padding: '12px 16px 14px 32px' }}>{a.perguntas.map(p => <li key={p} style={{ marginBottom: 6 }}>{p}</li>)}</ol>
            </div>
          ))}
        </div>
      </section>
      <div className="grid g2">
        <Bloco titulo="O que ela nunca faz" itens={dados.nunca} Icon={XCircle} cor="var(--danger)" />
        <Bloco titulo="Quando ela passa para a equipe" itens={dados.passaParaEquipe} Icon={CheckCircle2} cor="var(--success)" />
      </div>
      <div className="grid g2">
        <Bloco titulo="Reunião e distribuição" itens={[dados.agenda.reuniao, dados.agenda.opcoes, dados.agenda.etapa, dados.agenda.distribuicao]} Icon={CheckCircle2} cor="var(--cyan)" />
        <Bloco titulo="Retomada de quem parou de responder" itens={dados.retomada} Icon={CheckCircle2} cor="var(--purple)" />
      </div>
      <p className="tiny faint">As regras de "nunca faz" são travas em código: se uma resposta casar com uma delas, ela não sai. A {CLIENTE.agente} reescreve uma vez e, se insistir, sai um texto seguro aprovado.</p>
    </div>
  )
}

// ─────────────── pedidos ───────────────

const STATUS: Record<PedidoEnsino['status'], { rotulo: string; classe: string }> = {
  recebido: { rotulo: 'recebido', classe: 'cyan' }, 'em teste': { rotulo: 'em teste', classe: 'warn' }, publicado: { rotulo: 'publicado', classe: 'ok' }, recusado: { rotulo: 'não publicado', classe: 'bad' },
}

function Pedidos() {
  const { perfil } = useCentral()
  const { dados, erro, carregando, atualizar } = useSecao<{ pedidos: PedidoEnsino[]; custoLaboratorioMes: number }>('ensino')
  const mudar = async (id: string, status: PedidoEnsino['status']) => {
    const nota = status === 'recusado' ? window.prompt('Por que não foi publicado? (aparece para o escritório)') || '' : ''
    await acao({ acao: 'ensino-status', id, status, nota }).catch(e => alert(e instanceof Error ? e.message : 'falhou'))
    atualizar()
  }
  if (erro && !dados) return <ErroFonte fonte="Os pedidos" erro={erro} onTentar={() => atualizar()} />
  if (carregando && !dados) return <div className="panel pad"><Esqueleto linhas={4} /></div>
  const lista = dados?.pedidos || []
  return (
    <div className="stack-sm">
      {lista.length ? (
        <div className="panel">
          {lista.map(p => (
            <div key={p.id} className="lista-item">
              <span className={`chip ${STATUS[p.status].classe}`}>{STATUS[p.status].rotulo}</span>
              <div className="grow small" style={{ minWidth: 0 }}>
                <div className="ink">{p.texto}</div>
                {p.exemplo && (p.exemplo.lead || p.exemplo.gabi) && <div className="tiny muted" style={{ marginTop: 4 }}>Exemplo: “{p.exemplo.lead}” → “{p.exemplo.gabi}”</div>}
                <div className="tiny faint" style={{ marginTop: 4 }}>{dataHoraBR(p.em)} · destino: {p.destino}{p.nota ? ` · ${p.nota}` : ''}{perfil === 'agencia' ? ` · enviado por ${p.perfil === 'agencia' ? 'equipe técnica' : 'escritório'}` : ''}</div>
                {perfil === 'agencia' && (
                  <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
                    {(['em teste', 'publicado', 'recusado'] as const).map(s => <button key={s} className="chip" onClick={() => mudar(p.id, s)}>{STATUS[s].rotulo}</button>)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : <Vazio icon={ClipboardList} titulo="Nenhum pedido ainda" texto={`Quando você ensinar uma correção, ela aparece aqui com o andamento: recebido, em teste, publicado.`} />}
      {perfil === 'agencia' && dados && <p className="tiny faint">Laboratório neste mês: {brl(dados.custoLaboratorioMes, 2)} em IA.</p>}
    </div>
  )
}

function Conteudo() {
  const [modo, setModo] = useAba(MODOS, 'inicio', 'modo')
  const [exemplo, setExemplo] = useState<{ lead: string; gabi: string } | null>(null)
  const titulo: Record<Modo, string> = { inicio: '', testar: `Testar a ${CLIENTE.agente}`, ensinar: 'Ensinar uma correção', regras: 'As regras', pedidos: 'Pedidos de ensino' }
  return (
    <div className="stack">
      <PageIntro eyebrow="Ensinar" title={`Ensine a ${CLIENTE.agente}`} accent="sem mexer em código."
        description="Teste uma conversa, aponte o que ficou torto e diga como deveria ser. A correção só entra no atendimento depois de passar nos testes." />
      {modo === 'inicio' ? (
        <>
          <section>
            <SectionTitle eyebrow="Como funciona" title="Quatro passos, nessa ordem." />
            <Jornada />
          </section>
          <section>
            <SectionTitle eyebrow="O que você quer fazer?" title="Escolha uma opção." />
            <div className="grid g4">
              {ESCOLHAS.map(e => (
                <button key={e.id} className="panel pad clickable" style={{ textAlign: 'left' }} onClick={() => { setExemplo(null); setModo(e.id) }}>
                  <Ic icon={e.Icon} color={e.cor} />
                  <h3 style={{ fontSize: 15, marginTop: 14 }}>{e.titulo}</h3>
                  <p className="small" style={{ marginTop: 6 }}>{e.texto}</p>
                </button>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="stack-sm">
          <div className="row between wrap">
            <h2 style={{ fontSize: 20 }}>{titulo[modo]}</h2>
            <button className="btn" onClick={() => setModo('inicio')}><ArrowLeft size={14} /> Todas as opções</button>
          </div>
          {modo === 'testar' && <Laboratorio aoCorrigir={ex => { setExemplo(ex); setModo('ensinar') }} />}
          {modo === 'ensinar' && <Ensinar key={exemplo?.gabi || 'novo'} exemplo={exemplo} aoEnviar={() => setModo('pedidos')} />}
          {modo === 'regras' && <Regras />}
          {modo === 'pedidos' && <Pedidos />}
        </section>
      )}
    </div>
  )
}

export default function Cerebro() {
  return <Suspense fallback={<Esqueleto linhas={6} />}><Conteudo /></Suspense>
}
