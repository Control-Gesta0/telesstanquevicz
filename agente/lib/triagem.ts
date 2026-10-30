import OpenAI from 'openai'
import { CONFIG } from './config'
import { addUsage, type Usage } from './execlog'
import { decidirTriagem, rotear, type Assunto, type Rota, type Triagem } from './router'
import type { LeadState } from './state'

/**
 * Triagem por IA do primeiro contato: entende o que a pessoa procura e o nome que ela disse,
 * quando a palavra-chave não bastou. Uma chamada curta em JSON; a decisão do que responder
 * continua em código (router.decidirTriagem). Falhou a IA: trata como "indefinido".
 */

const ASSUNTOS: Assunto[] = ['rcpcc', 'rcv', 'dba', 'fora', 'cliente', 'outro', 'indefinido']

const SISTEMA = `Você faz a triagem do primeiro contato de um escritório de advocacia bancária no WhatsApp.
Leia o que a pessoa escreveu e responda SÓ com JSON: {"assunto": "...", "nome": "..."}.

assunto:
- "rcpcc": dívida ou juros com banco ou financeira que NÃO é de veículo: cartão de crédito, cheque especial, empréstimo, consignado, crédito pessoal, nome negativado por banco, superendividamento.
- "rcv": financiamento de veículo (carro, moto, caminhão): parcelas altas, juros, revisão do contrato, atraso, sem falar de apreensão.
- "dba": busca e apreensão: veículo apreendido, levado, guinchado, mandado, oficial de justiça, ameaça de apreensão.
- "fora": assunto que NÃO é bancário: trabalhista, família, pensão, divórcio, INSS, aposentadoria, imóvel, aluguel, consumo, criminal, trânsito.
- "cliente": já é cliente do escritório (diz que é cliente, pergunta do andamento do processo dele, do contrato com o escritório, da advogada ou do advogado que cuida do caso). Quem só diz que já fez a reunião ou a vídeo chamada com a equipe ainda NÃO é cliente: é "outro".
- "outro": precisa de uma pessoa do escritório: quem quer falar com uma pessoa ou advogado sem dizer o assunto, pagamento de boleto do escritório, outro assunto bancário fora dos três acima.
- "indefinido": só cumprimento, só o nome, "vi o anúncio" sem dizer o assunto, pedido genérico sem dizer o assunto ("preciso de ajuda", "quero uma informação", "tenho uma dúvida"), ou não dá para saber.

Na dúvida entre "outro" e "indefinido", escolha "indefinido": a assistente pergunta o que está acontecendo.

nome: o nome que a pessoa DISSE sobre si ("sou o Marcos", "aqui é a Ana Paula", "meu nome é João", ou uma mensagem que é só um nome). Não invente; se ela não disse, "".`

let client: OpenAI | null = null
const ia = () => (client ||= new OpenAI({ apiKey: CONFIG.openaiApiKey }))

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** O nome só vale se aparece no que a pessoa escreveu (a IA não inventa nome). */
export function nomeValido(nome: string, texto: string): string {
  const n = (nome || '').replace(/[^\p{L}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim()
  if (n.length < 2 || n.length > 60 || n.split(' ').length > 6) return ''
  return norm(texto).includes(norm(n.split(' ')[0])) ? n : ''
}

export async function triar(texto: string, usage?: Usage): Promise<Triagem> {
  const r = await ia().chat.completions.create({
    model: CONFIG.llmModel,
    max_completion_tokens: 120,
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: SISTEMA }, { role: 'user', content: texto.slice(0, 1500) }],
  })
  if (usage) addUsage(usage, r.usage)
  let j: { assunto?: string; nome?: string } = {}
  try { j = JSON.parse(r.choices[0]?.message?.content || '{}') } catch { /* indefinido */ }
  const assunto = (ASSUNTOS as string[]).includes(String(j.assunto)) ? (j.assunto as Assunto) : 'indefinido'
  return { assunto, nome: nomeValido(String(j.nome || ''), texto) }
}

/** Rota completa do turno: palavra-chave, depois IA. Usada pelo atendimento e pelo laboratório. */
export async function rotearTurno(state: LeadState, textoDoLead: string, usage?: Usage): Promise<Rota> {
  const r = rotear(state, textoDoLead)
  if (r.tipo !== 'triagem') return r
  const t = await triar(textoDoLead, usage).catch(e => {
    console.error('[triagem] IA falhou, segue como indefinido:', e)
    return { assunto: 'indefinido' as Assunto, nome: '' }
  })
  return decidirTriagem(state, t)
}
