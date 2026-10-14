/**
 * E2E do rastreador num lead de TESTE: gera um clique (meta-rcv + fbclid), manda ao /api/inbound
 * uma mensagem simulada com o código e confere De onde + UTMs no card. Depois fecha o lead.
 *   npx tsx scripts/test-rastreio.ts
 */
import { loadEnv } from './env'
loadEnv()

async function main() {
  const { origemDoLink, registrarClique, linkWhatsapp } = await import('../lib/rastreio')
  const { CRM_MAP } = await import('../lib/crm-map')
  const { kommoGet } = await import('../lib/kommo')
  const D = process.env.KOMMO_DOMAIN!, h = { Authorization: `Bearer ${process.env.KOMMO_TOKEN}`, 'Content-Type': 'application/json' }
  const o = origemDoLink('meta-rcv', { utm_content: 'video-teste', fbclid: 'fbclid-teste-123' })!
  const codigo = await registrarClique(o)
  const link = linkWhatsapp('5500000000000', CRM_MAP.rastreio.links['meta-rcv'].texto, codigo)
  const texto = decodeURIComponent(link.split('text=')[1])
  console.log('clique registrado, código', codigo, '· mensagem que o lead mandaria:', texto)
  const c = await (await fetch(`${D}/api/v4/leads`, { method: 'POST', headers: h, body: JSON.stringify([{ name: 'TESTE rastreador de origem · pode ignorar', pipeline_id: 9299515, status_id: 72186399 }]) })).json()
  const id = c._embedded.leads[0].id
  const body = new URLSearchParams({ 'account[id]': process.env.KOMMO_ACCOUNT_ID!, 'message[add][0][id]': `teste-rastreio-${Date.now()}`, 'message[add][0][entity_id]': String(id), 'message[add][0][text]': texto, 'message[add][0][type]': 'incoming' })
  const r = await fetch(`${process.env.SELF_URL}/api/inbound?secret=${process.env.WEBHOOK_SECRET}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
  console.log('inbound simulado:', r.status, await r.text())
  await new Promise(x => setTimeout(x, 5000))
  const l = await kommoGet<any>(`/api/v4/leads/${id}`)
  const nomes: Record<number, string> = Object.fromEntries([...Object.entries(CRM_MAP.rastreio.campos).map(([n, i]) => [i, n]), [CRM_MAP.rastreio.deOnde.fieldId, 'De onde']])
  const lidos = (l.custom_fields_values || []).filter((f: any) => nomes[f.field_id]).map((f: any) => `${nomes[f.field_id]}=${f.values[0].value}`)
  console.log('lead', id, '→', lidos.join(' · ') || '(nada gravado)')
  const reuso = await fetch(`${process.env.SELF_URL}/api/inbound?secret=${process.env.WEBHOOK_SECRET}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...Object.fromEntries(body), 'message[add][0][id]': `teste-rastreio-reuso-${Date.now()}` }) })
  console.log('mesmo código de novo (deve ser ignorado como já usado):', reuso.status)
  await fetch(`${D}/api/v4/leads/${id}/notes`, { method: 'POST', headers: h, body: JSON.stringify([{ note_type: 'common', params: { text: 'Lead de TESTE do rastreador de origem (Control Gestão, 14/10). Fechado como perdido de propósito, pode ignorar.' } }]) })
  await fetch(`${D}/api/v4/leads`, { method: 'PATCH', headers: h, body: JSON.stringify([{ id, status_id: 143, pipeline_id: 9299515 }]) })
  console.log('teste encerrado')
  process.exit(lidos.length ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(1) })
