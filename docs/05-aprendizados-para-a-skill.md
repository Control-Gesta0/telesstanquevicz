# Aprendizados para propagar na skill (repositório da skill fora do escopo desta sessão)

Formato: sintoma → causa → cura → anticorpo → data/evidência.

1. **Formulário do anúncio gravado deslocado no Kommo.** O campo "Você possui dívidas bancárias ativas?" guarda a faixa de valor; "Qual o valor..." guarda a situação; e assim por diante. Causa: mapeamento da integração do formulário com um campo de diferença. Cura: ler as respostas pelo conteúdo (`respostasDoFormulario`), nunca pelo nome do campo. Anticorpo: no discover, conferir valores de amostra contra o nome do campo. 07/10/2026, 290 leads em 30 dias. → `kommo/PEGADINHAS.md`
2. **"A segunda" é ordinal ou segunda-feira.** Ao casar a escolha de horário, "segunda às 9h" virava a 2ª opção. Cura: com hora ou "feira" no texto, "segunda" é dia da semana; dia citado que não está nas opções não chuta. 07/10/2026, teste `escolha: "segunda às 9h"`. → `comum/PEGADINHAS.md`
3. **Trava de "está marcado" larga demais derruba o agendamento.** "Para deixar a reunião marcada, qual o seu e-mail?" caía na trava duas vezes e saía o texto seguro no meio do fluxo. Cura: travar só a afirmação ("ficou marcado", "já marquei"). Anticorpo: eval de fluxo completo com 5 repetições. 07/10/2026, `agenda-completa [2/3]`. → `comum/EVALS.md`
4. **Eco do que o lead disse.** "Então foi no Santander e são 48 parcelas" soa a robô; o juiz reprovou. Cura: regra explícita no núcleo. Tell novo para §5.1. 07/10/2026, `rcv-qualifica [2/3]`.
5. **Urgência some quando a instrução de agendar domina.** No DBA, 1 em 3 ofertas de horário saiu sem o aviso de prazo. Cura: frase obrigatória no próprio retorno da tool (`avisoAoAgendar`), não só no prompt da porta. 07/10/2026, `dba-urgente [1/3]`.
6. **Calendly Scheduling API.** `POST /invitees` responde validação de parâmetros (não 403 de plano) nesta conta; reserva real ainda a provar no E2E. Leitura de `event_type_available_times` funciona com token pessoal.
7. **Compiler exige anthropic/groq** mesmo com o template v2 em OpenAI (já registrado em ONBOARDING.md §8); segue valendo.
