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
