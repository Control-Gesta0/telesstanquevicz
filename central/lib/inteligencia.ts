import { brl, num, plural } from './formato'
import type { DadosFunil, Etapa, Visao } from './tipos'

/**
 * A camada que interpreta (padrão v4.1/v5): número e recomendação calculados em
 * código, zero token. Nada aparece como "saudável" antes de as fontes responderem.
 */

export type Tom = 'calmo' | 'atencao' | 'critico' | 'oportunidade' | 'aprendizado'

export interface Decisao { id: string; tom: Tom; titulo: string; evidencia: string; impacto: string; acao: string; href: string }

export interface Briefing { estado: 'verificando' | 'atencao' | 'quase' | 'bem'; saudacao: string; resumo: string; decisoes: Decisao[] }

const PESO: Record<Tom, number> = { critico: 0, atencao: 1, oportunidade: 2, calmo: 3, aprendizado: 4 }

export const ETAPA_REUNIAO = 86825532
const FUNIL_CLOSER = 9312103

export function montarBriefing(v: Visao | null, agente = 'Stela'): Briefing {
  if (!v) return { estado: 'verificando', saudacao: 'Estou conferindo as fontes da operação.', resumo: 'O resumo só aparece depois que Kommo, diário e agenda responderem. Até lá, nenhuma conclusão é inventada.', decisoes: [] }

  const decisoes: Decisao[] = []
  const falhas = [
    !v.funil.ok && 'funil do Kommo', !v.diario.ok && 'diário', !v.agenda.ok && 'agenda', !v.saude.ok && 'sistema', !v.resultados.ok && 'resultados',
    ...(v.saude.ok ? v.saude.dados.fontes.filter(f => !f.ok).map(f => f.fonte) : []),
  ].filter(Boolean) as string[]
  if (falhas.length) {
    decisoes.push({
      id: 'fontes', tom: 'critico', titulo: `A Central não conseguiu ler: ${falhas.join(', ')}`,
      evidencia: 'Enquanto essa fonte não responde, os números dela ficam em branco em vez de aparecerem errados.',
      impacto: 'Se continuar assim depois de atualizar, avise a equipe técnica.', acao: 'Ver o sistema', href: '/configuracoes?aba=sistema',
    })
  }

  const m = v.diario.ok ? v.diario.dados.metricas : null
  if (m && m.h24.erros > 0) {
    decisoes.push({
      id: 'erros', tom: m.h24.erros >= 3 ? 'critico' : 'atencao', titulo: `${plural(m.h24.erros, 'falha', 'falhas')} nas últimas 24 horas`,
      evidencia: `O diário registrou ${plural(m.h24.erros, 'execução que não terminou', 'execuções que não terminaram')}.`,
      impacto: 'Pode ter lead esperando resposta ou automação pela metade.', acao: 'Abrir o histórico', href: '/operacao?aba=historico&filtro=erro',
    })
  }

  const pr = v.saude.ok ? v.saude.dados.prontidao : []
  const gabi = pr.find(i => i.id === 'gabi')
  if (gabi && !gabi.ok) {
    decisoes.push({
      id: 'gabi', tom: 'atencao', titulo: `A ${agente} ainda não responde no WhatsApp`,
      evidencia: `${gabi.oQueFalta || 'Falta ligar o envio.'} Até lá, os leads seguem com a equipe como hoje.`,
      impacto: 'Automações, agenda, lembretes em teste e origem já estão no ar.', acao: 'Ver o que falta', href: '/configuracoes?aba=sistema',
    })
  }

  if (v.funil.ok) {
    const closerParado = v.funil.dados.funis.find(f => f.id === FUNIL_CLOSER)?.etapas.filter(e => e.parados > 0) || []
    const nCloser = closerParado.reduce((s, e) => s + e.parados, 0)
    if (nCloser > 0) {
      decisoes.push({
        id: 'closer', tom: 'critico', titulo: `${plural(nCloser, 'card parado', 'cards parados')} no CLOSER há 7 dias ou mais`,
        evidencia: closerParado.map(e => `${e.nome}: ${num(e.parados)}`).join(' · '),
        impacto: 'É a etapa mais perto do contrato. Cada semana parada esfria a proposta.', acao: 'Ver quem está parado', href: '/resultados?aba=radar',
      })
    }
    const reuniao = v.funil.dados.funis.flatMap(f => f.etapas).find(e => e.id === ETAPA_REUNIAO)
    if (reuniao && reuniao.parados >= 10) {
      decisoes.push({
        id: 'reuniao', tom: 'oportunidade', titulo: `${num(reuniao.parados)} cards em Reunião agendada sem mudança há 7 dias ou mais`,
        evidencia: 'Na maioria são reuniões que já passaram e não foram marcadas como realizada ou no-show.',
        impacto: 'Enquanto ficam ali, o funil parece cheio e a taxa de comparecimento fica escondida.', acao: 'Ver o radar', href: '/resultados?aba=radar',
      })
    }
  }

  if (v.agenda.ok && (v.agenda.dados.hoje || v.agenda.dados.amanha)) {
    const a = v.agenda.dados
    decisoes.push({
      id: 'agenda', tom: 'calmo', titulo: a.hoje ? `${plural(a.hoje, 'reunião', 'reuniões')} hoje` : `${plural(a.amanha, 'reunião', 'reuniões')} amanhã`,
      evidencia: `${plural(a.seteDias, 'reunião marcada', 'reuniões marcadas')} nos próximos 7 dias.`,
      impacto: 'Confira quem é o responsável por cada uma antes do horário.', acao: 'Abrir a agenda', href: '/operacao?aba=agenda',
    })
  }

  if (v.agenda.ok && v.agenda.dados.lembretes.modo === 'sombra') {
    decisoes.push({
      id: 'lembretes', tom: 'aprendizado', titulo: 'Lembretes de reunião em modo sombra',
      evidencia: 'A Central já calcula quem recebe lembrete 24h e 2h antes, sem enviar. Quem envia ainda são os robôs do Kommo.',
      impacto: 'Na comparação, o Kommo deixou de mandar o lembrete de 2h em duas reuniões.', acao: 'Ver a agenda', href: '/operacao?aba=agenda',
    })
  }

  decisoes.sort((a, b) => PESO[a.tom] - PESO[b.tom])
  const estado: Briefing['estado'] = falhas.length || (m?.h24.erros || 0) > 0 ? 'atencao' : gabi && !gabi.ok ? 'quase' : 'bem'
  const saudacao = falhas.length ? 'A Central não conseguiu ler tudo agora.'
    : estado === 'atencao' ? `A ${agente} está atendendo, mas há pontos de atenção.`
    : estado === 'quase' ? `Tudo pronto em volta da ${agente}. Falta ligar o envio no WhatsApp.`
    : `A ${agente} está atendendo sem falha registrada.`
  const partes = [
    m ? `${plural(m.h24.conversas, 'conversa', 'conversas')} da ${agente} em 24h` : '',
    v.agenda.ok ? `${plural(v.agenda.dados.seteDias, 'reunião', 'reuniões')} nos próximos 7 dias` : '',
    v.resultados.ok ? `${plural(v.resultados.dados.marcos.find(x => x.id === 'agendadas')?.seteDias || 0, 'reunião marcada', 'reuniões marcadas')} na última semana` : '',
  ].filter(Boolean)
  return { estado, saudacao, resumo: `${partes.join(' · ')}.`, decisoes: decisoes.slice(0, 4) }
}

// ─────────────── radar de dinheiro parado ───────────────

export interface Sinal { etapa: Etapa; funil: string; tom: Tom; titulo: string; explicacao: string }

const POR_QUE: Record<number, string> = {
  72104583: 'Lead novo que ninguém atendeu ainda.',
  72186399: 'Conversa que parou no meio.',
  86825532: 'Em geral, reunião que já passou e não foi marcada como realizada ou no-show.',
  72113011: 'Faltou e ainda não foi remarcado.',
  72186407: 'Entrou no CLOSER e não andou.',
  72851523: 'Reunião feita, proposta sem resposta.',
  72686979: 'Contrato enviado e não assinado.',
  72186419: 'Contrato assinado, pagamento não confirmado.',
}

export function montarRadar(f: DadosFunil | null): Sinal[] {
  if (!f) return []
  return f.funis.flatMap(fu => fu.etapas.filter(e => e.radar && e.parados > 0).map(e => ({
    etapa: e, funil: fu.nome, tom: (fu.id === FUNIL_CLOSER ? 'critico' : 'oportunidade') as Tom,
    titulo: `${plural(e.parados, 'parado', 'parados')} em ${e.nome}`,
    explicacao: `${POR_QUE[e.id] || 'Sem mudança registrada há 7 dias ou mais.'}${e.valor ? ` ${brl(e.amostras.reduce((s, a) => s + a.valor, 0), 0)} nos maiores.` : ''}`,
  }))).sort((a, b) => PESO[a.tom] - PESO[b.tom] || b.etapa.parados - a.etapa.parados)
}

// ─────────────── pergunte à Central ───────────────

export interface Resposta { resposta: string; evidencias: string[]; href?: string; rotulo?: string }

export function responder(perguntaCrua: string, v: Visao | null, agente = 'Stela'): Resposta {
  const q = perguntaCrua.toLowerCase()
  if (!v) return { resposta: 'Ainda estou lendo o Kommo e o diário.', evidencias: ['Espere as fontes responderem e pergunte de novo.'] }
  const m = v.diario.ok ? v.diario.dados.metricas : null

  if (/custo|gasto|gast|token|caro|pre[cç]o da ia|quanto (custa|gasta)/.test(q)) {
    if (!m) return { resposta: 'O diário não respondeu agora, então não sei o custo.', evidencias: [] }
    return {
      resposta: m.d30.execucoesComCusto ? `Nos últimos 30 dias a ${agente} custou ${brl(m.d30.custoBrl)} em IA, ${brl(m.d30.custoBrl / Math.max(1, m.d30.execucoesComCusto), 3)} por resposta.` : `Ainda não há resposta da ${agente} com custo medido. O custo aparece a partir da primeira conversa real.`,
      evidencias: [`Hoje: ${brl(m.h24.custoBrl)}`, `7 dias: ${brl(m.d7.custoBrl)}`, 'Custo estimado por execução. A fatura do provedor fecha o valor.'],
      href: '/resultados?aba=resumo', rotulo: 'Abrir resultados',
    }
  }
  if (/erro|falh|quebr|problema|sa[uú]de|funcionando/.test(q)) {
    return {
      resposta: m ? (m.h24.erros ? `Encontrei ${plural(m.h24.erros, 'falha', 'falhas')} nas últimas 24 horas.` : 'O diário não registrou falha nas últimas 24 horas.') : 'O diário não respondeu agora.',
      evidencias: v.saude.ok ? v.saude.dados.fontes.map(f => `${f.fonte}: ${f.ok ? `ok (${f.ms} ms)` : 'sem resposta'}`) : [],
      href: '/operacao?aba=historico', rotulo: 'Abrir o histórico',
    }
  }
  if (/parad|dinheiro|oportunidade|esquecid|radar|proposta/.test(q)) {
    const radar = montarRadar(v.funil.ok ? v.funil.dados : null)
    const total = radar.reduce((s, r) => s + r.etapa.parados, 0)
    return {
      resposta: total ? `Há ${plural(total, 'card parado', 'cards parados')} há 7 dias ou mais nas etapas que contam (o Follow-up fica de fora porque é estacionamento).` : 'Não encontrei card parado há 7 dias ou mais nas etapas que contam.',
      evidencias: radar.slice(0, 4).map(r => `${r.funil} › ${r.etapa.nome}: ${num(r.etapa.parados)}`),
      href: '/resultados?aba=radar', rotulo: 'Abrir o radar',
    }
  }
  if (/funil|etapa|quantos leads|sdr|closer/.test(q)) {
    if (!v.funil.ok) return { resposta: 'O funil do Kommo não respondeu agora.', evidencias: [] }
    return {
      resposta: v.funil.dados.funis.map(f => `${f.nome}: ${plural(f.n, 'lead ativo', 'leads ativos')}`).join(' · '),
      evidencias: v.funil.dados.funis.flatMap(f => f.etapas.map(e => `${f.nome} › ${e.nome}: ${num(e.n)}`)),
      href: '/operacao?aba=funil', rotulo: 'Abrir o funil',
    }
  }
  if (/reuni|agenda|marcad|calendly|lembrete/.test(q)) {
    if (!v.agenda.ok) return { resposta: 'A agenda não respondeu agora.', evidencias: [] }
    const a = v.agenda.dados
    return {
      resposta: `${plural(a.hoje, 'reunião', 'reuniões')} hoje, ${num(a.amanha)} amanhã e ${num(a.seteDias)} nos próximos 7 dias. Lembretes: ${a.lembretes.modo === 'ativo' ? 'enviando' : 'em modo sombra'}.`,
      evidencias: a.proximas.slice(0, 4).map(r => `${r.quando} · ${r.nome}${r.responsavel ? ` · ${r.responsavel}` : ''}`),
      href: '/operacao?aba=agenda', rotulo: 'Abrir a agenda',
    }
  }
  if (/ligad|falta|pronto|no ar|whatsapp|go.?live|quando (come|liga)/.test(q)) {
    const pr = v.saude.ok ? v.saude.dados.prontidao : []
    const faltam = pr.filter(i => !i.ok)
    return {
      resposta: faltam.length ? `${plural(faltam.length, 'item falta', 'itens faltam')} para tudo ficar ligado.` : 'Está tudo ligado.',
      evidencias: pr.map(i => `${i.ok ? '✓' : '○'} ${i.nome}: ${i.estado}`),
      href: '/configuracoes?aba=sistema', rotulo: 'Ver o sistema',
    }
  }
  if (/origem|campanha|an[uú]ncio|meta|google|instagram|de onde/.test(q)) {
    return { resposta: 'A origem dos leads está em Resultados › Origem, com os últimos 7 e 30 dias.', evidencias: ['Mostra De onde, campanha e cliques nos links rastreados.'], href: '/resultados?aba=origem', rotulo: 'Abrir origem' }
  }
  if (/ensin|corrig|errou|resposta|testar|regra/.test(q)) {
    return { resposta: `Em Ensinar você conversa com a ${agente} como se fosse um lead, aponta o que ficou torto e escreve como deveria ser.`, evidencias: ['O teste não toca o Kommo nem a agenda.', 'A correção só é publicada depois de passar nos cenários de teste.'], href: '/cerebro', rotulo: 'Ensinar agora' }
  }
  return {
    resposta: m ? `Em 24h: ${plural(m.h24.conversas, 'conversa', 'conversas')} da ${agente}, ${plural(m.h24.automacoes, 'automação', 'automações')} e ${plural(m.h24.erros, 'falha', 'falhas')}.` : 'O diário não respondeu agora.',
    evidencias: ['Resposta calculada aqui, sem usar IA.', 'Pergunte sobre custo, falhas, parados, funil, reuniões, origem ou o que falta ligar.'],
  }
}
