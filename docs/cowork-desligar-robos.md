# Cowork · Desligar os robôs antigos que mandam mensagem

Cole o texto entre as linhas numa sessão nova do Cowork (app do Claude), com o Chrome aberto e logado no Kommo como administrador. Pode rodar a qualquer hora: a Stela está desligada até o teste real.

---

Preciso desligar (não excluir) 13 robôs (Salesbot) no Kommo da Teles & Stanquevicz Advogados. Antes de mexer no primeiro, me mostre a tela e espere meu ok.

**Contexto**
- Conta: https://telesstanquevicz.kommo.com (já estou logado no Chrome como administrador).
- A IA Stela vai atender os leads novos do WhatsApp. Estes robôs mandam mensagem para o lead e respondem junto com ela, o que deixa a conversa confusa. Por isso eles saem.
- É para **desligar**, nunca excluir: se precisar, dá para religar.

**Onde fica:** Kommo › **Configurações** › **Salesbot** (ou "Robôs"). Cada robô tem uma chave de ligar/desligar na lista.

**Robôs para desligar (os 13, nenhum outro)**

| Grupo | Robô | ID |
|---|---|---|
| Atendimento | BOT IA | 55391 |
| Atendimento | ENVIAR MENSAGEM | 55271 |
| Atendimento | retorno imediato | 45683 |
| Atendimento | RCPCC - N | 43775 |
| Atendimento | RCV - N | 43777 |
| Atendimento | DBA - N | 43683 |
| Atendimento | Spend - N | 43761 |
| Atendimento | RPJ - N | 43795 |
| Atendimento | Isenção de IR | 37476 |
| Atendimento | Exemplo instagram | 25992 |
| Follow-up do SDR | follow up | 49477 |
| Follow-up do SDR | follow up scalex | 57322 |
| Follow-up do SDR | sx - follow up copiar(1) | 59391 |

**NÃO mexa nestes de jeito nenhum:**
- **Stela · envio** (61873): é por ele que a Stela manda as mensagens;
- **Lembrete de reunião - 24h antes** (10528) e **Lembrete de reunião - 2h antes** (10530);
- os do CLOSER: C - Com proposta, C - Aguardando documentos, C - Aguardando assinatura, C - Aguardando documentos copiar 3011, Aguardando documento, Aguardando pagamento, Aguardando assinatura, Assas Entrada, Follow up - CLOSER;
- os do JURÍDICO e os demais: Fechar conversa, Saudação Jurídico, Jurídico, Produzindo petição, Petição protocolada, -30D, +30D, +60D, Robô de NPS, rcv êxito aguardando documentos, negociação 2, Transmissão…;
- os de classificação e origem (Tags …, Nicho - …, Painel - …, Define Campanha): não mandam mensagem e ficam para outro dia.

**O que fazer**
1. Abra Configurações › Salesbot e me mostre a lista.
2. Para cada robô da tabela, confira o **nome exato** (e o ID, se aparecer na tela ou no endereço ao passar o mouse). Há nomes parecidos: "follow up" (SDR) não é "Follow up - CLOSER"; "Aguardando documento" é do CLOSER e fica.
3. Desligue com a chave. Não abra o editor do robô, não duplique e não clique em excluir.
4. Depois do primeiro, me mostre como ficou e siga com os outros.
5. No fim, me mostre a lista com os 13 desligados e o **Stela · envio** e os dois **Lembretes de reunião** ligados.

**Regras**
- Só desligar. Nunca excluir, editar ou duplicar.
- Não mexa em nenhum outro robô, funil, lead, etiqueta, usuário ou configuração.
- Se algum robô da tabela não aparecer ou já estiver desligado, me avise e siga com os outros.
- Se aparecer qualquer janela pedindo confirmação de algo além de desligar, pare e me mostre.
- Não use nem anote senhas.

**No fim, me diga**
- quais dos 13 foram desligados;
- se algum não foi encontrado;
- se o Stela · envio e os dois lembretes continuam ligados.

---

Depois, a Control Gestão confere pela API se os 13 ficaram desligados.

**Para voltar atrás:** ligar de novo os mesmos robôs na mesma tela.
