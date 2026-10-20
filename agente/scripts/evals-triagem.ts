/**
 * Avaliação do primeiro contato SEM MENU NUMERADO (15/10/2026).
 *  1. Triagem por IA: frases variadas → assunto e nome certos.
 *  2. Fluxo completo no laboratório (mesmo roteador do atendimento, Calendly falso, sem Kommo).
 * Uso: npx tsx scripts/evals-triagem.ts
 */
process.env.CALENDLY_FAKE = '1'

const CASOS: Array<{ texto: string; assunto: string[]; nome: string }> = [
  { texto: 'oi, boa tarde', assunto: ['indefinido'], nome: '' },
  { texto: 'Marcos', assunto: ['indefinido'], nome: 'Marcos' },
  { texto: 'aqui é a Ana Paula', assunto: ['indefinido'], nome: 'Ana Paula' },
  { texto: 'vi o anúncio de vocês', assunto: ['indefinido'], nome: '' },
  { texto: '2', assunto: ['indefinido'], nome: '' },
  { texto: 'boa noite, me chamo Roberto Lima e preciso de ajuda', assunto: ['indefinido'], nome: 'Roberto Lima' },
  { texto: 'sou o João, tô com o nome sujo por causa do banco', assunto: ['rcpcc'], nome: 'João' },
  { texto: 'peguei um consignado e descontam muito do meu salário', assunto: ['rcpcc'], nome: '' },
  { texto: 'quero revisar as parcelas da minha moto', assunto: ['rcv'], nome: '' },
  { texto: 'o oficial veio aqui buscar a caminhonete', assunto: ['dba'], nome: '' },
  { texto: 'atrasei 3 parcelas do carro e tô com medo de tomarem', assunto: ['dba', 'rcv'], nome: '' },
  { texto: 'meu nome é Carla, é sobre aposentadoria do INSS', assunto: ['fora'], nome: 'Carla' },
  { texto: 'preciso de ajuda com uma causa trabalhista', assunto: ['fora'], nome: '' },
  { texto: 'já sou cliente, quero saber do meu processo', assunto: ['cliente'], nome: '' },
  { texto: 'quero falar com um advogado', assunto: ['outro', 'indefinido'], nome: '' },
]

const FLUXOS: Array<{ id: string; msgs: string[]; checa: (respostas: string[], estado: any) => string[] }> = [
  {
    id: 'oi → nome → caso',
    msgs: ['oi', 'Marcos', 'é sobre o financiamento do meu carro, a parcela tá muito alta'],
    checa: (r, e) => [
      /com quem eu falo/i.test(r[0]) && /o que você está procurando/i.test(r[0]) ? '' : '1ª resposta deveria perguntar nome e o que procura',
      /^prazer, marcos/i.test(r[1]) ? '' : '2ª resposta deveria cumprimentar o Marcos e perguntar do caso',
      e.porta === 'rcv' ? '' : `deveria entender financiamento de veículo (veio ${e.porta})`,
      !/com quem eu falo/i.test(r[2]) ? '' : '3ª resposta não deveria perguntar o nome de novo',
      !/aqui é a stela/i.test(r[2]) ? '' : '3ª resposta não deveria se apresentar de novo',
    ],
  },
  {
    id: 'nome no primeiro oi',
    msgs: ['boa tarde, sou a Ana', 'tenho um empréstimo no santander que virou uma bola de neve'],
    checa: (r, e) => [
      /^oi, ana!/i.test(r[0]) ? '' : '1ª resposta deveria usar o nome Ana',
      e.porta === 'rcpcc' ? '' : `deveria entender dívida com banco (veio ${e.porta})`,
      e.state?.respostas?.nome ? '' : 'deveria guardar o nome',
      !/com quem eu falo/i.test(r[1]) ? '' : 'não deveria perguntar o nome de novo',
    ],
  },
  {
    id: 'anúncio direto',
    msgs: ['Olá! Vi o anúncio e preciso de ajuda com a busca e apreensão do meu veículo.'],
    checa: (r, e) => [
      e.porta === 'dba' ? '' : `deveria entender busca e apreensão (veio ${e.porta})`,
      /stela/i.test(r[0]) && /com quem eu falo/i.test(r[0]) ? '' : 'deveria se apresentar e perguntar o nome',
    ],
  },
  {
    id: 'assunto de fora',
    msgs: ['oi, meu nome é Paulo, é sobre pensão alimentícia'],
    checa: (r, e) => [e.state?.finalizado?.motivo === 'fora_do_escopo' ? '' : `deveria encerrar como fora do escopo (veio ${e.state?.finalizado?.motivo})`, /equipe dar uma olhada/i.test(r[0]) && !/fora do que o escrit/i.test(r[0]) ? '' : 'deveria passar para a equipe conferir, sem recusar', /^Oi, Paulo! Aqui é a Stela/.test(r[0]) ? '' : 'deveria se apresentar e usar o nome'],
  },
  {
    id: 'já é cliente',
    msgs: ['oi, já sou cliente de vocês e queria saber do meu processo'],
    checa: (r, e) => [e.state?.finalizado?.motivo === 'cliente_do_escritorio' ? '' : `deveria passar para o jurídico (veio ${e.state?.finalizado?.motivo})`, /aqui é a stela/i.test(r[0]) ? '' : 'deveria se apresentar na primeira mensagem'],
  },
]

async function main() {
  const { triar } = await import('../lib/triagem')
  const { laboratorio } = await import('../lib/central')
  const { redis, k } = await import('../lib/redis')
  let falhas = 0
  console.log('## Triagem por IA')
  const REPS = Number(process.env.EVAL_REPS || 3)
  for (const c of CASOS) {
    const vistos: string[] = []
    let ok = true
    for (let i = 0; i < REPS; i++) {
      const t = await triar(c.texto)
      vistos.push(`${t.assunto}${t.nome ? `·${t.nome}` : ''}`)
      if (!(c.assunto.includes(t.assunto) && t.nome.toLowerCase() === c.nome.toLowerCase())) ok = false
    }
    if (!ok) falhas++
    console.log(`${ok ? '✅' : '❌'} "${c.texto}" → ${[...new Set(vistos)].join(' | ')} (${REPS}x)${ok ? '' : `   (esperado ${c.assunto.join('|')}${c.nome ? ` · ${c.nome}` : ''})`}`)
  }
  console.log('\n## Fluxo completo do primeiro contato (laboratório)')
  for (const f of FLUXOS) {
    let r = await laboratorio({})
    const respostas: string[] = []
    for (const m of f.msgs) { r = await laboratorio({ sessao: r.sessao, msg: m }); respostas.push(r.mensagens[r.mensagens.length - 1].text) }
    const w: any = await redis.get(k('central', 'lab', r.sessao))
    const erros = [...f.checa(respostas, { porta: w.porta, state: w.state }), ...respostas.map((x, i) => /^\s*\d\s*[.)-]\s/m.test(x) ? `resposta ${i + 1} tem lista numerada` : '')].filter(Boolean)
    if (erros.length) falhas++
    console.log(`${erros.length ? '❌' : '✅'} ${f.id}`)
    f.msgs.forEach((m, i) => console.log(`   LEAD: ${m}\n   STELA: ${respostas[i]}`))
    for (const e of erros) console.log(`   ⛔ ${e}`)
  }
  console.log(falhas ? `\n❌ ${falhas} reprovado(s)` : '\n✅ Primeiro contato aprovado')
  process.exit(falhas ? 1 : 0)
}
main().catch(e => { console.error(e); process.exit(1) })
