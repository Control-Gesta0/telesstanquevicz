# Cowork · Restaurar os leads excluídos no Kommo

Cole o texto abaixo numa sessão nova do Cowork (app do Claude), com o Chrome aberto e logado no Kommo como administrador.

---

Preciso restaurar leads excluídos por engano no Kommo da Teles & Stanquevicz Advogados.

**Contexto**
- Conta: https://telesstanquevicz.kommo.com (já estou logado no Chrome como administrador).
- Em 26/10/2026, por volta das 17h, o usuário "ADM Kommo - Control Gestão" excluiu 10.365 leads. Quase todos estavam no funil **SDR**, etapa **Follow-up**. Os contatos não foram excluídos, só os leads.
- A API do Kommo não restaura leads. Isso só se faz pela tela.

**O que fazer**
1. Abra o Kommo no Chrome e vá em **Leads**. Troque para a visão em **lista**.
2. Abra os filtros e procure a opção de leads excluídos. Pode aparecer como "Excluídos", "Lixeira", "Deleted" ou "Recently deleted". Me mostre a tela antes de seguir.
3. Confirme comigo quantos leads aparecem nessa lista e as datas de exclusão. O esperado é cerca de 10.365, de 26/10.
4. Selecione **só os excluídos em 26/10/2026** e use **Restaurar**. Se a seleção tiver limite por página, repita página por página até acabar.
5. Depois de restaurar, abra o funil SDR e me diga quantos cards ficaram na etapa Follow-up. Antes da exclusão eram cerca de 9.900.

**Se não existir opção de restaurar**
- Abra o chat de suporte do Kommo (ícone de ajuda na conta) e mande esta mensagem:
  "Olá! Na conta telesstanquevicz.kommo.com, em 26/10/2026 por volta das 17h (horário de Brasília), o usuário ADM Kommo - Control Gestão (ID 7111358) excluiu por engano 10.365 leads, a maioria do funil SDR, etapa Follow-up. Os contatos continuam na conta. Podem restaurar esses leads, com histórico, notas e tarefas? Obrigado."
- Me mostre a resposta do suporte.

**Regras**
- Não exclua, não mova e não edite nenhum outro lead, contato, funil, robô ou configuração.
- Não restaure leads excluídos em outras datas sem me perguntar.
- Antes de clicar em qualquer botão que mude dados (Restaurar, Confirmar), me mostre a tela e espere meu ok.
- Não use nem anote senhas.

**No fim, me diga**
- quantos leads foram restaurados;
- quantos cards ficaram em SDR › Follow-up;
- se sobrou algum excluído de 26/10 que não voltou.

---

Depois da restauração, a Control Gestão confere pela API se os 10.365 IDs voltaram (lista em `docs/backup/leads-excluidos-2026-10-26.txt`).
