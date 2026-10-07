# Desenho do agente Gabi · fase 1

Estado: **DESENHANDO**. Regras de negócio fechadas em 07/10/2026; faltam só credenciais de infraestrutura (ver `00-diagnostico.md`).
Base: template Kommo v2 da skill (Desenho A, OpenAI, portas). Peças marcadas **[novo]** não existem no template e serão construídas.

## A vida de uma mensagem

```
Lead escreve no WhatsApp oficial
 → Kommo dispara add_message → /api/inbound (200 na hora)
 → dedup · áudio/foto/PDF viram texto uma vez · anti-eco · histórico no Redis
 → lead sem a tag ia-gabi? com atendimento-humano? humano falou nas últimas 6h? → a IA não responde
 → espera 10s juntando mensagens seguidas
 → roteador em código escolhe a porta: RCPCC · RCV · DBA · outros
 → nucleo.md + prompt da porta → modelo + tools → travas em código
 → grava a resposta no campo "Resposta IA (agente)" → salesbot/run → Salesbot de envio manda no WhatsApp
```

## Portas

| Porta | Sinais no texto | Roteiro (uma pergunta por vez) | Obrigatório para qualificar |
|---|---|---|---|
| **RCPCC** | juros, cartão, cheque especial, empréstimo, conta corrente, revisão de juros | tipo de dívida e banco · valor aproximado · parcelas em atraso | tipo, valor aproximado |
| **RCV** | financiamento, carro, veículo, parcela do carro | banco · parcelas totais · pagas · valor da parcela · tem o contrato | banco, parcelas, pagas, valor |
| **DBA** | busca e apreensão, apreenderam, levaram o carro, mandado, oficial de justiça | já foi apreendido · quando · recebeu o mandado · foto do mandado · valor da dívida | apreensão, data, valor aproximado |
| outros | sem sinal claro de uma porta | menu curto para o lead escolher; assunto fora dos três vai para humano | — |

Antes de perguntar, a IA lê o card: **440 leads em 6 meses já chegam com as 4 respostas do formulário Meta** (dívidas ativas, valor, situação, tipos). O que já está respondido não é perguntado de novo.

## Quem recebe o lead (em código, nunca pelo modelo) [novo]

| Valor da dívida | Responsável no Kommo |
|---|---|
| abaixo de R$ 50 mil | Guilherme (11719359) ou Carla (13015432), alternando |
| R$ 50 mil ou mais | SDR (11719355), que aquece o lead antes da reunião |
| lead não soube dizer | SDR |

- RCV: o código calcula o saldo aproximado (parcelas que faltam × valor da parcela). Faixa do formulário Meta também vale.
- O modelo nunca escolhe o responsável; ele só registra o valor com a frase do lead como evidência.

## Como a IA termina (finalizar)

| Motivo | O que acontece no Kommo |
|---|---|
| **qualificado** (aceitou a reunião) | move para AGENDAR REUNIÃO · troca o responsável pela regra acima · cria tarefa "Confirmar encaixe da reunião" com modalidade e período preferido [novo] · nota com o resumo · tira a tag ia-gabi |
| **fora do escopo** (não é dívida bancária, banco de montadora) | mensagem respeitosa · Desqualificado = "Desqualificado robô" (já existe e alimenta o painel) · nota · tira a tag. Fechar como perdido continua com o time |
| **pediu humano, suporte de cliente, pagamento** | tag atendimento-humano · tarefa para o SDR · nota · tira a tag |
| **urgência DBA sem dados completos** | qualificado mesmo assim, com a urgência na tarefa |

A IA **nunca** fecha como ganho ou perdido e nunca mexe em lead que esteja nas etapas NO SHOW, "dia", ganho, perdido ou em outro funil (fail-closed).

## Onde a IA escreve no card

- **Nichos** (select, por enum_id): RCPCC 744545 · RCV 744547 · DBA 744543.
- **Desqualificado** (select): "Desqualificado robô" 744848.
- **Nota** com o resumo no formato que o time já usa em Observações, ex.: "Financiamento de veículo · BV · 48x R$ 1.360 · 2 pagas · em dia".
- **Observações** é do time: a IA não escreve. Número de processo, CPF e dados de pagamento ficam em `camposProibidos`.
- ⚠️ A conferir no E2E: se gravar "Nichos" dispara os bots "Nicho - *". Se disparar e eles mandarem mensagem, a IA passa a gravar o nicho só na nota.

## Follow-up dentro das 24h [novo]

- **Toque 1**, 2h depois da última mensagem da IA sem resposta: retoma a pergunta que ficou pendente, em uma frase.
- **Toque 2**, 20h depois da última mensagem do lead: oferece a reunião sem custo.
- Os dois respeitam a janela de 24h da Meta, contada da última mensagem do lead, e só saem entre 8h e 20h (horário de Brasília). Toque que cairia fora disso é antecipado, ou pulado se a janela fechar.
- Qualquer mensagem do lead, handoff ou finalização cancela a fila.
- Sem resposta depois do toque 2: a IA move para FOLLOW UP e o time segue com a cadência dele. Se o lead voltar, a automação leva para RETORNO IMEDIATO e a IA retoma.
- Textos fixos, aprovados e passados pelo filtro de tom: sem custo de modelo e sem risco de promessa.
- Relógio: QStash (o cron da Vercel Hobby é diário) + fila no Redis com claim atômico, para não mandar o mesmo toque duas vezes.

## Medição

- **Respondeu:** o lead mandou mensagem depois de um toque da IA.
- **Concretizou:** o lead chegou em AGENDAR REUNIÃO até 7 dias depois do toque.
- **Resultado do escritório** (separado): CLOSER › Venda ganha com valor. A Foto do Antes corrigida é de 47 contratos e R$ 213.142 em 30 dias.

## Travas em código (o modelo pode escorregar; o código não)

1. Nenhuma promessa: bloqueia percentual, "garantimos", "vamos conseguir", "liminar certa", prazo de solução.
2. Nenhum valor em R$ que o próprio lead não tenha dito (bloqueia honorários inventados).
3. Nenhum PIX, CNPJ, dado bancário ou link.
4. Nenhum travessão; uma pergunta por mensagem; sem "Ótima pergunta", sem "Fico à disposição".
5. Não confirma horário de reunião ("marcado", "confirmado para").
6. Fallback: o texto seguro da casa, nunca mensagem vazia.

## Persona e tom

"Gabi, assistente virtual da Teles & Stanquevicz Advogados". Trata por senhor/senhora, convida a contar o caso por texto ou áudio, começa pela resposta, uma pergunta por vez. Quando perguntada, diz que é a assistente virtual do escritório. As respostas prontas do time são a base do jeito de falar, depois de passar pelo filtro de tom (sem os 8 tells da skill).

## Prova antes do ar

1. `npm run typecheck && npm test` verdes (travas, roteador, regras do cliente, roteamento por valor).
2. Evals: os 12 cenários de `onboarding/entrada.json`, 3 repetições, **todos aprovados ou não sobe**.
3. `/api/validate` confere o mapa contra o Kommo vivo.
4. E2E com um lead de teste com a tag ia-gabi: mensagem chegando no celular, card, tarefa, responsável, nota e diário de execuções.
5. Rampagem: 1 contato nosso → 10 leads reais → todos. Os Salesbots da lista "desligar" ganham a condição "sem a tag ia-gabi" e saem no último passo.

## Fica para a fase 2

Integração com a agenda do Dr. Carlos Eduardo (a IA marca sozinha) · toques depois de 24h com template aprovado pela Meta · SE, RPJ, RMC/RCC e IR · Central de IA do cliente.
