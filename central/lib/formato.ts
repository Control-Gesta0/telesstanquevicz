export const num = (n: number) => n.toLocaleString('pt-BR')

export const brl = (n: number, casas = 2) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: casas, maximumFractionDigits: casas })

export const pct = (n: number, casas = 0) => `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: casas })}%`

export const plural = (n: number, um: string, varios: string) => `${num(n)} ${n === 1 ? um : varios}`

const TZ = 'America/Sao_Paulo'

export const horaBR = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })

export const dataHoraBR = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export const diaSemanaBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: TZ, weekday: 'short', day: '2-digit', month: '2-digit' })

/** "há 5 min", "há 3 h", "ontem", "há 4 dias" */
export function haQuanto(iso: string, agora = Date.now()): string {
  const s = Math.max(0, Math.round((agora - Date.parse(iso)) / 1000))
  if (s < 60) return 'agora'
  if (s < 3600) return `há ${Math.round(s / 60)} min`
  if (s < 86400) return `há ${Math.round(s / 3600)} h`
  const d = Math.round(s / 86400)
  return d === 1 ? 'ontem' : `há ${d} dias`
}

/** Daqui a quanto (para reunião e retomada). */
export function daquiA(iso: string, agora = Date.now()): string {
  const s = Math.round((Date.parse(iso) - agora) / 1000)
  if (s <= 0) return 'agora'
  if (s < 3600) return `em ${Math.max(1, Math.round(s / 60))} min`
  if (s < 86400) return `em ${Math.round(s / 3600)} h`
  const d = Math.round(s / 86400)
  return d === 1 ? 'amanhã' : `em ${d} dias`
}

/** Nome das ferramentas da Gabi em português de dono. */
export const FERRAMENTA: Record<string, string> = {
  salvar_respostas: 'anotou respostas',
  ver_horarios: 'buscou horários',
  agendar_reuniao: 'marcou reunião',
  finalizar_atendimento: 'encerrou o atendimento',
  registrar_respondente: 'registrou quem digita',
  registrar_outro_assunto: 'anotou outro assunto',
  'trava:abertura': 'abertura aprovada',
}

export const ferramenta = (t: string) => FERRAMENTA[t] || (t.startsWith('trava:finalizou') ? 'encerrou por regra' : t.replace(/_/g, ' '))

export const PORTA: Record<string, string> = { rcpcc: 'Dívida com banco', rcv: 'Financiamento de veículo', dba: 'Busca e apreensão', geral: 'Outro assunto' }
