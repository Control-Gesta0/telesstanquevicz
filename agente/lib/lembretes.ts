import { CRM_MAP } from './crm-map'
import { logExec } from './execlog'
import { kommoGet, runSalesbot, type KommoLead } from './kommo'
import { k, redis } from './redis'

/**
 * Lembretes de reunião (24h e 2h antes) pela Vercel. Relógio: agenda QStash a cada 15 min.
 *
 * Modo pela env LEMBRETES_MODO:
 *   "sombra" (padrão) → só registra no diário o que enviaria (para comparar com o Kommo)
 *   "ativo"           → roda o Salesbot do lembrete (modelo aprovado pela Meta)
 * A chave de "já enviado" é separada por modo: a sombra nunca impede o envio real depois.
 */

export interface Devido { leadId: number; nome: string; tipo: string; botId: number; reuniaoEm: number }

/** Puro: quais lembretes vencem agora. reuniaoEm em epoch SEGUNDOS (campo date_time do Kommo). */
export function lembretesDevidos(leads: Array<{ id: number; name?: string; reuniaoEm: number | null }>, agoraMs: number): Devido[] {
  const cfg = CRM_MAP.lembretes
  const out: Devido[] = []
  for (const l of leads) {
    if (!l.reuniaoEm) continue
    const reuniaoMs = l.reuniaoEm * 1000
    if (reuniaoMs <= agoraMs) continue
    for (const t of cfg.tipos) {
      const envioMs = reuniaoMs - t.antesMin * 60_000
      if (envioMs <= agoraMs && agoraMs - envioMs <= cfg.janelaMin * 60_000) out.push({ leadId: l.id, nome: l.name || '', tipo: t.id, botId: t.botId, reuniaoEm: l.reuniaoEm })
    }
  }
  return out
}

export interface LeadComReuniao { id: number; name?: string; reuniaoEm: number | null; statusId: number; pipelineId: number; responsavelId?: number }

export async function leadsComReuniao(): Promise<LeadComReuniao[]> {
  const cfg = CRM_MAP.lembretes
  const out: LeadComReuniao[] = []
  const filtro = cfg.etapas.map((e, i) => `filter[statuses][${i}][pipeline_id]=${e.pipelineId}&filter[statuses][${i}][status_id]=${e.statusId}`).join('&')
  for (let page = 1; page <= 20; page++) {
    const j = await kommoGet<{ _embedded?: { leads?: KommoLead[] } }>(`/api/v4/leads?limit=250&page=${page}&${filtro}`)
    const ls = j._embedded?.leads || []
    for (const l of ls) {
      const v = (l.custom_fields_values || []).find(f => f.field_id === cfg.campoReuniao)?.values?.[0]?.value
      out.push({ id: l.id, name: l.name, reuniaoEm: v ? Number(v) : null, statusId: l.status_id, pipelineId: l.pipeline_id, responsavelId: l.responsible_user_id })
    }
    if (ls.length < 250) break
  }
  return out
}

/** Diagnóstico: o que vence agora e as próximas reuniões, sem enviar nada. */
export async function previa(agoraMs = Date.now()) {
  const leads = await leadsComReuniao()
  const futuras = leads.filter(l => l.reuniaoEm && l.reuniaoEm * 1000 > agoraMs).sort((a, b) => (a.reuniaoEm || 0) - (b.reuniaoEm || 0))
  return {
    verificados: leads.length,
    venceAgora: lembretesDevidos(leads, agoraMs).map(d => `${d.leadId}:${d.tipo}`),
    proximasReunioes: futuras.slice(0, 15).map(l => ({ leadId: l.id, em: new Date((l.reuniaoEm || 0) * 1000).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) })),
  }
}

export async function rodarLembretes(agoraMs = Date.now()): Promise<{ modo: string; verificados: number; enviados: string[]; pulados: string[] }> {
  const modo = process.env.LEMBRETES_MODO === 'ativo' ? 'ativo' : 'sombra'
  const leads = await leadsComReuniao()
  const enviados: string[] = []
  const pulados: string[] = []
  for (const d of lembretesDevidos(leads, agoraMs)) {
    const chave = k(modo === 'ativo' ? 'lembrete' : 'lembrete-sombra', d.leadId, d.reuniaoEm, d.tipo)
    if ((await redis.set(chave, '1', { nx: true, ex: 3 * 86400 })) !== 'OK') { pulados.push(`${d.leadId}:${d.tipo}`); continue }
    const quando = new Date(d.reuniaoEm * 1000).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
    if (modo === 'ativo') {
      try {
        await runSalesbot(d.botId, d.leadId)
      } catch (e) {
        await redis.del(chave) // falhou: o próximo ciclo tenta de novo dentro da janela
        await logExec({ tipo: 'erro', leadId: d.leadId, nome: d.nome, detalhe: `lembrete ${d.tipo}: ${(e instanceof Error ? e.message : String(e)).slice(0, 200)}` })
        continue
      }
    }
    await logExec({ tipo: 'lembrete', leadId: d.leadId, nome: d.nome, detalhe: `${modo === 'ativo' ? 'enviado' : 'SOMBRA: enviaria'} lembrete ${d.tipo} (bot ${d.botId}) da reunião de ${quando}` })
    enviados.push(`${d.leadId}:${d.tipo}`)
  }
  return { modo, verificados: leads.length, enviados, pulados }
}
