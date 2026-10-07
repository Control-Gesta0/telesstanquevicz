/**
 * MAPA DO CRM — Teles & Stanquevicz Advogados (patch, nunca copie por cima).
 *
 * IDs lidos AO VIVO na conta 33277515 em 06/10/2026 (docs/01-descoberta-kommo.md).
 * Depois de qualquer mexida no funil ou nos campos: GET /api/validate.
 *
 *  1. PORTAS — RCPCC (dívida bancária), RCV (financiamento de veículo) e DBA
 *     (busca e apreensão). O resto vai para humano pela porta "geral".
 *  2. CAMPOS — quase tudo fica no ESTADO (id 0) e vai para a nota do card. Os
 *     ~80 campos de qualificação antigos estão mortos (menos de 40 leads em 6
 *     meses); o time trabalha pela nota/Observações. Observações é do time.
 *  3. NEGÓCIO — etapa de qualificado, responsável por valor da dívida, Calendly.
 *     Tudo determinístico: o modelo nunca escolhe etapa nem responsável.
 */

import type { Alerta, Campo, Etapa, Porta } from './crm-map-types'
export type { Alerta, Campo, CampoTipo, Etapa, Porta } from './crm-map-types'

const VALOR = /\d|mil|milh|cem\b|duzent|trezent|quatrocent|quinhent|reais|r\$/i

const CAMPOS = {
  // RCPCC
  tipoDivida: { key: 'tipoDivida', id: 0, name: 'Tipo de dívida (e banco, se disser)', type: 'text', sinal: /cart[aã]o|cheque|empr[eé]st|financ|consig|limite|fatura|cr[eé]dito|d[ií]vida|banco|ita[uú]|bradesco|santander|caixa|nubank|inter\b|brasil|sicredi|sicoob|c6|pan\b|bmg|agibank|mercado pago|picpay|neon|original|safra|banrisul/i, pergunta: 'Essa dívida é de cartão, cheque especial ou empréstimo?' },
  valorDivida: { key: 'valorDivida', id: 0, name: 'Valor aproximado da dívida', type: 'text', sinal: VALOR, pergunta: 'Mais ou menos quanto está a dívida hoje, somando tudo?' },
  atraso: { key: 'atraso', id: 0, name: 'Parcelas em atraso', type: 'text', sinal: /atras|em dia|parcela|pag|venc|\d|n[aã]o|sim|nenhuma/i, pergunta: 'Já tem parcela em atraso? Se tiver, quantas?' },
  // RCV
  bancoVeiculo: { key: 'bancoVeiculo', id: 0, name: 'Banco ou financeira do veículo', type: 'text', sinal: /[a-zà-ú]{2,}/i, pergunta: 'Por qual banco ou financeira foi feito o financiamento?' },
  parcelasTotal: { key: 'parcelasTotal', id: 0, name: 'Total de parcelas do financiamento', type: 'numeric', sinal: /\d|vezes|parcel|meses/i, pergunta: 'O financiamento foi feito em quantas parcelas?' },
  parcelasPagas: { key: 'parcelasPagas', id: 0, name: 'Parcelas já pagas', type: 'numeric', sinal: /\d|pag|nenhuma/i, pergunta: 'Quantas parcelas já foram pagas?' },
  valorParcela: { key: 'valorParcela', id: 0, name: 'Valor de cada parcela', type: 'numeric', sinal: VALOR, pergunta: 'Qual o valor de cada parcela?' },
  contrato: { key: 'contrato', id: 0, name: 'Tem o contrato do financiamento', type: 'text', sinal: /contrato|tenho|n[aã]o|sim|app|aplicativo|e-?mail/i, pergunta: 'Tem o contrato do financiamento em mãos?' },
  // DBA
  apreendido: { key: 'apreendido', id: 0, name: 'Veículo já apreendido', type: 'text', sinal: /apreend|levar|tomar|guinch|ainda n|n[aã]o|sim|j[aá]\b|comigo|recolh/i, pergunta: 'O veículo já foi apreendido?' },
  dataApreensao: { key: 'dataApreensao', id: 0, name: 'Data da apreensão', type: 'text', sinal: /\d|ontem|hoje|semana|m[eê]s|dia|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo|janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro/i, pergunta: 'Em que dia foi a apreensão?' },
  mandado: { key: 'mandado', id: 0, name: 'Recebeu cópia do mandado', type: 'text', sinal: /mandado|papel|c[oó]pia|deixou|n[aã]o|sim|recebi|oficial|documento/i, pergunta: 'O oficial de justiça deixou uma cópia do mandado com você?' },
  valorDividaDba: { key: 'valorDividaDba', id: 0, name: 'Quanto falta pagar do financiamento', type: 'text', sinal: VALOR, pergunta: 'Quanto falta pagar do financiamento, mais ou menos?' },
  // Agendamento (todas as portas)
  nomeCompleto: { key: 'nomeCompleto', id: 0, name: 'Nome completo', type: 'text', sinal: /[a-zà-ú]{2,}\s+[a-zà-ú]{2,}/i, pergunta: 'Pode me passar seu nome completo?' },
  email: { key: 'email', id: 0, name: 'E-mail', type: 'text', sinal: /\S+@\S+\.\S+/, pergunta: 'E qual o seu e-mail para receber o link da reunião?' },
} satisfies Record<string, Campo>

const BANCO_MONTADORA = /\bbanco\s+(toyota|volkswagen|vw|gm|chevrolet|honda|hyundai|renault|rci|fiat|stellantis|nissan|mercedes|bmw|volvo|yamaha|jeep|peugeot|citro[eë]n|mitsubishi|caoa|psa)\b|\b(rci|stellantis|psa) financ/i

export const CRM_MAP = {
  /** textarea que o Salesbot de envio lê. Criado no Passo 2 do playbook. */
  respostaFieldId: 0,

  /** a IA NUNCA escreve nestes campos: Observações (do time, tem nº de processo), processos, formulário */
  camposProibidos: [917704, 1009846, 1009860, 1047831, 1047825] as number[],

  campos: CAMPOS as Record<string, Campo>,

  portas: [
    {
      id: 'rcpcc',
      label: 'Dívida com banco (cartão, cheque especial, empréstimo)',
      menu: 1,
      ativa: true,
      promptFile: 'rcpcc.md',
      prioridade: 1,
      nichoEnumId: 744545,
      sinais: /\b(juros|cart[aã]o|cheque especial|empr[eé]stimos?|d[ií]vidas?|bancos?|serasa|nome sujo|negativad[oa]|fatura|conta corrente|limite|endividad[oa]|superendivid)/i,
      roteiro: ['tipoDivida', 'valorDivida', 'atraso', 'nomeCompleto', 'email'],
      obrigatorios: ['tipoDivida', 'valorDivida', 'nomeCompleto', 'email'],
      antesDeAgendar: ['tipoDivida', 'valorDivida'],
      abertura: 'Certo. Essa dívida é de cartão, cheque especial ou empréstimo?',
    },
    {
      id: 'rcv',
      label: 'Financiamento de veículo',
      menu: 2,
      ativa: true,
      promptFile: 'rcv.md',
      prioridade: 2,
      nichoEnumId: 744547,
      sinais: /\b(carro|ve[ií]culo|moto|caminh[aã]o|caminhonete|financiei|financiad[oa]|financiamento do (carro|ve[ií]culo)|parcela do carro)\b/i,
      roteiro: ['bancoVeiculo', 'parcelasTotal', 'parcelasPagas', 'valorParcela', 'contrato', 'nomeCompleto', 'email'],
      obrigatorios: ['bancoVeiculo', 'parcelasTotal', 'parcelasPagas', 'valorParcela', 'nomeCompleto', 'email'],
      antesDeAgendar: ['bancoVeiculo', 'parcelasTotal', 'parcelasPagas', 'valorParcela'],
      abertura: 'Certo. Por qual banco ou financeira foi feito o financiamento do veículo?',
    },
    {
      id: 'dba',
      label: 'Busca e apreensão do veículo',
      menu: 3,
      ativa: true,
      promptFile: 'dba.md',
      prioridade: 3,
      nichoEnumId: 744543,
      sinais: /busca e apreens|apreend|guinch|levaram (meu|o) (carro|ve[ií]culo|moto)|tomaram (meu|o) (carro|ve[ií]culo|moto)|mandado|oficial de justi/i,
      roteiro: ['apreendido', 'dataApreensao', 'mandado', 'valorDividaDba', 'nomeCompleto', 'email'],
      obrigatorios: ['apreendido', 'nomeCompleto', 'email'],
      antesDeAgendar: ['apreendido'],
      abertura: 'Entendi, vamos ver isso rápido. O veículo já foi apreendido?',
    },
    {
      id: 'geral',
      label: 'Outro assunto',
      menu: null,
      ativa: false,
      sinais: /$^/,
      roteiro: [],
      obrigatorios: [],
      mensagemSemAgente: 'Anotei aqui. Esse assunto quem vê é a equipe do escritório, e alguém continua a conversa com você por aqui.',
    },
  ] as Porta[],

  menu: {
    outros: 9,
    portaPadraoOutros: 'geral',
    classificarTextoLivre: true,
    texto: 'Oi, aqui é a Gabi, assistente virtual da Teles & Stanquevicz Advogados. Me conta qual é o seu caso, pode ser por texto ou áudio. Se preferir, responde só com o número:\n\n1. Dívida com banco (cartão, cheque especial, empréstimo)\n2. Financiamento de veículo\n3. Busca e apreensão do veículo\n9. Outro assunto',
    pedirResumo: 'Certo. Me conta em uma ou duas frases o que está acontecendo.',
    naoEntendi: 'Não consegui entender qual é o caso. Pode responder só com o número: 1, 2, 3 ou 9?',
  },

  finalizar: {
    removerGate: true,
    tags: [] as string[],
    tagUrgente: '' as string,
    nota: true,
  },

  alertas: [
    {
      nome: 'banco de montadora',
      re: BANCO_MONTADORA,
      aviso: 'O lead citou um banco de montadora. O escritório não atende financiamento feito por banco de montadora. Se ficou claro que o financiamento é desse banco, explique com respeito que esse caso fica fora do que o escritório atende e chame finalizar_atendimento(fora_do_escopo). Se ele citou só a marca do carro, pergunte por qual banco ou financeira foi feito.',
    },
    {
      nome: 'cliente do escritório',
      re: /j[aá] sou cliente|sou cliente de voc|meu processo (com|a[ií])|andamento do (meu )?processo|contrato (com|de) voc[eê]s|j[aá] contratei voc|minha advogada a[ií]|meu advogado a[ií]/i,
      aviso: 'Parece cliente do escritório. Não faça pitch nem perguntas de qualificação: diga que a equipe responsável vê o caso dele por aqui e chame finalizar_atendimento(pediu_humano).',
    },
    {
      nome: 'pagamento',
      re: /\bpix\b|boleto|pagar a entrada|dados banc|n[uú]mero da conta|link (de|do|pra|para) pagamento|chave/i,
      aviso: 'O lead falou de pagamento. Você nunca envia PIX, conta, boleto ou link de pagamento. Diga que a equipe manda os dados certos por aqui e chame finalizar_atendimento(pediu_humano).',
    },
  ] as Alerta[],

  /** o modelo NÃO move etapa: qualificado vai para AGENDAR REUNIÃO pelo código (negocio.etapaQualificado) */
  etapas: [] as Etapa[],
  /** status onde o lead é do time — a IA não mexe: ganho, perdido, NO SHOW, "dia" */
  etapasProtegidas: [142, 143, 72113011, 109569188] as number[],

  negocio: {
    pipelineId: 9299515,
    etapaQualificado: { id: 86825532, name: 'AGENDAR REUNIÃO' },
    etapaFollowUp: { id: 72104595, name: 'FOLLOW UP' },
    nicho: { fieldId: 1023263, kommoName: 'Nichos' },
    desqualificado: { fieldId: 1023548, kommoName: 'Desqualificado', enumRobo: 744848, valorRobo: 'Desqualificado robô' },
    reuniao: { fieldId: 719788, kommoName: 'Reunião', linkFieldId: 1012980, linkKommoName: 'Link da Reunião' },
    /** formulário Meta: os campos estão DESLOCADOS (o de "possui dívidas" guarda a faixa de valor). Lido pelo conteúdo. */
    formulario: { campos: [1047061, 1047063, 1047065, 1047067] },
    responsaveis: {
      limite: 50000,
      /** abaixo do limite: alterna Guilherme e Carla */
      abaixo: [11719359, 13015432],
      /** do limite para cima, ou valor desconhecido: SDR aquece antes da reunião */
      acima: 11719355,
      nomes: { 11719359: 'Guilherme', 13015432: 'Carla', 11719355: 'SDR' } as Record<number, string>,
    },
    /** tipo de tarefa do Kommo: 1 = Follow-up */
    tarefaTipo: 1,
    /** humano que recebe "pediu humano", "outro assunto" e falhas */
    responsavelPadrao: 11719355,
  },

  calendly: {
    /** ATENDIMENTO GERAL (30 min, Google Meet): 97 das 100 últimas reuniões */
    eventType: 'https://api.calendly.com/event_types/124acd98-cbd5-46cb-a23f-2473339a2996',
    antecedenciaMinHoras: 2,
    diasAFrente: 5,
    opcoes: 3,
  },

  textoSeguro: 'Entendi. Isso quem avalia é o advogado na reunião. Posso te fazer mais uma pergunta rápida?',
  textoSeguroFinal: 'Obrigada, anotei tudo. A equipe do escritório segue com você por aqui.',

  midia: {
    instrucaoVisao: 'Um lead de um escritório de advocacia bancária mandou este arquivo pelo WhatsApp. Descreva em português, em no máximo 4 frases: que documento é (mandado, contrato de financiamento, extrato, fatura, contracheque, print de app), quem emitiu, datas, valores, número de parcelas e nome do banco que estiverem legíveis. Não avalie direitos nem dê opinião jurídica. O que não estiver legível, diga "ilegível". Não copie CPF nem número de processo.',
  },
}

export const portaById = (id?: string) => CRM_MAP.portas.find(p => p.id === id)
export const campoByKey = (key: string) => CRM_MAP.campos[key]
