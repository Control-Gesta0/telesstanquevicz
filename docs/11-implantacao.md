# 11 · Implantação completa (26/10/2026)

## Feito agora

- **Modo "todos os leads novos"** (`lib/gate.ts`), publicado **desligado**. Liga com a variável `ATENDE_NOVOS_DESDE` (data da virada). Com ele ligado, a Stela atende só:
  - lead **criado a partir da virada** (os ~10 mil antigos ficam com a equipe);
  - no **funil SDR**, em Leads de entrada, Em atendimento ou Follow-up (nunca CLOSER, JURÍDICO, FINANCEIRO, DIRETORIA, FUP);
  - que **não** tem a etiqueta `atendimento-humano`;
  - e cujo atendimento da Stela **não foi encerrado** (encerrou, segue com a equipe; só a etiqueta `ia-stela` reabre).
  A etiqueta `ia-stela` continua liberando qualquer card à mão.
- Antes, sem a etiqueta, a Stela responderia qualquer funil e recomeçaria conversas já encerradas. Isso não acontece mais.
- Testes: 7 casos novos (etiqueta, lead antigo, outro funil, etapa errada, atendimento humano). Agente publicado, `/api/validate` ok.

## Estado da conta (26/10)

- Etiqueta `ia-stela` ainda não existe: o teste com WhatsApp real **não foi feito**. A entrega pelo robô "Stela · envio" (61873) não está provada.
- 62 de 63 Salesbots ativos, inclusive os de atendimento antigo (BOT IA, ENVIAR MENSAGEM…) e os 24 do SDR que viraram Vercel.

## Roteiro da virada

| # | Passo | Quem |
|---|---|---|
| 1 | Teste real: card de um WhatsApp da equipe com `ia-stela`, conversa até o fim (abertura, caso, horário ou passagem) | escritório manda as mensagens; Control Gestão acompanha o diário |
| 2 | Desligar (não apagar) em Configurações › Salesbot os 10 de atendimento: BOT IA (55391), ENVIAR MENSAGEM (55271), retorno imediato (45683), RCPCC - N (43775), RCV - N (43777), DBA - N (43683), Spend - N (43761), RPJ - N (43795), Isenção de IR (37476), Exemplo instagram (25992) | escritório (tela) |
| 3 | Desligar os 23 do SDR que viraram Vercel: follow up (49477), follow up scalex (57322), sx - follow up copiar(1) (59391); Tags RCV/DBA, RCPCC/RMC, Danos Morais, Embargos e Exceção, RPJ, Registrado, DCB, SE; Nicho - RCPCC, DBA, SE, RCV, RPJ, IR; Painel - Google, Meta, Instagram, desqualificado, desqualificado robô; Define Campanha | escritório (tela) |
| 4 | Remover no "Automatizar" do SDR e do CLOSER os gatilhos que viraram Vercel | escritório (tela) |
| 5 | Ligar o modo "todos os leads novos" (`ATENDE_NOVOS_DESDE`) e publicar | Control Gestão, no mesmo dia do passo 2 |
| 6 | Acompanhar as primeiras conversas no diário e no painel | Control Gestão |

Também na tela: acesso dos closers (GUILHERME, CLAUDIA) à etapa SDR › Reunião agendada; conferir se os robôs do JURÍDICO disparam em CONTACTAR CLIENTE.

Os robôs "Painel - …" e "Define Campanha" preenchem a origem hoje. Desligados, a origem passa a vir do rastreador da Vercel, que precisa do número do WhatsApp do escritório (`WHATSAPP_NUMERO`). Sem o número, "De onde" e campanha ficam em branco.

## Mensagens prontas do Google (26/10/2026)

- "Olá! Vim através do Google e gostaria de mais informações sobre Revisão de Financiamento de Veículos" → trava **financiamento de veículo** pela palavra-chave (o plural "Veículos" escapava e caía na IA). Card: De onde = Google, utm google/cpc/rcv, etiquetas **GOOGLE + RCV**.
- "Olá! Vim através do Google e gostaria de mais informações sobre Defesa em ação de Busca e Apreensão" → **busca e apreensão**. Card: De onde = Google, utm google/cpc/dba, etiquetas **GOOGLE + DBA**.
- Vale para todo lead (com ou sem a Stela), uma vez por lead. As etiquetas entram sempre; "De onde" só é gravado se estiver vazio. Instagram e Facebook/Meta com a mesma frase também gravam a origem (sem etiqueta, até haver pedido).
- Prova no Kommo real: card de teste 26294985 (sem contato) com GOOGLE + DBA e De onde Google; fechado depois.
- Correções que a avaliação pegou: "Olá!" era aceito como nome (acento no fim da palavra); "ainda não levaram" fazia a Stela perguntar a data da apreensão; reforço para gravar o que a pessoa já contou antes de perguntar.
- Avaliação completa: **57/57** (19 cenários × 3, com `google-rcv` e `google-dba`). Triagem 45/45 e 5/5.

## Auditoria contra o PDF de uso (26/10/2026)

| No PDF | Situação |
|---|---|
| Etapas SDR (Leads de entrada, Em atendimento, Follow-up, Reunião agendada, No-show) | existem |
| Etapas CLOSER (Leads de entrada, Atendimento direto, Proposta, Contrato, Pagamento) | existem |
| JURÍDICO › CONTACTAR CLIENTE | existe |
| Motivo de perda "Retomar depois (volta ao SDR)" | existe (39348516) |
| Lead escreveu → Em atendimento; etiqueta Follow up; 5 dias → perdido | ligadas (webhook + relógio QStash de 15 min) |
| Calendly marcou/remarcou/cancelou → card | ligado (webhook 98a6fd10, ativo) |
| Ganho SDR → Proposta; Venda ganha → JURÍDICO; Venda perdida (Retomar depois / Desqualificado) | ligadas (webhook status_lead) |
| Stela: qualifica, atendimento direto, busca e apreensão, fora do escopo, cliente → jurídico | prontas; atendendo só com `ia-stela` até a virada |
| Origem: mensagem do Google | ligada |
| Origem: links rastreados | aguardam o número do WhatsApp |
| Lembretes 24 h e 2 h | seguem pelos robôs do Kommo (Vercel em modo sombra) |
| Robôs antigos desligados, gatilhos do "Automatizar" removidos, acesso dos closers à Reunião agendada | só pela tela do Kommo (API não permite): pendente |

## Mensagens prontas do Google, 2ª versão (28/10/2026)

- "Olá, vim pelo Google. Gostaria de falar com um Advogado Especialista em Revisional de Veículos." → financiamento de veículo · GOOGLE + RCV · De onde Google.
- "Olá, vim pelo Google. Gostaria de falar com um Advogado Especialista em Busca e Apreensão." → busca e apreensão · GOOGLE + DBA · De onde Google.
- Travas novas que a avaliação pediu:
  - "falar com um Advogado Especialista em…" do anúncio **não** é pedido de pessoa (`pediuEspecialistaDoAnuncio`);
  - fora do escopo cuja prova é um assunto atendido ("Revisão de Financiamento de Veículos", "Busca e Apreensão") é recusado (`assuntoAtendido`);
  - "Busca", "Revisional", "Advogado Especialista" não viram nome; "financiamento do meu veículo" não vira banco (o campo banco exige nome de banco ou a resposta à pergunta);
  - "Entendi, vamos ver isso rápido. Entendi, Jorge." não dobra mais;
  - pergunta de percentual ("tiram 70%?") sempre recebe a resposta aprovada (`respostaDesconto`).
- Avaliação completa: **63/63** (21 cenários × 3, com `google2-rcv` e `google2-dba`). Triagem aprovada. Publicado.

## Etiquetas: `ia-stela` e limpeza das repetidas (28/10/2026)

- A etiqueta `ia-stela` não existia na conta. Criadas pela API: `ia-stela` (314691) e `atendimento-humano` (314693).
- As repetidas voltaram com a restauração dos leads excluídos (cada lead voltou com as suas etiquetas).
- A API do Kommo não apaga nem renomeia etiqueta (DELETE dá 405; PATCH responde 200 e não muda o nome). Ela só tira e põe etiqueta nos leads. Por isso a junção foi feita lead a lead (`tags_to_add` + `tags_to_delete`, lotes de 50), e as etiquetas vazias saem pela tela do Kommo.
- Backup das etiquetas de cada lead afetado, antes da troca: `docs/backup/etiquetas-antes-limpeza-2026-10-28.json` (542 leads).
- Feito, conferido em varredura da conta inteira (26.443 leads):

| Repetida | Leads trocados | Ficou em | Leads agora |
|---|---|---|---|
| QUALIFICADA | 509 | QUALIFICADO | 1.186 |
| Reunião realizada | 17 | `reuniao-realizada` | 21 |
| Advogada Parceira | 15 | Advogado Parceiro | 18 |
| FACEBOOK | 1 | Meta | 3.951 |

- Prova de que nada mais reagiu: nos leads trocados, os únicos eventos depois da troca são `entity_tag_added` e `entity_tag_deleted` (sem etapa, mensagem ou tarefa).
- Falta, pela tela do Kommo: excluir as etiquetas vazias QUALIFICADA, Reunião realizada, Advogada Parceira, FACEBOOK, DESQUALIFICADO, AÇÃO MONITÓRIA e `zz-teste-apagar-stela` (criada no teste da API).
