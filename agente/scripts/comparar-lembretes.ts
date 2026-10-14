/**
 * Sombra × Kommo: para cada reunião com data no Kommo, os lembretes que a Vercel registrou
 * (modo sombra) batem com as mensagens que o Kommo mandou (bots 10528/10530)?
 *   npx tsx scripts/comparar-lembretes.ts [horas=48]
 * Critério para ligar o modo ativo: toda linha "Kommo enviou" tem "sombra registrou" e vice-versa.
 */
import { loadEnv } from './env'

loadEnv()

async function main() {
  const { CRM_MAP } = await import('../lib/crm-map')
  const { kommoGet } = await import('../lib/kommo')
  const { readExecs } = await import('../lib/execlog')
  const horas = Number(process.argv[2] || 48)
  const agora = Date.now()
  const desde = agora - horas * 3600_000
  const cfg = CRM_MAP.lembretes
  const sombra = (await readExecs(2000)).filter(e => e.tipo === 'lembrete' && Date.parse(e.at) >= desde)
  const filtro = cfg.etapas.map((e, i) => `filter[statuses][${i}][pipeline_id]=${e.pipelineId}&filter[statuses][${i}][status_id]=${e.statusId}`).join('&')
  // Leads com reunião no período (inclui os que já saíram das etapas: busca por atualização recente)
  const leads: any[] = []
  for (const q of [filtro, `filter[updated_at][from]=${Math.floor(desde / 1000) - 3 * 86400}`]) {
    for (let p = 1; p <= 30; p++) {
      const j = await kommoGet<any>(`/api/v4/leads?limit=250&page=${p}&${q}`)
      const ls = j._embedded?.leads || []
      leads.push(...ls)
      if (ls.length < 250) break
    }
  }
  const vistos = new Set<number>()
  const linhas: string[] = []
  let divergencias = 0
  for (const l of leads) {
    if (vistos.has(l.id)) continue
    vistos.add(l.id)
    const v = Number((l.custom_fields_values || []).find((f: any) => f.field_id === cfg.campoReuniao)?.values?.[0]?.value || 0) * 1000
    if (!v) continue
    for (const t of cfg.tipos) {
      const envio = v - t.antesMin * 60_000
      if (envio < desde || envio > agora) continue
      const de = Math.floor((envio - 30 * 60_000) / 1000), ate = Math.floor((envio + 45 * 60_000) / 1000)
      const ev = await kommoGet<any>(`/api/v4/events?limit=50&filter[entity]=lead&filter[entity_id][0]=${l.id}&filter[type]=outgoing_chat_message&filter[created_at][from]=${de}&filter[created_at][to]=${ate}`)
      const kommo = (ev._embedded?.events || []).filter((e: any) => e.created_by === 0).length > 0
      const viu = sombra.some(e => e.leadId === l.id && (e.detalhe || '').includes(`lembrete ${t.id}`))
      if (kommo !== viu) divergencias++
      linhas.push(`${kommo === viu ? '✅' : '❌'} lead ${l.id} · lembrete ${t.id} · reunião ${new Date(v).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · Kommo ${kommo ? 'enviou' : 'não enviou'} · sombra ${viu ? 'registrou' : 'não registrou'}`)
    }
  }
  console.log(linhas.join('\n') || '(nenhum lembrete venceu no período)')
  console.log(`\n${linhas.length} lembrete(s) no período · ${divergencias} divergência(s) · sombra registrou ${sombra.length}`)
  process.exit(divergencias ? 1 : 0)
}
main().catch(e => { console.error(e); process.exit(1) })
