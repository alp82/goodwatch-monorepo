import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { paths, type RealtimeAttachment, type SharedRoomSnapshot, type RoomInvalidation } from '@goodwatch/yepwatch-contracts'
import type { RevisionBus } from '../src/bus.js'
import { paths as continuousPaths, type SharedRoomSnapshot as ContinuousSnapshot } from '@goodwatch/yepwatch-contracts/continuous'
import { HttpAuthority } from '../src/authority.js'
import { paths as proposalPaths, type SharedRoomSnapshot as ProposalSnapshot } from '@goodwatch/yepwatch-contracts/proposal'

export const secret = 'fixture-only-' + 'x'.repeat(40)
export function snapshot(revision = 1): SharedRoomSnapshot {
  return { contractVersion: 1, roomId: 'room-1', revision, phase: 'setup',
    expiresAt: Date.now() + 120_000, rosterVersion: 1, contextVersion: 1, hostParticipantId: 'person-1',
    participants: ['person-1', 'person-2'].map(participantId => ({ participantId, nickname: participantId,
      screenId: null, ready: false, participation: 'included', completedCount: 0, presence: 'unknown' })),
    screens: [], episodeProposals: [], constraints: { kinds: ['movie', 'show_start', 'show_continue'], maxMinutes: null, moods: [] },
    round: null, candidates: [], shortlist: null, decision: null }
}
export class FakeBus extends EventEmitter implements RevisionBus {
  ready = true
  async start() {}
  close() {}
  state(ready: boolean) { this.ready = ready; this.emit('state', ready) }
  hint(revision: number, roomId = 'room-1') { this.emit('hint', { roomId, revision } satisfies RoomInvalidation) }
}
// Explicit HTTP fixture. No Crate, catalog, account, backend domain or production data.
export function continuousSnapshot(): ContinuousSnapshot {
  const legacy = snapshot()
  return { contractVersion: 2, roomId: legacy.roomId, revision: 1, phase: 'setup', expiresAt: legacy.expiresAt,
    hostParticipantId: legacy.hostParticipantId, rosterVersion: 1, contextVersion: 1, generation: 1,
    participants: legacy.participants.map(({ participantId, nickname, screenId, ready }) => ({ participantId, nickname, screenId, ready })),
    screens: [], constraints: { ...legacy.constraints, kinds: ['movie', 'show_start'] }, candidates: [],
    matches: [], stream: { version: 1, state: 'ready', reason: null }, agreement: { version: 1, state: 'none', error: null }, decision: null }
}
export function proposalSnapshot(): ProposalSnapshot {
  return { ...continuousSnapshot(), contractVersion: 3, candidates: [], matches: [], proposalVersion: 0, proposal: null, decision: null }
}
export async function fixture(continuous: boolean | 'proposal' = false) {
  const routes = continuous === 'proposal' ? proposalPaths : continuous ? continuousPaths : paths
  const state = {
    shared: (continuous === 'proposal' ? proposalSnapshot() : continuous ? continuousSnapshot() : snapshot()) as any, leaseMs: 2000, revoked: false, unavailable: false, viewCalls: 0,
    beforeView: undefined as undefined | (() => Promise<void>),
    corruptAttachment: undefined as undefined | Record<string, unknown>,
  }
  const tickets = new Map<string, { roomId: string; participantId: string; expiresAt: number }>()
  const leases = new Map<string, RealtimeAttachment>()
  function ticket(participantId = 'person-1', expiresAt = Date.now() + 30_000, roomId = 'room-1') {
    const value = randomBytes(32).toString('base64url')
    tickets.set(value, { roomId, participantId, expiresAt }); return value
  }
  function lease(participantId: string): RealtimeAttachment {
    const a: RealtimeAttachment = { roomId: state.shared.roomId, participantId, lease: randomBytes(32).toString('base64url'),
      leaseExpiresAt: Math.min(Date.now() + state.leaseMs, state.shared.expiresAt),
      roomExpiresAt: state.shared.expiresAt, capabilityEpoch: 1, scope: 'shared:read' }
    leases.set(a.lease, a); return a
  }
  const server = createServer(async (req, res) => {
    const reply = (status: number, body: unknown) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)) }
    if (req.headers.authorization !== `Bearer ${secret}`) { reply(401, {}); return }
    let body: any
    try { let raw = ''; for await (const chunk of req) raw += chunk; body = JSON.parse(raw) }
    catch { reply(400, {}); return }
    if (state.unavailable) { reply(503, {}); return }
    if (req.url === routes.realtimeAttach) {
      const t = tickets.get(body.ticket)
      if (!t || t.expiresAt <= Date.now() || t.roomId !== body.roomId) { reply(401, {}); return }
      tickets.delete(body.ticket)
      reply(200, { ...lease(t.participantId), ...state.corruptAttachment }); return
    }
    if (req.url === routes.realtimeView) {
      state.viewCalls++
      const a = leases.get(body.lease)
      if (state.revoked || !a || a.leaseExpiresAt <= Date.now() || a.roomId !== body.roomId) { reply(403, {}); return }
      // Capture BEFORE delay to exercise subscribe/read/update races.
      const shared = structuredClone(state.shared)
      await state.beforeView?.()
      reply(200, { ...lease(a.participantId), snapshot: shared }); return
    }
    reply(404, {})
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Fixture address')
  const origin = `http://127.0.0.1:${address.port}`
  return { state, ticket, origin, authority: new HttpAuthority(origin, secret, 500, 2_000_000, routes),
    async close() { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) } }
}
