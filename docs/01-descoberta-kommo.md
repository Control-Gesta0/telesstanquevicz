# Descoberta ao vivo · Kommo Teles & Stanquevicz Advogados

Leitura feita pela API em 06/10/2026, somente leitura. O bruto (com dado de lead) ficou fora do git.
Conta `33277515` · subdomínio `telesstanquevicz` · moeda BRL.

## Canal

- Origem das conversas: `waba` → **WhatsApp oficial**. Confirma o Desenho A e a janela de 24h.
- 7 dias de eventos: **478 mensagens enviadas por robô/integração × 39 por humanos**, 283 recebidas. Hoje o bot responde quase tudo.
- O `bot_id` do Salesbot atual não sai pela API. Vem do link do bot no Kommo.

## Quem mais escuta a conta (webhooks)

| ID | Destino | Eventos | Situação |
|---|---|---|---|
| 44998140 | tintim.app | add_message | desativado |
| 47297220 | impactmind.app | add_lead, status_lead, update_lead | **ativo, a identificar** |
| 47357312 | ActiveCampaign (api-us1.com) | note_lead, note_contact | ativo |

Nenhum consumidor ativo de `add_message`. O nosso webhook entra sem disputa. A impactmind precisa ser explicada: se ela move etapa ou escreve campo, colide com as tools da IA.

## Funis (6)

| Funil | ID | Uso aparente |
|---|---|---|
| **SDR** (principal) | 9299515 | onde a IA deve operar |
| CLOSER | 9312103 | reunião, proposta, documentos, assinatura, pagamento |
| FINANCEIRO | 9312107 | cobrança |
| JURÍDICO | 9312127 | execução do caso |
| DIRETORIA | 9312147 | sócios |
| FUP | 14043840 | follow-up separado |

Etapas do SDR, em ordem: Leads de entrada (72104583) · NOVA OPORTUNIDADE (72104587) · RETORNO IMEDIATO (72186399) · NO SHOW (72113011) · AGENDAR REUNIÃO (86825532) · **"dia" (109569188)** · FOLLOW UP (72104595) · ganho 142 · perdido 143.

## Foto parcial dos últimos 30 dias (fonte: CRM, confiança média)

- **784 leads criados** (≈26/dia; caiu de 40–60/dia em meados de setembro para 6–22/dia em outubro).
- Nichos: RCPCC 338 · RCV 66 · DBA 41 · NEGOCIAÇÃO 29 · DIVERSOS 10.
- Origem: Meta/formulário em 435 leads; campo "De onde" vazio em 628 de 784.
- Hoje: 332 em FOLLOW UP (49 sem nenhuma atualização há mais de 7 dias) · 80 em AGENDAR REUNIÃO · 168 perdidos no SDR.
- Perdas: 148 de 174 com motivo "Solução não se aplica".
- Fechados como ganho: 175, mas 75 deles são "ganho" no **SDR sem valor**. Parece que "ganho no SDR" significa "passou para o closer", não venda. **A confirmar**: sem isso a Foto do Antes conta venda errada.
- Ticket médio dos 103 leads com valor: R$ 5.376.

## Riscos de dado (afetam o crm-map)

1. **Campos duplicados**: 17 nomes repetidos (ex.: "Você é Aposentado?" aparece 3 vezes). Preciso saber qual é o vivo; a IA não pode gravar no campo morto.
2. **Campos realmente preenchidos** nos últimos 30 dias: Nichos (487), as 4 perguntas do formulário Meta 1047061–1047067 (290), Closer (281), Reunião (86), Desqualificado (26). Os outros ~80 campos de qualificação estão praticamente vazios.
3. **Dado sensível**: número de processo (RCV/SE), banco, valor de dívida. Entra no `camposProibidos` ou com regra explícita de quem pode escrever.
4. Etapa "dia" sem significado claro.
5. Tags duplicadas por caixa: Desqualificado/DESQUALIFICADO, QUALIFICADO/QUALIFICADA.

## Perguntas que só o escritório responde

Ver resposta no chat da sessão de 06/10/2026.
