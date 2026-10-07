# Template agente Kommo v2 — Desenho A (Salesbot) · OpenAI · portas

> **Status honesto (16/09/2026):** construído a partir do template Kommo do curso
> (`agente-ia-crm/assets/kommo`) + travas do agente Filipe Oliveira (GHL, em
> produção desde 14/09/2026). **Provas feitas:** `tsc` limpo e `npm test`
> 32/32 (travas, roteador, parser do webhook, finalização). **Ainda NÃO
> provado:** E2E em número real no Kommo, `tags_to_delete` na API v4, evals
> com cenários de cliente. Primeiro cliente: MTF Advocacia (migração do n8n).
> Não chame de "validado em produção" até o primeiro E2E.

## O que ele é

Um agente, N **portas** (assuntos). O roteador em código trava a porta (menu
numérico ou sinal inequívoco no texto) e o cérebro carrega **só** o prompt
daquela porta: `prompts/nucleo.md` + `prompts/portas/<porta>.md`. Isso mantém
cada chamada em ~6–8k tokens com cache, em vez de um prompt de 25k+ com regras
de uma porta vazando na outra.

```
add_message (Kommo) → /api/inbound (200 imediato)
  → dedup → mídia vira texto (OpenAI, uma vez) → anti-eco → histórico Redis
  → gate por tag → humano falou nas últimas 6h? recua
  → buffer 10s → roteador (código) ─ menu/"não entendi" → envia sem LLM
                                   └ porta travada → GPT-5.4 Mini + tools → travas
  → deposita no campo de resposta + outbox → salesbot/run → WhatsApp
```

## Asset × patch (a regra que evita destruir cliente)

| Asset — copia inteiro, atualiza por cima | Patch — do cliente, NUNCA sobrescreva |
|---|---|
| `lib/agent.ts` `buffer.ts` `config.ts` `crm-map-types.ts` `execlog.ts` `guards.ts` `history.ts` `kommo.ts` `llm.ts` `media.ts` `port.ts` `redis.ts` `reset.ts` `router.ts` `state.ts` `tools.ts` `transport.ts` | `lib/crm-map.ts` · `lib/regras.ts` |
| `api/*` | `prompts/nucleo.md` · `prompts/portas/*` |
| `scripts/env.ts` `discover.ts` `evals.ts` `simulate-inbound.ts` `create-webhook.ts` `test-guards.ts` | `scripts/test-cliente.ts` · `evals/cenarios.ts` |
| `package.json` `tsconfig.json` `vercel.json` | `.env.local` · envs da Vercel · `.vercel/` |

## Instalação (ordem obrigatória)

1. Copie a pasta inteira para o projeto do cliente → `npm install`.
2. `.env.local` a partir do `.env.local.example`. **Token do Kommo começa com `eyJ`.**
3. `npm run discover` → leia: funis, campos (enums), tags, webhooks de terceiros,
   canal (`waba`?), campo alterado por integração (campo de resposta do bot antigo).
4. `lib/crm-map.ts`: portas, campos com `sinal` e `pergunta`, `camposProibidos`,
   `respostaFieldId`, `finalizar`, `etapas` (vazio se a IA não move etapa).
5. Prompts: `nucleo.md` (comum) + uma porta por arquivo. Nada de dado inventado.
6. `lib/regras.ts` + `scripts/test-cliente.ts` (cada regra: bloqueia × passa).
7. `npm run typecheck && npm test` → verde.
8. `evals/cenarios.ts` → `EVAL_REPS=3 npm run evals` → **todos aprovados ou não sobe**.
9. Vercel: `vercel link`, envs, `vercel deploy --prod`. `GET /api/inbound` (health) e
   `GET /api/validate?secret=` → `ok:true`.
10. Webhook: `npx tsx scripts/create-webhook.ts` (lista) → confirme com o responsável →
    `--criar`.
11. E2E: lead de teste com a tag de gate e em `TEST_LEAD_IDS` → WhatsApp real →
    confira mensagem no celular, card, tags e `/api/executions`. `reset` recomeça.
12. Rampagem: 1 lead → 10 → todos. Na migração do n8n, siga `MIGRACAO-N8N.md`.

## Envs

`KOMMO_DOMAIN` `KOMMO_TOKEN` `KOMMO_ACCOUNT_ID` `KOMMO_BOT_ID` · `OPENAI_API_KEY`
`LLM_MODEL` `VISION_MODEL` `STT_MODEL` · `UPSTASH_REDIS_REST_URL`
`UPSTASH_REDIS_REST_TOKEN` `REDIS_PREFIX` (único por cliente) · `WEBHOOK_SECRET`
(novo por cliente) `CLIENT_NAME` `GATE_TAG` `HUMAN_TAG` `DEBOUNCE_SECONDS`
`TEST_LEAD_IDS`.

## Fora deste template (de propósito)

- **Desenho B / uazapi / voz:** use o template do curso (`agente-ia-crm/assets/kommo`).
- **Follow-up:** não incluído. Em WABA, toque depois de 24h exige template aprovado
  (`kommo/PEGADINHAS.md §9`) e o motor precisa de fila com claim atômico (§10).
- **Central / Escola:** instalar depois, pela ordem canônica do `CENTRAL.md`.
- **Responses API (raciocínio + tools):** só Chat Completions com reasoning none
  (`comum/PEGADINHAS.md §50`). Troque o adapter se o bake-off pedir.
