/** Testes da Central v5: sessão, briefing fail-closed, radar e Pergunte à Central. Sem rede. */
import { assinar, verificar } from '../lib/sessao'
import { montarBriefing, montarRadar, responder } from '../lib/inteligencia'
import type { Visao } from '../lib/tipos'

let falhas = 0
const eq = (nome: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) falhas++
  console.log(`${ok ? '✅' : '❌'} ${nome}${ok ? '' : `\n   veio:     ${JSON.stringify(got)}\n   esperado: ${JSON.stringify(want)}`}`)
}

async function main() {
  const S = 'segredo-de-teste'
  const t = await assinar('dono', S, 1_000)
  eq('sessão: confere com o segredo certo', await verificar(t, S, 2_000), 'dono')
  eq('sessão: segredo errado não entra', await verificar(t, 'outro', 2_000), null)
  eq('sessão: vencida não entra', await verificar(t, S, 1_000 + 13 * 3600_000), null)
  const [corpo, sig] = t.split('.')
  const forjado = `${Buffer.from(JSON.stringify({ p: 'agencia', e: 9e15 })).toString('base64url')}.${sig}`
  eq('sessão: trocar o perfil quebra a assinatura', await verificar(forjado, S, 2_000), null)
  eq('sessão: sem cookie', await verificar(undefined, S), null)
  eq('sessão: corpo intacto continua válido', await verificar(`${corpo}.${sig}`, S, 2_000), 'dono')

  eq('briefing: sem dados não declara saúde', montarBriefing(null).estado, 'verificando')

  const base = (): Visao => ({
    versao: 'v', perfil: 'dono',
    saude: { ok: true, dados: { versao: 'v', usdBrl: 5.4, fontes: [{ fonte: 'Kommo', ok: true, ms: 100 }], prontidao: [{ id: 'gabi', nome: 'Gabi', ok: false, estado: 'pronta', oQueFalta: 'Criar o robô.' }] } },
    funil: { ok: true, dados: { _em: '', truncado: false, usuarios: {}, funis: [
      { id: 9299515, nome: 'SDR', n: 600, valor: 0, etapas: [
        { id: 72104595, nome: 'Follow-up', n: 500, valor: 0, parados: 480, novos7d: 1, papel: 'automacao', como: '', radar: false, amostras: [] },
        { id: 86825532, nome: 'Reunião agendada', n: 100, valor: 0, parados: 90, novos7d: 3, papel: 'gabi', como: '', radar: true, amostras: [] },
      ] },
      { id: 9312103, nome: 'CLOSER', n: 2, valor: 0, etapas: [{ id: 72851523, nome: 'Proposta', n: 2, valor: 0, parados: 0, novos7d: 1, papel: 'automacao', como: '', radar: true, amostras: [] }] },
    ] } },
    agenda: { ok: true, dados: { _em: '', proximas: [], hoje: 0, amanha: 2, seteDias: 3, lembretes: { modo: 'sombra', venceAgora: 0, regras: ['24h', '2h'] } } },
    resultados: { ok: true, dados: { _em: '', marcos: [{ id: 'agendadas', nome: 'Reuniões marcadas', trintaDias: 96, seteDias: 15, emMassa: 0, porDia: {}, truncado: false }] } },
    retomada: { ok: true, dados: { total: 0, proximas: [] } },
    diario: { ok: true, dados: { maisAntigo: null, recentes: [], metricas: Object.fromEntries(['h24', 'd7', 'd30'].map(k => [k, { conversas: 0, respostas: 0, reunioesGabi: 0, passouEquipe: 0, retomadas: 0, automacoes: 0, agenda: 0, erros: 0, travas: 0, respostaMedianaSeg: null, custoBrl: 0, execucoesComCusto: 0 }])) as any } },
  })

  const b1 = montarBriefing(base())
  eq('briefing: Gabi sem envio = quase no ar, com a decisão do que falta', [b1.estado, b1.decisoes[0].id], ['quase', 'gabi'])
  eq('briefing: reunião agendada parada vira oportunidade', b1.decisoes.some(d => d.id === 'reuniao'), true)
  eq('briefing: Follow-up parado não vira sinal', b1.decisoes.some(d => /Follow-up/.test(d.titulo)), false)

  const v2 = base(); v2.funil = { ok: false, erro: 'Kommo 503' }
  const b2 = montarBriefing(v2)
  eq('briefing: fonte fora = atenção e primeiro cartão é a fonte', [b2.estado, b2.decisoes[0].id], ['atencao', 'fontes'])

  const v3 = base(); (v3.diario as any).dados.metricas.h24.erros = 3
  eq('briefing: 3 falhas em 24h é urgente', montarBriefing(v3).decisoes.find(d => d.id === 'erros')?.tom, 'critico')

  const v4 = base(); (v4.funil as any).dados.funis[1].etapas[0].parados = 2
  eq('briefing: card parado no CLOSER vem antes de oportunidade', montarBriefing(v4).decisoes.findIndex(d => d.id === 'closer') < montarBriefing(v4).decisoes.findIndex(d => d.id === 'reuniao'), true)

  const radar = montarRadar(base().funil.ok ? (base().funil as any).dados : null)
  eq('radar: só etapas que contam', radar.map(r => r.etapa.nome), ['Reunião agendada'])

  eq('pergunte: custo sem execução não inventa número', /Ainda não há resposta/.test(responder('quanto a IA custou?', base()).resposta), true)
  eq('pergunte: o que falta ligar', responder('o que falta ligar?', base()).resposta, '1 item falta para tudo ficar ligado.')
  eq('pergunte: agenda', responder('quantas reuniões vêm aí?', base()).resposta, '0 reuniões hoje, 2 amanhã e 3 nos próximos 7 dias. Lembretes: em modo sombra.')
  eq('pergunte: sem dados', responder('custo', null).resposta, 'Ainda estou lendo o Kommo e o diário.')

  console.log(falhas ? `\n❌ ${falhas} falha(s)` : '\n✅ Central OK')
  process.exit(falhas ? 1 : 0)
}
main()
