# Respostas tiradas da própria conta Kommo

Leitura de 06/10/2026, somente leitura. Fontes: 89 respostas prontas do time (`chats/templates`), 63 Salesbots (`/api/v4/bots`, só nomes; o fluxo interno não sai pela API), 30 resumos de conversa da IA do Kommo (notas `ai_result`, set/2024 a jul/2026), 158 notas do closer (60 dias), 5.000 mudanças de etapa (28/09 a 06/10) e 784 leads criados em 30 dias.

A API do Kommo **não entrega o texto das conversas do WhatsApp** (os eventos de chat trazem só o id da mensagem). Para ver a conversa crua, só pelo navegador com login de usuário. O que está abaixo vem dos roteiros do time, dos resumos e do comportamento do funil.

Legenda de confiança: **alta** = escrito pelo próprio escritório · **média** = inferido do comportamento do CRM · **a confirmar** = precisa de uma palavra do escritório.

## 1 · O que é cada nicho

| Sigla | Significado | Fonte | Confiança |
|---|---|---|---|
| RCPCC | Revisão de Contrato de Produtos de Conta Corrente: cheque especial, cartão, empréstimo pessoal | template "Reunião Rcpcc" | alta |
| RCV | Revisão de Contrato de financiamento de Veículo | templates "Rcv *" e "Proposta Rcv" | alta |
| DBA | Defesa em Busca e Apreensão de veículo | template "Reunião Dba" | alta |
| SE / Spend | Superendividamento (repactuação de dívidas, limite de 35% da renda) | templates "Spend *", "Reunião Spend", "Proposta Spend" | alta |
| RMC/RCC | Cartão de crédito consignado com desconto indevido | template "RMC e RCC" | alta |
| IR | Isenção de imposto de renda por doença grave | bot "Isenção de IR" + campo "doença grave" | média |
| RPJ | Revisão de contratos bancários de pessoa jurídica | resumo de conversa com empresa | a confirmar |
| NEGOCIAÇÃO | Acordo de dívida (Serasa/banco) | template "Aviso de Acordo" | média |

Volume e receita dos leads criados em 30 dias:

| Nicho | Leads | Contratos fechados (CLOSER › ganho) | Receita |
|---|---|---|---|
| RCPCC | 338 | 14 | R$ 52.022 |
| RCV | 66 | 27 | R$ 139.806 |
| DBA | 41 | 6 | R$ 21.314 |
| Outros | ~42 | 0 | 0 |

**Recomendação:** a IA atende RCPCC, RCV e DBA, uma "porta" para cada. Esses três trazem ~95% dos leads e 100% dos contratos do mês. Os outros nichos vão direto para humano. O template Kommo já trabalha com uma porta por produto.

## 2 · O que qualifica e o que descarta, por nicho

Roteiro que o time já usa (templates), na ordem:

- **RCPCC**: qual a dívida e em qual banco · composição (parcelado, fatura, cheque especial) · valor acumulado · parcelas em atraso e quantas · banco já está cobrando. Qualificado: dívida bancária ativa, com atraso ou juros crescendo ("Rcpcc Qualificado").
- **RCV**: em quantas parcelas financiou · quantas pagou · valor da parcela · banco · tem o contrato. Qualificado: financiamento em banco/financeira comum ("Rcv Qualificado").
- **DBA**: o veículo já foi apreendido · dia da apreensão · o oficial deixou cópia do mandado · enviar foto do mandado. Sempre urgente (prazo de defesa correndo).
- **SE** (fora da 1ª fase): renda bruta · valor das dívidas · outras dívidas · quanto da renda está comprometido · contracheque. Qualificado: mais de 35% da renda comprometida.

Descarte (template "Infelizmente", 148 de 174 perdas = "Solução não se aplica"):
- problema que não é dívida com banco;
- veículo financiado por **banco de montadora** (Toyota, Volkswagen, GM, Honda: template "Banco Montadora");
- motivos que aparecem nas notas do closer: está em dia e não aceita ficar inadimplente; honorários acima do esperado; já contratou outro advogado; parou de responder.

## 3 · O que significa cada etapa do SDR

| Etapa | Leitura | Evidência | Confiança |
|---|---|---|---|
| Leads de entrada / NOVA OPORTUNIDADE | lead novo | 53 movimentos entre as duas pelo usuário SDR | média |
| RETORNO IMEDIATO | **o lead respondeu, atender agora** | robô move FOLLOW UP → RETORNO IMEDIATO (302) e ganho → RETORNO IMEDIATO (137) quando o lead escreve | alta |
| AGENDAR REUNIÃO | reunião sendo marcada ou marcada com o Dr. Carlos Eduardo | 80 leads; metade com campo Closer e valor | média |
| NO SHOW | faltou à reunião | nome | média |
| **"dia"** | **estacionamento de follow-up antigo**, trabalhado em lotes | 250+ leads, todos criados em jun–jul/2026, 246 com tag "Follow up"; SDR devolve "dia" → FOLLOW UP (82 na semana) | média |
| FOLLOW UP | cadência de recontato | 332 leads; o robô fecha como perdido quando a cadência acaba (120) | alta |
| **Ganho no SDR** | **não é venda**: é "encerrado/arquivado" ou "passou adiante" | 75 ganhos sem valor e sem data de reunião; 377 movimentos RETORNO IMEDIATO → ganho; limpezas em massa de 1.000 a 1.700 movimentos num dia (28/09, 02/10, 05/10) | média |

**Venda real = CLOSER › Venda ganha** (46 de 47 com valor, 44 com data de reunião). Foto do Antes corrigida: **47 contratos e R$ 213.142 em 30 dias, ticket médio de R$ 4.535**.

⚠️ As limpezas em massa misturam o histórico (ex.: 896 leads movidos de FUP › qualificação para CLOSER › Venda ganha). Para a métrica da IA vale contar só o que entra em CLOSER › Venda ganha **com valor**.

## 4 · Até onde a IA vai e como a reunião é marcada

O que o escritório faz hoje (templates "Disponibilidade Horários", "Encaixe", "Cadastro Reunião", "Reunião Agendada", bots "Lembrete 24h/2h"):
1. Pergunta telefone ou vídeo (recomenda vídeo, pode ser com a câmera fechada).
2. Pergunta disponibilidade e oferece um encaixe ("consigo te encaixar hoje às…").
3. Pede nome completo e e-mail.
4. Confirma a reunião no **Google Meet** com o Dr. Carlos Eduardo, sem custo.
5. Grava a data no campo **Reunião** (719788). Os bots de lembrete de 24h e 2h usam esse campo.

O Kommo não tem API de agenda. **Fase 1 recomendada:** a IA conduz até o passo 3, move para AGENDAR REUNIÃO, grava a preferência de horário e cria uma tarefa para o SDR confirmar o encaixe. A IA nunca confirma um horário que ela não pode ver. **Fase 2:** se a agenda do Dr. Carlos for Google Agenda, integrar para a IA ver os horários livres e preencher o campo Reunião sozinha.

## 5 · impactmind.app e o bot atual

- Pela API não dá para identificar a impactmind. Ela recebe "lead criado", "etapa mudou" e "lead atualizado". **A confirmar.**
- Existem Salesbots chamados **"BOT IA"** (55391), **"ENVIAR MENSAGEM"** (55271), **"follow up scalex"** (57322) e **"[SX] - follow up padrão IA"** (desligado), além da tag FORM-RCPCC-SX. Um resumo de jun/2026 mostra perguntas com cara de IA ("Qual seu nome, por favor? Assim posso te explicar…"). **Tudo indica que já existe uma IA de terceiros conversando pelo Salesbot**, não só um fluxo fixo.
- Consequência: na rampagem, quem precisa parar nos leads com a tag da nossa IA é esse "BOT IA" (e o follow-up dele), não só os bots de etiqueta.

## 6 · Perguntas que o Salesbot e o time fazem hoje

As do item 2, mais a abertura padrão da persona **"Gabi"** ("Me chamo Gabi, sou especialista da equipe… Pode me contar como posso te ajudar?" e "pode me mandar um texto ou um áudio contando o seu caso").

## 7 · Honorários

- Resposta oficial do escritório (template "Valor Honorários"): **não informa valor**. A proposta depende do caso e sai na conversa sem custo.
- Propostas reais do closer variam muito: de R$ 497,90 + 3× R$ 647,90 até R$ 3.097,90 + 10× R$ 1.247,90, mais 15% no êxito.
- Existem valores fixos em dois templates (RMC/RCC R$ 297,90; Superendividamento R$ 5.997,90), fora dos nichos da 1ª fase.

**Decisão proposta:** a IA não informa honorários. Ela usa a resposta oficial e oferece a reunião sem custo. Isso cumpre o gate "preço ou política explícita de não informar".

## Riscos para os advogados decidirem

1. **Promessa de resultado.** Os templates prometem "desconto que chega a 70%/90% do saldo devedor". As regras de publicidade da OAB restringem promessa de resultado. A IA, por padrão, **não repete percentual**. Só muda se os sócios aprovarem por escrito.
2. **Persona humana.** "Gabi, especialista" com cara de pessoa. A regra da casa é a IA assumir que é IA quando perguntada. Proposta: "Gabi, assistente virtual do escritório".
3. **Dados de pagamento** (PIX, conta) e links de assinatura estão nos templates. A IA nunca envia isso: é território do closer e do financeiro.
4. **Número de processo e dado sensível** nas Observações: a IA não grava nem repete.

## Dados fixos que já entram no prompt (fonte: templates)

- Sede em Itajaí/SC, atendimento 100% digital para todo o Brasil.
- Horário: segunda a sexta, 8h30–12h e 13h30–18h30; sábado e domingo fechado.
- Reunião: Google Meet ou telefone, sem custo, com o Dr. Carlos Eduardo.
