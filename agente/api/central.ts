import crypto from 'crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  agenda, atualizarEnsino, criarEnsino, custoLaboratorioMes, diario, entrar, filaRetomada, funil, laboratorio,
  listarEnsino, origem, regras, resultados, saude, SISTEMA_VERSAO, type PedidoEnsino,
} from '../lib/central'

/**
 * Dados da Central v5. Só a Central chama, com Authorization: Bearer CENTRAL_SECRET
 * (segredo próprio: o WEBHOOK_SECRET nunca sai do agente). O perfil vem do cookie
 * assinado da Central, no header x-central-perfil.
 *
 * GET  ?secao=visao|funil|resultados|origem|agenda|diario|retomada|regras|ensino|saude[&fresco=1]
 * POST { acao: 'login' | 'ensino' | 'ensino-status' | 'laboratorio', ... }
 */

// O laboratório nunca toca a agenda real: esta função roda isolada das outras.
process.env.CALENDLY_FAKE = '1'

function autorizado(req: VercelRequest): boolean {
  const esperado = process.env.CENTRAL_SECRET || ''
  const veio = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!esperado || veio.length !== esperado.length) return false
  return crypto.timingSafeEqual(Buffer.from(veio), Buffer.from(esperado))
}

async function fonte<T>(fn: () => Promise<T>): Promise<{ ok: true; dados: T } | { ok: false; erro: string }> {
  try { return { ok: true, dados: await fn() } } catch (e) {
    console.error('[central]', e)
    return { ok: false, erro: (e instanceof Error ? e.message : String(e)).slice(0, 200) }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (!autorizado(req)) return res.status(401).json({ error: 'unauthorized' })
  const perfil = String(req.headers['x-central-perfil'] || 'dono') === 'agencia' ? 'agencia' : 'dono'

  try {
    if (req.method === 'POST') {
      const b = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}) as Record<string, any>
      if (b.acao === 'login') return res.status(200).json(await entrar(String(b.senha || ''), String(b.ip || '')))
      if (b.acao === 'ensino') return res.status(200).json({ ok: true, pedido: await criarEnsino({ perfil, texto: b.texto, exemplo: b.exemplo }) })
      if (b.acao === 'ensino-status') {
        if (perfil !== 'agencia') return res.status(403).json({ error: 'só a agência muda o status' })
        return res.status(200).json({ ok: await atualizarEnsino(String(b.id), b.status as PedidoEnsino['status'], b.nota) })
      }
      if (b.acao === 'laboratorio') return res.status(200).json({ ok: true, ...(await laboratorio({ sessao: b.sessao, porta: b.porta, msg: b.msg })) })
      return res.status(400).json({ error: 'acao desconhecida' })
    }

    const secao = String(req.query.secao || 'visao')
    const fresco = req.query.fresco === '1'
    if (secao === 'visao') {
      const [s, f, a, d, r, fila] = await Promise.all([fonte(saude), fonte(() => funil(fresco)), fonte(() => agenda(fresco)), fonte(() => diario(600)), fonte(() => resultados(fresco)), fonte(filaRetomada)])
      return res.status(200).json({
        versao: SISTEMA_VERSAO, perfil, saude: s, funil: f, agenda: a, resultados: r, retomada: fila,
        diario: d.ok ? { ok: true, dados: { metricas: d.dados.metricas, recentes: d.dados.execs.slice(0, 8), maisAntigo: d.dados.maisAntigo } } : d,
      })
    }
    const mapa: Record<string, () => Promise<unknown>> = {
      saude, funil: () => funil(fresco), resultados: () => resultados(fresco), origem: () => origem(fresco), agenda: () => agenda(fresco),
      diario: () => diario(Number(req.query.limit || 600)), retomada: filaRetomada, regras: async () => regras(),
      ensino: async () => {
        const todos = await listarEnsino()
        return { pedidos: perfil === 'agencia' ? todos : todos.filter(p => p.perfil === 'dono'), custoLaboratorioMes: await custoLaboratorioMes() }
      },
    }
    if (!mapa[secao]) return res.status(400).json({ error: 'secao desconhecida' })
    return res.status(200).json({ versao: SISTEMA_VERSAO, perfil, ...(await fonte(mapa[secao])) })
  } catch (e) {
    console.error('[central] erro:', e)
    return res.status(500).json({ ok: false, erro: (e instanceof Error ? e.message : String(e)).slice(0, 200) })
  }
}
