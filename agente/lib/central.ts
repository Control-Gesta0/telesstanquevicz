import crypto from 'crypto'
import { waitUntil } from '@vercel/functions'
import { CONFIG } from './config'
import { CRM_MAP, portaById } from './crm-map'
import { costUsd, emptyUsage, readExecs, type ExecEntry } from './execlog'
import type { ChatMsg } from './history'
import { kommoGet, type KommoFieldValue, type KommoLead } from './kommo'
import { leadsComReuniao, lembretesDevidos } from './lembretes'
import { createBrain } from './llm'
import { resumoRastreio } from './rastreio'
import { k, redis } from './redis'
import { REGRAS_CLIENTE } from './regras'
import { comApresentacao } from './router'
import { rotearTurno } from './triagem'
import type { LeadPort } from './tools'
import type { LeadState } from './state'

/**
 * Fonte de dados da Central v5 (painel do cliente). Só leitura no Kommo, com três exceções
 * que nunca tocam o CRM: pedidos de ensino, laboratório (porta em memória, Calendly falso)
 * e o login. A Central chama com CENTRAL_SECRET, que é diferente do WEBHOOK_SECRET.
 *
 * Tudo que é número sai daqui calculado em código. Nada vira estimativa sem dizer que é.
 */

export const SISTEMA_VERSAO = '2026.10.14-v5'

const DIA = 86400
const agoraS = () => Math.floor(Date.now() / 1000)
const USD_BRL = () => Number(process.env.USD_BRL || 5.4)
const dataBR = (ms: number) => new Date(ms).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
const diaBR = (ms: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(ms))

// ─────────────────────────────── privacidade ───────────────────────────────

/** Primeiro nome só, para a tela. Telefone ou número no lugar do nome vira "Lead sem nome". */
export function primeiroNome(nome?: string): string {
  const limpo = (nome || '').replace(/[^\p{L}\s'-]/gu, ' ').trim()
  const p = limpo.split(/\s+/)[0] || ''
  if (p.length < 2) return 'Lead sem nome'
  return p[0].toUpperCase() + p.slice(1).toLowerCase()
}

/** Tira telefone, e-mail e CPF/processo de qualquer texto que vai para a tela. */
export function anonimizar(texto: string): string {
  return (texto || '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '•••@•••')
    .replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '•••')
    .replace(/\+?\d[\d\s().-]{8,}\d/g, '•••')
}

// ─────────────────────────────── cache ───────────────────────────────

/**
 * Cache com leitura velha permitida: até `maxIdade` serve direto; depois disso serve a
 * última leitura e atualiza por trás (o funil do SDR tem 10 mil leads e leva ~15 s).
 * Sem leitura nenhuma, espera a primeira.
 */
async function cache<T>(nome: string, maxIdade: number, fresco: boolean, fn: () => Promise<T>): Promise<T & { _em: string; _velho?: boolean }> {
  const chave = k('central', 'cache', nome)
  const atualizar = async () => {
    const valor = { ...(await fn()), _em: new Date().toISOString() } as T & { _em: string }
    await redis.set(chave, valor, { ex: 2 * DIA }).catch(() => {})
    return valor
  }
  const hit = await redis.get<T & { _em: string }>(chave).catch(() => null)
  if (fresco || !hit) {
    try { return await atualizar() } catch (e) {
      if (hit) { console.error(`[central] ${nome} falhou, servindo a leitura anterior:`, e); return { ...hit, _velho: true } }
      throw e
    }
  }
  if (Date.now() - Date.parse(hit._em) <= maxIdade * 1000) return hit
  const trava = await redis.set(k('central', 'atualizando', nome), 1, { nx: true, ex: 90 }).catch(() => null)
  if (trava) waitUntil(atualizar().catch(e => console.error(`[central] atualizar ${nome}:`, e)).finally(() => redis.del(k('central', 'atualizando', nome))))
  return { ...hit, _velho: true }
}

/**
 * Uma fila só para as leituras da Central no Kommo (limite da conta: 7 por segundo).
 * Funil, resultados e origem atualizam juntos; sem a fila, estouravam o limite e a fonte caía.
 */
const MAX_KOMMO = 4
let emVoo = 0
const espera: Array<() => void> = []
async function kommoLimitado<T>(path: string): Promise<T> {
  if (emVoo >= MAX_KOMMO) await new Promise<void>(r => espera.push(r))
  emVoo++
  try { return await kommoGet<T>(path) } finally { emVoo--; espera.shift()?.() }
}

async function paginas<T>(montar: (page: number) => string, chave: string, max: number, por = 250, paralelo = 4): Promise<{ itens: T[]; truncado: boolean }> {
  const itens: T[] = []
  let fim = false
  for (let base = 1; base <= max && !fim; base += paralelo) {
    const lote = Array.from({ length: Math.min(paralelo, max - base + 1) }, (_, i) => base + i)
    const res = await Promise.all(lote.map(p => kommoLimitado<{ _embedded?: Record<string, T[]> }>(montar(p))))
    for (const r of res) {
      const xs = r?._embedded?.[chave] || []
      itens.push(...xs)
      if (xs.length < por) fim = true
    }
  }
  return { itens, truncado: !fim }
}

// ─────────────────────────────── funil ───────────────────────────────

const FUNIS = [
  { id: 9299515, nome: 'SDR' },
  { id: 9312103, nome: 'CLOSER' },
]

/** Como o card chega em cada etapa. É o que a Central explica ao lado do número. */
const PAPEL: Record<number, { papel: 'gabi' | 'automacao' | 'time'; como: string }> = {
  72104583: { papel: 'gabi', como: 'Lead novo do WhatsApp. A Stela atende aqui; quando o lead escreve, vai sozinho para Em atendimento.' },
  72186399: { papel: 'gabi', como: 'Conversa em andamento com a Stela ou com a equipe.' },
  72104595: { papel: 'automacao', como: 'Parou de responder. Se escrever, volta sozinho para Em atendimento; 5 dias sem resposta, vai para perdido.' },
  86825532: { papel: 'gabi', como: 'Reunião marcada pela Stela ou pelo Calendly.' },
  72113011: { papel: 'time', como: 'Faltou à reunião. A equipe remarca.' },
  72186407: { papel: 'time', como: 'Entrada do CLOSER.' },
  72851523: { papel: 'automacao', como: 'Chega sozinho quando a reunião é marcada como realizada no SDR.' },
  72686979: { papel: 'time', como: 'Contrato enviado. A equipe acompanha a assinatura.' },
  72186419: { papel: 'time', como: 'Aguardando pagamento. Pago, vai sozinho para o Jurídico.' },
}

/** Etapa de estacionamento: parado é o estado normal, não entra no radar. */
const SEM_RADAR = new Set([72104595])

export interface Amostra { id: number; nome: string; dias: number; valor: number; responsavel: string }
export interface EtapaFoto { id: number; nome: string; n: number; valor: number; parados: number; novos7d: number; papel: string; como: string; radar: boolean; amostras: Amostra[] }
export interface FunilFoto { id: number; nome: string; n: number; valor: number; etapas: EtapaFoto[] }

type LeadCru = KommoLead & { updated_at?: number; created_at?: number }

const nomeEtapa = (s: { name: string; type?: number }) => (s.type === 1 ? 'Leads de entrada' : s.name)

/** Puro (testado): agrega os leads ativos nas etapas do funil. */
export function agregarFunil(funil: { id: number; nome: string }, statuses: Array<{ id: number; name: string; type?: number; sort: number }>, leads: LeadCru[], agora: number, nomes: Record<number, string> = {}): FunilFoto {
  const etapas: EtapaFoto[] = statuses
    .filter(s => s.id !== 142 && s.id !== 143)
    .sort((a, b) => a.sort - b.sort)
    .map(s => ({ id: s.id, nome: nomeEtapa(s), n: 0, valor: 0, parados: 0, novos7d: 0, papel: PAPEL[s.id]?.papel || 'time', como: PAPEL[s.id]?.como || '', radar: !SEM_RADAR.has(s.id), amostras: [] }))
  const porId = new Map(etapas.map(e => [e.id, e]))
  const parados: Record<number, Amostra[]> = {}
  for (const l of leads) {
    if (l.pipeline_id !== funil.id) continue
    const e = porId.get(l.status_id)
    if (!e) continue
    e.n++
    e.valor += Number(l.price || 0)
    if (l.created_at && agora - l.created_at <= 7 * DIA) e.novos7d++
    const dias = l.updated_at ? Math.floor((agora - l.updated_at) / DIA) : 0
    if (dias >= 7) {
      e.parados++
      ;(parados[e.id] ||= []).push({ id: l.id, nome: primeiroNome(l.name), dias, valor: Number(l.price || 0), responsavel: nomes[l.responsible_user_id || 0] || '' })
    }
  }
  for (const e of etapas) e.amostras = (parados[e.id] || []).sort((a, b) => b.valor - a.valor || b.dias - a.dias).slice(0, 5)
  return { id: funil.id, nome: funil.nome, n: etapas.reduce((s, e) => s + e.n, 0), valor: etapas.reduce((s, e) => s + e.valor, 0), etapas }
}

async function usuarios(): Promise<Record<number, string>> {
  const j = await kommoLimitado<{ _embedded?: { users?: Array<{ id: number; name: string }> } }>('/api/v4/users?limit=250')
  const out: Record<number, string> = {}
  for (const u of j._embedded?.users || []) out[u.id] = CRM_MAP.negocio.responsaveis.nomes[u.id] || (/advogados/i.test(u.name) ? 'Escritório' : /^adm\b/i.test(u.name) ? 'Administrador' : primeiroNome(u.name))
  return out
}

export async function funil(fresco = false) {
  return cache('funil', 600, fresco, async () => {
    const [nomes, ...pipes] = await Promise.all([usuarios(), ...FUNIS.map(f => kommoLimitado<{ _embedded: { statuses: Array<{ id: number; name: string; type?: number; sort: number }> } }>(`/api/v4/leads/pipelines/${f.id}`))])
    const filtro: string[] = []
    FUNIS.forEach((f, i) => pipes[i]._embedded.statuses.filter(s => s.id !== 142 && s.id !== 143).forEach(s => filtro.push(`filter[statuses][${filtro.length}][pipeline_id]=${f.id}&filter[statuses][${filtro.length}][status_id]=${s.id}`)))
    const { itens, truncado } = await paginas<LeadCru>(p => `/api/v4/leads?limit=250&page=${p}&${filtro.join('&')}&order[id]=asc`, 'leads', 80, 250, 6)
    const agora = agoraS()
    return { funis: FUNIS.map((f, i) => agregarFunil(f, pipes[i]._embedded.statuses, itens, agora, nomes)), truncado, usuarios: nomes }
  })
}

// ─────────────────────────────── resultados (eventos do Kommo) ───────────────────────────────

interface EventoCru { entity_id: number; created_at: number; created_by: number }

/**
 * Puro (testado): conta lead DISTINTO que entrou na etapa, sem movimentação em massa.
 * Massa = mais de 5 mudanças do mesmo usuário no mesmo minuto (limpeza de funil, não venda).
 */
export function limparEventos(evs: EventoCru[]): { n: number; massa: number; porDia: Record<string, number> } {
  const grupos: Record<string, number> = {}
  for (const e of evs) grupos[`${e.created_by}:${Math.floor(e.created_at / 60)}`] = (grupos[`${e.created_by}:${Math.floor(e.created_at / 60)}`] || 0) + 1
  const vistos = new Set<number>()
  const porDia: Record<string, number> = {}
  let massa = 0
  for (const e of [...evs].sort((a, b) => a.created_at - b.created_at)) {
    if (grupos[`${e.created_by}:${Math.floor(e.created_at / 60)}`] > 5) { massa++; continue }
    if (vistos.has(e.entity_id)) continue
    vistos.add(e.entity_id)
    const d = diaBR(e.created_at * 1000)
    porDia[d] = (porDia[d] || 0) + 1
  }
  return { n: vistos.size, massa, porDia }
}

const MARCOS = [
  { id: 'agendadas', nome: 'Reuniões marcadas', pipelineId: 9299515, statusId: 86825532 },
  { id: 'realizadas', nome: 'Reuniões realizadas', pipelineId: 9299515, statusId: 142 },
  { id: 'noshow', nome: 'Faltaram à reunião', pipelineId: 9299515, statusId: 72113011 },
  { id: 'contratos', nome: 'Contratos pagos', pipelineId: 9312103, statusId: 142 },
]

export async function resultados(fresco = false) {
  return cache('resultados', 900, fresco, async () => {
    const desde = agoraS() - 30 * DIA
    const marcos = await Promise.all(MARCOS.map(async m => {
      const { itens, truncado } = await paginas<EventoCru>(p => `/api/v4/events?limit=100&page=${p}&filter[type]=lead_status_changed&filter[created_at][from]=${desde}&filter[value_after][leads_statuses][0][pipeline_id]=${m.pipelineId}&filter[value_after][leads_statuses][0][status_id]=${m.statusId}`, 'events', 30, 100, 3)
      const limpo = limparEventos(itens)
      const seteDias = Object.entries(limpo.porDia).filter(([d]) => d >= diaBR(Date.now() - 6 * DIA * 1000)).reduce((s, [, n]) => s + n, 0)
      return { id: m.id, nome: m.nome, trintaDias: limpo.n, seteDias, emMassa: limpo.massa, porDia: limpo.porDia, truncado }
    }))
    return { marcos }
  })
}

// ─────────────────────────────── origem ───────────────────────────────

/** Puro (testado): de onde vieram os leads criados no período. */
export function agregarOrigem(leads: LeadCru[]): { total: number; deOnde: Record<string, number>; campanhas: Record<string, number> } {
  const r = CRM_MAP.rastreio
  const nomeEnum = Object.fromEntries(Object.entries(r.deOnde.enums).map(([nome, id]) => [id, nome]))
  const deOnde: Record<string, number> = {}
  const campanhas: Record<string, number> = {}
  for (const l of leads) {
    const cf = l.custom_fields_values || []
    const v = cf.find(f => f.field_id === r.deOnde.fieldId)?.values?.[0]
    const origem = (v?.enum_id && nomeEnum[v.enum_id]) || (v?.value ? String(v.value) : 'Sem origem registrada')
    deOnde[origem] = (deOnde[origem] || 0) + 1
    const camp = cf.find(f => f.field_id === r.campos.utm_campaign)?.values?.[0]?.value
    if (camp) campanhas[String(camp)] = (campanhas[String(camp)] || 0) + 1
  }
  return { total: leads.length, deOnde, campanhas }
}

export async function origem(fresco = false) {
  return cache('origem', 900, fresco, async () => {
    const desde = agoraS() - 30 * DIA
    const [{ itens, truncado }, links] = await Promise.all([
      paginas<LeadCru>(p => `/api/v4/leads?limit=250&page=${p}&filter[created_at][from]=${desde}`, 'leads', 20),
      resumoRastreio(30),
    ])
    const sete = itens.filter(l => (l.created_at || 0) >= agoraS() - 7 * DIA)
    return { trintaDias: agregarOrigem(itens), seteDias: agregarOrigem(sete), links, linksLigados: !!process.env.WHATSAPP_NUMERO, truncado }
  })
}

// ─────────────────────────────── agenda ───────────────────────────────

const ETAPA_NOME: Record<number, string> = { 86825532: 'Reunião agendada', 72113011: 'No-show', 72186399: 'Em atendimento', 83784180: 'DIRETORIA › reuniões agendadas' }

export async function agenda(fresco = false) {
  return cache('agenda', 300, fresco, async () => {
    const [leads, nomes] = await Promise.all([leadsComReuniao(), usuarios()])
    const agoraMs = Date.now()
    const futuras = leads.filter(l => l.reuniaoEm && l.reuniaoEm * 1000 > agoraMs).sort((a, b) => (a.reuniaoEm || 0) - (b.reuniaoEm || 0))
    const hoje = diaBR(agoraMs)
    const amanha = diaBR(agoraMs + DIA * 1000)
    return {
      proximas: futuras.slice(0, 40).map(l => ({
        id: l.id, nome: primeiroNome(l.name), em: new Date((l.reuniaoEm || 0) * 1000).toISOString(), quando: dataBR((l.reuniaoEm || 0) * 1000),
        etapa: ETAPA_NOME[l.statusId] || '', responsavel: nomes[l.responsavelId || 0] || '',
      })),
      hoje: futuras.filter(l => diaBR((l.reuniaoEm || 0) * 1000) === hoje).length,
      amanha: futuras.filter(l => diaBR((l.reuniaoEm || 0) * 1000) === amanha).length,
      seteDias: futuras.filter(l => (l.reuniaoEm || 0) * 1000 - agoraMs <= 7 * DIA * 1000).length,
      lembretes: {
        modo: (process.env.LEMBRETES_MODO || 'sombra') === 'ativo' ? 'ativo' : 'sombra',
        venceAgora: lembretesDevidos(leads, agoraMs).length,
        regras: CRM_MAP.lembretes.tipos.map(t => t.id),
      },
    }
  })
}

// ─────────────────────────────── diário ───────────────────────────────

export interface ExecTela { at: string; tipo: ExecEntry['tipo']; leadId: number; nome: string; porta?: string; ms?: number; tools: string[]; travas: string[]; custoBrl: number | null; urgente: boolean; detalhe: string; categoria: 'gabi' | 'retomada' | 'automacao' | 'agenda' | 'origem' | 'erro' }

export function categoria(e: ExecEntry): ExecTela['categoria'] {
  if (e.tipo === 'erro') return 'erro'
  if (e.tipo === 'followup') return 'retomada'
  if (e.tipo === 'lembrete') return 'agenda'
  if (e.tipo === 'automacao') return /^rastreio/.test(e.detalhe || '') ? 'origem' : /^calendly/.test(e.detalhe || '') ? 'agenda' : 'automacao'
  return 'gabi'
}

export function paraTela(e: ExecEntry): ExecTela {
  const usd = e.custoUsd ?? (e.usage ? costUsd(CONFIG.llmModel, e.usage) : null)
  return {
    at: e.at, tipo: e.tipo, leadId: e.leadId, nome: e.nome ? primeiroNome(e.nome) : '', porta: e.porta, ms: e.ms,
    tools: e.tools || [], travas: e.guard || [], custoBrl: usd === null || usd === undefined ? null : Math.round(usd * USD_BRL() * 10000) / 10000,
    urgente: !!e.urgente, detalhe: anonimizar(e.detalhe || ''), categoria: categoria(e),
  }
}

/** Puro (testado): números do diário numa janela. */
export function metricasDiario(execs: ExecTela[], agoraMs: number) {
  const janela = (h: number) => execs.filter(e => agoraMs - Date.parse(e.at) <= h * 3600_000)
  const resumo = (xs: ExecTela[]) => {
    const gabi = xs.filter(e => e.categoria === 'gabi' && (e.tipo === 'resposta' || e.tipo === 'finalizou' || e.tipo === 'menu'))
    const ms = gabi.map(e => e.ms || 0).filter(Boolean).sort((a, b) => a - b)
    const comCusto = xs.filter(e => e.custoBrl !== null)
    return {
      conversas: new Set(gabi.map(e => e.leadId)).size,
      respostas: gabi.length,
      reunioesGabi: xs.filter(e => e.tools.includes('agendar_reuniao') && e.tipo === 'finalizou').length,
      passouEquipe: xs.filter(e => e.tipo === 'finalizou' && !e.tools.includes('agendar_reuniao')).length,
      retomadas: xs.filter(e => e.categoria === 'retomada' && /^toque/.test(e.detalhe)).length,
      automacoes: xs.filter(e => e.categoria === 'automacao' && !/nada feito|PAUSADO/.test(e.detalhe)).length,
      agenda: xs.filter(e => e.categoria === 'agenda').length,
      erros: xs.filter(e => e.categoria === 'erro').length,
      travas: xs.filter(e => e.travas.length).length,
      respostaMedianaSeg: ms.length ? Math.round(ms[Math.floor(ms.length / 2)] / 100) / 10 : null,
      custoBrl: Math.round(comCusto.reduce((s, e) => s + (e.custoBrl || 0), 0) * 100) / 100,
      execucoesComCusto: comCusto.length,
    }
  }
  return { h24: resumo(janela(24)), d7: resumo(janela(24 * 7)), d30: resumo(janela(24 * 30)) }
}

export async function diario(limit = 400) {
  const execs = (await readExecs(Math.min(limit, 2000))).map(paraTela)
  return { execs, metricas: metricasDiario(execs, Date.now()), maisAntigo: execs[execs.length - 1]?.at || null }
}

/** Retomadas (follow-up) agendadas agora. */
export async function filaRetomada() {
  const itens: Array<{ leadId: number; toque: number; em: string }> = []
  let cursor: string | number = 0
  for (let i = 0; i < 20; i++) {
    const [prox, chaves] = (await redis.scan(cursor, { match: k('fu', '*'), count: 200 })) as [string | number, string[]]
    const valores = chaves.length ? await redis.mget<Array<{ toque: number; em: number } | null>>(...chaves) : []
    chaves.forEach((c, j) => { const v = valores[j]; if (v) itens.push({ leadId: Number(c.split(':').pop()), toque: v.toque, em: new Date(v.em).toISOString() }) })
    cursor = prox
    if (String(prox) === '0') break
  }
  return { total: itens.length, proximas: itens.sort((a, b) => a.em.localeCompare(b.em)).slice(0, 20) }
}

// ─────────────────────────────── saúde e prontidão ───────────────────────────────

export interface Item { id: string; nome: string; ok: boolean; estado: string; oQueFalta?: string }

/** Puro (testado): o que já está ligado na operação, pelo ambiente. */
export function prontidao(env: Record<string, string | undefined>): Item[] {
  const gate = (env.GATE_TAG || '').trim()
  return [
    { id: 'gabi', nome: 'Stela respondendo no WhatsApp', ok: !!Number(env.KOMMO_BOT_ID || 0), estado: Number(env.KOMMO_BOT_ID || 0) ? 'ligada' : 'pronta, aguardando o robô de envio', oQueFalta: Number(env.KOMMO_BOT_ID || 0) ? undefined : 'Criar no Kommo o robô que envia a resposta da Stela.' },
    { id: 'rampa', nome: 'Quem a Stela atende', ok: true, estado: gate ? `fase de teste: só leads com a etiqueta ${gate}` : 'todos os leads novos' },
    { id: 'retomada', nome: 'Retomada de quem parou de responder', ok: !!(env.QSTASH_TOKEN && env.SELF_URL), estado: env.QSTASH_TOKEN && env.SELF_URL ? 'ligada' : 'desligada' },
    { id: 'lembretes', nome: 'Lembretes de reunião (24h e 2h)', ok: env.LEMBRETES_MODO === 'ativo', estado: env.LEMBRETES_MODO === 'ativo' ? 'enviando' : 'modo sombra: confere sem enviar', oQueFalta: env.LEMBRETES_MODO === 'ativo' ? undefined : 'Desligar o disparo por data dos robôs de lembrete no Kommo e trocar para envio pela Vercel.' },
    { id: 'calendly', nome: 'Calendly atualizando o Kommo', ok: !!env.CALENDLY_WEBHOOK_KEY, estado: env.CALENDLY_WEBHOOK_KEY ? 'ligado' : 'desligado' },
    { id: 'automacoes', nome: 'Reunião realizada → Proposta · Contrato pago → Jurídico', ok: true, estado: 'ligadas' },
    { id: 'origem', nome: 'Links rastreados de campanha', ok: !!env.WHATSAPP_NUMERO, estado: env.WHATSAPP_NUMERO ? 'ligados' : 'prontos, aguardando o número do WhatsApp', oQueFalta: env.WHATSAPP_NUMERO ? undefined : 'Informar o número de WhatsApp do escritório.' },
  ]
}

async function checar(nome: string, fn: () => Promise<unknown>): Promise<{ fonte: string; ok: boolean; ms: number; erro?: string }> {
  const t0 = Date.now()
  try { await fn(); return { fonte: nome, ok: true, ms: Date.now() - t0 } } catch (e) { return { fonte: nome, ok: false, ms: Date.now() - t0, erro: (e instanceof Error ? e.message : String(e)).slice(0, 160) } }
}

export async function saude() {
  const fontes = await Promise.all([
    checar('Kommo', () => kommoGet('/api/v4/account')),
    checar('Diário', () => redis.get(k('execlog-ping'))),
    checar('Calendly', async () => {
      if (!process.env.CALENDLY_TOKEN) throw new Error('sem token')
      const r = await fetch('https://api.calendly.com/users/me', { headers: { Authorization: `Bearer ${process.env.CALENDLY_TOKEN}` } })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
    }),
  ])
  return { versao: SISTEMA_VERSAO, fontes, prontidao: prontidao(process.env), usdBrl: USD_BRL() }
}

// ─────────────────────────────── regras (leitura) ───────────────────────────────

const REGRA_TELA: Record<string, string> = {
  'prometeu resultado': 'Prometer resultado ("garanto", "vamos conseguir", "liminar certa").',
  'percentual de desconto': 'Falar em percentual de desconto ou redução.',
  'dado de pagamento': 'Mandar PIX, conta, CNPJ ou boleto.',
  'link na mensagem': 'Mandar qualquer link (o link da reunião chega por e-mail).',
  'resíduo de chatbot': 'Frases de robô ("Fico à disposição", "Ótima pergunta").',
}

export function regras() {
  const neg = CRM_MAP.negocio
  const r = neg.responsaveis
  const nomes = (ids: number[]) => ids.map(id => r.nomes[id] || String(id)).join(' e ')
  return {
    assuntos: CRM_MAP.portas.filter(p => p.ativa !== false && p.roteiro.length).map(p => ({
      id: p.id, nome: p.label, perguntas: p.roteiro.map(c => CRM_MAP.campos[c]?.pergunta).filter(Boolean),
    })),
    nunca: [
      ...REGRAS_CLIENTE.map(x => REGRA_TELA[x.regra] || x.regra),
      'Dizer um valor em reais que o lead não disse (honorário ou desconto).',
      'Dizer que a reunião está marcada antes de o Calendly confirmar.',
      'Dar parecer jurídico, analisar contrato ou dizer se a pessoa tem direito.',
      'Falar de honorários. Isso é na reunião com o advogado.',
      'Pedir CPF ou número de processo.',
    ],
    passaParaEquipe: [
      'Pediu para falar com uma pessoa.',
      'Já é cliente do escritório.',
      'Falou de pagamento, PIX ou boleto.',
      'Já tem outro advogado no mesmo caso.',
      'Assunto que não é bancário (sai como desqualificado, com respeito).',
      'Busca e apreensão com urgência: a equipe é avisada na hora.',
    ],
    agenda: {
      reuniao: 'Reunião de diagnóstico sem custo, 30 minutos, Google Meet, com um dos nossos especialistas.',
      opcoes: `A Stela oferece ${CRM_MAP.calendly.opcoes} horários reais do Calendly, com pelo menos ${CRM_MAP.calendly.antecedenciaMinHoras}h de antecedência, nos próximos ${CRM_MAP.calendly.diasAFrente} dias.`,
      distribuicao: `Dívida abaixo de R$ ${r.limite.toLocaleString('pt-BR')}: vai alternando entre ${nomes(r.abaixo)}. A partir disso, ou sem valor informado: ${nomes([r.acima])}, que aquece o lead antes da reunião.`,
      etapa: `Reunião marcada: o card vai para ${neg.etapaQualificado.name} com data e link preenchidos.`,
    },
    retomada: [
      'Toque 1: 2 horas depois da última mensagem da Stela sem resposta.',
      'Toque 2: perto de fechar a janela de 24 horas do WhatsApp.',
      `Sem resposta: o card vai para ${neg.etapaFollowUp.name}.`,
      `${CRM_MAP.automacoes.sdr.followUp.dias} dias em ${neg.etapaFollowUp.name} sem resposta: perdido, com motivo Lead Desaparecido.`,
      'Só entre 8h e 20h. Se a pessoa responde, a retomada para na hora.',
    ],
    automacoes: [
      { gatilho: 'Reunião marcada como realizada (ganho no SDR)', efeito: 'Card vai para CLOSER › Proposta, com nota e etiqueta.' },
      { gatilho: 'Contrato pago (venda ganha no CLOSER)', efeito: 'Card vai para JURÍDICO › contrato fechado/pago, com nota e etiqueta.' },
      { gatilho: 'Reunião marcada no Calendly', efeito: 'Grava data e link no card e move para Reunião agendada.' },
      { gatilho: 'Reunião cancelada no Calendly', efeito: 'Limpa a data e cria tarefa de reagendar.' },
      { gatilho: '24h e 2h antes da reunião', efeito: 'Lembrete pelo modelo aprovado do WhatsApp.' },
      { gatilho: 'Lead chegou por link rastreado', efeito: 'Grava De onde e a campanha no card.' },
      { gatilho: 'Lead escreve estando em Leads de entrada ou Follow-up', efeito: 'Card volta para Em atendimento. Reunião agendada e No-show ficam onde estão.' },
      { gatilho: 'Card entra em Follow-up', efeito: 'Põe a etiqueta "Follow up" e começa a contar 5 dias.' },
      { gatilho: '5 dias em Follow-up sem resposta', efeito: 'Vai para perdido (Lead Desaparecido) com a etiqueta "Desqualificado".' },
      { gatilho: 'Venda perdida no CLOSER com o motivo "Retomar depois (volta ao SDR)"', efeito: 'Volta para SDR › Follow-up, com a Gabi (SDR), etiqueta "Follow up", tarefa de retomar em 24 h e nota.' },
      { gatilho: 'Venda perdida no CLOSER com outro motivo', efeito: 'Põe a etiqueta "Desqualificado".' },
      { gatilho: 'Busca e apreensão atendida pela Stela', efeito: 'Card em Em atendimento, com a Gabi (SDR), e tarefa de consultar o processo e confirmar a reunião em 30 minutos.' },
      { gatilho: 'Assunto que parece não bancário', efeito: 'Etiqueta "Conferir escopo" e tarefa para a Gabi (SDR) conferir antes de dispensar.' },
      { gatilho: `Mais de ${CRM_MAP.automacoes.limiteEmMassa.eventos} mudanças em ${CRM_MAP.automacoes.limiteEmMassa.janelaSeg / 60} min`, efeito: 'As automações pausam: é limpeza de funil, não venda.' },
    ],
  }
}

// ─────────────────────────────── ensinar (pedidos) ───────────────────────────────

export interface PedidoEnsino { id: string; em: string; perfil: string; texto: string; exemplo?: { lead: string; gabi: string }; destino: string; explicacao: string; status: 'recebido' | 'em teste' | 'publicado' | 'recusado'; nota?: string }

/**
 * Régua de destino (CENTRAL.md §2), na parte determinística. O que é regra de
 * comportamento vira pedido para a agência, que publica só se os cenários passarem.
 */
export function destinoDaCorrecao(texto: string): { destino: string; explicacao: string } {
  const t = texto.toLowerCase()
  if (/hor[aá]rio|agenda|dispon[ií]vel|calendly|dia da reuni/.test(t)) return { destino: 'agenda', explicacao: 'Horário é dado vivo: a Stela lê do Calendly na hora. Mudou a disponibilidade? Ajuste no Calendly e ela já oferece os novos horários.' }
  if (/r\$|\d+ ?mil|honor[aá]rio|pre[cç]o|valor d[aoe]s? (consulta|honor|servi)|quanto custa|desconto|percentual|%/.test(t)) return { destino: 'fora do escopo', explicacao: 'A Stela não fala valores nem percentuais por decisão do escritório. Se quiser mudar essa regra, a equipe técnica revisa com você antes.' }
  if (/etapa|funil|respons[aá]vel|mover|card|tarefa|etiqueta/.test(t)) return { destino: 'funil', explicacao: 'Isso é regra de funil, que roda em código. Vai como pedido para a equipe técnica, que testa no lead de teste antes de ligar.' }
  return { destino: 'jeito de conversar', explicacao: 'Vira regra no jeito de conversar da Stela. A equipe técnica escreve a regra, roda os cenários de teste e só publica se todos passarem.' }
}

export async function listarEnsino(): Promise<PedidoEnsino[]> {
  return (await redis.lrange<PedidoEnsino>(k('central', 'ensino'), 0, 199)) || []
}

export async function criarEnsino(p: { perfil: string; texto: string; exemplo?: { lead: string; gabi: string } }): Promise<PedidoEnsino> {
  const texto = anonimizar(String(p.texto || '').trim()).slice(0, 1500)
  if (texto.length < 8) throw new Error('Escreva a correção com um pouco mais de detalhe.')
  const pedido: PedidoEnsino = {
    id: crypto.randomBytes(5).toString('hex'), em: new Date().toISOString(), perfil: p.perfil, texto,
    exemplo: p.exemplo ? { lead: anonimizar(p.exemplo.lead).slice(0, 600), gabi: anonimizar(p.exemplo.gabi).slice(0, 600) } : undefined,
    ...destinoDaCorrecao(texto), status: 'recebido',
  }
  await redis.lpush(k('central', 'ensino'), pedido)
  await redis.ltrim(k('central', 'ensino'), 0, 199)
  return pedido
}

export async function atualizarEnsino(id: string, status: PedidoEnsino['status'], nota?: string): Promise<boolean> {
  const lista = await listarEnsino()
  const i = lista.findIndex(p => p.id === id)
  if (i < 0) return false
  await redis.lset(k('central', 'ensino'), i, { ...lista[i], status, nota: nota ? nota.slice(0, 500) : lista[i].nota })
  return true
}

// ─────────────────────────────── laboratório ───────────────────────────────

interface Mundo {
  /** vazio até a Stela entender o assunto (o laboratório roteia como o atendimento real) */
  porta: string
  statusId: number
  pipelineId: number
  fields: Record<number, { value?: unknown; enumIds: number[] }>
  tags: string[]
  state: LeadState
  history: ChatMsg[]
  turnos: number
}

const LIMITE_DIA = Number(process.env.LAB_LIMITE_DIA || 150)
const LIMITE_SESSAO = 24
const CAMPO_NOME: Record<number, string> = { 1023263: 'Nicho', 719788: 'Data da reunião', 1012980: 'Link da reunião', 1023548: 'Desqualificado' }
const ETAPAS_LAB: Record<number, string> = { 72104583: 'Leads de entrada', 72186399: 'Em atendimento', 72104595: 'Follow-up', 86825532: 'Reunião agendada', 72113011: 'No-show' }

function portaDoMundo(w: Mundo, eventos: string[]): LeadPort {
  const nomeResp = (id: number) => CRM_MAP.negocio.responsaveis.nomes[id] || `usuário ${id}`
  return {
    async getLead() { return { id: 1, statusId: w.statusId, pipelineId: w.pipelineId, fields: structuredClone(w.fields), tags: [...w.tags] } },
    async writeFields(vs: KommoFieldValue[]) {
      for (const v of vs) {
        w.fields[v.field_id] = { value: v.values?.[0]?.value, enumIds: (v.values || []).map(x => x.enum_id).filter((x): x is number => typeof x === 'number') }
        if (CAMPO_NOME[v.field_id]) eventos.push(`Gravaria no card: ${CAMPO_NOME[v.field_id]}.`)
      }
    },
    async moveStage(s: number, p: number) { w.statusId = s; w.pipelineId = p; eventos.push(`Moveria o card para ${ETAPAS_LAB[s] || 'outra etapa'}.`) },
    async addTags(t: string[]) { w.tags = [...new Set([...w.tags, ...t.map(x => x.toLowerCase())])] },
    async removeTags(t: string[]) { w.tags = w.tags.filter(x => !t.map(y => y.toLowerCase()).includes(x)); if (t.some(x => x.toLowerCase() === CONFIG.gateTag)) eventos.push('Pararia de atender: o lead passa para a equipe.') },
    async addNote() { eventos.push('Deixaria no card a nota com o resumo do caso.') },
    async setResponsible(u: number) { eventos.push(`Passaria o card para ${nomeResp(u)}.`) },
    async addTask(t: string, u: number) { eventos.push(`Criaria tarefa para ${nomeResp(u)}: ${t.slice(0, 90)}${t.length > 90 ? '…' : ''}`) },
    async getPhone() { return '+5547999990000' },
    async nextTurn() { return w.turnos },
    async getState() { return structuredClone(w.state) },
    async patchState(p: Partial<LeadState>) { Object.assign(w.state, p); return structuredClone(w.state) },
  }
}

export interface RespostaLab { sessao: string; porta: string; mensagens: Array<{ dir: 'in' | 'out'; text: string }>; eventos: string[]; travas: string[]; finalizado: boolean; custoBrl: number; restamHoje: number }

export async function laboratorio(p: { sessao?: string; porta?: string; msg?: string }): Promise<RespostaLab> {
  const sessao = /^[a-f0-9]{16}$/.test(p.sessao || '') ? p.sessao! : crypto.randomBytes(8).toString('hex')
  const chave = k('central', 'lab', sessao)
  const usoChave = k('central', 'lab-uso', diaBR(Date.now()))
  let w = await redis.get<Mundo>(chave)
  const eventos: string[] = []

  // Conversa nova começa vazia: quem escreve primeiro é o "lead", como no WhatsApp
  if (!w) {
    w = { porta: '', statusId: 72104583, pipelineId: CRM_MAP.negocio.pipelineId, fields: {}, tags: [CONFIG.gateTag].filter(Boolean), state: {}, turnos: 0, history: [] }
    await redis.set(chave, w, { ex: 7200 })
  }

  const usados = Number((await redis.get<number>(usoChave)) || 0)
  const resposta = (travas: string[] = [], custoBrl = 0): RespostaLab => ({
    sessao, porta: w!.porta, mensagens: w!.history.map(m => ({ dir: m.dir, text: m.text })), eventos, travas,
    finalizado: !!w!.state.finalizado, custoBrl, restamHoje: Math.max(0, LIMITE_DIA - usados - (p.msg ? 1 : 0)),
  })
  const msg = String(p.msg || '').trim().slice(0, 600)
  if (!msg) return resposta()
  if (w.state.finalizado) { eventos.push('Esta conversa já terminou. Comece outra.'); return resposta() }
  if (w.turnos >= LIMITE_SESSAO) { eventos.push('Esta conversa chegou ao limite do teste. Comece outra.'); return resposta() }
  if (usados >= LIMITE_DIA) { eventos.push('O limite de testes de hoje acabou. Amanhã libera de novo.'); return resposta() }

  w.history.push({ id: `m${w.history.length}`, dir: 'in', text: msg, ts: w.history.length + 1 })
  w.turnos++
  const usoTriagem = emptyUsage()
  const fechar = async (texto: string, travas: string[] = [], usd = 0) => {
    w!.history.push({ id: `m${w!.history.length}`, dir: 'out', text: texto, ts: w!.history.length + 1 })
    await redis.set(chave, w, { ex: 7200 })
    await redis.incr(usoChave)
    await redis.expire(usoChave, 2 * DIA)
    const brl = Math.round(usd * USD_BRL() * 10000) / 10000
    if (brl) await redis.incrbyfloat(k('central', 'lab-custo', diaBR(Date.now()).slice(0, 7)), brl).catch(() => {})
    return resposta(travas, brl)
  }

  // Primeiro contato: o MESMO roteador do atendimento (palavra-chave, depois triagem por IA)
  if (!w.state.porta) {
    const rota = await rotearTurno(w.state, w.history.filter(m => m.dir === 'in').slice(-6).map(m => m.text).join('\n'), usoTriagem)
    const usdTriagem = costUsd(CONFIG.llmModel, usoTriagem) || 0
    if (rota.tipo === 'mensagem') {
      if (rota.patch.respostas?.nome && !w.state.respostas?.nome) eventos.push(`Anotou: Nome = ${anonimizar(rota.patch.respostas.nome)}`)
      eventos.push(w.state.aberturaEnviada
        ? 'Ainda não deu para saber o assunto: perguntou de novo, com pergunta aberta (sem menu).'
        : 'Se apresentou e perguntou o nome e o que a pessoa procura (sem menu).')
      Object.assign(w.state, rota.patch)
      return fechar(rota.texto, [], usdTriagem)
    }
    if (rota.tipo === 'encerrar') {
      Object.assign(w.state, rota.patch)
      w.state.finalizado = { motivo: rota.motivo, resumo: 'assunto não bancário', em: new Date().toISOString() }
      eventos.push('Passaria para a equipe conferir: o assunto parece não ser bancário. Poria a etiqueta "Conferir escopo", criaria tarefa para a Gabi (SDR) e pararia de atender.')
      return fechar(rota.texto, [], usdTriagem)
    }
    if (rota.tipo !== 'porta') return fechar(CRM_MAP.textoSeguro)
    if (!rota.porta.ativa) {
      w.state.finalizado = { motivo: 'porta_sem_agente', resumo: 'assunto fora dos três que a Stela atende', em: new Date().toISOString() }
      eventos.push('Passaria para a equipe: o assunto não é um dos três que ela atende (tarefa "Assumir o atendimento" para o SDR).')
      return fechar(comApresentacao(w.state, rota.patch?.respostas?.nome || w.state.respostas?.nome || '', rota.porta.mensagemSemAgente || CRM_MAP.textoSeguroFinal), [], usdTriagem)
    }
    w.porta = rota.porta.id
    w.state = { ...w.state, porta: rota.porta.id, portaEm: w.history[w.history.length - 1].ts, respostas: { ...(w.state.respostas || {}), ...(rota.patch?.respostas || {}) } }
    eventos.push(`Entendeu o assunto: ${rota.porta.label}.`)
  }
  const porta = portaById(w.porta)!
  const conversa = w.history.filter(m => m.ts >= (w!.state.portaEm || 0))
  const antes = { ...(w.state.respostas || {}) }
  const brain = createBrain({
    apiKey: CONFIG.openaiApiKey, model: CONFIG.llmModel,
    onTool: nome => {
      if (nome === 'ver_horarios') eventos.push('Buscou horários na agenda (no teste, a agenda é de mentira).')
      if (nome === 'agendar_reuniao') eventos.push('Tentou marcar a reunião (no teste, nada é reservado no Calendly).')
    },
  })
  const iOut = conversa.map(m => m.dir).lastIndexOf('out')
  const reply = await brain.generateReply({
    port: portaDoMundo(w, eventos), porta, gateTag: CONFIG.gateTag,
    leadText: conversa.filter(m => m.dir === 'in').map(m => m.text).join('\n'),
    lastLeadText: conversa.slice(iOut + 1).map(m => m.text).join('\n'),
    lastAgentText: iOut >= 0 ? conversa[iOut].text : '',
  }, { nomeContato: '', primeiroContatoDaPorta: !conversa.some(m => m.dir === 'out') }, conversa)
  const anotou = Object.entries(w.state.respostas || {}).filter(([c, v]) => antes[c] !== v)
    .map(([c, v]) => `Anotou: ${CRM_MAP.campos[c]?.name || c} = ${anonimizar(String(v)).slice(0, 80)}`)
  eventos.unshift(...anotou)
  const usd = (reply ? costUsd(CONFIG.llmModel, reply.usage) || 0 : 0) + (costUsd(CONFIG.llmModel, usoTriagem) || 0)
  return fechar(reply?.text || CRM_MAP.textoSeguro, reply?.guard || [], usd)
}

export async function custoLaboratorioMes(): Promise<number> {
  return Number((await redis.get<number>(k('central', 'lab-custo', diaBR(Date.now()).slice(0, 7)))) || 0)
}

// ─────────────────────────────── acesso ───────────────────────────────

/** scrypt com sal: o hash vai para a env, a senha nunca. Gere com scripts/central-senha.ts. */
export function hashSenha(senha: string, sal = crypto.randomBytes(16).toString('hex')): string {
  return `scrypt$${sal}$${crypto.scryptSync(senha, sal, 32).toString('hex')}`
}

export function confereSenha(senha: string, hash: string): boolean {
  const [alg, sal, hex] = (hash || '').split('$')
  if (alg !== 'scrypt' || !sal || !hex) return false
  const a = crypto.scryptSync(senha, sal, 32)
  const b = Buffer.from(hex, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/**
 * Login com freio: 8 tentativas por IP e 60 no total a cada 15 minutos. Senha curta
 * só aguenta porque o freio existe.
 */
export async function entrar(senha: string, ip: string): Promise<{ ok: true; perfil: 'dono' | 'agencia' } | { ok: false; motivo: 'senha' | 'bloqueado' }> {
  const ipKey = k('central', 'login', crypto.createHash('sha256').update(ip || '?').digest('hex').slice(0, 16))
  const totalKey = k('central', 'login-total')
  const [porIp, total] = await Promise.all([redis.incr(ipKey), redis.incr(totalKey)])
  if (porIp === 1) await redis.expire(ipKey, 900)
  if (total === 1) await redis.expire(totalKey, 900)
  if (porIp > 8 || total > 60) return { ok: false, motivo: 'bloqueado' }
  const s = String(senha || '').slice(0, 200)
  const perfil = confereSenha(s, process.env.CENTRAL_SENHA_AGENCIA_HASH || '') ? 'agencia' : confereSenha(s, process.env.CENTRAL_SENHA_DONO_HASH || '') ? 'dono' : null
  if (!perfil) return { ok: false, motivo: 'senha' }
  await redis.del(ipKey)
  return { ok: true, perfil }
}
