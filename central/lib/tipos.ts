/** Formato do que o agente devolve em /api/central (espelho de agente/lib/central.ts). */

export type Fonte<T> = { ok: true; dados: T } | { ok: false; erro: string }

export interface Amostra { id: number; nome: string; dias: number; valor: number; responsavel: string }
export interface Etapa { id: number; nome: string; n: number; valor: number; parados: number; novos7d: number; papel: 'gabi' | 'automacao' | 'time'; como: string; radar: boolean; amostras: Amostra[] }
export interface Funil { id: number; nome: string; n: number; valor: number; etapas: Etapa[] }
export interface DadosFunil { funis: Funil[]; truncado: boolean; usuarios: Record<number, string>; _em: string; _velho?: boolean }

export interface Marco { id: 'agendadas' | 'realizadas' | 'noshow' | 'contratos'; nome: string; trintaDias: number; seteDias: number; emMassa: number; porDia: Record<string, number>; truncado: boolean }
export interface DadosResultados { marcos: Marco[]; _em: string }

export interface Reuniao { id: number; nome: string; em: string; quando: string; etapa: string; responsavel: string }
export interface DadosAgenda { proximas: Reuniao[]; hoje: number; amanha: number; seteDias: number; lembretes: { modo: 'ativo' | 'sombra'; venceAgora: number; regras: string[] }; _em: string }

export type Categoria = 'gabi' | 'retomada' | 'automacao' | 'agenda' | 'origem' | 'erro'
export interface Exec { at: string; tipo: string; leadId: number; nome: string; porta?: string; ms?: number; tools: string[]; travas: string[]; custoBrl: number | null; urgente: boolean; detalhe: string; categoria: Categoria }

export interface Janela {
  conversas: number; respostas: number; reunioesGabi: number; passouEquipe: number; retomadas: number; automacoes: number
  agenda: number; erros: number; travas: number; respostaMedianaSeg: number | null; custoBrl: number; execucoesComCusto: number
}
export interface Metricas { h24: Janela; d7: Janela; d30: Janela }
export interface DadosDiario { execs: Exec[]; metricas: Metricas; maisAntigo: string | null }

export interface ItemProntidao { id: string; nome: string; ok: boolean; estado: string; oQueFalta?: string }
export interface DadosSaude { versao: string; fontes: Array<{ fonte: string; ok: boolean; ms: number; erro?: string }>; prontidao: ItemProntidao[]; usdBrl: number }

export interface DadosRetomada { total: number; proximas: Array<{ leadId: number; toque: number; em: string }> }

export interface Visao {
  versao: string
  perfil: 'dono' | 'agencia'
  saude: Fonte<DadosSaude>
  funil: Fonte<DadosFunil>
  agenda: Fonte<DadosAgenda>
  resultados: Fonte<DadosResultados>
  retomada: Fonte<DadosRetomada>
  diario: Fonte<{ metricas: Metricas; recentes: Exec[]; maisAntigo: string | null }>
}

export interface OrigemJanela { total: number; deOnde: Record<string, number>; campanhas: Record<string, number> }
export interface DadosOrigem { trintaDias: OrigemJanela; seteDias: OrigemJanela; links: Record<string, { cliques: number; leads: number }>; linksLigados: boolean; truncado: boolean; _em: string }

export interface DadosRegras {
  assuntos: Array<{ id: string; nome: string; perguntas: string[] }>
  nunca: string[]
  passaParaEquipe: string[]
  agenda: { reuniao: string; opcoes: string; distribuicao: string; etapa: string }
  retomada: string[]
  automacoes: Array<{ gatilho: string; efeito: string }>
}

export interface PedidoEnsino { id: string; em: string; perfil: string; texto: string; exemplo?: { lead: string; gabi: string }; destino: string; explicacao: string; status: 'recebido' | 'em teste' | 'publicado' | 'recusado'; nota?: string }

export interface RespostaLab { ok: boolean; sessao: string; porta: string; mensagens: Array<{ dir: 'in' | 'out'; text: string }>; eventos: string[]; travas: string[]; finalizado: boolean; custoBrl: number; restamHoje: number; erro?: string }
