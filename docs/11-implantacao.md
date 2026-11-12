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
- Etiquetas vazias excluídas pela tela do Kommo (Cowork, roteiro em `docs/cowork-excluir-etiquetas.md`): QUALIFICADA, Reunião realizada, Advogada Parceira, FACEBOOK, DESQUALIFICADO, AÇÃO MONITÓRIA e `zz-teste-apagar-stela`. Conferido pela API: as sete sumiram, nenhuma outra saiu, a conta ficou com 58 etiquetas.
- Criada também `Conferir escopo` (314707), usada no fora do escopo.

## Fim de semana com a Stela, Social Seller e live (30/10/2026)

- **Pedido do cliente (29/10):** sexta às 17h/17h30 ligar a Stela para todos os leads que chegarem no fim de semana; na segunda a equipe avalia.
- **Publicado:** `ATENDE_NOVOS_DESDE=2026-10-30T17:30:00-03:00`. A partir das 17h30 a Stela atende todo lead **criado** depois disso, no SDR, em Leads de entrada, Social Seller, Em atendimento ou Follow-up. Os leads antigos continuam com a equipe; a etiqueta `ia-stela` continua valendo à mão.
- **Falta, pela tela do Kommo às 17h30:** desligar os 10 robôs de atendimento (roteiro em `docs/cowork-virada-fim-de-semana.md`). Mensagem de outro robô conta como "humano falou" e cala a Stela por 6 h, então com eles ligados a Stela quase não responde.
- **Para voltar atrás:** religar os 10 robôs e apagar `ATENDE_NOVOS_DESDE` (Control Gestão publica).

### Correções vindas das 9 conversas reais com `ia-stela` (27 a 29/10)

| Conversa | O que aconteceu | Correção |
|---|---|---|
| Letícia (26304233) | "Mais já resolvi": a Stela seguiu o roteiro; o encerramento foi recusado; mandou 2 follow-ups, um depois de a Gabi marcar perdido | "já resolvi", "conseguiu resolver", "deu certo" encerram como `desistiu`; follow-up para em card ganho/perdido |
| Roger (26300977) | "Já fiz vídeo chamada com o rapaz" virou cliente e foi para o JURÍDICO | cliente só com sinal no texto (processo, contrato, advogado, andamento); a triagem não trata "já fiz a reunião" como cliente |
| José (26320267) | plano balão do Banco GM encerrado como "fora do escopo" | **não é erro**: banco de montadora vai para conferência (etiqueta Conferir escopo), pedido do Dr. de 26/10. A Gabi conferiu e seguiu |
| (todos) | o follow-up da Stela exigia a etiqueta `ia-stela` | follow-up usa o mesmo gate do inbound: vale para os leads novos do fim de semana |

### Social Seller e live "fura fila" (pedido de 29/10)

- Etapa **SDR › Social Seller** (113568644) criada, entre Leads de entrada e Em atendimento. É etapa de entrada da Stela.
- Etiqueta **LIVE** (314835) criada.
- **"Manda QUERO no direct":** a primeira mensagem de um lead novo (até 2 h de criado, sem mensagem anterior de ninguém) que é só "quero" vai para Social Seller com LIVE (+ Instagram, se veio pelo direct), De onde Instagram e campanha rcpcc. A Stela lê "QUERO (veio da live: quer a análise gratuita das dívidas com o banco)" e abre no RCPCC. "Quero" no meio de uma conversa não conta.
- **Links da bio:** `https://telesstanquevicz-ia.vercel.app/r/live-instagram` e `/r/live-tiktok` abrem o WhatsApp `WHATSAPP_NUMERO=558005917729` (0800 591 7729) com "Quero a análise gratuita das minhas dívidas com o banco." e vão para Social Seller com LIVE + Instagram ou LIVE + TIKTOK.
- Comentário de live não chega ao Kommo (só o direct). TikTok não tem canal no Kommo: só o link.
- Avaliação: 23 cenários × 3 aprovados (66 + `live-quero` 3/3); triagem aprovada; testes ok. Publicado.

### TikTok ligado ao Kommo (1º/11/2026)

- O TikTok foi ligado ao Kommo (canal `tiktok_kommo`). Comentário entra como conversa, mas o TikTok não deixa mandar DM para quem só comentou: a mensagem da Stela aparece com erro ("start a chat with this user in the TikTok app first"). Casos: leads 26337643 e 26344795.
- Pela API não dá para saber se foi comentário ou DM (as duas conversas têm o mesmo chat e a mesma origem). Então a Stela continua respondendo (DM funciona) e, uma vez por lead do TikTok, põe a etiqueta TIKTOK e cria tarefa para a SDR: conferir se a mensagem saiu e, se deu erro, responder o comentário pelo app pedindo para chamar na DM.
- "QUERO" da live pela DM do TikTok agora ganha LIVE + TIKTOK e utm_source tiktok.
- Fim de semana: 3 leads novos (2 TikTok, 1 Instagram), nenhum lead novo de WhatsApp. Robôs antigos seguem ligados (10 + 23).

## Stela desligada e corrigida (04/11/2026)

**O que o cliente viu (3 e 4/11):** "a Stela tá doidona", não etiqueta as conversas, não conseguem desligar, ignora respostas, para do nada e se mete nas conversas da equipe.

**Desligada às 9h50 de 04/11:** `ATENDE_NOVOS_DESDE` apagado. Ela só atende card com `ia-stela` (nenhum tem).

**Causas encontradas nas conversas (Brenda 26358297, Sergio 26360523, Thaissa 26363565, Cleberson 26363581, Sandro 26366867, Edberto 26364765):**

| Problema | Causa | Correção |
|---|---|---|
| Se mete na conversa da equipe | o webhook de mensagem do Kommo não entrega o que a equipe manda: a Stela nunca detectou um humano (0 vezes) | `lib/equipe.ts`: antes de responder e antes do follow-up, lê os eventos `outgoing_chat_message` das últimas 6 h; mensagem com `created_by` de usuário = pessoa da equipe → a Stela não responde |
| Bagunça com várias respostas | os 10 robôs de atendimento seguem ligados (Sergio: 15+ mensagens de robô em 15 min) | desligar os 10 antes de religar (roteiro do Cowork) |
| Não etiqueta e não dá para desligar | no modo "todos os leads novos" ela atendia sem etiqueta | põe `ia-stela` quando começa; se a equipe tirar a etiqueta, ela para naquele card (`equipeTirouEtiqueta`) |
| "Prazer, Stela" e "Pan" como nome; banco perguntado 6 vezes | a triagem e o salvar aceitavam o nome da IA e nome de banco | `lib/nome.ts`: "Stela" e banco sozinho nunca são nome; "Pan" manda gravar como banco |
| Ignora respostas (mesma pergunta seguida) | nada impedia repetir | trava "repetiu a mesma pergunta": reescreve com outras palavras |
| Busca e apreensão: "Não" e depois "Em que dia foi a apreensão?"; "Bom dia" gravado como data | "Não" sozinho não pulava a data; o sinal da data aceitava "dia" de "bom dia" | corrigido |
| "Não compensa, já comprei outro carro" respondido com "Com quem eu falo?" | desistência não reconhecida e a 1ª mensagem jogava fora a resposta | "não compensa", "já comprei outro" = desistiu; a 1ª mensagem mantém o acolhimento |
| Desconto do consignado (R$ 647/mês) virou valor da dívida e foi direto para o closer | parcela gravada como total | valor com "desconta/parcela/por mês" é recusado: pergunta o total |
| Testes do cliente | um erro de carregamento era engolido e os testes não rodavam | agora conta como falha |

**Antes de religar:** desligar os 10 robôs de atendimento; teste real com um WhatsApp da equipe (com `ia-stela`), incluindo a Gabi respondendo no meio para ver a Stela recuar; depois religar o modo "todos os leads novos".

## Pedidos de 04/11/2026 (tarde)

- **JURÍDICO › Negociação** (113755868) criada pela API, depois de "Cumprindo despacho", sem nenhuma automação. Dá para arrastar a coluna para outra posição na tela.
- **CLOSER › Em atendimento** (113807748) criada como primeira coluna do CLOSER (correção do cliente em 05/11: a etapa de atendimento é no funil do closer).
- **Closers no SDR:** GUILHERME e CLAUDIA precisam ver e editar só SDR › Reunião agendada. É direito de usuário (só pela tela): roteiro em `docs/cowork-acesso-closers.md`.
- Robôs antigos: o escritório decidiu manter ligados. Consequência: mensagem de robô aparece para a Stela igual à dela, então resposta dupla em lead novo pode voltar a acontecer.

## Mensagens prontas do Meta Ads (06/11/2026)

- "RCV · Olá! Tenho financiamento de veículo e quero mais informações." → etiquetas Meta + RCV · De onde Meta · facebook/paid_social/rcv.
- "RCPCC · Olá! Tenho dívidas com banco e quero mais informações." → etiquetas Meta + RCPCC · De onde Meta · facebook/paid_social/rcpcc.
- O prefixo ("RCV · ", "RCPCC · ") sai do texto antes de a Stela ler; o resto cai na porta certa pela palavra-chave.
- Grava a origem uma vez por lead e só se "De onde" estiver vazio. Vale para todo lead, com ou sem a Stela.
- Testes ok. Avaliação com a IA não rodada nesta sessão (a chave da OpenAI do projeto não está disponível aqui); a mudança é de rastreio, sem mexer no texto da Stela. Publicado.

## "A IA não atendeu muitas pessoas ontem" (06/11/2026)

- **Causa:** a Stela está desligada para os leads novos desde 04/11 às 9h50 (depois do "tá doidona"), à espera do teste real. Só atende card com `ia-stela`. Em 05/11 nenhum card tinha a etiqueta.
- **Efeito colateral achado:** leads novos do Google (Suelen 26381485, Filipe 26381895 e outros) foram para **SDR › Social Seller**. Quando a Vercel põe etiqueta num lead que ainda está em Incoming leads, o Kommo aceita o lead e o joga na primeira coluna depois de Incoming, que era a Social Seller (antes era Em atendimento). 13 leads saíram de Incoming para Social Seller entre 03 e 06/11.
- **Correção:** Social Seller passou para depois de Em atendimento (sort 30). Em atendimento voltou a ser a primeira coluna. Só 1 card ainda estava em Social Seller sem ser da live (Beatriz 26389965): mover para Em atendimento pela tela.
- Cuidado ao reordenar etapa pela API: PATCH sem `name` apaga o nome da etapa (aconteceu e foi corrigido na hora).

## Stela religada para os leads novos (06/11/2026, 15h48)

- `ATENDE_NOVOS_DESDE=2026-11-06T15:48:00-03:00`, publicado. Painel: "todos os leads novos do SDR desde 06/11/2026 e quem tiver a etiqueta ia-stela".
- Sem o teste real combinado (decisão do escritório). Robôs antigos seguem ligados.
- Conferência marcada para as 17h50.

## Stela "parando" no meio da conversa (09/11/2026)

- **Sintoma:** Francisco (26408041) respondeu "Empréstimo" e "Vcs atendem qual cidade" às 8h53 e ficou sem resposta; Sidnei (26408591) igual. A equipe entrava depois de 11 minutos.
- **Causa:** as mensagens chegavam ao webhook (todas marcadas como vistas), mas eram descartadas no gate. O cache de 60 s do "lead é da Stela?" é gravado como '1', e o Upstash devolve o número 1; a comparação `=== '1'` dava sempre falso. Toda mensagem que chegava até 60 s depois de outra (inclusive o eco da própria resposta da Stela) era jogada fora em silêncio. O bug existia desde que o cache foi criado; com a Stela atendendo leads de verdade, apareceu.
- **Correção:** `gateDoCache` compara pelo valor em texto. Confirmado no Redis que o valor volta como número. Teste novo. Publicado às 10h50 de 09/11.

## Lead sem resposta às 12h30 de 12/11/2026 (Flash Imports, 26439805)

- **Causa:** a Stela gerou a resposta, mas a conexão com o Kommo (api-g.kommo.com) caiu no meio ("fetch failed", "other side closed") e o cliente da API não tentava de novo em erro de conexão, só em 429/5xx. O atendimento terminou em erro e ninguém foi avisado.
- **Correção:** `lib/kommo.ts` tenta de novo (até 3 vezes) quando a conexão cai. O disparo do Salesbot continua sem repetir, porque a mensagem pode já ter saído. Se mesmo assim der erro, a Stela cria tarefa para a SDR em 15 minutos: "A Stela não conseguiu responder este lead por uma falha técnica". Testes novos; publicado.
