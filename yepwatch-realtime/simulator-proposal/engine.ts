import { EventEmitter } from 'node:events'
import { randomBytes } from 'node:crypto'
import WebSocket from 'ws'
import { paths, type ActivityView, type ActivityGesture, type CommandEnvelope, type GuestAdmission, type GuestCredential,
  type RoomSnapshot, type SharedRoomSnapshot, type RoomCommand } from '@goodwatch/yepwatch-contracts/proposal'
import { localOrigin } from '../simulator/engine.js'
import { proposalProjection } from '../src/proposal-projection.js'
import { proposalServerActivitySchema, proposalClientActivitySchema, inspectionAllowed, type Inspection } from '../src/proposal-activity.js'
const nonce = () => randomBytes(32).toString('base64url')
export type Scenario = 'agreement' | 'disagreement' | 'slow'
export interface Config { apiOrigin: string; wsOrigin: string; appOrigin: string; serviceId?: number; catalog?: 'synthetic' | 'real-sample' }
interface Actor {
  id: string; host: boolean; index: number; name: string; credential: GuestCredential
  snapshot: RoomSnapshot; ws?: WebSocket; live: boolean; paused: boolean; busy: boolean; chain: Promise<unknown>
  target: number; queued: boolean; sessionId?: string; activitySequence: number; view: ActivityView
  pending?: CommandEnvelope; error: string | null; nextAt: number; lastVoted?: string
}
class Failure extends Error { constructor(readonly code: string, readonly uncertain: boolean) { super(`Local API: ${code}`) } }
export class ProposalSimulator extends EventEmitter {
  readonly config: Config
  private actors: Actor[] = []
  private roomId = ''; private inviteCode = ''; private hostPath = ''
  private timer: NodeJS.Timeout; private starting = false; private adding = false; private closed = false; private generation = 0
  private shared?: SharedRoomSnapshot
  automatic = false; paceMs = 1500; scenario: Scenario = 'agreement'; frames = 0; privacyFailures = 0
  notice = 'Create a fresh proposal demo. Artificial guests use real independent API/WS credentials.'
  constructor(config: Config) {
    super()
    if (!Number.isSafeInteger(config.serviceId ?? 1) || (config.serviceId ?? 1) < 1 ||
        (config.catalog !== undefined && !['synthetic', 'real-sample'].includes(config.catalog))) throw new Error('Choose a positive provider ID and explicit local catalog mode')
    this.config = { apiOrigin: localOrigin(config.apiOrigin, 'http:'), wsOrigin: localOrigin(config.wsOrigin, 'ws:'), appOrigin: localOrigin(config.appOrigin, 'http:'),
      serviceId: config.serviceId ?? 1, catalog: config.catalog ?? 'synthetic' }
    this.timer = setInterval(() => {
      if (!this.automatic || this.closed || this.starting) return
      for (const actor of this.actors) if (actor.live && !actor.paused && !actor.busy && !actor.error && this.canStep(actor) && actor.nextAt <= Date.now()) {
        actor.nextAt = Date.now() + this.paceMs * (this.scenario === 'slow' && actor.index === this.actors.length - 1 ? 5 : 1)
        void this.action(actor.id, 'step').catch(() => {})
      }
    }, 200)
  }
  private changed() { this.emit('change') }
  private async request<T>(path: string, body?: unknown, actor?: Actor): Promise<{ data: T }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-YepWatch-Client': 'native' }
    if (actor) { headers.Authorization = `Bearer ${actor.credential.token}`; headers['X-YepWatch-Participant'] = actor.id }
    let response: Response
    try { response = await fetch(new URL(path, this.config.apiOrigin), { method: body === undefined ? 'GET' : 'POST', headers,
      body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(8000) }) }
    catch { throw new Failure('outcome_unknown', true) }
    const data = await response.json()
    if (!response.ok) throw new Failure(data.error?.code ?? 'busy', response.status >= 500 || ['busy', 'outcome_unknown'].includes(data.error?.code))
    return { data }
  }
  private queue<T>(actor: Actor, work: () => Promise<T>) {
    const generation = this.generation
    const next = actor.chain.then(async () => {
      if (this.closed || generation !== this.generation) throw new Error('Previous demo stopped')
      actor.busy = true; this.changed()
      try { return await work() } catch (error) { actor.error = error instanceof Error ? error.message : 'Action failed'; throw error }
      finally { actor.busy = false; this.changed() }
    })
    actor.chain = next.catch(() => {}); return next
  }
  private accept(actor: Actor, snapshot: RoomSnapshot) {
    if (!this.actors.includes(actor)) return
    const shared = proposalProjection(snapshot.shared, this.roomId)
    if (snapshot.own.participantId !== actor.id) throw new Error('Wrong own projection')
    if (snapshot.shared.revision >= actor.snapshot.shared.revision && snapshot.own.nextSequence >= actor.snapshot.own.nextSequence) actor.snapshot = snapshot
    if (!this.shared || shared.revision >= this.shared.revision) this.shared = shared
    actor.error = null; this.changed()
  }
  private async read(actor: Actor) { const { data } = await this.request<RoomSnapshot>(paths.snapshot(actor.credential.roomId), undefined, actor); this.accept(actor, data) }
  private async command(actor: Actor, command: RoomCommand) {
    if (actor.pending) throw new Error('Recover retained command first')
    actor.pending = { commandId: nonce(), sequence: actor.snapshot.own.nextSequence, command }
    return this.retry(actor)
  }
  private async retry(actor: Actor) {
    const envelope = actor.pending
    if (!envelope) { await this.read(actor); return }
    try {
      const { data } = await this.request<{ snapshot: RoomSnapshot }>(paths.commands(actor.credential.roomId), envelope, actor)
      actor.pending = undefined; this.accept(actor, data.snapshot)
    } catch (error) { if (error instanceof Failure && !error.uncertain) actor.pending = undefined; throw error }
  }
  private activity(actor: Actor, view: ActivityView, gesture?: ActivityGesture, beat?: 'answer', inspection?: Inspection) {
    if (!actor.live || !actor.sessionId || actor.error || actor.ws?.readyState !== WebSocket.OPEN) return
    actor.view = view
    actor.ws.send(JSON.stringify({ type: 'activity', sessionId: actor.sessionId, sequence: actor.activitySequence++, view,
      ...(gesture ? { gesture } : {}), ...(beat ? { beat } : {}), ...(inspection ? { inspection } : {}) }))
  }
  private async connect(actor: Actor) {
    if (this.closed || !this.actors.includes(actor)) throw new Error('Previous demo stopped')
    const generation = this.generation
    actor.ws?.close(1000, 'Fresh proposal simulator subscription'); actor.live = false; actor.sessionId = undefined; actor.activitySequence = 0
    const { data } = await this.request<{ ticket: string }>(paths.realtimeTicket(this.roomId), {}, actor)
    if (this.closed || generation !== this.generation || !this.actors.includes(actor)) throw new Error('Previous demo stopped')
    const ws = new WebSocket(`${this.config.wsOrigin}${paths.realtime}`, {})
    actor.ws = ws
    await new Promise<void>((resolve, reject) => {
      let complete = false
      const timer = setTimeout(() => { ws.terminate(); reject(new Error('Proposal session timed out')) }, 6000)
      ws.on('open', () => ws.send(JSON.stringify({ type: 'authenticate', ticket: data.ticket, roomId: this.roomId, lastRevision: actor.snapshot.shared.revision })))
      ws.on('message', raw => {
        if (this.generation !== generation || actor.ws !== ws) return
        try {
          const frame = JSON.parse(raw.toString())
          if (frame.type === 'room.snapshot' || frame.type === 'room.updated') {
            const shared = proposalProjection(frame.snapshot, this.roomId); this.frames++
            if (!this.shared || shared.revision >= this.shared.revision) this.shared = shared
            actor.target = Math.max(actor.target, shared.revision)
            if (actor.sessionId) actor.live = true
            if (actor.target > actor.snapshot.shared.revision && !actor.queued) {
              actor.queued = true
              void this.queue(actor, async () => {
                try {
                  for (let attempt = 0; attempt < 3 && actor.snapshot.shared.revision < actor.target; attempt++) await this.read(actor)
                  if (actor.snapshot.shared.revision < actor.target) throw new Error('Private view is behind; Recover')
                } finally { actor.queued = false }
              }).catch(() => {})
            }
          } else if (frame.type === 'activity.session') {
            if (frame.roomId !== this.roomId || typeof frame.sessionId !== 'string') throw new Error('Wrong activity session')
            actor.sessionId = frame.sessionId; actor.live = true
            if (!complete) { complete = true; clearTimeout(timer); resolve() }
          } else if (frame.type === 'activity') {
            if (!proposalServerActivitySchema.safeParse(frame).success) throw new Error('Unsafe activity')
          } else if (['degraded', 'restarting', 'error', 'resync_required'].includes(frame.type)) { actor.live = false; this.changed() }
          this.changed()
        } catch { this.privacyFailures++; actor.live = false; actor.paused = true; ws.close() }
      })
      ws.on('close', () => { if (actor.ws === ws) { actor.live = false; this.changed() }; if (!complete) { clearTimeout(timer); reject(new Error('Subscription closed')) } })
      ws.on('error', () => { if (!complete) { clearTimeout(timer); reject(new Error('Local WebSocket unavailable')) } })
    })
  }
  private actor(admission: GuestAdmission, name: string, index: number): Actor {
    return { id: admission.credential.participantId, credential: admission.credential, name, index, host: index === 0,
      snapshot: admission.snapshot, live: false, paused: false, busy: false, chain: Promise.resolve(),
      target: admission.snapshot.shared.revision, queued: false, activitySequence: 0, view: 'voting', error: null, nextAt: Date.now() + this.paceMs }
  }
  async fresh(input: { count: number; scenario: Scenario; paceMs: number }) {
    if (this.closed) throw new Error('Local simulator stopped')
    if (this.starting || this.adding || this.actors.some(a => a.busy || a.pending)) throw new Error('Wait for active admission/actions / Recover pending commands before replacing this demo')
    if (!Number.isInteger(input.count) || input.count < 1 || input.count > 3) throw new Error('Choose one to three artificial guests')
    this.starting = true; this.changed()
    try {
      await this.controls({ ...input, automatic: false })
      this.generation++; for (const actor of this.actors) actor.ws?.close(1000, 'New fresh demo')
      this.actors = []; this.shared = undefined; this.roomId = ''; this.frames = 0; this.privacyFailures = 0
      const { data } = await this.request<GuestAdmission>(paths.rooms, { contractVersion: 3, commandId: nonce(), admissionSecret: nonce(), nickname: 'Sim Alex (host)' })
      this.roomId = data.credential.roomId; this.inviteCode = data.invite.code; this.hostPath = data.invite.path
      const host = this.actor(data, 'Sim Alex (host)', 0); this.actors.push(host); this.accept(host, data.snapshot)
      await this.command(host, { type: 'setup', expectedContextVersion: host.snapshot.shared.contextVersion,
        screens: [{ id: 'demo', label: 'Demo screen', country: 'DE', serviceIds: [this.config.serviceId ?? 1], confirmed: true }],
        constraints: { kinds: ['movie', 'show_start'], maxMinutes: null, moods: [] }, screenId: 'demo' })
      await this.connect(host)
      for (let index = 1; index < input.count; index++) await this.admitGuest()
      // Setup admission invalidates earlier readiness; explicitly ready artificial
      // people only after the entire requested fresh roster has been admitted.
      for (const actor of this.actors) {
        await this.read(actor)
        if (!actor.snapshot.shared.participants.find(p => p.participantId === actor.id)?.ready)
          await this.command(actor, { type: 'ready', expectedContextVersion: actor.snapshot.shared.contextVersion, ready: true })
      }
      this.notice = `Fresh proposal room. Join from your actual phone with the invitation, confirm readiness there, then Start here. ${this.config.catalog === 'real-sample' ? 'Finite real catalog sample' : 'Synthetic catalog'} · DE / provider${this.config.serviceId}. Artificial timings omitted; Quickest may be unavailable.`
      return { inviteCode: this.inviteCode, joinUrl: new URL(this.hostPath, this.config.appOrigin).href }
    } finally { this.starting = false; this.changed() }
  }
  async addGuest() {
    if (this.starting) throw new Error('Demo creation in progress')
    return this.admitGuest()
  }
  async startChoosing() {
    if (this.closed || this.starting || this.adding || !this.actors.length) throw new Error('Wait for fresh room/admission first')
    this.starting = true; this.changed()
    try {
      const host = this.actors[0]
      await this.queue(host, () => this.read(host))
      if (host.snapshot.shared.participants.length <= this.actors.length) throw new Error('Join and ready from the actual phone before starting')
      for (const actor of this.actors) await this.queue(actor, async () => {
        await this.read(actor)
        if (!actor.snapshot.shared.participants.find(p => p.participantId === actor.id)?.ready)
          await this.command(actor, { type: 'ready', expectedContextVersion: actor.snapshot.shared.contextVersion, ready: true })
      })
      await this.queue(host, async () => {
        await this.read(host)
        await this.command(host, { type: 'start', hostReady: true, expectedContextVersion: host.snapshot.shared.contextVersion,
          expectedRosterVersion: host.snapshot.shared.rosterVersion })
      })
    } finally { this.starting = false; this.changed() }
  }
  private async admitGuest() {
    if (this.closed) throw new Error('Local simulator stopped')
    if (this.adding) throw new Error('Another guest admission is in progress')
    if (!this.roomId || this.actors.length >= 3 || this.shared?.phase === 'decided') throw new Error('Create fresh demo first; at most three artificial peers including host before Done')
    this.adding = true
    try {
    this.changed()
    const generation = this.generation, roomId = this.roomId
    const index = this.actors.length, name = ['Sim Alex (host)', 'Sim Bea', 'Sim Casey'][index]
    const { data } = await this.request<GuestAdmission>(paths.join(this.roomId), { contractVersion: 3, commandId: nonce(), admissionSecret: nonce(), nickname: name, inviteCode: this.inviteCode, screenId: 'demo' })
    if (this.closed || generation !== this.generation || roomId !== this.roomId || data.credential.roomId !== roomId || data.snapshot.shared.roomId !== roomId)
      throw new Error('Previous demo admission stopped')
    const actor = this.actor(data, name, index); this.actors.push(actor); this.accept(actor, data.snapshot)
    await this.command(actor, { type: 'ready', expectedContextVersion: actor.snapshot.shared.contextVersion, ready: true })
    await this.connect(actor); this.changed()
    } finally { this.adding = false; this.changed() }
  }
  private candidate(actor: Actor) {
    const list = actor.snapshot.shared.candidates, answered = new Set(actor.snapshot.own.votes.filter(v => v.value !== null).map(v => v.candidateId))
    for (let step = 0; step < list.length; step++) { const candidate = list[(step + actor.index) % list.length]; if (candidate && !answered.has(candidate.id)) return candidate }
    return undefined
  }
  private canStep(actor: Actor) {
    if (actor.pending || actor.snapshot.shared.revision < actor.target) return false
    if (actor.snapshot.shared.phase === 'setup') return !actor.snapshot.shared.participants.find(p => p.participantId === actor.id)?.ready
    return actor.snapshot.shared.phase === 'choosing' && (!!this.candidate(actor) ||
      (!!actor.snapshot.shared.proposal && !actor.snapshot.own.agreement.agreed) ||
      (!!actor.snapshot.shared.matches.length && !actor.snapshot.shared.proposal))
  }
  async action(actorId: string, action: string, input: { view?: ActivityView; gesture?: ActivityGesture; candidateId?: string; inspection?: Inspection } = {}) {
    const actor = this.actors.find(a => a.id === actorId)
    if (!actor) throw new Error('Only this fresh demo’s artificial peers are controllable')
    if (action === 'pause') { actor.paused = true; this.changed(); return }
    if (action === 'resume') { actor.paused = false; actor.nextAt = Date.now() + this.paceMs; this.changed(); return }
    if (action === 'disconnect') { this.activity(actor, 'away'); actor.paused = true; actor.live = false; actor.ws?.close(1000, 'Operator disconnected artificial guest'); this.changed(); return }
    return this.queue(actor, async () => {
      if (action === 'retry') { await this.retry(actor); if (!actor.live) await this.connect(actor); return }
      if (action === 'reconnect') { await this.read(actor); await this.connect(actor); return }
      if (!actor.live || actor.pending) throw new Error('Reconnect / Recover before acting')
      if (action === 'view') { if (!['voting', 'matches', 'trailer', 'away'].includes(input.view ?? '')) throw new Error('Unknown view'); this.activity(actor, input.view!); return }
      if (action === 'gesture') { if (actor.view === 'away' || !['reach', 'handle', 'release'].includes(input.gesture ?? '')) throw new Error('Choose a foreground view and neutral gesture'); this.activity(actor, actor.view, input.gesture); return }
      await this.read(actor)
      const shared = actor.snapshot.shared, own = actor.snapshot.own
      if (action === 'inspect') {
        const frame = { type: 'activity', sessionId: actor.sessionId, sequence: actor.activitySequence, view: 'matches', inspection: input.inspection }
        if (!input.inspection || !proposalClientActivitySchema.safeParse(frame).success || !inspectionAllowed(frame, shared)) throw new Error('Inspect a current shared match, or use a targetless lens/dice')
        this.activity(actor, 'matches', undefined, undefined, input.inspection); return
      }
      if (shared.phase === 'setup' && action === 'step') { await this.command(actor, { type: 'ready', expectedContextVersion: shared.contextVersion, ready: true }); return }
      if (shared.phase !== 'choosing') throw new Error('Choosing is not active')
      const disagrees = action === 'step' && this.scenario === 'disagreement' && actor.index === 0 && shared.proposal
      if (action === 'propose' || (action === 'step' && !shared.proposal && shared.matches.length)) {
        const candidateId = input.candidateId ?? shared.matches[0]?.candidateId
        if (!candidateId || !shared.matches.some(m => m.candidateId === candidateId)) throw new Error('Choose a current unanimous match')
        await this.command(actor, { type: 'propose', generation: shared.generation, expectedRosterVersion: shared.rosterVersion,
          expectedProposalVersion: shared.proposalVersion, candidateId })
        return // Durable shared revisions/counts animate agreement; never emit a person-linked proposal pulse.
      }
      if (action === 'agree' || action === 'withdraw' || (action === 'step' && shared.proposal && !own.agreement.agreed && !disagrees)) {
        if (!shared.proposal) throw new Error('No current confirmed proposal')
        await this.command(actor, { type: 'agree', generation: shared.generation, expectedRosterVersion: shared.rosterVersion,
          expectedProposalVersion: shared.proposalVersion, candidateId: shared.proposal.candidateId,
          expectedOwnAgreementRevision: own.agreement.revision, agreed: action !== 'withdraw' })
        if (action === 'withdraw') actor.paused = true // Preserve the operator's deliberate withdrawal until explicit resume.
        return
      }
      if (action === 'refill') { await this.command(actor, { type: 'refill', generation: shared.generation, expectedStreamVersion: shared.stream.version }); return }
      const candidate = disagrees ? shared.candidates.find(c => c.id === shared.proposal!.candidateId) :
        input.candidateId ? shared.candidates.find(c => c.id === input.candidateId) :
        action === 'undo' ? shared.candidates.find(c => c.id === actor.lastVoted) : this.candidate(actor)
      if (!candidate) return
      const value = action === 'undo' ? null : action === 'pass' || (action === 'step' && this.scenario === 'disagreement' && actor.index === 0) ? 'pass' : 'watch'
      if (!['step', 'watch', 'pass', 'undo'].includes(action)) throw new Error('Unknown action')
      const revision = own.votes.find(v => v.candidateId === candidate.id)?.revision ?? 0
      await this.command(actor, { type: 'vote', generation: shared.generation, candidateId: candidate.id, expectedVoteRevision: revision, value })
      actor.lastVoted = candidate.id
      this.activity(actor, 'voting', 'release', 'answer') // Real artificial vote interaction; never encode its value/target.
    })
  }
  async controls(input: { automatic?: boolean; paceMs?: number; scenario?: Scenario }) {
    if (input.automatic !== undefined && typeof input.automatic !== 'boolean') throw new Error('Automatic must be boolean')
    if (input.paceMs !== undefined && (!Number.isInteger(input.paceMs) || input.paceMs < 300 || input.paceMs > 10_000)) throw new Error('Pace must be300–10000ms')
    if (input.scenario && !['agreement', 'disagreement', 'slow'].includes(input.scenario)) throw new Error('Unknown scenario')
    if (input.automatic !== undefined) this.automatic = input.automatic
    if (input.paceMs !== undefined) this.paceMs = input.paceMs
    if (input.scenario) this.scenario = input.scenario
    this.changed()
  }
  state() {
    const shared = this.shared
    return { starting: this.starting, adding: this.adding, room: !!this.roomId, inviteCode: this.inviteCode,
      joinUrl: this.hostPath ? new URL(this.hostPath, this.config.appOrigin).href : null,
      phase: shared?.phase, people: shared?.participants.length,
      matches: shared?.matches.map(m => ({ ...m, title: shared.candidates.find(c => c.id === m.candidateId)?.title ?? 'Shared match' })),
      proposal: shared?.proposal ? { ...shared.proposal, title: shared.candidates.find(c => c.id === shared.proposal!.candidateId)?.title ?? 'Shared proposal' } : null,
      notice: this.notice, automatic: this.automatic, paceMs: this.paceMs, scenario: this.scenario, shared: this.shared,
      frames: this.frames, privacyFailures: this.privacyFailures,
      actors: this.actors.map(a => ({ id: a.id, name: a.name, host: a.host, live: a.live, busy: a.busy, paused: a.paused, error: a.error,
        pending: !!a.pending, privateCard: this.candidate(a) ?? null, privateAnswered: a.snapshot.own.votes.filter(v => v.value !== null).length,
        privateAgreement: a.snapshot.own.agreement.agreed ? (a.snapshot.own.agreement.isProposer ? 'Proposer · agreed' : 'Agreed') : 'Not agreed',
        view: a.view, privateCaughtUp: a.snapshot.shared.revision >= a.target })) }
  }
  close() { this.closed = true; this.generation++; clearInterval(this.timer); for (const a of this.actors) a.ws?.close(1000, 'Local simulator stopped') }
}
