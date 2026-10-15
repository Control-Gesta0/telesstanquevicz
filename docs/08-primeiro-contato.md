# 08 · Primeiro contato sem menu numerado (15/10/2026)

Pedido do mestre: **nunca usar número**. A Gabi começa perguntando o nome e o que a pessoa procura, entende o que ela escreveu e segue o fluxo certo.

## Como ficou

| Situação | O que acontece | Onde |
|---|---|---|
| A mensagem já diz o assunto ("vi o anúncio da busca e apreensão", "meu carro financiado…") | Palavra-chave trava o assunto em código (zero token). A Gabi se apresenta e pergunta o nome antes do caso, mesmo em busca e apreensão. | `lib/router.ts` (`rotear`) + linha "PRÓXIMO PASSO OBRIGATÓRIO" em `lib/llm.ts` |
| A mensagem não diz ("oi", "Marcos", "preciso de ajuda") | Triagem por IA (uma chamada JSON curta) lê tudo o que a pessoa já disse e devolve assunto e nome. | `lib/triagem.ts` |
| Ainda não deu para saber | 1ª: abertura ("Oi! Aqui é a Gabi… Com quem eu falo, e o que você está procurando?", ou "Oi, Ana!…" se ela disse o nome). 2ª: pergunta aberta ("Prazer, Marcos. Me conta um pouco do seu caso…"). 3ª: cita as três áreas, sem número. 4ª: passa para a equipe. | `decidirTriagem` + `CRM_MAP.abertura` |
| Assunto que não é bancário (pensão, INSS, trabalhista) | Recusa aprovada, encerra como `fora_do_escopo` (Desqualificado robô, sem tarefa). | rota `encerrar` em `lib/agent.ts` |
| Já é cliente, quer uma pessoa, boleto, outro assunto bancário | Porta "geral": mensagem fixa e tarefa "Assumir o atendimento" para o SDR. | porta `geral` |

- O nome dito vai para `respostas.nome` (campo novo `nome`, primeiro do roteiro das três portas). O nome tem que aparecer no texto da pessoa; a IA não inventa (`nomeValido`).
- A Gabi se apresenta **uma vez**: o contexto diz se ela já se apresentou (`aberturaEnviada`).
- A retomada (toques) pula o nome e retoma pela próxima pergunta do caso.
- Os números de menu saíram das portas (`menu: null`) e o `/api/validate` reprova se voltarem ou se a abertura tiver lista numerada.
- O laboratório do painel começa vazio: quem testa escreve o primeiro "oi" e passa pelo mesmo roteador do atendimento.

## Provas

- `npm test`: 17 testes novos do primeiro contato (número sozinho não trava assunto, abertura com e sem nome, segunda e terceira tentativa, equipe na quarta, fora do escopo, nome inventado descartado).
- `scripts/evals-triagem.ts`: 15 frases × 3 rodadas = 45/45 (assunto e nome) e 5 fluxos completos no laboratório (oi → nome → caso; nome no primeiro oi; anúncio direto; fora do escopo; já cliente).
- `EVAL_REPS=3 npm run evals`: 16 cenários × 3 = **48/48 aprovados**, nota 10 em todos (custo do agente US$ 0,13 na rodada inteira).

## O que a primeira rodada pegou e como foi corrigido

A primeira rodada completa deu 41/45. Duas falhas reais:

| Falha | Causa | Correção |
|---|---|---|
| Fora do escopo (2 de 3): recusou com o texto certo, mas não encerrou o card | A IA tentou `registrar_outro_assunto`, a ferramenta respondeu "faz parte do assunto atual, responda dentro do roteiro" e ela não chamou `finalizar_atendimento` | Alerta novo "assunto não bancário" em `CRM_MAP.alertas` (trabalhista, rescisão, pensão, divórcio, INSS, aposentadoria, aluguel…) com `finaliza`: se ela recusou com o texto padrão e não finalizou, o código finaliza como `fora_do_escopo`. A mensagem de erro da ferramenta agora aponta para a recusa. |
| Robô (2 de 3): confirmou que é assistente virtual e não continuou o caso | Regra do núcleo dizia só "siga a conversa normalmente"; o cenário tinha nome gravado sem o nome aparecer na conversa | Regra: "na mesma mensagem siga o atendimento com a próxima pergunta do caso". Cenário `bot` com o histórico coerente (abertura, "Maria", pergunta aberta) e cenário novo `bot-primeiro-contato` (robô no primeiro oi: confirma que é IA e pergunta o nome). |

Ajustes que vieram junto:
- **Apresentação também na recusa e na passagem para a equipe**: se a primeira mensagem já é de assunto não bancário ou de quem já é cliente, ela se apresenta antes ("Oi, Paulo! Aqui é a Gabi… Esse tipo de caso fica fora…"). `comApresentacao` em `lib/router.ts`, usada no atendimento e no laboratório.
- **Trava de abertura de chatbot**: resposta que começa com "Perfeito,", "Ótimo!", "Excelente." ou "Maravilha" não sai; a Gabi reescreve (`lib/regras.ts`). Pegou um "Perfeito, Ana." no laboratório.

## Resultado final (15/10/2026)

| Avaliação | Resultado |
|---|---|
| `npm test` (travas) | todas OK, 166 testes, 25 novos (primeiro contato, recusa, trava de chatbot) |
| Triagem: 15 frases × 3 | 45/45 (assunto e nome) |
| Fluxos do primeiro contato no laboratório | 5/5 |
| Conversa completa: 16 cenários × 3 | 48/48, nota 10 |
| Produção, laboratório do painel | oi → "Com quem eu falo, e o que você está procurando?" → Marcos → "Prazer, Marcos. Me conta…" → caso → porta Financiamento de veículo |

Publicado na Vercel: agente (telesstanquevicz-ia) e painel (central-telesstanquevicz). O `/api/validate` só aponta `KOMMO_BOT_ID` ausente, que é a entrada no ar da Gabi (robô de envio no Kommo), já esperada.
