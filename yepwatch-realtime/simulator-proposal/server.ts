import { createServer } from 'node:http'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { ServerResponse } from 'node:http'
import { ProposalSimulator, type Scenario } from './engine.js'

const port = Number(process.env.YEPWATCH_SIM_PORT ?? '8126')
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error('Choose a local simulator port from 1024 to 65535')
// Loopback cookies span ports. Never replace another instance's control cookie.
const controlCookieName = `yepwatch_sim_control_${port}`
const origin = `http://127.0.0.1:${port}`
const catalog = process.env.YEPWATCH_SIM_CATALOG ?? 'real-sample'
if (catalog !== 'synthetic' && catalog !== 'real-sample') throw new Error('Explicit local catalog mode required')
const simulator = new ProposalSimulator({ apiOrigin: process.env.YEPWATCH_SIM_API_ORIGIN ?? 'http://127.0.0.1:15992',
  wsOrigin: process.env.YEPWATCH_SIM_WS_ORIGIN ?? 'ws://127.0.0.1:4324', appOrigin: process.env.YEPWATCH_SIM_APP_ORIGIN ?? 'http://127.0.0.1:8133',
  serviceId: Number(process.env.YEPWATCH_SIM_SERVICE_ID ?? '8'), catalog })
const token = randomBytes(32).toString('base64url')
const clients = new Set<ServerResponse>()
function cookieValid(value: string | undefined) {
  const candidate = value?.split(';').map(v => v.trim()).find(v => v.startsWith(`${controlCookieName}=`))?.slice(controlCookieName.length + 1)
  return !!candidate && Buffer.byteLength(candidate) === Buffer.byteLength(token) && timingSafeEqual(Buffer.from(candidate), Buffer.from(token))
}
function event(response: ServerResponse) {
  // Private controlled-bot state is sent ONLY to this local operator UI, never to the room bus/WS.
  if (response.writableLength > 256_000) { response.destroy(); clients.delete(response); return }
  response.write(`data: ${JSON.stringify(simulator.state())}\n\n`)
}
simulator.on('change', () => { for (const response of clients) event(response) })
const server = createServer(async (request, response) => {
  const reply = (status: number, data: unknown) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(data)) }
  if (request.headers.host !== `127.0.0.1:${port}`) { reply(403, { error: 'Open the fixed 127.0.0.1 simulator URL' }); return }
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'no-referrer')
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-src ${simulator.config.appOrigin}; base-uri 'none'; frame-ancestors 'self'`)
  if (request.method === 'GET' && ['/', '/ui.js', '/style.css'].includes(request.url ?? '')) {
    const file = request.url === '/' ? 'ui.html' : request.url!.slice(1)
    response.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8')
    if (file === 'ui.html') response.setHeader('Set-Cookie', `${controlCookieName}=${token}; Path=/simulator/; HttpOnly; SameSite=Strict`)
    response.end(await readFile(new URL(file === 'style.css' ? '../simulator/style.css' : file, import.meta.url))); return
  }
  if (!cookieValid(request.headers.cookie) || (request.headers.origin && request.headers.origin !== origin)) { reply(403, { error: 'Open this local control page first' }); return }
  if (request.method === 'GET' && request.url === '/simulator/events') {
    response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' })
    clients.add(response); event(response); request.on('close', () => clients.delete(response)); return
  }
  if (request.method !== 'POST' || request.headers.origin !== origin || request.headers['content-type'] !== 'application/json') {
    reply(403, { error: 'Same-origin JSON control action required' }); return
  }
  try {
    let body = ''; for await (const chunk of request) { body += chunk; if (Buffer.byteLength(body) > 8192) throw new Error('Control input too large') }
    const input = JSON.parse(body)
    if (request.url === '/simulator/new') {
      const result = await simulator.fresh({ count: input.count, scenario: input.scenario, paceMs: input.paceMs })
      reply(200, result); return
    }
    if (request.url === '/simulator/start') { await simulator.startChoosing(); reply(200, { ok: true }); return }
    if (request.url === '/simulator/add') {
      if (simulator.state().starting) throw new Error('Demo creation in progress')
      await simulator.addGuest(); reply(200, { ok: true }); return
    }
    if (request.url === '/simulator/controls') {
      await simulator.controls(input as { automatic?: boolean; paceMs?: number; scenario?: Scenario }); reply(200, { ok: true }); return
    }
    if (request.url === '/simulator/action') {
      if (!['step', 'watch', 'pass', 'propose', 'agree', 'withdraw', 'inspect', 'refill', 'undo', 'pause', 'resume', 'disconnect', 'reconnect', 'retry', 'view', 'gesture'].includes(input.action)) throw new Error('Unknown control action')
      await simulator.action(input.actorId, input.action, { candidateId: input.candidateId, view: input.view, gesture: input.gesture, inspection: input.inspection }); reply(200, { ok: true }); return
    }
    if (request.url === '/simulator/step') {
      const actors = simulator.state().actors.filter(a => a.live && !a.paused)
      await Promise.all(actors.map(a => simulator.action(a.id, 'step'))); reply(200, { ok: true }); return
    }
    reply(404, { error: 'Unknown local control route' })
  } catch (error) {
    reply(400, { error: error instanceof Error ? error.message : 'Local control action failed' })
  }
})
server.requestTimeout = 10_000; server.headersTimeout = 5000; server.maxConnections = 32
const keepalive = setInterval(() => { for (const response of clients) response.write(': local simulator alive\n\n') }, 15_000)
server.listen(port, '127.0.0.1', () => console.info(`YepWatch proposal simulator: ${origin} · artificial guests, fresh phone demo rooms only`))
let closing = false
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  if (closing) return
  closing = true; clearInterval(keepalive); simulator.close()
  for (const response of clients) response.end()
  server.close(); server.closeAllConnections()
})
