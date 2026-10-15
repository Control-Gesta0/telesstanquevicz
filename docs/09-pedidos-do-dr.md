# 09 · Ajustes pedidos pelo Dr. (15/10/2026)

O Dr. revisou o guia e pediu estas mudanças. As duas decisões abertas foram fechadas com o mestre: Venda perdida volta para o Follow-up do SDR, e o fora do escopo vai para conferência humana com mensagem neutra.

| Pedido | O que mudou | Onde |
|---|---|---|
| A IA se chama **Stela** (Gabi é a SDR, uma pessoa) | Todos os textos que o lead ou a equipe leem: abertura, nota no card, laboratório, painel. Etiqueta de liberação trocada para `ia-stela` (a `ia-gabi` nunca chegou a existir na conta). Identificadores internos de código ficaram. | `lib/crm-map.ts`, `prompts/`, `lib/*.ts`, `central/`, `GATE_TAG` na Vercel |
| Só o nome, sem "assistente virtual" | Abertura: "Oi! Aqui é a Stela, da Teles & Stanquevicz Advogados." Ela não se anuncia como IA. Se a pessoa perguntar diretamente se é robô, ela **não mente**: confirma e segue o atendimento. Nunca diz que é uma pessoa. | `prompts/nucleo.md`, abertura |
| Closers são **especialistas** | A reunião é sempre "com um dos nossos especialistas". O nome do Dr. Carlos Eduardo saiu de todos os textos da IA, e "o advogado" virou "o especialista". | prompts, `lib/tools.ts`, `lib/followup.ts` |
| Usuários CLOSER 1 e CLOSER 2 | Nomes nas notas e no guia: Guilherme = CLOSER 1, Claudia (13015432) = CLOSER 2, SDR (11719355) = Gabi (SDR). O guia antigo chamava a 13015432 de "Carla"; no Kommo ela é CLAUDIA. | `negocio.responsaveis.nomes` |
| Busca e apreensão passa pela Gabi (SDR) antes de marcar | A Stela não oferece horário. Pergunta se foi apreendido, quando, se tem o mandado (pede a foto) e o nome completo para localizar o processo. Depois: card em Em atendimento, responsável SDR, tarefa "consultar o processo, ver se tem tese e confirmar a reunião" em 30 minutos. | porta `dba`: `conferenciaAntesDaReuniao`; `prompts/portas/dba.md` |
| Fora do escopo: conferência humana antes de dispensar | A Stela não recusa: "Vou passar o seu caso para a nossa equipe dar uma olhada…". Etiqueta **Conferir escopo**, tarefa para a SDR em 1 hora, sem "Desqualificado robô". Vale também para banco de montadora. | `efeitosDoNegocio`, `negocio.conferirEscopo`, alertas |
| Follow-up depois da reunião (CLOSER) | Motivo de perda novo no Kommo: **Retomar depois (volta ao SDR)** (39348516). Venda perdida com esse motivo volta para SDR › Follow-up, com a SDR, etiqueta Follow up, tarefa de retomar em 24 h e nota. Lá vale a regra dos 5 dias. Outros motivos seguem com a etiqueta Desqualificado. | `automacoes.retomarDepois`, `lib/crm-eventos.ts` |

## Provas

- `npm test`: travas OK, com testes novos (busca e apreensão sem agenda e com tarefa; fora do escopo com etiqueta e tarefa; CLOSER 1/2).
- Triagem: 45/45 e 5/5 fluxos.
- Na primeira rodada, 3 falhas eram critérios do juiz que ainda falavam em "advogado" ou exigiam que ela dissesse o nome; foram corrigidos. A falha real foi na busca e apreensão: ela não acolhia a urgência, repetia a data e não pedia a foto do mandado. O prompt da porta foi ajustado.

## O que as rodadas de avaliação pegaram (e virou trava em código)

| Falha | Correção |
|---|---|
| Gravou a frase do caso ("Levaram meu carro ontem…") como nome completo e encerrou com nome inventado | `pareceNome`: nome e nome completo só valem se parecem nome de pessoa (sem palavras do caso nem de horário) |
| Lead mandou o nome completo e ela reservou sem gravar, pedindo o nome de novo | `agendar_reuniao` aproveita nome completo e e-mail da última mensagem do lead |
| Gravou o banco como "não informado" e pulou a pergunta do banco | resposta "não informado"/"não dito" não é gravada: ela pergunta |
| Disse "vou passar para a equipe" sem ter encerrado (sem tarefa) | trava: essa frase só sai com o atendimento encerrado. O encerramento garantido do fora do escopo roda antes da trava |
| Esquecia de acolher a busca e apreensão | "Entendi, vamos ver isso rápido." entra em código na primeira resposta do caso, uma vez só |
| A mensagem de erro de uma ferramenta ainda mandava "recusar" | texto alinhado com a regra nova (não recusa; honorários e reunião são do roteiro) |

## Resultado final (15/10/2026)

| Avaliação | Resultado |
|---|---|
| `npm test` (travas) | todas OK |
| Triagem do primeiro contato | 45/45 e 5/5 fluxos |
| Conversa completa: 16 cenários × 3 | **48/48** |
| Automação "Retomar depois", teste real pelo webhook (lead 26212401, sem contato) | voltou para SDR › Follow-up, responsável SDR, etiqueta Follow up, tarefa e nota; lead fechado depois |
| Produção | agente e painel publicados; `/api/validate` ok; laboratório: abertura da Stela e busca e apreensão com acolhimento |

Pendências do escritório: renomear no Kommo o robô "Gabi · envio" para "Stela · envio" (só nome) e, se quiserem, os usuários GUILHERME e CLAUDIA para CLOSER 1 e CLOSER 2.
