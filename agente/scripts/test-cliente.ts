/**
 * TESTES DO CLIENTE (patch) — Teles & Stanquevicz. Rodam junto com `npm test`.
 * Cada regra de lib/regras.ts: um texto que DEVE bloquear e um aprovado que DEVE passar.
 * Mais: roteamento por valor, formulário Meta, desempate de portas, escolha de horário
 * e os efeitos da finalização no CRM (porta em memória, sem rede).
 */
type Eq = (nome: string, got: unknown, want: unknown) => void

export default async function testesCliente(eq: Eq): Promise<number> {
  const { checkReply } = await import('../lib/guards')
  const { checarContexto } = await import('../lib/regras')
  const regras = (t: string) => [...new Set(checkReply(t).map(v => v.regra))]

  // Nenhuma promessa (decisão de 07/10/2026)
  eq('promessa: "vamos conseguir" bloqueia', regras('Fica tranquilo, vamos conseguir baixar essa dívida.'), ['prometeu resultado'])
  eq('promessa: percentual bloqueia', regras('Em casos assim o desconto chega a 70% do saldo.'), ['percentual de desconto'])
  eq('promessa: texto aprovado passa', regras('Cada contrato é diferente, então quanto dá para reduzir só o advogado consegue dizer olhando os documentos.'), [])
  eq('pagamento: chave pix bloqueia', regras('Segue a chave pix: 48.463.900/0001-00'), ['dado de pagamento'])
  eq('pagamento: encaminhar passa', regras('Certo, vou passar para a equipe do escritório e alguém continua com você por aqui.'), [])
  eq('link bloqueia', regras('Agende aqui: https://calendly.com/telesstanqueviczadvogados/atendimento-gabi'), ['link na mensagem'])
  eq('chatbot: "fico à disposição" bloqueia', regras('Qualquer coisa, fico à disposição.'), ['resíduo de chatbot'])
  eq('chatbot: abrir com "Perfeito, Ana." bloqueia', regras('Perfeito, Ana. Me manda seu nome completo, por favor?'), ['resíduo de chatbot'])
  eq('chatbot: "perfeito" no meio da frase passa', regras('Ficou perfeito o horário de sexta para você?'), [])
  eq('honorários inventados bloqueiam', checarContexto('Os honorários ficam em R$ 1.997,90 de entrada.', { leadText: 'quanto custa?', reuniaoMarcada: false }).map(v => v.regra), ['valor que o lead não disse'])
  eq('valor dito pelo lead passa', checarContexto('Entendi, uma dívida de uns 80 mil no cartão.', { leadText: 'deve dar uns 80 mil no cartão', reuniaoMarcada: false }), [])
  eq('"ficou marcado" sem reserva bloqueia', checarContexto('Pronto, ficou marcado para quinta às 9h15.', { leadText: 'quinta 9h15', reuniaoMarcada: false }).map(v => v.regra), ['disse que marcou sem reserva'])
  eq('pedir e-mail "para deixar a reunião marcada" passa', checarContexto('Para deixar a reunião marcada, qual o seu e-mail?', { leadText: 'Maria Souza', reuniaoMarcada: false }), [])
  eq('"já marquei" sem reserva bloqueia', checarContexto('Já marquei para quinta às 9h15.', { leadText: 'quinta', reuniaoMarcada: false }).map(v => v.regra), ['disse que marcou sem reserva'])
  eq('"ficou marcado" com reserva passa', checarContexto('Pronto, ficou marcado para quinta às 9h15.', { leadText: 'quinta 9h15', reuniaoMarcada: true }), [])

  // Valor da dívida e responsável
  const { escolherResponsavel, parseValorAprox, respostasDoFormulario, valorDoCaso } = await import('../lib/roteamento')
  eq('valor: "uns 80 mil"', parseValorAprox('uns 80 mil'), 80000)
  eq('valor: "R$ 62.560,00"', parseValorAprox('R$ 62.560,00'), 62560)
  eq('valor: faixa do formulário pega o piso', parseValorAprox('entre_r$_30_mil_e_r$_50_mil'), 30000)
  eq('valor: "uns 15 a 20 mil"', parseValorAprox('uns 15 a 20 mil'), 15000)
  eq('valor: "não sei"', parseValorAprox('não sei'), null)
  eq('RCV: saldo = parcelas que faltam × parcela', valorDoCaso('rcv', { parcelasTotal: '48', parcelasPagas: '2', valorParcela: '1360' }), 62560)
  eq('RCPCC: sem resposta usa a faixa do formulário', valorDoCaso('rcpcc', {}, ['entre_r$_50_mil_e_r$_100_mil', 'cartão_de_crédito']), 50000)
  eq('< 50 mil: CLOSER 1 na vez par', escolherResponsavel(30000, 0).nome, 'CLOSER 1')
  eq('< 50 mil: CLOSER 2 na vez ímpar', escolherResponsavel(30000, 1).nome, 'CLOSER 2')
  eq('≥ 50 mil: SDR', escolherResponsavel(50000, 0).nome, 'Gabi (SDR)')
  eq('sem valor: SDR', escolherResponsavel(null, 0).nome, 'Gabi (SDR)')
  eq('formulário deslocado é lido pelo conteúdo', respostasDoFormulario(['acima_de_r$_100_mil', 'com_parcelas_atrasadas_há_mais_de_90_dias', 'cartão_de_crédito', 'sim,_tenho_dívidas_bancárias']), {
    valorDivida: 'formulário: acima de r$ 100 mil', atraso: 'formulário: com parcelas atrasadas há mais de 90 dias', tipoDivida: 'formulário: cartão de crédito',
  })

  // Portas: desempate por prioridade
  const { classificar, escolherPorta } = await import('../lib/router')
  const porta = (t: string) => escolherPorta(classificar(t))?.id ?? null
  eq('porta: busca e apreensão vence financiamento', porta('o banco entrou com busca e apreensão do meu carro financiado'), 'dba')
  eq('porta: carro + banco vai para RCV', porta('financiei meu carro no banco e a parcela está pesada'), 'rcv')
  eq('porta: cartão vai para RCPCC', porta('tenho uma dívida enorme no cartão de crédito'), 'rcpcc')
  eq('porta: assunto vago não trava', porta('oi, boa tarde'), null)

  // Escolha de horário
  const { casarEscolha, escolherOpcoes } = await import('../lib/calendly')
  const agora = new Date('2026-10-07T12:00:00Z') // quarta 9h em Brasília
  const livres = ['2026-10-07T13:05:00Z', '2026-10-07T17:00:00Z', '2026-10-07T17:15:00Z', '2026-10-08T12:15:00Z', '2026-10-08T16:15:00Z', '2026-10-09T12:15:00Z']
  const opcoes = escolherOpcoes(livres, agora)
  eq('opções: antecedência de 2h, minuto redondo, um por período', opcoes.map(o => o.label), ['quarta, 07/10, às 14h', 'quinta, 08/10, às 9h15', 'quinta, 08/10, às 13h15'])
  eq('escolha: "pode ser a segunda"', casarEscolha('pode ser a segunda', opcoes, agora)?.label, 'quinta, 08/10, às 9h15')
  eq('escolha: "quinta 13h15"', casarEscolha('quinta 13h15', opcoes, agora)?.label, 'quinta, 08/10, às 13h15')
  eq('escolha: "hoje às 14h"', casarEscolha('hoje às 14h', opcoes, agora)?.label, 'quarta, 07/10, às 14h')
  eq('escolha: "segunda às 9h" é dia da semana, não a 2ª opção', casarEscolha('segunda às 9h', opcoes, agora), null)
  eq('escolha: dia que não foi oferecido não chuta', casarEscolha('sexta às 9h15', opcoes, agora), null)
  eq('escolha: "qualquer um" não chuta', casarEscolha('qualquer um', opcoes, agora), null)

  // Finalização no CRM (porta em memória)
  const { runTool } = await import('../lib/tools')
  const { CRM_MAP, portaById } = await import('../lib/crm-map')
  const neg = CRM_MAP.negocio
  const mundo = (statusId: number, pipelineId = neg.pipelineId) => {
    const w = { statusId, pipelineId, fields: {} as Record<number, { value?: unknown; enumIds: number[] }>, tags: new Set(['ia-stela']), notes: [] as string[], tasks: [] as Array<[string, number]>, responsible: 0, state: {} as Record<string, any> }
    const port = {
      getLead: async () => ({ id: 1, statusId: w.statusId, pipelineId: w.pipelineId, fields: w.fields, tags: [...w.tags] }),
      writeFields: async (vs: Array<{ field_id: number; values: Array<{ value?: unknown; enum_id?: number }> }>) => { for (const v of vs) w.fields[v.field_id] = { value: v.values[0]?.value, enumIds: v.values.map(x => x.enum_id).filter((x): x is number => !!x) } },
      moveStage: async (s: number, p?: number) => { w.statusId = s; if (p) w.pipelineId = p },
      addTags: async (t: string[]) => { t.forEach(x => w.tags.add(x)) }, removeTags: async (t: string[]) => { t.forEach(x => w.tags.delete(x)) },
      addNote: async (n: string) => { w.notes.push(n) },
      setResponsible: async (u: number) => { w.responsible = u },
      addTask: async (t: string, u: number) => { w.tasks.push([t, u]) },
      getPhone: async () => '+5511999990000', nextTurn: async () => 1,
      getState: async () => ({ ...w.state }), patchState: async (p: Record<string, unknown>) => Object.assign(w.state, p),
    }
    return { w, port }
  }
  const ctx = (port: unknown, portaId: string, lead: string) => ({ port, porta: portaById(portaId)!, gateTag: 'ia-stela', leadText: lead, lastLeadText: lead, lastAgentText: '' }) as any

  let m = mundo(72186399)
  m.w.state = { porta: 'rcv', respostas: { bancoVeiculo: 'BV', parcelasTotal: '48', parcelasPagas: '2', valorParcela: '1360', nomeCompleto: 'Maria da Silva', email: 'maria@x.com' } }
  let out = await runTool(ctx(m.port, 'rcv', 'BV 48x 1.360'), 'finalizar_atendimento', { motivo: 'qualificado', resumo: 'RCV no BV.' })
  eq('qualificado RCV ≥ 50 mil: etapa, SDR, Nichos, tarefa, sem gate', [out.handoff, m.w.statusId, m.w.responsible, m.w.fields[neg.nicho.fieldId]?.enumIds, m.w.tasks.length, m.w.tags.has('ia-stela')], [true, neg.etapaQualificado.id, neg.responsaveis.acima, [744547], 1, false])
  eq('tarefa do SDR pede para aquecer o lead', /Aquecer|Agendar/.test(m.w.tasks[0]?.[0] || ''), true)

  m = mundo(72186399)
  m.w.state = { porta: 'rcpcc', respostas: { tipoDivida: 'cartão Itaú', valorDivida: 'uns 30 mil', nomeCompleto: 'João Souza', email: 'joao@x.com' } }
  await runTool(ctx(m.port, 'rcpcc', 'cartão Itaú uns 30 mil'), 'finalizar_atendimento', { motivo: 'qualificado', resumo: 'RCPCC.' })
  eq('qualificado RCPCC < 50 mil: CLOSER 2 na vez 1', m.w.responsible, 13015432)
  eq('< 50 mil: card no CLOSER › Atendimento direto com tarefa de agendar', [m.w.statusId, m.w.pipelineId, /agendar a reunião/.test(m.w.tasks[0]?.[0] || '')], [neg.atendimentoDireto.statusId, neg.atendimentoDireto.pipelineId, true])
  const { closerAgenda } = await import('../lib/tools')
  const rcpcc = CRM_MAP.portas.find(p => p.id === 'rcpcc')!
  eq('< 50 mil: o closer agenda; ≥ 50 mil e sem valor: a Stela agenda', [closerAgenda(rcpcc, { respostas: { tipoDivida: 'cartão', valorDivida: 'uns 35 mil' } }), closerAgenda(rcpcc, { respostas: { tipoDivida: 'cartão', valorDivida: 'uns 60 mil' } }), closerAgenda(rcpcc, { respostas: { tipoDivida: 'cartão', valorDivida: 'formulário: acima_de_r$_50_mil' } })], [true, false, false])
  m = mundo(72186399)
  m.w.state = { porta: 'rcpcc', respostas: { tipoDivida: 'cartão Itaú', valorDivida: 'uns 30 mil' } }
  out = await runTool(ctx(m.port, 'rcpcc', 'cartão Itaú uns 30 mil'), 'ver_horarios', { periodo: 'qualquer', dia: '' })
  eq('< 50 mil: ver_horarios recusado', out.isError, true)
  out = await runTool(ctx(m.port, 'rcpcc', 'cartão Itaú uns 30 mil'), 'finalizar_atendimento', { motivo: 'qualificado', resumo: 'RCPCC.' })
  eq('< 50 mil: finaliza sem nome completo e e-mail', [out.isError, m.w.statusId], [false, neg.atendimentoDireto.statusId])
  m = mundo(72104583)
  out = await runTool(ctx(m.port, 'rcpcc', 'já sou cliente de vocês, quero saber do meu processo'), 'finalizar_atendimento', { motivo: 'cliente_do_escritorio', evidencia: 'já sou cliente de vocês, quero saber do meu processo', resumo: 'Cliente.' })
  eq('cliente do escritório: JURÍDICO › CONTACTAR CLIENTE, responsável e tarefa do jurídico', [out.handoff, m.w.pipelineId, m.w.statusId, m.w.responsible, m.w.tasks[0]?.[1]], [true, neg.clienteDoEscritorio.pipelineId, neg.clienteDoEscritorio.statusId, neg.clienteDoEscritorio.responsavel, neg.clienteDoEscritorio.responsavel])

  m = mundo(72186403, 9312103)
  m.w.state = { porta: 'rcpcc', respostas: { tipoDivida: 'cartão', valorDivida: '30 mil', nomeCompleto: 'Ana Lima', email: 'ana@x.com' } }
  await runTool(ctx(m.port, 'rcpcc', 'cartão 30 mil'), 'finalizar_atendimento', { motivo: 'qualificado', resumo: 'x' })
  eq('lead no funil CLOSER: não move nem troca responsável (fail-closed)', [m.w.statusId, m.w.responsible], [72186403, 0])

  m = mundo(72186399)
  out = await runTool(ctx(m.port, 'rcv', 'meu carro é financiado pelo banco toyota'), 'finalizar_atendimento', { motivo: 'fora_do_escopo', evidencia: 'financiado pelo banco toyota', resumo: 'Banco de montadora.' })
  eq('fora do escopo: etiqueta Conferir escopo e tarefa, sem Desqualificado, sem mover', [out.handoff, m.w.tags.has(neg.conferirEscopo.tag), m.w.tasks.length, m.w.tasks[0]?.[1], m.w.fields[neg.desqualificado.fieldId], m.w.statusId], [true, true, 1, neg.responsavelPadrao, undefined, 72186399])

  m = mundo(72186399)
  out = await runTool(ctx(m.port, 'rcpcc', 'já sou cliente de vocês, quero saber do meu processo'), 'finalizar_atendimento', { motivo: 'pediu_humano', evidencia: 'já sou cliente de vocês, quero saber do meu processo', resumo: 'Cliente ativo.' })
  eq('pediu humano (cliente pelo motivo antigo): tarefa para o SDR', [out.handoff, m.w.tasks[0]?.[1]], [true, neg.responsavelPadrao])

  // Agenda: oferecer, escolher, pedir dados, reservar (Calendly falso)
  m = mundo(72186399)
  m.w.state = { porta: 'rcpcc', respostas: { tipoDivida: 'cartão do itaú', valorDivida: 'uns 60 mil' } }
  out = await runTool(ctx(m.port, 'rcpcc', 'cartão do itaú, uns 60 mil'), 'ver_horarios', { periodo: 'qualquer', dia: '' })
  const oferta = (m.w.state.horariosOferecidos || []) as Array<{ label: string }>
  eq('ver_horarios guarda até 3 opções', [out.isError, oferta.length > 0 && oferta.length <= 3], [false, true])
  const escolha = `pode ser ${oferta[0].label.split(', às ')[0].split(', ')[0]} às ${oferta[0].label.split('às ')[1]}`
  out = await runTool(ctx(m.port, 'rcpcc', `cartão do itaú, uns 60 mil\n${escolha}`), 'agendar_reuniao', { evidencia: escolha, observacao: '', resumo: 'Cartão.' })
  eq('agendar sem nome/e-mail guarda o horário e pede o dado', [out.isError, !!m.w.state.horarioEscolhido, !!m.w.state.reuniao, /nome completo/.test(out.content)], [false, true, false, true])
  m.w.state.respostas = { ...m.w.state.respostas, nomeCompleto: 'Carlos Pereira', email: 'carlos@x.com' }
  out = await runTool(ctx(m.port, 'rcpcc', `cartão do itaú, uns 60 mil\n${escolha}`), 'agendar_reuniao', { evidencia: escolha, observacao: '', resumo: 'Cartão.' })
  eq('agendar com dados reserva, grava a data e finaliza qualificado', [out.handoff, !!m.w.state.reuniao, typeof m.w.fields[neg.reuniao.fieldId]?.value, m.w.statusId, m.w.state.finalizado?.motivo], [true, true, 'number', neg.etapaQualificado.id, 'qualificado'])

  // Nome: só vale o que parece nome de pessoa (bug do eval de 16/10: frase do caso gravada como nome completo)
  const { pareceNome } = await import('../lib/tools')
  eq('nome completo: "Maria Aparecida Souza" vale', pareceNome('Maria Aparecida Souza', 2), 'Maria Aparecida Souza')
  eq('nome completo: "meu nome é João Lima" vale sem o prefixo', pareceNome('meu nome é João Lima', 2), 'João Lima')
  eq('nome completo: frase do caso não vale', pareceNome('Levaram meu carro ontem, o oficial deixou um papel aqui', 2), '')
  eq('nome completo: um nome só não vale', pareceNome('Marcos', 2), '')
  eq('nome completo: horário escolhido não vira nome', [pareceNome('sexta de manhã', 2), pareceNome('o primeiro horário', 2)], ['', ''])
  m = mundo(72186399)
  m.w.state = { porta: 'dba', respostas: { apreendido: 'levaram', mandado: 'papel' } }
  out = await runTool(ctx(m.port, 'dba', 'Levaram meu carro ontem, o oficial deixou um papel aqui'), 'salvar_respostas', { respostas: [{ campo: 'nomeCompleto', evidencia: 'Levaram meu carro ontem, o oficial deixou um papel aqui', valor: 'Maria' }] })
  eq('salvar nome completo inventado é recusado', [out.isError, m.w.state.respostas?.nomeCompleto], [true, undefined])
  m.w.state = { porta: 'rcpcc', respostas: {} }
  out = await runTool(ctx(m.port, 'rcpcc', 'sou a Ana Souza, tenho uma dívida no cartão do Itaú'), 'salvar_respostas', { respostas: [{ campo: 'nome', evidencia: 'sou a Ana Souza, tenho uma dívida no cartão do Itaú', valor: 'Ana' }] })
  eq('nome dentro de frase vale pelo valor', m.w.state.respostas?.nome, 'Ana')

  const { acolher } = await import('../lib/llm')
  const F = 'Entendi, vamos ver isso rápido.'
  eq('acolhimento: entra na 1ª resposta do caso', acolher(F, ['Oi! Aqui é a Stela, da Teles & Stanquevicz Advogados. Com quem eu falo?'], 'Rafael, o veículo já foi apreendido?', false), `${F} Rafael, o veículo já foi apreendido?`)
  eq('acolhimento: não repete', acolher(F, ['Entendi, vamos ver isso rápido. O veículo já foi apreendido?'], 'O oficial deixou o mandado?', false), 'O oficial deixou o mandado?')
  eq('acolhimento: não entra na abertura nem no encerramento', [acolher(F, [], 'Oi! Aqui é a Stela, da Teles & Stanquevicz Advogados. Com quem eu falo?', false), acolher(F, ['x'], 'Obrigada.', true)], ['Oi! Aqui é a Stela, da Teles & Stanquevicz Advogados. Com quem eu falo?', 'Obrigada.'])

  eq('"vou passar para a equipe" sem encerrar é barrado', checarContexto('Obrigada. Vou passar para a nossa equipe consultar o seu processo.', { leadText: '', reuniaoMarcada: false, encerrado: false }).map(v => v.regra), ['disse que passou para a equipe sem encerrar'])
  eq('"vou passar para a equipe" depois de encerrar passa', checarContexto('Obrigada. Vou passar para a nossa equipe consultar o seu processo.', { leadText: '', reuniaoMarcada: false, encerrado: true }), [])

  m = mundo(72186399)
  m.w.state = { porta: 'rcv', respostas: {} }
  out = await runTool(ctx(m.port, 'rcv', 'Olá! Vi o anúncio e quero saber sobre a revisão do financiamento do meu veículo.'), 'salvar_respostas', { respostas: [{ campo: 'bancoVeiculo', evidencia: 'revisão do financiamento do meu veículo', valor: 'não informado' }] })
  eq('banco "não informado" não é gravado', [out.isError, m.w.state.respostas?.bancoVeiculo], [true, undefined])

  const { primeiraMensagem } = await import('../lib/llm')
  eq('1ª mensagem sem nome: apresenta e pergunta o nome', primeiraMensagem(true, '', 'Por qual banco foi o financiamento?', false), `Oi! ${CRM_MAP.abertura.apresentacao} Com quem eu falo?`)
  eq('1ª mensagem com nome: apresenta e segue', primeiraMensagem(true, 'ana', 'Mais ou menos quanto está a dívida?', false), `Oi, Ana! ${CRM_MAP.abertura.apresentacao} Mais ou menos quanto está a dívida?`)
  eq('1ª mensagem que já se apresenta fica igual', primeiraMensagem(true, '', 'Oi! Aqui é a Stela, da Teles & Stanquevicz Advogados. Com quem eu falo?', false), 'Oi! Aqui é a Stela, da Teles & Stanquevicz Advogados. Com quem eu falo?')
  eq('depois da primeira mensagem: nada muda', primeiraMensagem(false, '', 'Quantas parcelas já foram pagas?', false), 'Quantas parcelas já foram pagas?')

  const { respostaHonesta } = await import('../lib/llm')
  eq('perguntou se é robô e ela desconversou: confirma', respostaHonesta('tô falando com um robô? tenho dívida no cheque especial', 'Aqui é a Stela, da Teles & Stanquevicz Advogados. Mais ou menos quanto está a dívida?'), 'Sim, aqui é a Stela, a assistente virtual da Teles & Stanquevicz Advogados. Mais ou menos quanto está a dívida?')
  eq('perguntou se é robô e ela já confirmou: fica igual', respostaHonesta('você é um robô?', 'Sou a assistente virtual do escritório. Qual o valor da dívida?'), 'Sou a assistente virtual do escritório. Qual o valor da dívida?')
  eq('não perguntou: fica igual', respostaHonesta('tenho dívida no cartão', 'Mais ou menos quanto está a dívida?'), 'Mais ou menos quanto está a dívida?')

  // Quem a Stela atende (etiqueta × modo "todos os leads novos")
  const { liberadoParaStela } = await import('../lib/gate')
  const virada = Date.parse('2026-10-27T00:00:00-03:00')
  const cfgTodos = { gateTag: 'ia-stela', humanTag: 'atendimento-humano', desde: virada }
  const cfgTeste = { gateTag: 'ia-stela', humanTag: 'atendimento-humano', desde: 0 }
  const novoSdr = { pipeline_id: 9299515, status_id: 72104583, created_at: virada / 1000 + 60 }
  eq('teste: sem etiqueta não atende', liberadoParaStela(novoSdr, [], cfgTeste).sim, false)
  eq('teste: com ia-stela atende', liberadoParaStela(novoSdr, ['ia-stela'], cfgTeste).sim, true)
  eq('todos: lead novo no SDR atende', liberadoParaStela(novoSdr, [], cfgTodos).sim, true)
  eq('todos: lead criado antes da virada não atende', liberadoParaStela({ ...novoSdr, created_at: virada / 1000 - 3600 }, [], cfgTodos).sim, false)
  eq('todos: lead novo no JURÍDICO não atende', liberadoParaStela({ ...novoSdr, pipeline_id: 9312127, status_id: 72188239 }, [], cfgTodos).sim, false)
  eq('todos: lead novo em Reunião agendada não atende', liberadoParaStela({ ...novoSdr, status_id: 86825532 }, [], cfgTodos).sim, false)
  eq('etiqueta atendimento-humano sempre vence', liberadoParaStela(novoSdr, ['ia-stela', 'atendimento-humano'], cfgTodos).sim, false)

  // Mensagens prontas dos anúncios do Google (26/10/2026)
  const { rotear: rotearG } = await import('../lib/router')
  const { origemPorFrase } = await import('../lib/rastreio')
  const gRcv = 'Olá! Vim através do Google e gostaria de mais informações sobre Revisão de Financiamento de Veículos'
  const gDba = 'Olá! Vim através do Google e gostaria de mais informações sobre Defesa em ação de Busca e Apreensão'
  const pid = (r: any) => r.tipo === 'porta' ? r.porta.id : r.tipo
  eq('Google RCV trava financiamento de veículo pela palavra-chave', pid(rotearG({}, gRcv)), 'rcv')
  eq('Google DBA trava busca e apreensão pela palavra-chave', pid(rotearG({}, gDba)), 'dba')
  eq('Google RCV: origem Google, campanha rcv', [origemPorFrase(gRcv)?.deOnde, origemPorFrase(gRcv)?.utm_campaign], ['Google', 'rcv'])
  eq('Google DBA: origem Google, campanha dba', [origemPorFrase(gDba)?.deOnde, origemPorFrase(gDba)?.utm_campaign], ['Google', 'dba'])
  eq('mensagem comum não vira origem', origemPorFrase('oi, tenho uma dívida no cartão'), null)
  const { etiquetasPorFrase } = await import('../lib/rastreio')
  eq('Google: etiquetas GOOGLE + RCV / GOOGLE + DBA', [etiquetasPorFrase(gRcv), etiquetasPorFrase(gDba)], [['GOOGLE', 'RCV'], ['GOOGLE', 'DBA']])
  eq('"Olá!" e "Bom dia" não viram nome', [pareceNome('Olá!'), pareceNome('Bom dia!'), pareceNome('manhã')], ['', '', ''])
  m = mundo(72186399)
  m.w.state = { porta: 'dba', respostas: {} }
  await runTool(ctx(m.port, 'dba', 'ainda não levaram, mas chegou uma notificação'), 'salvar_respostas', { respostas: [{ campo: 'apreendido', evidencia: 'ainda não levaram', valor: 'não' }] })
  eq('busca e apreensão ainda não feita: data não é perguntada', (m.w.state.semResposta || []).includes('dataApreensao'), true)

  // Busca e apreensão: sem horário, conferência da equipe antes da reunião (pedido do Dr., 15/10/2026)
  const { buildTools } = await import('../lib/tools')
  const nomesDba = buildTools(CRM_MAP.portas.find(p => p.id === 'dba')!).map(t => t.type === 'function' ? t.function.name : '')
  eq('busca e apreensão: sem ferramentas de agenda', [nomesDba.includes('ver_horarios'), nomesDba.includes('agendar_reuniao')], [false, false])
  m = mundo(72104583)
  m.w.state = { porta: 'dba', respostas: { apreendido: 'levaram ontem', mandado: 'deixou o papel', nomeCompleto: 'Marcos Pereira' } }
  out = await runTool(ctx(m.port, 'dba', 'levaram ontem, deixou o papel'), 'finalizar_atendimento', { motivo: 'qualificado', resumo: 'DBA.' })
  eq('busca e apreensão: Em atendimento, SDR, tarefa de consultar o processo', [out.handoff, m.w.statusId, m.w.responsible, /consultar o processo/.test(m.w.tasks[0]?.[0] || '')], [true, 72186399, neg.responsavelPadrao, true])

  // Follow-up: relógio e textos
  const { proximoToque, encaixar } = await import('../lib/followup-tempo')
  const { textoDoToque } = await import('../lib/followup')
  const brt = (s: string) => new Date(`${s}-03:00`).getTime()
  const hora = (ms: number | undefined) => ms ? new Date(ms - 3 * 3600_000).toISOString().slice(5, 16).replace('T', ' ') : null
  let x = brt('2026-10-07T10:00')
  eq('follow-up 10h: toque 1 às 12h', hora(proximoToque(0, x, x, x)?.em), '10-07 12:00')
  eq('follow-up 10h: toque 2 às 8h do dia seguinte', hora(proximoToque(1, x, x, brt('2026-10-07T12:00'))?.em), '10-08 08:00')
  x = brt('2026-10-07T19:00')
  eq('follow-up 19h: toque 1 não sai de noite, vai para 8h', hora(proximoToque(0, x, x, x)?.em), '10-08 08:00')
  x = brt('2026-10-07T03:00')
  eq('follow-up 3h: toque 2 antecipa para caber na janela', hora(proximoToque(1, x, x, brt('2026-10-07T08:00'))?.em), '10-07 19:59')
  eq('follow-up: esgotou quando a janela fecha', hora(proximoToque(2, x, x, x)?.em), '10-08 03:00')
  eq('encaixar: não cabe antes do limite → null', encaixar(brt('2026-10-07T21:00'), brt('2026-10-07T21:30'), brt('2026-10-07T20:50')), null)
  const tregras = (t: string) => [...new Set(checkReply(t).map(v => v.regra))]
  for (const st of [{}, { porta: 'rcv', respostas: { bancoVeiculo: 'BV' } }, { porta: 'dba', respostas: { apreendido: 'sim' } }, { porta: 'rcpcc', horariosOferecidos: [{ iso: 'x', label: 'y' }] }]) {
    const t1 = textoDoToque(1, st as any)
    eq(`toque 1 passa nas travas (${(st as any).porta || 'sem porta'})`, tregras(t1), [])
  }
  eq('toque 1 RCV pergunta o próximo dado', textoDoToque(1, { porta: 'rcv', respostas: { bancoVeiculo: 'BV' } }), 'Oi! Só para a gente seguir com o seu caso: O financiamento foi feito em quantas parcelas?')
  eq('toque 2 passa nas travas', tregras(textoDoToque(2, {})), [])

  // Automação: contrato pago → JURÍDICO
  const { parseStatusLead, decidir } = await import('../lib/crm-eventos')
  const plano = parseStatusLead({ 'account[id]': '33277515', 'leads[status][0][id]': '555', 'leads[status][0][status_id]': '142', 'leads[status][0][pipeline_id]': '9312103', 'leads[status][0][old_status_id]': '72186419', 'leads[status][0][old_pipeline_id]': '9312103' })
  eq('webhook status_lead plano', plano.mudancas[0], { leadId: 555, statusId: 142, pipelineId: 9312103, oldStatusId: 72186419, oldPipelineId: 9312103 })
  const aninhado = parseStatusLead({ account: { id: '33277515' }, leads: { status: [{ id: '556', status_id: '142', pipeline_id: '9312103', old_status_id: '72851523', old_pipeline_id: '9312103' }] } })
  eq('webhook status_lead aninhado', [aninhado.accountId, aninhado.mudancas[0]?.leadId], ['33277515', 556])
  eq('venda ganha no CLOSER dispara contrato pago', decidir(plano.mudancas[0]), 'contratoPago')
  eq('ganho no SDR (reunião realizada) dispara Proposta', decidir({ leadId: 1, statusId: 142, pipelineId: 9299515, oldStatusId: 86825532, oldPipelineId: 9299515 }), 'reuniaoRealizada')
  eq('a ida para Proposta não dispara (sem laço)', decidir({ leadId: 1, statusId: 72851523, pipelineId: 9312103, oldStatusId: 142, oldPipelineId: 9299515 }), null)
  eq('perdido no SDR não dispara', decidir({ leadId: 1, statusId: 143, pipelineId: 9299515, oldStatusId: 72104595, oldPipelineId: 9299515 }), null)
  eq('ganho do JURÍDICO não dispara', decidir({ leadId: 1, statusId: 142, pipelineId: 9312127, oldStatusId: 72186743, oldPipelineId: 9312127 }), null)
  eq('a própria ida ao JURÍDICO não dispara (sem laço)', decidir({ leadId: 1, statusId: 72657491, pipelineId: 9312127, oldStatusId: 142, oldPipelineId: 9312103 }), null)
  eq('mudança para Pagamento não dispara', decidir({ leadId: 1, statusId: 72186419, pipelineId: 9312103, oldStatusId: 72686979, oldPipelineId: 9312103 }), null)
  eq('entrar em Follow-up põe a etiqueta Follow up', decidir({ leadId: 1, statusId: 72104595, pipelineId: 9299515, oldStatusId: 72186399, oldPipelineId: 9299515 }), 'etiquetaFollowUp')
  eq('venda perdida no CLOSER põe Desqualificado', decidir({ leadId: 1, statusId: 143, pipelineId: 9312103, oldStatusId: 72851523, oldPipelineId: 9312103 }), 'etiquetaVendaPerdida')
  eq('perdido no SDR não põe Desqualificado', decidir({ leadId: 1, statusId: 143, pipelineId: 9299515, oldStatusId: 72104595, oldPipelineId: 9299515 }), null)
  eq('Follow-up de outro funil não dispara', decidir({ leadId: 1, statusId: 72104595, pipelineId: 9312103, oldStatusId: 72851523, oldPipelineId: 9312103 }), null)
  eq('evento repetido dentro do Follow-up não dispara', decidir({ leadId: 1, statusId: 72104595, pipelineId: 9299515, oldStatusId: 72104595, oldPipelineId: 9299515 }), null)
  const FS = await import('../lib/funil-sdr')
  eq('retorno: Leads de entrada e Follow-up voltam', [FS.deveVoltar({ pipeline_id: 9299515, status_id: 72104583 }), FS.deveVoltar({ pipeline_id: 9299515, status_id: 72104595 })], [true, true])
  eq('retorno: Reunião agendada, No-show, perdido e outros funis ficam', [FS.deveVoltar({ pipeline_id: 9299515, status_id: 86825532 }), FS.deveVoltar({ pipeline_id: 9299515, status_id: 72113011 }), FS.deveVoltar({ pipeline_id: 9299515, status_id: 143 }), FS.deveVoltar({ pipeline_id: 9312147, status_id: 83784180 })], [false, false, false, false])
  const D = 86400_000, T = Date.parse('2026-10-20T12:00:00Z')
  eq('follow-up: 5 dias sem resposta perde', FS.venceu(T - 5 * D - 1, 0, T), 'perder')
  eq('follow-up: 4 dias ainda espera', FS.venceu(T - 4 * D, 0, T), 'esperar')
  eq('follow-up: respondeu há 2 dias reinicia a contagem', FS.venceu(T - 6 * D, T - 2 * D, T), 'reiniciar')
  eq('follow-up: resposta antiga não salva', FS.venceu(T - 12 * D, T - 6 * D, T), 'perder')

  // Lembretes de reunião: 24h e 2h antes, janela de 30 min, nada para reunião passada
  const { lembretesDevidos } = await import('../lib/lembretes')
  const agoraL = Date.parse('2026-10-15T12:00:00Z')
  const seg = (iso: string) => Math.floor(Date.parse(iso) / 1000)
  const devidos = lembretesDevidos([
    { id: 1, reuniaoEm: seg('2026-10-16T11:50:00Z') },  // 24h antes foi há 10 min → 24h
    { id: 2, reuniaoEm: seg('2026-10-15T13:55:00Z') },  // 2h antes foi há 5 min → 2h
    { id: 3, reuniaoEm: seg('2026-10-16T13:00:00Z') },  // 24h antes ainda não chegou
    { id: 4, reuniaoEm: seg('2026-10-16T11:00:00Z') },  // 24h antes foi há 60 min → fora da janela
    { id: 5, reuniaoEm: seg('2026-10-15T11:00:00Z') },  // já passou
    { id: 6, reuniaoEm: null },
  ], agoraL)
  eq('lembretes: 24h e 2h na janela, nada fora dela', devidos.map(d => `${d.leadId}:${d.tipo}`), ['1:24h', '2:2h'])
  eq('lembretes: bot certo por tipo', devidos.map(d => d.botId), [10528, 10530])

  // Calendly → Kommo
  const { chaveTelefone, escolherLead, assinaturaValida } = await import('../lib/calendly-sync')
  eq('telefone: Calendly e Kommo casam', [chaveTelefone('+55 48 99966-1278'), chaveTelefone('5548999661278'), chaveTelefone('(48) 9966-1278')], ['4899661278', '4899661278', '4899661278'])
  eq('telefone: DDD diferente não casa', chaveTelefone('+55 47 99966-1278') === chaveTelefone('+55 48 99966-1278'), false)
  eq('telefone curto é ignorado', chaveTelefone('9966-1278'), null)
  eq('lead: aberto no SDR vence', escolherLead([{ id: 1, pipelineId: 9312127, statusId: 72657491, updatedAt: 9 }, { id: 2, pipelineId: 9299515, statusId: 72104595, updatedAt: 5 }])?.id, 2)
  eq('lead: perdido no SDR antes de outro funil fechado', escolherLead([{ id: 3, pipelineId: 9312103, statusId: 142, updatedAt: 9 }, { id: 4, pipelineId: 9299515, statusId: 143, updatedAt: 1 }])?.id, 4)
  eq('lead: ganho no SDR não é escolhido', escolherLead([{ id: 5, pipelineId: 9299515, statusId: 142, updatedAt: 9 }]), null)
  const chaveW = 'segredo-teste', corpo = '{"event":"invitee.created"}', tW = Math.floor(Date.now() / 1000)
  const v1 = (await import('crypto')).createHmac('sha256', chaveW).update(`${tW}.${corpo}`).digest('hex')
  eq('assinatura do Calendly: válida', assinaturaValida(`t=${tW},v1=${v1}`, corpo, chaveW), true)
  eq('assinatura do Calendly: corpo alterado falha', assinaturaValida(`t=${tW},v1=${v1}`, corpo + ' ', chaveW), false)
  eq('assinatura do Calendly: velha (>5 min) falha', assinaturaValida(`t=${tW - 400},v1=${v1}`, corpo, chaveW), false)

  // Rastreador de origem
  const { novoCodigo, origemDoLink, linkWhatsapp, lerMarca, camposDaOrigem } = await import('../lib/rastreio')
  eq('código: 4 letras sem O/0/I/1', /^[A-HJ-NP-Z2-9]{4}$/.test(novoCodigo()), true)
  const oMeta = origemDoLink('meta-rcv', { utm_campaign: 'rcv-outubro', fbclid: 'abc123' })
  eq('link: parâmetro da URL vence o padrão', [oMeta?.deOnde, oMeta?.utm_source, oMeta?.utm_campaign, oMeta?.fbclid], ['Meta', 'facebook', 'rcv-outubro', 'abc123'])
  eq('link: slug inexistente', origemDoLink('nao-existe', {}), null)
  eq('link do WhatsApp com frase e código', linkWhatsapp('+55 47 99999-0000', 'Olá!', 'K7PX'), 'https://wa.me/5547999990000?text=Ol%C3%A1!%20(c%C3%B3d.%20K7PX)')
  eq('mensagem com código: lê e limpa', lerMarca('Olá! Vi o anúncio e quero saber sobre a revisão do financiamento do meu veículo. (cód. K7PX)'), { tipo: 'cod', codigo: 'K7PX', limpo: 'Olá! Vi o anúncio e quero saber sobre a revisão do financiamento do meu veículo.' })
  eq('mensagem com ref fixa de anúncio', lerMarca('Quero saber mais (ref. RCV1)').codigo, 'RCV1')
  eq('ref desconhecida não conta', lerMarca('oi (ref. XPTO9)').tipo, null)
  eq('mensagem comum fica igual', lerMarca('oi, tudo bem?'), { tipo: null, codigo: '', limpo: 'oi, tudo bem?' })
  eq('origem vira campos (UTM + De onde por enum)', camposDaOrigem({ deOnde: 'Meta', utm_source: 'facebook', utm_campaign: 'rcv', fbclid: 'x' }).map(f => f.field_id).sort(), [1023546, 369986, 369988, 370000].sort())
  const { classificar: cls, escolherPorta: ep } = await import('../lib/router')
  eq('frase do link leva a Stela para a porta certa', ['meta-rcpcc', 'meta-rcv', 'meta-dba'].map(s => ep(cls(lerMarca((CRM_MAP as any).rastreio.links[s].texto).limpo))?.id), ['rcpcc', 'rcv', 'dba'])

  // Central v5: o que vai para a tela
  const C = await import('../lib/central')
  eq('central: primeiro nome só', [C.primeiroNome('MARIA da silva'), C.primeiroNome('+55 47 99999-0000'), C.primeiroNome(undefined)], ['Maria', 'Lead sem nome', 'Lead sem nome'])
  eq('central: telefone, e-mail e CPF somem', C.anonimizar('liga 47 99999-0000, maria@x.com.br, cpf 123.456.789-09'), 'liga •••, •••@•••, cpf •••')
  eq('central: data e id de lead ficam', C.anonimizar('calendly marcou 15/10/2026, 13:30 · lead 26157673'), 'calendly marcou 15/10/2026, 13:30 · lead 26157673')
  const tC = 1_800_000_000
  const sts = [{ id: 1, name: 'Incoming leads', type: 1, sort: 10 }, { id: 2, name: 'Proposta', sort: 20 }, { id: 142, name: 'ganho', sort: 10000 }]
  const foto = C.agregarFunil({ id: 9, nome: 'CLOSER' }, sts, [
    { id: 11, name: 'Ana Paula', status_id: 2, pipeline_id: 9, price: 5000, updated_at: tC - 10 * 86400, created_at: tC - 20 * 86400, responsible_user_id: 7 },
    { id: 12, name: 'Bruno', status_id: 2, pipeline_id: 9, price: 0, updated_at: tC - 86400, created_at: tC - 86400 },
    { id: 13, name: 'Outro funil', status_id: 2, pipeline_id: 8, price: 999 },
    { id: 14, name: 'Ganho', status_id: 142, pipeline_id: 9, price: 999 },
  ], tC, { 7: 'Carla' })
  eq('funil: etapas na ordem, sem ganho/perdido, entrada com nome em português', foto.etapas.map(e => e.nome), ['Leads de entrada', 'Proposta'])
  eq('funil: conta, soma, parados e novos', [foto.n, foto.valor, foto.etapas[1].parados, foto.etapas[1].novos7d], [2, 5000, 1, 1])
  eq('funil: amostra parada com primeiro nome e responsável', foto.etapas[1].amostras, [{ id: 11, nome: 'Ana', dias: 10, valor: 5000, responsavel: 'Carla' }])
  const massa = Array.from({ length: 8 }, (_, i) => ({ entity_id: 100 + i, created_at: tC + i, created_by: 5 }))
  const limpos = C.limparEventos([...massa, { entity_id: 1, created_at: tC - 3600, created_by: 5 }, { entity_id: 1, created_at: tC - 1800, created_by: 5 }, { entity_id: 2, created_at: tC, created_by: 0 }])
  eq('resultados: movimentação em massa não conta e lead repetido conta uma vez', [limpos.n, limpos.massa], [2, 8])
  const org = C.agregarOrigem([
    { id: 1, status_id: 1, pipeline_id: 1, custom_fields_values: [{ field_id: 1023546, values: [{ enum_id: 744844 }] }, { field_id: 369986, values: [{ value: 'rcv' }] }] },
    { id: 2, status_id: 1, pipeline_id: 1, custom_fields_values: null },
  ])
  eq('origem: De onde por enum, sem origem e campanha', [org.deOnde, org.campanhas], [{ Meta: 1, 'Sem origem registrada': 1 }, { rcv: 1 }])
  const nowMs = Date.parse('2026-10-14T20:00:00Z')
  const ex = (h: number, tipo: string, extra: Record<string, unknown> = {}) => C.paraTela({ at: new Date(nowMs - h * 3600_000).toISOString(), tipo: tipo as any, leadId: 1, ...extra })
  const mc = C.metricasDiario([
    ex(1, 'resposta', { ms: 4000, leadId: 1, custoUsd: 0.001 }), ex(2, 'finalizou', { ms: 6000, leadId: 2, tools: ['agendar_reuniao'] }),
    ex(3, 'erro'), ex(5, 'followup', { detalhe: 'toque 1 · x' }), ex(30, 'automacao', { detalhe: 'reuniaoRealizada → Proposta' }),
    ex(31, 'automacao', { detalhe: 'contratoPago: lead já não está em Venda ganha, nada feito' }),
  ], nowMs)
  eq('diário 24h: conversas, reunião da Stela, erro, retomada e mediana', [mc.h24.conversas, mc.h24.reunioesGabi, mc.h24.erros, mc.h24.retomadas, mc.h24.respostaMedianaSeg], [2, 1, 1, 1, 6])
  eq('diário 7d: automação que não fez nada não conta', [mc.d7.automacoes, mc.h24.automacoes], [1, 0])
  eq('diário: custo em reais com o câmbio da env', mc.h24.custoBrl, Math.round(0.001 * Number(process.env.USD_BRL || 5.4) * 100) / 100)
  eq('categoria: rastreio é origem, calendly é agenda', [C.categoria({ at: '', tipo: 'automacao', leadId: 0, detalhe: 'rastreio: x' }), C.categoria({ at: '', tipo: 'automacao', leadId: 0, detalhe: 'calendly marcou' })], ['origem', 'agenda'])
  const pr = C.prontidao({ GATE_TAG: 'ia-stela', LEMBRETES_MODO: 'sombra' })
  eq('prontidão: sem robô de envio a Stela não aparece como ligada', pr.find(i => i.id === 'gabi')?.ok, false)
  eq('prontidão: lembretes em sombra não aparecem como enviando', pr.find(i => i.id === 'lembretes')?.estado, 'modo sombra: confere sem enviar')
  eq('prontidão: rampagem explica a etiqueta', pr.find(i => i.id === 'rampa')?.estado, 'fase de teste: só leads com a etiqueta ia-stela')
  eq('régua: horário é agenda viva', C.destinoDaCorrecao('ela ofereceu horário de sábado').destino, 'agenda')
  eq('régua: honorário fica fora', C.destinoDaCorrecao('ela devia dizer que a consulta custa R$ 300').destino, 'fora do escopo')
  eq('régua: tom vira regra de conversa', C.destinoDaCorrecao('ela foi seca demais quando a pessoa disse que estava desesperada').destino, 'jeito de conversar')
  const h = C.hashSenha('54321')
  eq('senha: hash confere só com a senha certa', [C.confereSenha('54321', h), C.confereSenha('12345', h), C.confereSenha('54321', ''), h.includes('54321')], [true, false, false, false])

  return 0
}
