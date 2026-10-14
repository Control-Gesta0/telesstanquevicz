# Funil enxuto · SDR e CLOSER (proposta, 14/10/2026)

Pedido do cliente: ver todas as etapas sem rolar a tela. Meta: **no máximo 5 colunas por funil**, contando a coluna fixa "Leads de entrada" do Kommo (ganho e perdido não ocupam coluna). Pelo tamanho padrão das colunas, 5 cabem num notebook comum; conferir com um print da tela do escritório.

## Uso real (API, 14/10/2026)

| Funil | Etapa (id) | Leads hoje | Entradas em 30 dias |
|---|---|---|---|
| SDR | NOVA OPORTUNIDADE (72104587) | 0 | 320 |
| SDR | "no show" (72186399), era RETORNO IMEDIATO em 06/10 | 1 | 1.285 |
| SDR | NO SHOW (72113011) | 0 | 12 |
| SDR | AGENDAR REUNIÃO (86825532) | 505 | 406 |
| SDR | dia (109569188) | 1.060 | 3 |
| SDR | FOLLOW UP (72104595) | 8.880 | 2.000+ |
| CLOSER | 11 etapas | **0 em todas** | 0 a 86 cada |

O CLOSER está vazio (tudo fechado em massa), então muda sem mover lead nenhum. No SDR, o trabalho real acontece em 4 lugares: conversa, reunião, follow-up e o estacionamento "dia".

## Proposta

### SDR: do primeiro contato até a reunião (5 colunas)

| # | Etapa nova | Vem de | Como |
|---|---|---|---|
| 1 | Leads de entrada | fixa do Kommo | nada |
| 2 | **Em atendimento** | 72186399 + NOVA OPORTUNIDADE | renomear 72186399 (a automação "lead respondeu" já cai nela); apagar NOVA OPORTUNIDADE (vazia) |
| 3 | **Follow-up** | FOLLOW UP + "dia" | manter 72104595; os 1.060 leads do "dia" precisam de decisão (abaixo); apagar "dia" |
| 4 | **Reunião agendada** | AGENDAR REUNIÃO | renomear 86825532 (a IA usa este ID: só troca o nome no mapa) |
| 5 | **No-show** | NO SHOW | manter 72113011 |
| ganho | reunião realizada | | automação leva para CLOSER › Proposta |
| perdido | desqualificado / sem interesse | | motivo de perda obrigatório (já ligado na conta) |

### CLOSER: da reunião feita ao contrato pago (4 colunas)

| # | Etapa nova | Vem de | Como |
|---|---|---|---|
| 1 | Leads de entrada | fixa do Kommo | nada |
| 2 | **Proposta** | com proposta + Reunião agendada + Retorno imediato + No show + Follow up + FORMS | renomear 72851523; apagar as outras (vazias) |
| 3 | **Contrato** | Aguardando documentos + Aguardando assinatura | renomear 72686979; apagar 72186415 (vazia) |
| 4 | **Pagamento** | Aguardando pagamento | manter 72186419 |
| ganho | contrato pago | Jurídico (transição) | automação leva para JURÍDICO › contrato fechado/pago; apagar a etapa Jurídico (72574327) |
| perdido | não fechou | | motivo de perda |

De 18 colunas para 9, sem perder nenhuma informação que o time use hoje.

## Por que renomear em vez de apagar e criar
Etapa renomeada mantém o histórico e as automações. Etapa apagada some dos relatórios: nos eventos ela aparece como "undefined", e isso já acontece hoje na conta. Por isso a regra é renomear e reordenar o que fica, e só apagar etapa vazia.

## Riscos antes de executar
1. **Automações presas às etapas.** Salesbots e gatilhos do funil digital ("C - Com proposta", "C - Aguardando documentos", "Aguardando assinatura", "Aguardando pagamento", "Assas Entrada", "Follow up - CLOSER", "retorno imediato") não aparecem pela API. Apagar uma etapa apaga o gatilho dela sem aviso. É preciso inventariar pela tela do Kommo antes.
2. **Mover lead dispara automação.** Mover os 1.060 leads do "dia" para Follow-up pode disparar o follow-up do Kommo para mil pessoas de uma vez. Só com os gatilhos de entrada pausados.
3. **impactmind** recebe mudança de etapa: se for painel por ID de etapa, os gráficos mudam junto.
4. **Mudança em andamento:** 72186399 já foi renomeada para "no show" por alguém. Uma pessoa só mexe no funil até terminar.
5. **A IA:** depois da mudança, atualizo o mapa (nome da etapa de reunião e a lista de etapas protegidas), rodo `/api/validate` e publico.

## Execução

**Passo 1 feito em 14/10/2026** (autorização escrita do mestre). Foto de antes: `docs/backup/funis-antes-2026-10-14.json`.

| SDR (ordem na tela) | ID |
|---|---|
| Leads de entrada | 72104583 |
| Em atendimento | 72186399 |
| Follow-up | 72104595 |
| Reunião agendada | 86825532 |
| No-show | 72113011 |
| ANTIGA · NOVA OPORTUNIDADE | 72104587 |
| ANTIGA · dia | 109569188 |

| CLOSER (ordem na tela) | ID |
|---|---|
| Leads de entrada | 72186407 |
| Proposta | 72851523 |
| Contrato | 72686979 |
| Pagamento | 72186419 |
| ANTIGA · FORMS, Retorno imediato, Reunião agendada, No show, Aguardando assinatura, Jurídico, Follow up | 110421768, 72686959, 72186411, 72577607, 72186415, 72574327, 72186443 |

- Nenhum lead mudou de etapa (renomear não move lead).
- Incidente: o Kommo apagou o nome das 6 etapas do SDR quando corrigi a ordem com um PATCH só de `sort` (respondeu 200). Ficaram sem nome por 1 a 2 minutos e foram restauradas com nome e posição no mesmo PATCH.
- Mapa da IA atualizado (Reunião agendada, Follow-up), publicado, `/api/validate` ok exceto `KOMMO_BOT_ID`.

**Passo 2, pendente:** inventário das automações das etapas "ANTIGA ·", religar o que importa nas etapas novas, decidir os 1.060 leads do "dia" e apagar as etapas antigas. Até lá, as 5 + 4 etapas novas são as primeiras da tela, mas as antigas ainda ocupam colunas à direita.

## Passo 2 · automações (decisão do mestre, 14/10/2026)

Decisão: desligar (não apagar) as automações do SDR e do CLOSER; o bot que conversa sai quando a Gabi entrar; lembretes de reunião ficam até existir a versão na Vercel; JURÍDICO, FINANCEIRO, DIRETORIA, NPS e transmissões ficam.

**A API pública do Kommo não desliga Salesbot** (`PATCH /api/v4/bots/{id}` → 405; `PATCH /api/v4/bots` → 403 "This is a private API"). Desligar é pela tela: Configurações › Salesbot (ou o funil › Automatizar). Foto dos bots antes: `docs/backup/bots-antes-2026-10-14.json`.

### Desligar agora (antes de mover o "dia")

| Grupo | Bots (id) |
|---|---|
| Follow-up do SDR | follow up (49477) · follow up scalex (57322) · sx - follow up copiar(1) (59391) · TestBot (48699) |
| Classificação do SDR | Tags RCV/DBA (18394) · Tags RCPCC/RMC (18396) · Tags Danos Morais (18400) · Tags Embargos e Exceção (18402) · Tags RPJ (18408) · Tags Registrado (18410) · Tags DCB (18416) · Tags SE (18422) · Nicho - RCPCC (33292) · Nicho - DBA (33294) · Nicho - SE (33296) · Nicho - RCV (33298) · Nicho - RPJ (33300) · Nicho - IR (33302) |
| Origem do SDR | Painel - Google (33304) · Painel - Meta (33306) · Painel - Instagram (33308) · Painel - desqualificado (33310) · Painel - desqualificado robô (33312) · Define Campanha (47656) |
| CLOSER | C - Com proposta (22990) · C - Aguardando documentos (22992) · C - Aguardando assinatura (22998) · C - Aguardando documentos copiar 3011 (30946) · Aguardando documento (19082) · Aguardando pagamento (19084) · Aguardando assinatura (19090) · Assas Entrada (22336) · Follow up - CLOSER (19034) |

Lacuna que isso abre: "De onde" e campanha deixam de ser preenchidos até o rastreador de origem existir na Vercel (`lib/tracker.ts` da skill). Nichos passa a ser gravado só pela Gabi, no lead qualificado.

### Desligar quando a Gabi entrar (atendimento atual)
BOT IA (55391) · ENVIAR MENSAGEM (55271) · retorno imediato (45683) · RCPCC - N (43775) · RCV - N (43777) · DBA - N (43683) · Spend - N (43761) · RPJ - N (43795) · Isenção de IR (37476) · Exemplo instagram (25992)

### Ficam
Lembrete de reunião 24h (10528) e 2h (10530) até a versão Vercel · Fechar conversa (11512) · Saudação Jurídico, Jurídico, Produzindo petição, Petição protocolada · -30D, +30D, +60D · Robô de NPS · Transmissões · negociação 2 · rcv êxito aguardando documentos (44329, a confirmar se é do CLOSER)

### Depois de desligar
1. Eu movo 10 leads do "dia" para Follow-up e confiro por 5 minutos que nenhuma mensagem saiu para eles.
2. Sem mensagem, movo os outros ~1.050 em lotes de 250.
3. Apago as etapas "ANTIGA ·" vazias.

Também fora do alcance da API: os gatilhos do funil digital que não são Salesbot (mudar etapa, criar tarefa, webhook). Eles aparecem no botão "Automatizar" de cada funil e precisam ser removidos lá.

## Passo 2 executado (14/10/2026)

- **"dia" → Follow-up:** prova com 10 leads observada por 5 minutos (nenhuma mensagem, tarefa ou mudança de etapa); depois os demais em lotes. "dia" ficou com 0, Follow-up com 9.938. Na conta inteira, nenhuma mensagem saiu para os leads movidos. Única reação: uma automação de etapa que continua em Follow-up pôs a tag "Follow up" em 4 leads (os outros já tinham).
- **Etapas apagadas (9):** ANTIGA · NOVA OPORTUNIDADE, ANTIGA · dia (SDR); FORMS, Retorno imediato, Reunião agendada, No show, Aguardando assinatura, Jurídico, Follow up (CLOSER). Cada uma conferida vazia logo antes de apagar.
- O lead 1569162 tinha sido arrastado à mão para "ANTIGA · Retorno imediato" às 13h29 pelo usuário SDR; foi para **Proposta** com nota explicando.
- Mapa da IA sem a etapa extinta, publicado; `/api/validate` ok, exceto `KOMMO_BOT_ID`.
- Foto de depois: `docs/backup/funis-depois-2026-10-14.json`.

### Resultado

SDR: Leads de entrada · Em atendimento · Follow-up · Reunião agendada · No-show
CLOSER: Leads de entrada · Proposta · Contrato · Pagamento

### O que deixou de existir e precisa ir para a Vercel

| Função | Antes | Situação |
|---|---|---|
| Contrato pago → JURÍDICO | etapa "Jurídico" do CLOSER movia para JURÍDICO › contrato fechado/pago | **na Vercel desde 14/10**: CLOSER › Venda ganha → JURÍDICO › contrato fechado/pago em até 5s, com tag `contrato-pago` e nota. Prova: lead de teste 26201039 |
| Reunião realizada (ganho no SDR) → CLOSER › Proposta | não existia | **na Vercel desde 14/10**: em até 5s, com tag `reuniao-realizada` e nota. Prova: lead de teste 26201097 |
| Origem e campanha (De onde, Define Campanha, Painel) | bots de origem | sem automação até o rastreador de origem |
| Mensagens do CLOSER (proposta, documentos, assinatura, pagamento, Assas, follow-up do closer) | bots por etapa | sem automação: o closer envia pelas respostas prontas |
| Tag "Follow up" ao entrar em Follow-up | gatilho da etapa | **continua ativa** no Kommo |
| Tag "Desqualificado" ao ir para perdido no CLOSER | gatilho da etapa | **continua ativa** no Kommo (visto no teste de 14/10) |

### Ponto em aberto
A API ainda mostra como **ligados** os 33 bots da lista de desligar. Se eles foram só tirados das etapas, isso basta para o funil. Mas eles continuam aptos a rodar se outro gatilho os chamar.

## Automação "contrato pago → JURÍDICO" (14/10/2026)

- **Como funciona:** o closer arrasta o lead para "Venda ganha" no CLOSER. O Kommo avisa a Vercel (webhook `status_lead`). A Vercel relê o lead, confirma que ele ainda está em Venda ganha e move para **JURÍDICO › contrato fechado/pago**, sem trocar o responsável (igual à automação antiga). Põe a tag `contrato-pago` e uma nota com data e valor.
- **Por que a tag:** o lead sai do "ganho" do CLOSER ao ir para o JURÍDICO (no Kommo um lead vive num funil só). A tag e o histórico de etapas guardam a venda para relatório.
- **Prova:** lead de teste 26201039, sem contato, chegou ao JURÍDICO em menos de 5s; fechado como perdido no JURÍDICO depois do teste (a automação não reagiu a isso, como deve).
- **Se falhar:** aparece como `erro` no diário (`/api/executions`) e o lead fica em Venda ganha. O time move à mão.

## Automação "reunião realizada → CLOSER › Proposta" (14/10/2026)

- **Como funciona:** depois da reunião, o lead é arrastado para **ganho no SDR**. A Vercel confirma que ele continua lá e move para **CLOSER › Proposta**, sem trocar o responsável, com tag `reuniao-realizada` e nota.
- **Mudança de hábito do time:** "ganho no SDR" passou a significar **reunião realizada**. Para arquivar lead sem reunião, use **perdido** com motivo.
- **Trava de massa (vale para as duas automações):** mais de 20 eventos em 10 minutos pausam a automação. Os leads ficam onde estão e o diário registra "PAUSADO". Isso protege contra limpeza de funil em massa, que já aconteceu (792 "ganhos" no SDR em 30 dias).
- **Prova:** lead de teste 26201097 chegou a Proposta em menos de 5s; fechado como perdido no CLOSER depois do teste.
- **Em aberto:** quem é o responsável no CLOSER para os leads de R$ 50 mil ou mais? Hoje ele continua com o SDR, que aqueceu o lead.

## Lembretes de reunião pela Vercel (14/10/2026)

- **Como funciona:** agenda QStash `scd_6cF7zkPGixMqmkbABibhbYpH4CMr` chama `/api/lembretes` a cada 15 min. A Vercel lê os leads com reunião marcada (SDR › Reunião agendada, No-show, Em atendimento e DIRETORIA › reuniões agendadas) e, quando falta 24h ou 2h para a reunião, roda o bot do lembrete: 10528 (24h) ou 10530 (2h). Os bots mandam o modelo aprovado pela Meta "Lembrete de Reunião" (43417), que entra mesmo fora da janela de 24h. Um lembrete nunca sai duas vezes.
- **Modo atual: SOMBRA.** Só registra no diário o que enviaria (`LEMBRETES_MODO` ausente). Para ligar: `LEMBRETES_MODO=ativo` + deploy.
- **Prova até aqui:** primeira chamada do relógio às 18:15 UTC, entregue com 200 e assinatura conferida; testes de janela (24h, 2h, fora da janela, reunião passada).
- **Comparador:** `npx tsx scripts/comparar-lembretes.ts [horas]`.

### O que a comparação mostrou
Nas reuniões de 13 e 14/10 com data no Kommo, **o Kommo não mandou o lembrete de 2h** nas duas em que ele cabia (leads 26188763 e 26193477): nenhuma mensagem saiu para elas. Na terceira (25408463) a data foi preenchida 53 min antes da reunião, então não cabia lembrete. Ou o gatilho de data dos bots não está ativo, ou esses leads não têm conversa de WhatsApp no Kommo.

### Lacuna maior
O Calendly teve **147 reuniões em 30 dias**; o campo "Reunião" do Kommo só tem cerca de um terço delas. Lembrete por campo nunca alcança os outros dois terços. Cura proposta: webhook do Calendly (`invitee.created` / `invitee.canceled`) achando o lead pelo telefone e preenchendo "Reunião" (e limpando no cancelamento).

### Para ligar o envio de verdade
1. Teste com um lead de WhatsApp nosso: rodar o bot 10530 nele e ver o lembrete chegar no celular.
2. Tirar o gatilho de data dos bots 10528 e 10530 no Kommo (se existir), para não sair em dobro.
3. `LEMBRETES_MODO=ativo` e deploy.
