import { WebSocket, type ClientOptions } from 'ws'
import type { ServerRealtimeFrame } from '@goodwatch/yepwatch-contracts'
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
export async function until(check: () => boolean, ms = 1800) {
  const end = Date.now() + ms
  while (!check()) { if (Date.now() > end) throw new Error('Condition timeout'); await sleep(5) }
}
export async function connect(url: string, ticket?: string, options: ClientOptions | string[] = {}, roomId = 'room-1') {
  const ws = Array.isArray(options) ? new WebSocket(url, options) : new WebSocket(url, options)
  const frames: ServerRealtimeFrame[] = []
  let closed: number | undefined
  ws.on('message', data => frames.push(JSON.parse(data.toString())))
  ws.on('close', code => { closed = code })
  await new Promise<void>((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject) })
  if (ticket) ws.send(JSON.stringify({ type: 'authenticate', ticket, roomId, lastRevision: null }))
  return { ws, frames, get closed() { return closed } }
}

export const snapshots = (frames: ServerRealtimeFrame[]) => frames.filter((f): f is Extract<ServerRealtimeFrame, { snapshot: unknown }> => f.type === 'room.snapshot' || f.type === 'room.updated')
