import { CRM_MAP } from './crm-map'
import { parseNumeroBR } from './guards'

/**
 * Quem recebe o lead qualificado — regra do escritório (07/10/2026), em CÓDIGO:
 *   dívida abaixo de R$ 50 mil → Guilherme ou Carla, alternando
 *   R$ 50 mil ou mais, ou valor desconhecido → SDR, que aquece antes da reunião
 * Arquivo puro (sem rede) para rodar em `npm test`.
 */

/** "uns 80 mil", "R$ 80.000", "80k", "mais de 100 mil", "entre_r$_30_mil_e_r$_50_mil", "1 milhão" → número (faixa = limite inferior). */
export function parseValorAprox(input: unknown): number | null {
  const t = String(input ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/_/g, ' ')
  if (!t.trim()) return null
  if (/\bnao (sei|lembro|faco ideia|tenho certeza)\b/.test(t) && !/\d/.test(t)) return null
  const nums: Array<{ n: number; mult: boolean }> = []
  const re = /(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?)\s*(milhao|milhoes|mil|k\b)?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(t))) {
    let n = parseNumeroBR(m[1])
    if (n === null) continue
    const mult = !!m[2]
    if (m[2] === 'mil' || m[2] === 'k') n *= 1000
    if (m[2] === 'milhao' || m[2] === 'milhoes') n *= 1_000_000
    nums.push({ n, mult })
  }
  if (!nums.length) return /\bcem mil\b/.test(t) ? 100000 : null
  // "entre 30 e 50 mil", "uns 15 a 20 mil": o "mil" do último vale para os anteriores
  const iMult = nums.findIndex(x => x.mult && x.n >= 1000)
  if (iMult > 0) for (let i = 0; i < iMult; i++) if (!nums[i].mult && nums[i].n < 1000) nums[i].n *= 1000
  const faixa = /\b(entre|acima|mais de|a partir|de \d+ a)\b/.test(t) || (nums.length >= 2 && /\d\s*(a|e|ou)\s*\d/.test(t))
  return faixa ? Math.min(...nums.map(x => x.n)) : nums[0].n
}

/** Valor da dívida do caso, pela porta. RCV: parcelas que faltam × valor da parcela. */
export function valorDoCaso(portaId: string, respostas: Record<string, string> = {}, formulario: unknown[] = []): number | null {
  if (portaId === 'rcv') {
    const total = parseNumeroBR(respostas.parcelasTotal)
    const pagas = parseNumeroBR(respostas.parcelasPagas)
    const parcela = parseValorAprox(respostas.valorParcela)
    if (total !== null && pagas !== null && parcela !== null && total >= pagas) return Math.round((total - pagas) * parcela)
    return null
  }
  const dito = parseValorAprox(portaId === 'dba' ? respostas.valorDividaDba : respostas.valorDivida)
  if (dito !== null) return dito
  // Faixa do formulário Meta (o campo certo é achado pelo conteúdo: "entre_r$_30_mil_e_r$_50_mil")
  const faixa = formulario.map(v => String(v ?? '')).find(v => /r\$.*mil/i.test(v))
  return faixa ? parseValorAprox(faixa) : null
}

export interface Escolha { userId: number; nome: string; regra: string }

/** `vez` é um contador crescente (Redis INCR) para alternar Guilherme e Carla. */
export function escolherResponsavel(valor: number | null, vez: number): Escolha {
  const r = CRM_MAP.negocio.responsaveis
  const fmt = (n: number) => `R$ ${Math.round(n).toLocaleString('pt-BR')}`
  if (valor === null) return { userId: r.acima, nome: r.nomes[r.acima], regra: 'valor da dívida não informado → SDR aquece antes da reunião' }
  if (valor >= r.limite) return { userId: r.acima, nome: r.nomes[r.acima], regra: `dívida de ${fmt(valor)} (≥ ${fmt(r.limite)}) → SDR aquece antes da reunião` }
  const userId = r.abaixo[Math.abs(vez) % r.abaixo.length]
  return { userId, nome: r.nomes[userId], regra: `dívida de ${fmt(valor)} (< ${fmt(r.limite)}) → rodízio Guilherme/Carla` }
}

/**
 * Formulário Meta → respostas já dadas (porta RCPCC). Os campos do Kommo estão
 * deslocados, então cada valor é reconhecido pelo conteúdo.
 */
export function respostasDoFormulario(valores: unknown[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of valores) {
    const v = String(raw ?? '').replace(/_/g, ' ').trim()
    if (!v || /^sim, tenho/i.test(v)) continue
    if (/r\$.*mil/i.test(v)) out.valorDivida ||= `formulário: ${v}`
    else if (/atrasad|em dia/i.test(v)) out.atraso ||= `formulário: ${v}`
    else out.tipoDivida ||= `formulário: ${v}`
  }
  return out
}
