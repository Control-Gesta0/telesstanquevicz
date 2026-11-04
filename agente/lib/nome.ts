/**
 * O que nunca é nome do lead. Conversas reais de 3 e 4/11/2026: "Olá Stela, bom dia" virou "Prazer, Stela"
 * (o nome da própria IA) e "Pan" (o Banco Pan) foi gravado como nome, e a Stela perguntou o banco 6 vezes.
 * Puro: testado.
 */
const NOME_DA_IA = /^(stel+a|estel+a)$/i
const BANCO_SOZINHO = /^(banco\s+)?(pan|bv|ita[uú]|bradesco|santander|caixa|safra|omni|aymor[eé]|daycoval|sicredi|sicoob|stel+antis|nubank|bmg|agibank|digio|banrisul|creditas|losango|rodobens|unicred|cresol|banestes|c6|bb|inter|mercantil|banco do brasil|caixa econ[oô]mica( federal)?)$/i

export function naoENome(nome: string): 'ia' | 'banco' | '' {
  const n = (nome || '').trim().replace(/[.!,;]+$/, '').replace(/\s+/g, ' ')
  if (NOME_DA_IA.test(n)) return 'ia'
  if (BANCO_SOZINHO.test(n)) return 'banco'
  return ''
}
