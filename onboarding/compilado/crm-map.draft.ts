// RASCUNHO GERADO — IDs precisam vir do CRM ao vivo.
export const CRM_MAP_DRAFT = {
  crm: "kommo",
  pipelineId: 9299515,
  pipelineName: "SDR",
  stages: [
    {
      id: 72104583,
      name: "Leads de entrada",
      quando: "Lead chegou (WhatsApp, formulário Meta ou site) e ninguém falou com ele ainda.",
      aiCanMove: false,
    },
    {
      id: 72104587,
      name: "NOVA OPORTUNIDADE",
      quando: "Lead em triagem inicial pelo SDR.",
      aiCanMove: false,
    },
    {
      id: 72186399,
      name: "RETORNO IMEDIATO",
      quando: "O lead respondeu e precisa de atendimento agora (a automação atual move para cá quando o lead escreve).",
      aiCanMove: false,
    },
    {
      id: 72113011,
      name: "NO SHOW",
      quando: "Faltou à reunião marcada. Etapa protegida: a IA não mexe.",
      aiCanMove: false,
    },
    {
      id: 86825532,
      name: "AGENDAR REUNIÃO",
      quando: "Caso dentro de RCPCC, RCV ou DBA, sem motivo de descarte, e o lead aceitou a reunião sem custo informando telefone ou vídeo, período preferido, nome completo e e-mail. O SDR confirma o encaixe na agenda do Dr. Carlos Eduardo.",
      aiCanMove: true,
    },
    {
      id: 109569188,
      name: "dia",
      quando: "Estacionamento de follow-up antigo trabalhado em lotes pelo SDR. A IA não mexe.",
      aiCanMove: false,
    },
    {
      id: 72104595,
      name: "FOLLOW UP",
      quando: "Cadência de recontato de lead que parou de responder. A IA não mexe.",
      aiCanMove: false,
    },
  ],
  stageOrder: [72104583, 72104587, 72186399, 72113011, 86825532, 109569188, 72104595],
  gateTag: "ia-gabi",
  humanTag: "atendimento-humano",
  aiLimit: "Agendado",
  recovery: {
    responseLabel: "a definir na rodada 4",
    goalLabel: "Lead chegou em AGENDAR REUNIÃO depois de um toque de follow-up (proposta)",
    goalSignal: {
    "type": "stage",
    "id": 86825532,
    "name": "AGENDAR REUNIÃO",
    "value": 86825532,
    "confirmed": false,
    "source": "crm-2026-10-06"
},
    attributionWindowHours: 168,
    assistedAttribution: true,
  },
} as const
