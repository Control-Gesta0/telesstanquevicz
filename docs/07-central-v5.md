# 07 · Central de IA v5 (painel do cliente)

**No ar:** https://central-telesstanquevicz.vercel.app (projeto Vercel `central-telesstanquevicz`, time control-gestao, sem ligação com o Git; deploy só pela CLI).
**Versão:** `SISTEMA_VERSAO = 2026.10.14-v5` (agente/lib/central.ts).

## O que a v5 soma à v4.1

A estrutura é a do padrão (CENTRAL.md §1): 5 áreas, uma leitura por vez, tema claro/escuro, fail-closed, perfil dono × agência. O que a v5 acrescenta, nascido deste cliente (Kommo + automações fora do Kommo):

| Peça nova | Onde | Por quê |
|---|---|---|
| **Prontidão** | Visão Geral › O que está ligado · Configurações › Sistema | O cliente precisa ver o que já roda e o que falta (robô de envio, lembretes em sombra, número do WhatsApp) sem perguntar. "Quase no ar" é um estado próprio, diferente de "operando". |
| **Automações** | Operação › Automações | As regras que saíram dos robôs do Kommo (reunião realizada → Proposta, contrato pago → Jurídico, Calendly, origem) aparecem como gatilho e efeito, com cada execução. |
| **Agenda unificada** | Operação › Agenda | Reuniões lidas do campo Reunião, com responsável, + lembretes (modo sombra/ativo) + eventos do Calendly. |
| **Funil lado a lado** | Operação › Funil | Pedido do cliente: SDR e CLOSER com todas as etapas numa tela, sem rolar. Cada etapa diz como o card chega ali (Gabi, automático, equipe). |
| **Origem** | Resultados › Origem | De onde, campanha e links rastreados, 7 e 30 dias. |
| **Contagem limpa do Kommo** | Resultados › Resumo | Lead distinto por marco e **movimentação em massa fora** (mais de 5 mudanças do mesmo usuário no mesmo minuto). Em 30 dias, 1.077 das 1.127 "vendas ganhas" eram limpeza de funil. |
| **Laboratório com porta em memória** | Ensinar › Testar | A Gabi real (mesmo cérebro, mesmas travas) num card de mentira e com o Calendly falso. Mostra em português o que ela faria no Kommo. Limite de 150 mensagens por dia e 24 por conversa. |
| **Pedidos de ensino com régua** | Ensinar › Ensinar / Pedidos | A correção passa pela parte determinística da régua (§2): agenda, fora do escopo, funil ou jeito de conversar. Vira pedido, a agência roda os cenários e só publica se passarem. O dono nunca edita o prompt. |

Fica para depois (não instalado neste cliente): Shadow Lab (candidata de prompt), editor técnico, catálogo e base de conhecimento (o escritório não cota preço e tem pouco conteúdo).

## Arquitetura

```
navegador ──cookie assinado──▶ central (Next 14, Vercel)
                                  │  /api/dados, /api/acao, /api/login
                                  ▼  Authorization: Bearer CENTRAL_SECRET + x-central-perfil
                               agente /api/central  ──▶ Kommo (só leitura) · Redis (diário, cache) · Calendly (saúde)
```

- **Agente:** `agente/lib/central.ts` (dados e regras puras, testadas em `scripts/test-cliente.ts`) e `agente/api/central.ts`.
- **Central:** `central/` (Next.js 14.2.35, React 18.3.1, sem Tailwind; tokens em `app/globals.css`). Interpretação em `lib/inteligencia.ts` (briefing, radar e Pergunte à Central, zero token), testada em `scripts/test-central.ts`.
- **Cache:** funil 10 min, resultados e origem 15 min, agenda 5 min. Passou da idade, serve a leitura anterior e atualiza por trás; se a atualização falha, a anterior continua valendo. Fila única de no máximo 4 leituras simultâneas no Kommo (o limite da conta é 7 por segundo).

## Acesso

| Perfil | Senha | Vê |
|---|---|---|
| Escritório (dono) | `54321`, escolhida pelo cliente | tudo, menos mudar status de pedido de ensino e o custo do laboratório |
| Equipe técnica (agência) | gerada, guardada fora do repositório | tudo + muda status dos pedidos |

- A senha nunca fica em texto: o agente guarda o hash scrypt com sal (`CENTRAL_SENHA_DONO_HASH`, `CENTRAL_SENHA_AGENCIA_HASH`). Gerar: `npx tsx scripts/central-senha.ts '<senha>'`. Atenção: o hash tem `$`; grave na Vercel sem passar pelo shell.
- Freio: 8 tentativas por IP e 60 no total a cada 15 min. **Senha de 5 dígitos é fraca** mesmo com o freio; recomendação registrada para trocar por uma de 10+ caracteres.
- Sessão: cookie HttpOnly, Secure, SameSite=Lax, 12 h, HMAC com `SESSAO_SECRET`. Middleware é a primeira porta; toda rota confere de novo. POST de outra origem é recusado.
- `CENTRAL_SECRET` é separado do `WEBHOOK_SECRET` (que nunca sai do agente).
- PII: só primeiro nome; telefone, e-mail e CPF/processo saem do texto antes da tela.

**Envs.** Agente: `CENTRAL_SECRET`, `CENTRAL_SENHA_DONO_HASH`, `CENTRAL_SENHA_AGENCIA_HASH`, opcional `USD_BRL` (padrão 5,40) e `LAB_LIMITE_DIA`. Central: `AGENT_URL`, `CENTRAL_SECRET`, `SESSAO_SECRET`.

## Provas (14/10/2026)

- Agente: `tsc` limpo, `npm test` verde (24 testes novos da Central), funções rodadas contra o Kommo real: funil com 10.448 leads ativos no SDR em ~16 s (por isso o cache com leitura anterior), resultados 2,4 s, agenda 1,6 s.
- Central: `tsc` limpo, 18 testes, `next build` limpo; navegação de 21 telas em escuro/claro, 1440 e 390 px, sem overflow (`scrollWidth === clientWidth`) e sem esqueleto preso.
- Produção: sem sessão → /login e 401; cookie forjado → 401; senha errada → 401; 54321 → perfil dono; dono não muda status (403); POST de outra origem → 403; `X-Frame-Options: DENY`, `noindex`.
- Laboratório pela tela, em produção: RCV, a Gabi anotou banco, parcelas e valor, buscou horários na agenda falsa e ofereceu 3 opções. Custo R$ 0,024. Nada no Kommo.
- Fail-closed visto ao vivo: uma leitura de resultados falhou (limite do Kommo) e a tela mostrou "A Central não conseguiu ler: resultados" em vez de zeros. Daí a fila única e a leitura anterior em falha.

## Pendências

1. Trocar a senha 54321 por uma forte (pedido ao cliente).
2. Quando o robô de envio for ligado (`KOMMO_BOT_ID`), a Prontidão vira "ligada" sozinha e a primeira conversa inaugura o custo por resposta.
3. Confirmar o câmbio de `USD_BRL` antes de apresentar custo em reunião.

## Guia de uso para o cliente

`docs/Guia de uso - Central de IA - Teles & Stanquevicz.pdf` (18 páginas, prints reais de produção em 14/10/2026). Fonte em `docs/guia-central/` (HTML + prints). Para regenerar: `PW=$(npm root -g)/playwright HTML=$PWD/docs/guia-central/guia.html PDF=saida.pdf node docs/guia-central/gerar-pdf.mjs`; antes, `medir.mjs` confere se cada página planejada cabe nos 266 mm úteis do A4. A senha não aparece no guia: ela vai separada.
