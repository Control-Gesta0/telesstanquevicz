# Teles Stanquevicz · Agente de IA (Kommo)

Estado do projeto: **DIAGNOSTICANDO** (rodadas 1–3 respondidas pela própria conta, ver 02-respostas-da-conta.md)
Atualizado em 06/10/2026.

## Bloco 0 fechado

| Item | Resposta | Fonte | Confirmado |
|---|---|---|---|
| CRM | Kommo | mestre (sessão) | sim |
| Objetivo | agente novo do zero | mestre (sessão) | sim |
| WhatsApp | oficial (Meta) conectado no Kommo | mestre (sessão) | a conferir na API |
| Desenho | **A**: resposta pelo Salesbot de envio | decorre do canal | sim |
| Bot existente | Salesbot do Kommo ativo no número | mestre (sessão) | a inventariar na API |
| Transição | bot atual desliga no go-live | mestre (sessão) | sim, com a regra abaixo |
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

## Pendências que bloqueiam

| Pendência | De quem | Bloqueia |
|---|---|---|
| Token de integração do Kommo | cliente / mestre | descoberta ao vivo, crm-map |
| Respostas da rodada 1 | cliente | prompt.md |
