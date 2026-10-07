# Decisões e trade-offs — Teles & Stanquevicz Advogados

| Decisão | Escolha | Por quê / preço |
|---|---|---|
| CRM | kommo | O histórico mora no Redis e o envio é indireto; ganha-se controle e assume-se a memória. |
| Canal | official | Voz outbound só existe com uazapi validada. |
| Alçada | Agendado | Depois de Agendado o closer humano assume. |
| Gate | ia-gabi | Rampagem segura: contato próprio → amostra → todos. |
| Handoff | atendimento-humano | Quando humano assume, IA e follow-up param na mesma volta. |
| Recuperação de conversa | O lead mandou mensagem depois de um toque de follow-up da IA | Mede retorno humano válido após envio. |
| Objetivo recuperado | O lead chegou em AGENDAR REUNIÃO até 7 dias depois do toque | Só conta com sinal verificável no CRM. |
| Janela de atribuição | 168h | Fora da janela não recebe crédito do follow-up. |
| Conversão assistida | sim | Handoff para humano é separado de conversão direta. |
| Preço | do-not-inform | Número volátil não pode ser inventado nem ficar sem dono. |
