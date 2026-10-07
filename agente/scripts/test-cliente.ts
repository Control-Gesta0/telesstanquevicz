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
  eq('honorários inventados bloqueiam', checarContexto('Os honorários ficam em R$ 1.997,90 de entrada.', { leadText: 'quanto custa?', reuniaoMarcada: false }).map(v => v.regra), ['valor que o lead não disse'])
  eq('valor dito pelo lead passa', checarContexto('Entendi, uma dívida de uns 80 mil no cartão.', { leadText: 'deve dar uns 80 mil no cartão', reuniaoMarcada: false }), [])
  eq('"ficou marcado" sem reserva bloqueia', checarContexto('Pronto, ficou marcado para quinta às 9h15.', { leadText: 'quinta 9h15', reuniaoMarcada: false }).map(v => v.regra), ['disse que marcou sem reserva'])
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
  eq('< 50 mil: Guilherme na vez par', escolherResponsavel(30000, 0).nome, 'Guilherme')
  eq('< 50 mil: Carla na vez ímpar', escolherResponsavel(30000, 1).nome, 'Carla')
  eq('≥ 50 mil: SDR', escolherResponsavel(50000, 0).nome, 'SDR')
  eq('sem valor: SDR', escolherResponsavel(null, 0).nome, 'SDR')
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
    const w = { statusId, pipelineId, fields: {} as Record<number, { value?: unknown; enumIds: number[] }>, tags: new Set(['ia-gabi']), notes: [] as string[], tasks: [] as Array<[string, number]>, responsible: 0, state: {} as Record<string, any> }
    const port = {
      getLead: async () => ({ id: 1, statusId: w.statusId, pipelineId: w.pipelineId, fields: w.fields, tags: [...w.tags] }),
      writeFields: async (vs: Array<{ field_id: number; values: Array<{ value?: unknown; enum_id?: number }> }>) => { for (const v of vs) w.fields[v.field_id] = { value: v.values[0]?.value, enumIds: v.values.map(x => x.enum_id).filter((x): x is number => !!x) } },
      moveStage: async (s: number) => { w.statusId = s },
      addTags: async () => {}, removeTags: async (t: string[]) => { t.forEach(x => w.tags.delete(x)) },
      addNote: async (n: string) => { w.notes.push(n) },
      setResponsible: async (u: number) => { w.responsible = u },
      addTask: async (t: string, u: number) => { w.tasks.push([t, u]) },
      getPhone: async () => '+5511999990000', nextTurn: async () => 1,
      getState: async () => ({ ...w.state }), patchState: async (p: Record<string, unknown>) => Object.assign(w.state, p),
    }
    return { w, port }
  }
  const ctx = (port: unknown, portaId: string, lead: string) => ({ port, porta: portaById(portaId)!, gateTag: 'ia-gabi', leadText: lead, lastLeadText: lead, lastAgentText: '' }) as any

  let m = mundo(72186399)
  m.w.state = { porta: 'rcv', respostas: { bancoVeiculo: 'BV', parcelasTotal: '48', parcelasPagas: '2', valorParcela: '1360', nomeCompleto: 'Maria da Silva', email: 'maria@x.com' } }
  let out = await runTool(ctx(m.port, 'rcv', 'BV 48x 1.360'), 'finalizar_atendimento', { motivo: 'qualificado', resumo: 'RCV no BV.' })
  eq('qualificado RCV ≥ 50 mil: etapa, SDR, Nichos, tarefa, sem gate', [out.handoff, m.w.statusId, m.w.responsible, m.w.fields[neg.nicho.fieldId]?.enumIds, m.w.tasks.length, m.w.tags.has('ia-gabi')], [true, neg.etapaQualificado.id, neg.responsaveis.acima, [744547], 1, false])
  eq('tarefa do SDR pede para aquecer o lead', /Aquecer|Agendar/.test(m.w.tasks[0]?.[0] || ''), true)

  m = mundo(72186399)
  m.w.state = { porta: 'rcpcc', respostas: { tipoDivida: 'cartão Itaú', valorDivida: 'uns 30 mil', nomeCompleto: 'João Souza', email: 'joao@x.com' } }
  await runTool(ctx(m.port, 'rcpcc', 'cartão Itaú uns 30 mil'), 'finalizar_atendimento', { motivo: 'qualificado', resumo: 'RCPCC.' })
  eq('qualificado RCPCC < 50 mil: Carla na vez 1', m.w.responsible, 13015432)

  m = mundo(72186403, 9312103)
  m.w.state = { porta: 'rcpcc', respostas: { tipoDivida: 'cartão', valorDivida: '30 mil', nomeCompleto: 'Ana Lima', email: 'ana@x.com' } }
  await runTool(ctx(m.port, 'rcpcc', 'cartão 30 mil'), 'finalizar_atendimento', { motivo: 'qualificado', resumo: 'x' })
  eq('lead no funil CLOSER: não move nem troca responsável (fail-closed)', [m.w.statusId, m.w.responsible], [72186403, 0])

  m = mundo(72186399)
  out = await runTool(ctx(m.port, 'rcv', 'meu carro é financiado pelo banco toyota'), 'finalizar_atendimento', { motivo: 'fora_do_escopo', evidencia: 'financiado pelo banco toyota', resumo: 'Banco de montadora.' })
  eq('fora do escopo: Desqualificado robô, sem mover, sem tarefa', [out.handoff, m.w.fields[neg.desqualificado.fieldId]?.enumIds, m.w.statusId, m.w.tasks.length], [true, [neg.desqualificado.enumRobo], 72186399, 0])

  m = mundo(72186399)
  out = await runTool(ctx(m.port, 'rcpcc', 'já sou cliente de vocês, quero saber do meu processo'), 'finalizar_atendimento', { motivo: 'pediu_humano', evidencia: 'já sou cliente de vocês, quero saber do meu processo', resumo: 'Cliente ativo.' })
  eq('cliente do escritório: pediu humano com tarefa para o SDR', [out.handoff, m.w.tasks[0]?.[1]], [true, neg.responsavelPadrao])

  // Agenda: oferecer, escolher, pedir dados, reservar (Calendly falso)
  m = mundo(72186399)
  m.w.state = { porta: 'dba', respostas: { apreendido: 'levaram ontem' } }
  out = await runTool(ctx(m.port, 'dba', 'levaram ontem'), 'ver_horarios', { periodo: 'qualquer', dia: '' })
  const oferta = (m.w.state.horariosOferecidos || []) as Array<{ label: string }>
  eq('ver_horarios guarda até 3 opções', [out.isError, oferta.length > 0 && oferta.length <= 3], [false, true])
  const escolha = `pode ser ${oferta[0].label.split(', às ')[0].split(', ')[0]} às ${oferta[0].label.split('às ')[1]}`
  out = await runTool(ctx(m.port, 'dba', `levaram ontem\n${escolha}`), 'agendar_reuniao', { evidencia: escolha, observacao: '', resumo: 'DBA urgente.' })
  eq('agendar sem nome/e-mail guarda o horário e pede o dado', [out.isError, !!m.w.state.horarioEscolhido, !!m.w.state.reuniao, /nome completo/.test(out.content)], [false, true, false, true])
  m.w.state.respostas = { ...m.w.state.respostas, nomeCompleto: 'Carlos Pereira', email: 'carlos@x.com' }
  out = await runTool(ctx(m.port, 'dba', `levaram ontem\n${escolha}`), 'agendar_reuniao', { evidencia: escolha, observacao: '', resumo: 'DBA urgente.' })
  eq('agendar com dados reserva, grava a data e finaliza qualificado', [out.handoff, !!m.w.state.reuniao, typeof m.w.fields[neg.reuniao.fieldId]?.value, m.w.statusId, m.w.state.finalizado?.motivo], [true, true, 'number', neg.etapaQualificado.id, 'qualificado'])

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

  return 0
}
