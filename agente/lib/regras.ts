/**
 * TRAVAS DO CLIENTE (patch) — Teles & Stanquevicz Advogados.
 * O que é regra de negócio, ética ou jurídica vira CÓDIGO: a resposta que casar
 * com uma destas não sai; o modelo reescreve uma vez e, se insistir, sai o
 * texto seguro. Decisão do escritório (07/10/2026): nenhuma promessa.
 *
 * Toda regra tem um caso que bloqueia e um texto aprovado que passa em
 * scripts/test-cliente.ts.
 */
export const REGRAS_CLIENTE: Array<{ regra: string; re: RegExp }> = [
  { regra: 'prometeu resultado', re: /\bgarant(o|imos|ido|ida|ia)\b|\bvamos conseguir\b|\bvoc[eê] vai conseguir\b|\b(com certeza|certamente) (vai|vamos|voc[eê] vai|d[aá] pra)\b|\bliminar (certa|garantida)\b|\bganhar (a|essa) (a[cç][aã]o|causa)\b|\bvai (reduzir|baixar|diminuir) (sua|a|o)\b/i },
  { regra: 'percentual de desconto', re: /\d{1,3}\s?%|\bpor cento\b/i },
  { regra: 'dado de pagamento', re: /\bchave pix\b|\bcnpj\b|\bag[eê]ncia\s*:|\bconta( corrente)?\s*:|48\.?463\.?900|\bboleto (segue|abaixo|em anexo)\b/i },
  { regra: 'link na mensagem', re: /https?:\/\/|www\.|\.com\.br\b|\bcalendly\b|meet\.google/i },
  { regra: 'resíduo de chatbot', re: /\bfico [àa] disposi[cç][aã]o\b|\bespero ter ajudado\b|\b[óo]tima pergunta\b|\bexcelente pergunta\b|\bqualquer d[uú]vida,? (é|e) s[oó] chamar\b/i },
]

/**
 * Travas que precisam do contexto da conversa:
 *  - valor em R$ que o lead não disse (honorário ou desconto inventado);
 *  - "está marcado" sem a reserva confirmada pelo Calendly.
 */
export function checarContexto(text: string, ctx: { leadText: string; reuniaoMarcada: boolean }): Array<{ regra: string; trecho: string }> {
  const out: Array<{ regra: string; trecho: string }> = []
  const digitosLead = new Set((ctx.leadText.match(/\d+/g) || []).map(n => n.replace(/^0+/, '')))
  for (const m of text.matchAll(/r\$\s?([\d.,]+)|\b(\d+(?:[.,]\d+)?)\s?mil\b/gi)) {
    const numero = (m[1] || m[2] || '').split(/[.,]/)[0].replace(/^0+/, '')
    if (numero && !digitosLead.has(numero)) out.push({ regra: 'valor que o lead não disse', trecho: m[0] })
  }
  if (!ctx.reuniaoMarcada) {
    const marcado = text.match(/\b(est[aá]|fica|ficou|j[aá] (est[aá]|deixei)|deixei)\s+(marcad[oa]|agendad[oa]|reservad[oa]|confirmad[oa])\b|\breuni[aã]o (marcada|agendada|confirmada)\b/i)
    if (marcado) out.push({ regra: 'disse que marcou sem reserva', trecho: marcado[0] })
  }
  return out
}
