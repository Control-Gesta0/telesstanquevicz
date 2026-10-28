# Cowork · Excluir as etiquetas vazias no Kommo

Cole o texto abaixo numa sessão nova do Cowork (app do Claude), com o Chrome aberto e logado no Kommo como administrador.

---

Preciso excluir sete etiquetas vazias no Kommo da Teles & Stanquevicz Advogados.

**Contexto**
- Conta: https://telesstanquevicz.kommo.com (já estou logado no Chrome como administrador).
- Em 28/10/2026 a Control Gestão juntou etiquetas repetidas pela API: os leads saíram das etiquetas abaixo e foram para a etiqueta certa. As sete ficaram com zero leads.
- A API do Kommo não apaga etiqueta. Isso só se faz pela tela.

**Etiquetas para excluir (todas com 0 leads)**

| Etiqueta | ID |
|---|---|
| QUALIFICADA | 240821 |
| Reunião realizada | 51848 |
| Advogada Parceira | 227239 |
| FACEBOOK | 314623 |
| DESQUALIFICADO (tudo maiúsculo) | 285216 |
| AÇÃO MONITÓRIA | 248183 |
| zz-teste-apagar-stela | 314695 |

**Cuidado com nomes parecidos. Estas NÃO podem ser excluídas** (têm leads e as automações e a Stela dependem delas):
- QUALIFICADO (com O no fim)
- Desqualificado (só a primeira letra maiúscula), Desqualificado pelo robô, DESQUALIFICADO FORMULARIO, QUALIFICADO FORMULARIO
- reuniao-realizada (minúsculo, com hífen)
- Advogado Parceiro
- Meta
- DEFESA EM AÇÃO MONITÓRIA
- Follow up, Conferir escopo, contrato-pago, GOOGLE, DBA, RCV, RCPCC, ia-stela, atendimento-humano

**O que fazer**
1. Abra o Kommo no Chrome e vá em **Leads**. Troque para a visão em **lista**.
2. Para cada etiqueta da tabela, filtre a lista por ela e confirme que aparecem **0 leads**. Se alguma tiver lead, não exclua essa e me avise.
3. Abra o gerenciador de etiquetas. Costuma estar no menu de três pontos no canto superior direito da lista, como "Gerenciar etiquetas" ("Manage tags"). Me mostre a tela.
4. Marque **só as sete etiquetas da tabela**, conferindo o nome letra por letra (maiúscula, minúscula, acento e hífen). Me mostre a seleção antes de excluir.
5. Depois do meu ok, clique em excluir e confirme.
6. Abra o gerenciador de novo e confirme que as sete sumiram e que as etiquetas da lista "NÃO podem ser excluídas" continuam lá.

**Regras**
- Não exclua, renomeie ou edite nenhuma outra etiqueta.
- Não mexa em leads, contatos, funis, robôs ou configurações.
- Antes de clicar em qualquer botão que mude dados (Excluir, Confirmar), me mostre a tela e espere meu ok.
- Não use nem anote senhas.

**No fim, me diga**
- quais das sete foram excluídas;
- se alguma tinha lead e ficou;
- se as etiquetas que não podiam ser excluídas continuam na lista.

---

Depois, a Control Gestão confere pela API que as sete sumiram e que as etiquetas usadas pelas automações continuam na conta.
