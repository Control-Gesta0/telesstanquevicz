# Construção da fase 1 · estado em 07/10/2026

Estado do projeto: **VALIDANDO → PROVANDO**. Código pronto, testado e publicado; falta ligar no Kommo e provar no WhatsApp real.

## No ar

- Agente: https://telesstanquevicz-ia.vercel.app (projeto Vercel `telesstanquevicz-ia`, equipe control-gestao)
- `GET /api/inbound` → saúde · `GET /api/validate?secret=` → mapa × Kommo vivo · `GET /api/executions?secret=` → diário
- Redis compartilhado da Control Gestão com prefixo exclusivo `agente-telesstanquevicz:`
- Campo criado no Kommo: **Resposta IA (agente)** (1048279), onde a Gabi deixa a resposta para o Salesbot enviar.

## Provas

| Prova | Resultado | Evidência |
|---|---|---|
| Typecheck | limpo | `npm run typecheck` |
| Testes (motor + escritório) | 100% verdes (~90 casos: travas, roteamento por valor, formulário Meta, portas, horários, finalização, follow-up) | `npm test` |
| Evals | **39/39** (13 cenários × 3), custo do agente US$ 0,086 no exame inteiro | `docs/evals-2026-10-07.log` |
| Validador contra o Kommo vivo | ok, exceto `KOMMO_BOT_ID` | `/api/validate` |
| Calendly | leitura de horários livres real (146 horários em 7 dias); reserva **ainda não provada** | E2E |
| Follow-up | relógio testado; disparo real pelo QStash **ainda não provado** | E2E |
| WhatsApp real | **não provado** | E2E |

## O que mudou no motor do template (registrar na skill)

- `Porta.prioridade`: desempate quando o texto casa com mais de uma porta (DBA > RCV > RCPCC).
- `Porta.antesDeAgendar` + `avisoAoAgendar` e as tools `ver_horarios` / `agendar_reuniao` (Calendly).
- `aplicarFinalizacao` com efeitos do negócio em código: etapa, responsável por valor, Nichos, Desqualificado, tarefa.
- `LeadPort` ganhou `setResponsible`, `addTask`, `getPhone`, `nextTurn`.
- Travas de contexto (`checarContexto`): valor em R$ que o lead não disse; "está marcado" sem reserva.
- Follow-up nas 24h (`lib/followup*.ts` + `api/followup.ts`) com QStash e claim atômico.
- `/api/validate` confere também os IDs de `CRM_MAP.negocio` e os usuários.

## Pendências até o go-live

| # | Pendência | Quem |
|---|---|---|
| 1 | Criar o Salesbot de envio (1 bloco "Enviar mensagem" com `{{lead.cf.1048279}}`) e informar o `bot_id` | mestre no Kommo, ou eu com um login |
| 2 | Autorizar o webhook `add_message` apontando para o agente | mestre |
| 3 | Lead de teste: o WhatsApp de alguém da Control Gestão, com a tag `ia-gabi` | mestre |
| 4 | Nos Salesbots de atendimento do SDR, condição "sem a tag ia-gabi" (senão o lead de teste recebe resposta dupla) | escritório/mestre |
| 5 | Autorizar uma reserva de teste no Calendly do escritório (cancelada logo depois) | mestre |
| 6 | Trocar as chaves que passaram pelo chat (OpenAI, Vercel, Upstash, QStash, Calendly, Kommo) antes de abrir para todos | mestre |
| 7 | Avisar o escritório: o formulário do anúncio grava as respostas deslocadas no Kommo | escritório |
| 8 | Confirmar a lista de bancos de montadora (hoje: Toyota, VW, GM/Chevrolet, Honda, Hyundai, Renault/RCI, Fiat/Stellantis, Nissan, Mercedes, BMW, Volvo, Yamaha, Jeep, Peugeot, Citroën, Mitsubishi, Caoa) | escritório |
| 9 | 5 a 10 conversas reais boas do time para o exemplo de tom (hoje os exemplos foram escritos a partir das respostas prontas) | escritório |
