# 10 · Segunda rodada de ajustes do Dr. (20/10/2026)

| Pedido | O que mudou | Onde |
|---|---|---|
| Quem já é cliente: tarefa para o jurídico e card no funil dele | Motivo novo `cliente_do_escritorio`. A triagem separa "cliente" de "outro"; no atendimento, a palavra-chave de cliente também vale. O card vai para **JURÍDICO › CONTACTAR CLIENTE** (72188239), responsável JURIDICO (11719371), tarefa de responder em 1 h. Mensagem: "Anotei aqui. A equipe jurídica que cuida do seu caso vê isso e te responde por aqui." | `negocio.clienteDoEscritorio`, `lib/triagem.ts`, `lib/router.ts`, `lib/agent.ts` |
| Closer acessa a etapa Reunião agendada | Não dá pela API (o Kommo não altera direitos de usuário por ela). Feito na tela: Configurações › Usuários › GUILHERME e CLAUDIA › Direitos › funil SDR › Reunião agendada: ver e editar. **Pendente, pelo escritório.** | Kommo, tela |
| Etapa no CLOSER para os casos abaixo de R$ 50 mil, que o closer atende e agenda | Etapa nova **CLOSER › Atendimento direto (até R$ 50 mil)** (113161464), entre Incoming leads e Proposta. Abaixo de R$ 50 mil, a Stela qualifica e **não oferece horário**: card nessa etapa, rodízio CLOSER 1/CLOSER 2, tarefa "conversar e agendar" em 1 h. Quando o closer marca no Calendly, o card vai sozinho para SDR › Reunião agendada (onde o closer confere a agenda do dia). R$ 50 mil ou mais, ou sem valor: segue como antes (a Stela marca, a Gabi aquece). | `negocio.atendimentoDireto`, `closerAgenda`, `lib/calendly-sync.ts` |

## Travas novas que as avaliações pediram

| Falha | Correção |
|---|---|
| Na primeira mensagem, foi direto à pergunta do caso, sem se apresentar nem perguntar o nome | `primeiraMensagem`: na primeira resposta da conversa ela se apresenta; sem o nome, pergunta só o nome |
| Perguntaram "tô falando com um robô?" e ela desconversou | `respostaHonesta`: quando perguntam direto, a resposta confirma que é a assistente virtual (ela não mente) |
| Respondeu honorários com a frase de "quanto dá para reduzir" | frase aprovada de honorários explícita no núcleo |
| Pergunta seca ao ouvir o caso | regra de acolhimento curto ("Entendi.") antes da primeira pergunta |

## Provas (20/10/2026)

| Avaliação | Resultado |
|---|---|
| `npm test` | todas OK (testes novos: atendimento direto, ver_horarios recusado abaixo de 50 mil, cliente → JURÍDICO, triagem "cliente", primeira mensagem, resposta honesta) |
| Triagem | 45/45 e 5/5 fluxos (cliente → jurídico) |
| Conversa completa: 17 cenários × 3 | **51/51** (cenário novo `abaixo-50k`; `agenda-completa` e `horario-fora-da-oferta` passaram para valores acima de 50 mil) |
| Kommo real, cards de teste sem contato (26244451, 26244453) | atendimento direto: CLOSER › Atendimento direto, CLOSER 2, tarefa · cliente: JURÍDICO › CONTACTAR CLIENTE, JURIDICO, tarefa · fechados depois |
| Produção | agente publicado, `/api/validate` ok; laboratório: "uns 30 mil" → não oferece horário, card no Atendimento direto com CLOSER 1 |

## Atenção

O JURÍDICO tem Salesbots ativos ("Saudação Jurídico", "Jurídico", "retorno imediato"). A API não mostra em que etapa disparam. Se algum dispara em CONTACTAR CLIENTE, o cliente recebe essa saudação ao entrar lá. Conferir na tela do funil JURÍDICO › Automatizar.
