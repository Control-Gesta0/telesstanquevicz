# Cowork · Concluir o que falta no Kommo

São **dois prompts**. Cole cada um numa sessão nova do Cowork (app do Claude), com o Chrome aberto e logado no Kommo como administrador.

- **Prompt 1, pode rodar agora:** robôs do SDR que a Vercel já substituiu, gatilhos do "Automatizar", acesso dos closers e conferências.
- **Prompt 2, às 17h30 de sexta (30/10):** desligar os 10 robôs de atendimento, para a Stela atender o fim de semana.

Os dois só **desligam** robôs, nunca excluem. Tudo pode ser religado.

---

## Prompt 1 · rodar agora

Preciso concluir a configuração do Kommo da Teles & Stanquevicz Advogados para a IA Stela. São quatro partes. Antes de cada clique que muda alguma coisa, me mostre a tela e espere meu ok.

**Contexto**
- Conta: https://telesstanquevicz.kommo.com (já estou logado no Chrome como administrador).
- Funis: **SDR** (pré-venda), **CLOSER** (venda), **JURÍDICO**.
- Várias automações antigas do Kommo foram refeitas num servidor externo (Vercel), que já está rodando. Se as antigas continuam ligadas, as duas fazem a mesma coisa ao mesmo tempo.

### Parte 1 · Desligar 23 robôs do SDR (Configurações › Salesbot)

Desligue com a chave de ligar/desligar. **Não exclua, não edite.**

| Grupo | Robô | ID |
|---|---|---|
| Follow-up | follow up | 49477 |
| Follow-up | follow up scalex | 57322 |
| Follow-up | sx - follow up copiar(1) | 59391 |
| Classificação | Tags RCV/DBA | 18394 |
| Classificação | Tags RCPCC/RMC | 18396 |
| Classificação | Tags Danos Morais | 18400 |
| Classificação | Tags Embargos e Exceção | 18402 |
| Classificação | Tags RPJ | 18408 |
| Classificação | Tags Registrado | 18410 |
| Classificação | Tags DCB | 18416 |
| Classificação | Tags SE | 18422 |
| Classificação | Nicho - RCPCC | 33292 |
| Classificação | Nicho - DBA | 33294 |
| Classificação | Nicho - SE | 33296 |
| Classificação | Nicho - RCV | 33298 |
| Classificação | Nicho - RPJ | 33300 |
| Classificação | Nicho - IR | 33302 |
| Origem | Painel - Google | 33304 |
| Origem | Painel - Meta | 33306 |
| Origem | Painel - Instagram | 33308 |
| Origem | Painel - desqualificado | 33310 |
| Origem | Painel - desqualificado robô | 33312 |
| Origem | Define Campanha | 47656 |

**Não mexa nestes, de jeito nenhum:**
- **Stela · envio** (61873);
- **Lembrete de reunião - 24h antes** (10528) e **Lembrete de reunião - 2h antes** (10530);
- os 10 de atendimento (BOT IA, ENVIAR MENSAGEM, retorno imediato, RCPCC - N, RCV - N, DBA - N, Spend - N, RPJ - N, Isenção de IR, Exemplo instagram), que saem no Prompt 2;
- os do CLOSER: C - Com proposta, C - Aguardando documentos, C - Aguardando assinatura, Aguardando documento, Aguardando pagamento, Aguardando assinatura, Assas Entrada, Follow up - CLOSER;
- os do JURÍDICO e os demais: Fechar conversa, Saudação Jurídico, Jurídico, Produzindo petição, Petição protocolada, -30D, +30D, +60D, Robô de NPS, negociação 2, Transmissão….

Mostre a tela antes do primeiro e, no fim, a lista com os 23 desligados.

### Parte 2 · Gatilhos do "Automatizar" que a Vercel já faz

Abra **Leads**, escolha o funil, e clique em **Automatizar** (fica no topo do funil, mostra as etapas em colunas com os gatilhos embaixo).

Procure **só estes quatro**:

| Funil | Etapa | Gatilho |
|---|---|---|
| SDR | Leads de entrada e/ou Follow-up | quando o lead manda mensagem, **mover para Em atendimento** |
| SDR | Follow-up | depois de X dias, **mover para perdido** (Closed - lost) |
| SDR | Follow-up | **adicionar etiqueta "Follow up"** |
| CLOSER | Venda perdida | **adicionar etiqueta "Desqualificado"** |

Para cada um que achar:
1. Abra o gatilho e me mostre a configuração (tipo, condição, etapa, prazo). Anote o que aparece na tela, para dar para recriar se precisar.
2. Espere meu ok e então **exclua só esse gatilho** (o Kommo não tem opção de desligar gatilho de etapa).
3. Não mexa em gatilho que roda Salesbot de lembrete, que cria tarefa, que muda responsável ou que não está na tabela. Se ficar em dúvida, me mostre e pergunte.

No fim, me mostre de novo o "Automatizar" do SDR e do CLOSER.

### Parte 3 · Acesso dos closers à etapa Reunião agendada do SDR

Os closers GUILHERME e CLAUDIA precisam ver e editar os cards de **SDR › Reunião agendada** (para conferir a agenda do dia e os dados do lead).

1. Vá em **Configurações › Usuários**. Abra **GUILHERME** e depois **CLAUDIA**.
2. Abra **Direitos de acesso** (ou "Permissões") › **Leads** › funil **SDR**.
3. Me mostre a tela. Quero liberar **ver** e **editar** na etapa **Reunião agendada**. Não mude os direitos nas outras etapas nem nos outros funis.
4. Espere meu ok e salve.

### Parte 4 · Só conferir, sem mudar nada

1. Funil **SDR**: confirme que existe a etapa **Social Seller**, entre "Incoming leads" e "Em atendimento", e me diga se aparece algum gatilho no "Automatizar" embaixo dela (o esperado é nenhum).
2. Funil **JURÍDICO**, etapa **CONTACTAR CLIENTE**: me diga quais gatilhos ou robôs aparecem embaixo dela no "Automatizar", sem mexer.

**Regras**
- Desligar robô: sim. Excluir robô: nunca.
- Excluir gatilho: só os quatro da tabela da Parte 2, e só depois do meu ok.
- Não mexa em leads, contatos, etiquetas, campos, outros usuários ou outras etapas.
- Não use nem anote senhas.

**No fim, me diga**
- quais dos 23 robôs foram desligados e se algum não foi encontrado;
- quais gatilhos foram excluídos e a configuração anotada de cada um;
- se os direitos do GUILHERME e da CLAUDIA foram salvos;
- o que você viu na Social Seller e no CONTACTAR CLIENTE.

---

## Prompt 2 · rodar às 17h30 de sexta (30/10)

É o roteiro de `docs/cowork-virada-fim-de-semana.md`. Copie o texto entre as linhas de lá.

---

Depois de cada prompt, a Control Gestão confere pela API se os robôs ficaram como deviam.
