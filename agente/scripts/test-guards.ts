/**
 * npm test — travas determinísticas do MOTOR (sem rede, sem env de produção).
 * Cada cliente ACRESCENTA os casos das próprias regras (lib/regras.ts) no fim.
 */
process.env.KOMMO_DOMAIN ||= 'https://teste.kommo.com'
process.env.KOMMO_TOKEN ||= 'x'
process.env.KOMMO_ACCOUNT_ID ||= '1'
process.env.OPENAI_API_KEY ||= 'x'
process.env.UPSTASH_REDIS_REST_URL ||= 'https://x.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN ||= 'x'
process.env.WEBHOOK_SECRET ||= 'x'
process.env.CALENDLY_FAKE = '1'

let falhas = 0
export function eq(nome: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) falhas++
  console.log(`${ok ? '✅' : '❌'} ${nome}${ok ? '' : ` → recebido ${JSON.stringify(got)}, esperado ${JSON.stringify(want)}`}`)
}

async function main() {
  const { checkReply, evidenceFound, keepLastQuestion, matchOption, parseNumeroBR, semTravessao } = await import('../lib/guards')
  const { parseKommoWebhook } = await import('../api/inbound')
  const regras = (t: string) => [...new Set(checkReply(t, []).map(v => v.regra))]

  // Degeneração do modelo (comum §49)
  eq('tool vazada', regras('salvar_respostas({"campo":"x"}) to=functions.salvar_respostas 重庆'), ['texto corrompido'])
  eq('JSON vazado', regras('{"respostas":[{"campo":"nome","evidencia":"joão","valor":"João"}]}'), ['texto corrompido'])
  eq('duas perguntas', regras('Qual a idade dele? E quantas pessoas moram na casa?'), ['mais de uma pergunta'])
  eq('texto normal passa', regras('Entendido, Cláudia. Quantas pessoas moram junto com o Davi?'), [])
  // Tom humano (SKILL §5.1): travessão sai em código
  eq('travessão é violação', regras('O curso — que começa em março — custa R$ 1.200.'), ['travessão'])
  eq('aposto vira vírgula', semTravessao('O curso — que começa em março — custa R$ 1.200.'), 'O curso, que começa em março, custa R$ 1.200.')
  eq('faixa numérica vira "a"', semTravessao('Atendemos das 9–18h.'), 'Atendemos das 9 a 18h.')
  eq('travessão no fim da frase', semTravessao('Pode deixar — anotei.'), 'Pode deixar, anotei.')
  eq('sem travessão fica igual', semTravessao('Tá certo, anotei aqui.'), 'Tá certo, anotei aqui.')
  eq('corta eco da pergunta do lead', keepLastQuestion('Você tem direito? Quem avalia é o especialista. Qual a idade dele?', 'eu tenho direito?'), 'Quem avalia é o especialista. Qual a idade dele?')

  // Números e opções
  eq('R$ 1.491,00', parseNumeroBR('R$ 1.491,00'), 1491)
  eq('2,6 mil', parseNumeroBR('2,6 mil'), 2600)
  eq('não sei', parseNumeroBR('não sei'), null)
  const opts = [{ id: 1, value: 'Sim, do INSS' }, { id: 2, value: 'Não' }, { id: 3, value: 'Não sabe' }]
  eq('opção por texto → enum', matchOption('sim do inss', opts)?.id, 1)
  eq('"sim" ambíguo', matchOption('sim', [{ id: 1, value: 'Sim, do INSS' }, { id: 4, value: 'Sim, particular' }]), null)

  // Anti-invenção (comum §48)
  const lead = 'Moramos em 4 aqui em casa e a renda somada dá uns 2.600'
  eq('evidência real', evidenceFound('moramos em 4', lead), true)
  eq('evidência inventada', evidenceFound('não recebe outro benefício', lead), false)
  eq('"não" curto presente', evidenceFound('não', 'não'), true)

  // Parser do webhook (formato plano e aninhado — kommo §5)
  const plano = parseKommoWebhook({ 'account[id]': '9', 'message[add][0][id]': 'm1', 'message[add][0][entity_id]': '77', 'message[add][0][text]': 'oi', 'message[add][0][attachment][type]': 'voice', 'message[add][0][attachment][link]': 'https://x/a.ogg' })
  eq('webhook plano', plano?.msgs[0], { id: 'm1', leadId: 77, text: 'oi', attachType: 'voice', attachLink: 'https://x/a.ogg', direction: '' })
  const aninhado = parseKommoWebhook({ account: { id: '9' }, message: { add: [{ id: 'm2', entity_id: '78', text: 'olá', type: 'incoming' }] } })
  eq('webhook aninhado', [aninhado?.accountId, aninhado?.msgs[0].leadId, aninhado?.msgs[0].direction], ['9', 78, 'incoming'])

  // Primeiro contato SEM MENU NUMERADO: palavra-chave, triagem por IA, abertura com nome
  const { rotear, decidirTriagem, comApresentacao } = await import('../lib/router')
  const { CRM_MAP } = await import('../lib/crm-map')
  const { nomeValido } = await import('../lib/triagem')
  const A = CRM_MAP.abertura
  const id = (r: any) => r.tipo === 'porta' ? r.porta.id : r.tipo
  eq('número sozinho NÃO trava porta (vai para a triagem)', id(rotear({}, '2')), 'triagem')
  eq('palavra-chave trava porta', id(rotear({}, 'meu carro foi financiado e a parcela está alta')), 'rcv')
  eq('frase do anúncio trava porta', id(rotear({}, 'Olá! Vi o anúncio e preciso de ajuda com a busca e apreensão do meu veículo.')), 'dba')
  eq('porta travada nunca muda', id(rotear({ porta: 'rcv' }, 'é do cartão também')), 'rcv')
  eq('cumprimento vai para a triagem', id(rotear({}, 'oi boa tarde')), 'triagem')
  const t1 = decidirTriagem({}, { assunto: 'indefinido', nome: '' })
  eq('abertura sem nome pergunta nome e assunto', t1.tipo === 'mensagem' && t1.texto, A.semNome)
  const t2 = decidirTriagem({}, { assunto: 'indefinido', nome: 'marcos' })
  eq('abertura com nome usa o nome', t2.tipo === 'mensagem' && t2.texto, 'Oi, Marcos! Aqui é a Gabi, assistente virtual da Teles & Stanquevicz Advogados. Me conta o que você está procurando? Pode ser por texto ou áudio.')
  eq('abertura grava o nome dito', t2.tipo === 'mensagem' && t2.patch.respostas?.nome, 'marcos')
  const t3 = decidirTriagem({ aberturaEnviada: true, tentativasTriagem: 1 }, { assunto: 'indefinido', nome: 'Ana Paula' })
  eq('depois da abertura, nome novo: "Prazer" e pergunta aberta', t3.tipo === 'mensagem' && t3.texto, 'Prazer, Ana. Me conta um pouco do seu caso: o que está acontecendo?')
  const t4 = decidirTriagem({ aberturaEnviada: true, tentativasTriagem: 2, respostas: { nome: 'Ana' } }, { assunto: 'indefinido', nome: '' })
  eq('terceira tentativa cita as áreas, sem número', t4.tipo === 'mensagem' && t4.texto, 'Ana, o escritório cuida de dívida com banco, financiamento de veículo e busca e apreensão de veículo. O seu caso tem a ver com algum desses?')
  eq('nenhum texto do primeiro contato tem número de menu', Object.values(A).filter(v => typeof v === 'string').some(v => /\b\d\s*[.)-]\s/.test(v as string)), false)
  eq('quarta sem entender passa para a equipe', id(decidirTriagem({ aberturaEnviada: true, tentativasTriagem: 3 }, { assunto: 'indefinido', nome: '' })), A.portaOutros)
  const t5 = decidirTriagem({ aberturaEnviada: true, tentativasTriagem: 1 }, { assunto: 'rcpcc', nome: 'João' })
  eq('triagem entendeu: trava a porta e leva o nome', [id(t5), t5.tipo === 'porta' && t5.patch?.respostas?.nome], ['rcpcc', 'João'])
  eq('outro assunto (cliente, pessoa) vai para a equipe', id(decidirTriagem({}, { assunto: 'outro', nome: '' })), A.portaOutros)
  const t6 = decidirTriagem({}, { assunto: 'fora', nome: 'Paulo' })
  eq('assunto não bancário encerra e, no primeiro contato, ela se apresenta', [t6.tipo, t6.tipo === 'encerrar' && t6.texto], ['encerrar', `Oi, Paulo! ${A.apresentacao} ${A.foraDoEscopo.replace(/^Entendi\.\s*/, '')}`])
  const t7 = decidirTriagem({ aberturaEnviada: true }, { assunto: 'fora', nome: '' })
  eq('assunto não bancário depois da abertura usa a recusa aprovada', t7.tipo === 'encerrar' && t7.texto, A.foraDoEscopo)
  eq('equipe no primeiro contato: ela se apresenta', comApresentacao({}, '', 'Anotei aqui. Alguém da equipe continua.'), `Oi! ${A.apresentacao} Alguém da equipe continua.`)
  eq('equipe depois da abertura: texto fixo', comApresentacao({ aberturaEnviada: true }, 'Ana', 'Anotei aqui. Alguém da equipe continua.'), 'Anotei aqui. Alguém da equipe continua.')
  eq('nome que não está no texto é descartado', nomeValido('Carlos', 'oi, tudo bem?'), '')
  eq('nome que está no texto vale', nomeValido('Ana Paula', 'aqui é a ana paula'), 'Ana Paula')
  const naoBanc = CRM_MAP.alertas.find(a => a.nome === 'assunto não bancário')!
  eq('alerta não bancário dispara em rescisão e pensão', [naoBanc.re.test('fui demitido e não pagaram minha rescisão'), naoBanc.re.test('quero revisar a pensão do meu filho')], [true, true])
  eq('alerta não bancário fica quieto em dívida de banco', naoBanc.re.test('tenho dívida no cheque especial do Bradesco'), false)
  eq('recusa aprovada fecha o card pelo código', [naoBanc.finaliza?.motivo, naoBanc.finaliza?.seResposta.test(A.foraDoEscopo)], ['fora_do_escopo', true])

  // Finalização: remove a tag de gate e exige evidência
  const { runTool } = await import('../lib/tools')
  const porta = CRM_MAP.portas.find(p => p.ativa) || CRM_MAP.portas[0]
  const mundo = { tags: new Set(['gate', 'outra']), state: {} as Record<string, any> }
  const port = {
    getLead: async () => ({ id: 1, statusId: 1, pipelineId: 1, fields: {}, tags: [...mundo.tags] }),
    writeFields: async () => {}, moveStage: async () => {}, addNote: async () => {},
    setResponsible: async () => {}, addTask: async () => {}, getPhone: async () => '', nextTurn: async () => 0,
    addTags: async (t: string[]) => { t.forEach(x => mundo.tags.add(x)) },
    removeTags: async (t: string[]) => { t.forEach(x => mundo.tags.delete(x)) },
    getState: async () => ({ ...mundo.state }),
    patchState: async (p: Record<string, unknown>) => Object.assign(mundo.state, p),
  }
  const ctx = (lead: string) => ({ port, porta, gateTag: 'gate', leadText: lead, lastLeadText: lead, lastAgentText: '' }) as any
  let out = await runTool(ctx('meu filho tem 8 anos'), 'finalizar_atendimento', { motivo: 'advogado_ativo', evidencia: 'já tenho advogado', resumo: 'x' })
  eq('advogado ativo inventado NÃO finaliza', [out.isError, mundo.tags.has('gate')], [true, true])
  out = await runTool(ctx('sim, já tenho advogado cuidando do processo'), 'finalizar_atendimento', { motivo: 'advogado_ativo', evidencia: 'já tenho advogado cuidando do processo', resumo: 'x' })
  eq('advogado ativo real finaliza e remove SÓ o gate', [out.isError, out.handoff, mundo.tags.has('gate'), mundo.tags.has('outra'), mundo.state.finalizado?.motivo], [false, true, false, true, 'advogado_ativo'])
  if (porta.obrigatorios.length) {
    mundo.state = {}
    out = await runTool(ctx('oi'), 'finalizar_atendimento', { motivo: 'qualificado', resumo: 'x' })
    eq('qualificado com roteiro incompleto é recusado', out.isError, true)
  }

  const extra = await import('./test-cliente').catch(() => null)
  if (extra?.default) { const extras = await extra.default(eq); falhas += extras }

  console.log(falhas ? `\n❌ ${falhas} falha(s)` : '\n✅ Todas as travas OK')
  process.exit(falhas ? 1 : 0)
}
main()
