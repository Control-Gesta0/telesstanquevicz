/**
 * E2E da ponte Calendly → Kommo num lead de TESTE (sem contato, sem tocar o Calendly real):
 * cria o lead, simula invitee.created e invitee.canceled apontando para ele e confere o card.
 *   npx tsx scripts/test-calendly-sync.ts
 */
import { loadEnv } from './env'
loadEnv()

async function main() {
  const { sincronizarConvidado } = await import('../lib/calendly-sync')
  const { kommoGet } = await import('../lib/kommo')
  const { k, redis } = await import('../lib/redis')
  const D = process.env.KOMMO_DOMAIN!, h = { Authorization: `Bearer ${process.env.KOMMO_TOKEN}`, 'Content-Type': 'application/json' }
  const c = await (await fetch(`${D}/api/v4/leads`, { method: 'POST', headers: h, body: JSON.stringify([{ name: 'TESTE ponte Calendly · pode ignorar', pipeline_id: 9299515, status_id: 72186399 }]) })).json()
  const id = c._embedded.leads[0].id
  const uri = `teste:invitee:${id}:${Date.now()}`
  await redis.set(k('cal-invitee', uri), id, { ex: 3600 })
  const inicio = new Date(Date.now() + 3 * 86400_000).toISOString().replace(/\.\d+Z$/, '.000000Z')
  const conv = { uri, name: 'Teste Ponte', email: 'teste@exemplo.com', scheduled_event: { uri: 'teste:evento', start_time: inicio, location: { join_url: 'https://meet.google.com/teste-ponte' } } }
  const ler = async () => { const l = await kommoGet<any>(`/api/v4/leads/${id}`); const f = (fid: number) => (l.custom_fields_values || []).find((x: any) => x.field_id === fid)?.values?.[0]?.value ?? null; return { etapa: l.status_id, reuniao: f(719788), link: f(1012980) } }
  console.log('lead de teste', id, 'antes:', await ler())
  console.log('created →', await sincronizarConvidado('invitee.created', conv as any), await ler())
  console.log('canceled →', await sincronizarConvidado('invitee.canceled', { ...conv, cancellation: { reason: 'teste', canceled_by: 'Teste' } } as any), await ler())
  const notas = await kommoGet<any>(`/api/v4/leads/${id}/notes?limit=10`)
  console.log('notas:', (notas._embedded?.notes || []).map((n: any) => n.params?.text).join(' | '))
  const tarefas = await kommoGet<any>(`/api/v4/tasks?filter[entity_type]=leads&filter[entity_id][0]=${id}`)
  console.log('tarefas:', (tarefas._embedded?.tasks || []).map((t: any) => t.text).join(' | '))
  // encerra o teste: conclui a tarefa e fecha o lead como perdido com nota
  for (const t of tarefas._embedded?.tasks || []) await fetch(`${D}/api/v4/tasks/${t.id}`, { method: 'PATCH', headers: h, body: JSON.stringify({ is_completed: true, result: { text: 'teste' } }) })
  await fetch(`${D}/api/v4/leads/${id}/notes`, { method: 'POST', headers: h, body: JSON.stringify([{ note_type: 'common', params: { text: 'Lead de TESTE da ponte Calendly → Kommo (Control Gestão, 14/10). Fechado como perdido de propósito, pode ignorar.' } }]) })
  await fetch(`${D}/api/v4/leads`, { method: 'PATCH', headers: h, body: JSON.stringify([{ id, status_id: 143, pipeline_id: 9299515 }]) })
  console.log('teste encerrado:', await ler())
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
