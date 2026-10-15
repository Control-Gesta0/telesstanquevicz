import { CRM_MAP, portaById, type Porta } from './crm-map'
import type { LeadState } from './state'

/**
 * Roteador do primeiro contato. SEM MENU NUMERADO (decisão de 15/10/2026): a Stela entende o que a
 * pessoa escreveu. Ordem: porta travada → palavra-chave inequívoca (código, zero token) → triagem
 * por IA (lib/triagem.ts) → abertura, pergunta aberta, áreas → equipe. A porta, travada, nunca muda.
 */

export type Rota =
  | { tipo: 'porta'; porta: Porta; travou: boolean; patch?: Partial<LeadState> }
  | { tipo: 'mensagem'; texto: string; patch: Partial<LeadState> }
  | { tipo: 'encerrar'; motivo: 'fora_do_escopo'; texto: string; patch: Partial<LeadState> }
  | { tipo: 'triagem' }

/** Portas cujos sinais aparecem no texto. */
export function classificar(text: string, portas = CRM_MAP.portas): Porta[] {
  return portas.filter(p => p.sinais.source !== '$^' && p.sinais.test(text))
}

/** Uma porta só, ou a de maior `prioridade` quando o texto casa com várias ("busca e apreensão do carro" → DBA). */
export function escolherPorta(achadas: Porta[]): Porta | null {
  if (achadas.length <= 1) return achadas[0] || null
  const ord = [...achadas].sort((a, b) => (b.prioridade ?? 0) - (a.prioridade ?? 0))
  return (ord[0].prioridade ?? 0) > (ord[1].prioridade ?? 0) ? ord[0] : null
}

/** Puro: porta travada ou palavra-chave. Se não der, pede a triagem por IA. */
export function rotear(state: LeadState, texto: string): Rota {
  const travada = portaById(state.porta)
  if (travada) return { tipo: 'porta', porta: travada, travou: false }
  const porta = escolherPorta(classificar(texto))
  if (porta) return { tipo: 'porta', porta, travou: true }
  return { tipo: 'triagem' }
}

export type Assunto = 'rcpcc' | 'rcv' | 'dba' | 'fora' | 'outro' | 'indefinido'
export interface Triagem { assunto: Assunto; nome: string }

export function primeiroNome(nome: string): string {
  const p = (nome || '').trim().split(/\s+/)[0] || ''
  return p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : ''
}

/** Primeira resposta da Stela que não é a abertura (fora do escopo, equipe): ela se apresenta antes. */
export function comApresentacao(state: LeadState, nome: string, texto: string): string {
  if (state.aberturaEnviada) return texto
  const n = primeiroNome(nome)
  return `${n ? `Oi, ${n}!` : 'Oi!'} ${CRM_MAP.abertura.apresentacao} ${texto.replace(/^(Entendi|Anotei aqui)\.\s*/, '')}`
}

/** Puro (testado): o que fazer com o resultado da triagem. */
export function decidirTriagem(state: LeadState, t: Triagem): Rota {
  const A = CRM_MAP.abertura
  const nomeDito = (t.nome || '').trim()
  const nome = primeiroNome(nomeDito || state.respostas?.nome || '')
  const patchNome: Partial<LeadState> = nomeDito ? { respostas: { ...(state.respostas || {}), nome: nomeDito } } : {}
  const outros = portaById(A.portaOutros)!

  const porta = portaById(t.assunto)
  if (porta && porta.ativa && t.assunto !== 'outro') return { tipo: 'porta', porta, travou: true, patch: patchNome }
  if (t.assunto === 'fora') return { tipo: 'encerrar', motivo: 'fora_do_escopo', texto: comApresentacao(state, nome, A.foraDoEscopo), patch: { ...patchNome, aberturaEnviada: true } }
  if (t.assunto === 'outro') return { tipo: 'porta', porta: outros, travou: true, patch: patchNome }

  const n = (state.tentativasTriagem || 0) + 1
  if (n > A.maxTentativas) return { tipo: 'porta', porta: outros, travou: true, patch: patchNome }
  const preencher = (s: string) => s.replace('{nome}', nome).replace('{nomeVirgula}', nome ? `${nome}, ` : '')
  const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  const texto = !state.aberturaEnviada
    ? (nome ? preencher(A.comNome) : A.semNome)
    : n <= 2
      ? (nomeDito && !state.respostas?.nome ? preencher(A.entenderComNome) : A.entender)
      : capital(preencher(A.areas))
  return { tipo: 'mensagem', texto, patch: { ...patchNome, aberturaEnviada: true, tentativasTriagem: n } }
}
