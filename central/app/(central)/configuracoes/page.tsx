'use client'

import { Suspense } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, GitBranch, KeyRound, RotateCcw, Server, Users, Zap } from 'lucide-react'
import { useCentral } from '@/components/Shell'
import { PapelChip } from '@/components/Funil'
import { Esqueleto, ErroFonte, Ic, PageIntro, SectionTitle, useAba } from '@/components/ui'
import { CLIENTE } from '@/lib/cliente'
import { brl, num } from '@/lib/formato'
import type { DadosRegras } from '@/lib/tipos'
import { dadosDe, useSecao } from '@/lib/useDados'

type Aba = 'mapa' | 'funil' | 'distribuicao' | 'automacoes' | 'retomada' | 'sistema' | 'seguranca'
const ABAS = ['mapa', 'funil', 'distribuicao', 'automacoes', 'retomada', 'sistema', 'seguranca'] as const

const DESTINOS: Array<{ id: Exclude<Aba, 'mapa'>; Icon: typeof GitBranch; cor: string; titulo: string; texto: string }> = [
  { id: 'funil', Icon: GitBranch, cor: '#06b6d4', titulo: 'Funil e etapas', texto: 'As etapas do SDR e do CLOSER e como o card chega em cada uma.' },
  { id: 'distribuicao', Icon: Users, cor: '#a78bfa', titulo: 'Agenda e distribuição', texto: 'Reunião, horários oferecidos e quem recebe cada lead.' },
  { id: 'automacoes', Icon: Zap, cor: '#a78bfa', titulo: 'Automações', texto: 'O que anda sozinho no funil e na agenda.' },
  { id: 'retomada', Icon: RotateCcw, cor: '#22c55e', titulo: 'Retomada', texto: 'Quando e como a Stela volta a chamar quem parou de responder.' },
  { id: 'sistema', Icon: Server, cor: '#3b82f6', titulo: 'Sistema', texto: 'O que está ligado, as fontes de dados e a versão.' },
  { id: 'seguranca', Icon: KeyRound, cor: '#f59e0b', titulo: 'Acesso e segurança', texto: 'Senha, sessão e o que fica protegido.' },
]

function Funil() {
  const { visao } = useCentral()
  const f = dadosDe(visao?.funil)
  if (!visao) return <div className="panel pad"><Esqueleto linhas={8} /></div>
  if (!f) return <ErroFonte fonte="O funil do Kommo" erro={visao.funil.ok ? '' : visao.funil.erro} />
  return (
    <div className="grid g2">
      {f.funis.map(fu => (
        <div key={fu.id} className="panel">
          <div className="pad-sm" style={{ borderBottom: '1px solid var(--line-soft)' }}><h3 style={{ fontSize: 15 }}>{fu.nome}</h3></div>
          {fu.etapas.map((e, i) => (
            <div key={e.id} className="lista-item small">
              <span className="mono faint" style={{ width: 16 }}>{i + 1}</span>
              <div className="grow"><div className="row" style={{ gap: 8 }}><b className="ink">{e.nome}</b><PapelChip papel={e.papel} /></div><div className="muted" style={{ marginTop: 2 }}>{e.como || 'Etapa da equipe.'}</div></div>
            </div>
          ))}
        </div>
      ))}
      <p className="tiny faint">Para mudar etapa (nome, ordem, criar ou apagar), fale com a equipe técnica: as automações e a {CLIENTE.agente} usam o código de cada etapa, e a troca é conferida antes de valer.</p>
    </div>
  )
}

function Lista({ itens }: { itens: string[] }) {
  return <div className="panel divide">{itens.map(i => <div key={i} className="lista-item small"><CheckCircle2 size={14} className="cyan" style={{ marginTop: 3, flexShrink: 0 }} /><span>{i}</span></div>)}</div>
}

function ComRegras({ aba }: { aba: 'distribuicao' | 'automacoes' | 'retomada' }) {
  const { dados, erro, carregando, atualizar } = useSecao<DadosRegras>('regras')
  if (erro && !dados) return <ErroFonte fonte="As regras" erro={erro} onTentar={() => atualizar()} />
  if (carregando || !dados) return <div className="panel pad"><Esqueleto linhas={5} /></div>
  if (aba === 'distribuicao') return <Lista itens={[dados.agenda.reuniao, dados.agenda.opcoes, dados.agenda.etapa, dados.agenda.distribuicao]} />
  if (aba === 'retomada') return <Lista itens={dados.retomada} />
  return <div className="panel divide">{dados.automacoes.map(a => <div key={a.gatilho} className="lista-item small"><Zap size={14} className="purple" style={{ marginTop: 3, flexShrink: 0 }} /><div><b className="ink">{a.gatilho}</b><div className="muted" style={{ marginTop: 2 }}>{a.efeito}</div></div></div>)}</div>
}

function Sistema() {
  const { visao } = useCentral()
  const s = dadosDe(visao?.saude)
  if (!visao) return <div className="panel pad"><Esqueleto linhas={8} /></div>
  if (!s) return <ErroFonte fonte="O sistema" erro={visao.saude.ok ? '' : visao.saude.erro} />
  return (
    <div className="stack">
      <section>
        <SectionTitle eyebrow="Prontidão" title="O que está ligado." />
        <div className="panel divide">
          {s.prontidao.map(i => (
            <div key={i.id} className="lista-item">
              {i.ok ? <CheckCircle2 size={17} className="ok" /> : <Circle size={17} className="warn" />}
              <div className="grow"><div className="small ink">{i.nome}</div><div className="tiny muted" style={{ marginTop: 2 }}>{i.estado}</div>{i.oQueFalta && <div className="tiny warn" style={{ marginTop: 2 }}>Falta: {i.oQueFalta}</div>}</div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <SectionTitle eyebrow="Fontes" title="De onde a Central lê." description="Se uma fonte não responde, os números dela ficam em branco: nunca aparecem como zero." />
        <div className="grid g3">
          {s.fontes.map(f => (
            <div key={f.fonte} className="panel pad-sm row">
              <span className="dot" style={{ color: f.ok ? 'var(--success)' : 'var(--danger)' }} />
              <div className="grow small"><b className="ink">{f.fonte}</b><div className="tiny muted">{f.ok ? `respondeu em ${num(f.ms)} ms` : `sem resposta: ${f.erro}`}</div></div>
            </div>
          ))}
        </div>
      </section>
      <section className="panel pad small">
        <div className="grid g3">
          <div><div className="eyebrow">Versão</div><div className="ink mono" style={{ marginTop: 4 }}>{s.versao}</div></div>
          <div><div className="eyebrow">Câmbio do custo</div><div className="ink" style={{ marginTop: 4 }}>{brl(s.usdBrl)} por dólar</div></div>
          <div><div className="eyebrow">Atualização do funil</div><div className="ink" style={{ marginTop: 4 }}>a cada 10 minutos</div></div>
        </div>
      </section>
    </div>
  )
}

function Seguranca() {
  const { perfil } = useCentral()
  return (
    <Lista itens={[
      `Você entrou como ${perfil === 'agencia' ? 'equipe técnica' : 'escritório'}. A sessão vale 12 horas neste aparelho; depois disso a Central pede a senha de novo.`,
      'Depois de 8 senhas erradas seguidas, o acesso daquele aparelho fica bloqueado por 15 minutos.',
      'A Central só lê o Kommo. Ela não apaga nem edita card. O que muda no funil são as automações descritas aqui, que conferem o card antes de agir.',
      'Nomes aparecem só pelo primeiro nome. Telefone, e-mail e CPF são retirados antes de chegar na tela.',
      'O teste da Stela em Ensinar roda num funil de mentira: nada é gravado no Kommo e nenhuma reunião é marcada.',
      'Para trocar a senha, peça à equipe técnica. A senha nunca fica guardada em texto: só a versão embaralhada dela.',
    ]} />
  )
}

function Conteudo() {
  const [aba, setAba] = useAba(ABAS, 'mapa')
  const atual = DESTINOS.find(d => d.id === aba)
  return (
    <div className="stack">
      <PageIntro eyebrow="Configurações" title="Como a operação" accent="está montada." description="Escolha um assunto. Cada um abre numa página própria." />
      {aba === 'mapa' ? (
        <div className="grid g3">
          {DESTINOS.map(d => (
            <button key={d.id} className="panel pad clickable" style={{ textAlign: 'left' }} onClick={() => setAba(d.id)}>
              <Ic icon={d.Icon} color={d.cor} />
              <h3 style={{ fontSize: 15, marginTop: 14 }}>{d.titulo}</h3>
              <p className="small" style={{ marginTop: 6 }}>{d.texto}</p>
              <span className="link" style={{ marginTop: 10 }}>Abrir <ArrowRight size={12} /></span>
            </button>
          ))}
        </div>
      ) : (
        <section className="stack-sm">
          <div className="row between wrap"><h2 style={{ fontSize: 20 }}>{atual?.titulo}</h2><button className="btn" onClick={() => setAba('mapa')}><ArrowLeft size={14} /> Todos os assuntos</button></div>
          {aba === 'funil' && <Funil />}
          {(aba === 'distribuicao' || aba === 'automacoes' || aba === 'retomada') && <ComRegras aba={aba} />}
          {aba === 'sistema' && <Sistema />}
          {aba === 'seguranca' && <Seguranca />}
        </section>
      )}
    </div>
  )
}

export default function Configuracoes() {
  return <Suspense fallback={<Esqueleto linhas={6} />}><Conteudo /></Suspense>
}
