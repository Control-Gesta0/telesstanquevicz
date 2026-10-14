/**
 * Traz para o Kommo as reuniões FUTURAS já marcadas no Calendly (antes da ponte existir).
 *   npx tsx scripts/backfill-calendly.ts [dias=7]
 */
import { loadEnv } from './env'
loadEnv()

async function main() {
  const { sincronizarConvidado } = await import('../lib/calendly-sync')
  const T = process.env.CALENDLY_TOKEN!, O = 'https://api.calendly.com/organizations/aa0cc176-04fe-48b6-afc4-2f7156f7cd84'
  const dias = Number(process.argv[2] || 7)
  const get = async (u: string) => (await fetch(u, { headers: { Authorization: `Bearer ${T}` } })).json()
  const ev = await get(`https://api.calendly.com/scheduled_events?organization=${O}&status=active&min_start_time=${new Date().toISOString()}&max_start_time=${new Date(Date.now() + dias * 86400_000).toISOString()}&count=100`)
  for (const e of ev.collection || []) {
    const inv = await get(`https://api.calendly.com/scheduled_events/${e.uri.split('/').pop()}/invitees?status=active`)
    for (const i of inv.collection || []) {
      const r = await sincronizarConvidado('invitee.created', { ...i, scheduled_event: { uri: e.uri, start_time: e.start_time, location: e.location } })
      console.log(e.start_time, '→', r)
    }
  }
  console.log(`${(ev.collection || []).length} reunião(ões) futura(s) em ${dias} dias`)
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
