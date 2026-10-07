# Teles Stanquevicz · Agente de IA (Kommo)

Estado do projeto: **DIAGNOSTICANDO → falta a rodada 4 (follow-up e recuperação) e as credenciais de build**
Atualizado em 07/10/2026.

## Bloco 0 fechado

| Item | Resposta | Fonte | Confirmado |
|---|---|---|---|
| CRM | Kommo | mestre (sessão) | sim |
| Objetivo | agente novo do zero | mestre (sessão) | sim |
| WhatsApp | oficial (Meta) conectado no Kommo | mestre (sessão) | a conferir na API |
| Desenho | **A**: resposta pelo Salesbot de envio | decorre do canal | sim |
| Bot existente | Salesbots do Kommo (não há agente de IA nativo do Kommo: 0 eventos de IA em 30 dias) | API | sim |
| Transição | os Salesbots de atendimento do SDR desligam no go-live; impactmind continua | mestre (07/10) | sim, com a regra abaixo |
| Mídia | lead manda áudio, imagem e PDF; IA responde só texto | mestre (sessão) | sim |

## Decisões e trade-offs

1. **Desenho A (Salesbot).** Ganha: zero fornecedor extra, conversa fica no chat oficial do Kommo. Custa: uma mensagem por resposta (sem rajada de mensagens curtas), sem voz e com a janela de 24h da Meta.
2. **Follow-up sob a janela de 24h.** O 1º toque (até 12h) sai em texto livre. Do 2º em diante só entrega com **template WABA aprovado** dentro do bot (categoria Marketing, cobrado por envio). Sem template, o toque some sem erro visível (kommo/PEGADINHAS §9). Decidir na rodada 4 quantos toques e quais templates.
3. **Mídia na entrada, resposta em texto.** Áudio vira transcrição, imagem e PDF viram descrição, uma vez só, gravadas como texto no histórico. Nada de voz: no Desenho A ela nem é possível.
4. **Salesbot atual × agente novo.** "Desliga no go-live" fica assim, para não violar a rampagem (lei 3):
   - Durante a rampagem o Salesbot atual continua atendendo todo mundo, **exceto** os leads com a tag da IA. Os gates precisam ser disjuntos: o gatilho dele ganha a condição "não tem a tag da IA".
   - Rampagem: 1 contato nosso → 10 leads reais → todos.
   - No passo "todos" o Salesbot atual é desligado. Esse é o go-live.
   - Ligar a IA para todos e desligar o bot no mesmo minuto, sem rampa, fica fora: um erro de prompt ou de mapa atinge 100% dos leads no primeiro dia.
5. **Histórico no Redis é obrigatório.** O Kommo não devolve o transcript do chat; perder o Redis é perder a conversa.

## Decisões do mestre em 07/10/2026

| # | Decisão | Consequência no build |
|---|---|---|
| 1 | **Nenhuma promessa** de resultado (nem percentual de desconto) | regra dura no prompt + trava em código + eval `promessa` |
| 2 | Persona **"Gabi, assistente virtual do escritório"** | assume que é IA quando perguntada (eval `bot`) |
| 3 | O que desliga no go-live é o **Salesbot**; impactmind fica | gates disjuntos na rampagem; lista de bots a confirmar abaixo |
| 4 | Escopo da fase 1: **RCPCC, RCV e DBA** | 3 portas; o resto vai para humano |

## Desenho que já decorre dos dados

- **IA não informa honorários.** Usa a resposta oficial do escritório e oferece a reunião sem custo.
- **IA não confirma horário.** Coleta modalidade, período, nome completo e e-mail, move para AGENDAR REUNIÃO e cria tarefa para o SDR encaixar. Integração com Google Agenda fica para a fase 2.
- **IA não fecha como perdido.** Caso fora do escopo: preenche "Desqualificado" = "Desqualificado robô" (já existe e alimenta o painel), avisa o lead com respeito e devolve para o time.
- **Onde a IA escreve:** Nichos (select), Desqualificado (select) e uma **nota no card** com o resumo do caso no formato que o time já usa em Observações ("Financiamento de veículo · BV · 48x R$ 1.360 · 2 pagas · em dia"). Observações é do time e fica intocado; os ~80 campos de qualificação antigos estão mortos (menos de 40 leads em 6 meses) e não entram.
- **Formulário Meta:** 440 leads em 6 meses já chegam com 4 respostas (dívidas ativas, valor, situação, tipos). A IA lê o card antes de perguntar e não repete o que o lead já respondeu.
- **Modelo:** template Kommo v2 com OpenAI (texto, visão e transcrição com a mesma chave). Por isso o Compiler acusa "anthropic" e "groq": limitação conhecida dele (ONBOARDING.md §8), tratada como override consciente.

## Salesbots: o que desliga no go-live (confirmar antes da rampagem)

A API lista os 63 bots só pelo nome; o fluxo interno não aparece. Proposta pela função do nome:

- **Desligar (atendimento e follow-up do SDR):** BOT IA (55391) · ENVIAR MENSAGEM (55271) · retorno imediato (45683) · RCPCC - N (43775) · RCV - N (43777) · DBA - N (43683) · Spend - N (43761) · RPJ - N (43795) · follow up (49477) · follow up scalex (57322) · sx - follow up copiar(1) (59391) · TestBot (48699) · Exemplo instagram (25992).
- **Manter:** lembretes de reunião 24h e 2h · Fechar conversa · Tags * · Nicho * · Painel * · bots do CLOSER, JURÍDICO e FINANCEIRO · NPS · transmissões · Assas Entrada · Define Campanha · negociação 2.
- Durante a rampagem, os bots da lista "desligar" ganham a condição **"não tem a tag ia-gabi"**.

## O que eu descubro sozinho (com o token do Kommo)

- pipelines, etapas e ordem real; campos do lead com `enum_id`;
- Salesbots e Digital Pipeline ativos, para mapear o gatilho do bot atual;
- webhooks já cadastrados na conta;
- se o canal é mesmo o WhatsApp oficial e se o número aparece em outra integração.

## Próximas rodadas

1. Negócio e oferta ← **agora**
2. Jornada comercial e alçada
3. Canais e experiência (handoff)
4. Operação: horários, SLA, follow-up, recuperação
5. Dados e integrações (descoberta ao vivo)
6. Qualidade: cenários de eval e Foto do Antes
7. Central e acesso

## Pendências que bloqueiam (saída do Compiler em `onboarding/compilado/`)

| Pendência | De quem | Bloqueia |
|---|---|---|
| Rodada 4: follow-up e definição de recuperação (respondeu × concretizou) | mestre / escritório | prompt de follow-up, Central |
| Chave OpenAI de produção (conta comercial) | Control Gestão | evals, deploy |
| Upstash Redis (URL + token REST) | Control Gestão | histórico da conversa, deploy |
| Projeto Vercel | Control Gestão | deploy |
| Salesbot de envio no Kommo (`KOMMO_BOT_ID`) | eu, pelo navegador, ou o mestre no UI (~3 min) | envio das respostas |
| Confirmar a lista de Salesbots a desligar | escritório | rampagem |
| Gerar um token novo do Kommo (o atual apareceu no chat) | mestre | go-live |
