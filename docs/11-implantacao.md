# 11 · Implantação completa (26/10/2026)

## Feito agora

- **Modo "todos os leads novos"** (`lib/gate.ts`), publicado **desligado**. Liga com a variável `ATENDE_NOVOS_DESDE` (data da virada). Com ele ligado, a Stela atende só:
  - lead **criado a partir da virada** (os ~10 mil antigos ficam com a equipe);
  - no **funil SDR**, em Leads de entrada, Em atendimento ou Follow-up (nunca CLOSER, JURÍDICO, FINANCEIRO, DIRETORIA, FUP);
  - que **não** tem a etiqueta `atendimento-humano`;
  - e cujo atendimento da Stela **não foi encerrado** (encerrou, segue com a equipe; só a etiqueta `ia-stela` reabre).
  A etiqueta `ia-stela` continua liberando qualquer card à mão.
- Antes, sem a etiqueta, a Stela responderia qualquer funil e recomeçaria conversas já encerradas. Isso não acontece mais.
- Testes: 7 casos novos (etiqueta, lead antigo, outro funil, etapa errada, atendimento humano). Agente publicado, `/api/validate` ok.

## Estado da conta (26/10)

- Etiqueta `ia-stela` ainda não existe: o teste com WhatsApp real **não foi feito**. A entrega pelo robô "Stela · envio" (61873) não está provada.
- 62 de 63 Salesbots ativos, inclusive os de atendimento antigo (BOT IA, ENVIAR MENSAGEM…) e os 24 do SDR que viraram Vercel.

## Roteiro da virada

| # | Passo | Quem |
|---|---|---|
| 1 | Teste real: card de um WhatsApp da equipe com `ia-stela`, conversa até o fim (abertura, caso, horário ou passagem) | escritório manda as mensagens; Control Gestão acompanha o diário |
| 2 | Desligar (não apagar) em Configurações › Salesbot os 10 de atendimento: BOT IA (55391), ENVIAR MENSAGEM (55271), retorno imediato (45683), RCPCC - N (43775), RCV - N (43777), DBA - N (43683), Spend - N (43761), RPJ - N (43795), Isenção de IR (37476), Exemplo instagram (25992) | escritório (tela) |
| 3 | Desligar os 23 do SDR que viraram Vercel: follow up (49477), follow up scalex (57322), sx - follow up copiar(1) (59391); Tags RCV/DBA, RCPCC/RMC, Danos Morais, Embargos e Exceção, RPJ, Registrado, DCB, SE; Nicho - RCPCC, DBA, SE, RCV, RPJ, IR; Painel - Google, Meta, Instagram, desqualificado, desqualificado robô; Define Campanha | escritório (tela) |
| 4 | Remover no "Automatizar" do SDR e do CLOSER os gatilhos que viraram Vercel | escritório (tela) |
| 5 | Ligar o modo "todos os leads novos" (`ATENDE_NOVOS_DESDE`) e publicar | Control Gestão, no mesmo dia do passo 2 |
| 6 | Acompanhar as primeiras conversas no diário e no painel | Control Gestão |

Também na tela: acesso dos closers (GUILHERME, CLAUDIA) à etapa SDR › Reunião agendada; conferir se os robôs do JURÍDICO disparam em CONTACTAR CLIENTE.

Os robôs "Painel - …" e "Define Campanha" preenchem a origem hoje. Desligados, a origem passa a vir do rastreador da Vercel, que precisa do número do WhatsApp do escritório (`WHATSAPP_NUMERO`). Sem o número, "De onde" e campanha ficam em branco.
