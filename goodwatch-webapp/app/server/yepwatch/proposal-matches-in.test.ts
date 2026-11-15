import { ProposalService } from './proposal-service.server.ts'
import test from 'node:test'
import assert from 'node:assert/strict'
import { rankingRoom, cards } from './proposal-ranking-test-support.ts'
import { proposalTransition, proposalSnapshot, reconcile, agreementCandidate } from './proposal-machine.ts'
import { initializeIns, setIn, tieHash } from './proposal-matches-in.ts'
import { proposalCommandSchema } from './proposal-validation.ts'
import { ProposalMemoryRepository, proposalFixtureCatalog } from './proposal-test-support.ts'
import { ValkeyRoomRepository } from './proposal-valkey-repository.ts'
import { encodeMatches, decodeMatches } from './proposal-matches-storage.ts'
import { RelationalProposalRepository } from './proposal-relational-repository.ts'
import { parseRow, tables, columns } from './proposal-storage-schema.ts'
import type { ProposalRoom } from './proposal-types.ts'
import type { RoomCommand } from '../../../packages/yepwatch-contracts/proposal.ts'

function fixture(people = 2) {
  const room = rankingRoom(); room.candidates = cards(3).map((c, i) => ({ ...c, id: `movie_${i + 1}` }))
  room.participants = Array.from({ length: people }, (_, i) => ({ ...structuredClone(room.participants[0]), id: `person_${i}`, serviceIds: [1], ins: [], inRevision: 0, favorite: null,
    votes: Object.fromEntries(room.candidates.map(c => [c.id, { value: 'watch' as const, revision: 1 }])) }))
  room.hostId = room.participants[0].id
  initializeIns(room)
  return room
}
const ids = ['movie_1', 'movie_2', 'movie_3']
function send(room: ProposalRoom, who: number, command: RoomCommand) {
  return proposalTransition(room, room.participants[who].id, { commandId: 'command', sequence: 1, command }, Date.now())
}
const mark = (room: ProposalRoom, who: number, candidateId: string, value = true) => send(room, who, { type: 'set_in', generation: room.generation,
  candidateId, in: value, expectedOwnInRevision: room.participants[who].inRevision ?? 0 })
const pick = (room: ProposalRoom, who: number, candidateId: string | null) => send(room, who, { type: 'pick_favorite', generation: room.generation,
  candidateId, tiebreakVersion: room.tiebreak!.version })
function tied(people = 2) {
  let room = fixture(people)
  for (let who = 0; who < people; who++) for (const id of ids.slice(0, 2)) room = mark(room, who, id)
  return room
}
test('set_in and pick_favorite validate exact shapes, booleans, nullable pick and safe revision fences', () => {
  const parse = (command: unknown) => proposalCommandSchema.safeParse({ commandId: 'command', sequence: 1, command }).success
  const command = { type: 'set_in', generation: 1, candidateId: ids[0], in: true, expectedOwnInRevision: 0 }
  assert.ok(parse(command)); assert.ok(parse({ type: 'pick_favorite', generation: 1, tiebreakVersion: 1, candidateId: null }))
  for (const change of [{ in: 1 }, { expectedOwnInRevision: -1 }, { expectedOwnInRevision: 1.5 }, { generation: NaN }, { person: 'private' }, { candidateId: '' }]) assert.equal(parse({ ...command, ...change }), false)
  assert.equal(parse({ type: 'pick_favorite', generation: 1, tiebreakVersion: -1, candidateId: null }), false)
})
test('set_in is multi-select, idempotent, revision fenced, choosing/current generation/current match only', () => {
  let room = mark(fixture(), 0, ids[0]); room = mark(room, 0, ids[1])
  assert.deepEqual(room.participants[0].ins, ids.slice(0, 2)); assert.equal(room.inVersion, 2)
  assert.equal(room.participants[0].inRevision, 2)
  assert.throws(() => send(room, 0, { type: 'set_in', generation: 1, candidateId: ids[1], in: true, expectedOwnInRevision: 1 }), { status: 409, code: 'conflict', message: "Your I'm in changed" })
  const again = mark(room, 0, ids[1]); assert.equal(again.inVersion, room.inVersion); assert.equal(again.participants[0].inRevision, 2)
  assert.throws(() => send(room, 0, { type: 'set_in', generation: 1, candidateId: ids[0], in: false, expectedOwnInRevision: 0 }), /Your I'm in changed/)
  for (const r of [{ ...room, phase: 'decided' as const }, { ...room, generation: 2 }, room]) assert.throws(() => send(r, 0,
    { type: 'set_in', generation: 1, candidateId: r === room ? 'missing' : ids[0], in: true, expectedOwnInRevision: 2 }), /Pick a current match/)
  room = mark(room, 0, ids[0], false); assert.deepEqual(room.participants[0].ins, [ids[1]])
})
test('set_in true records implied Yep without replacing measured Yep timing', () => {
  let room = fixture(); room.participants[0].votes[ids[0]] = { value: 'watch', revision: 2, activeExposureMs: 99, timingSource: 'active_exposure' }
  room = mark(room, 0, ids[0]); assert.equal(room.participants[0].votes[ids[0]].activeExposureMs, 99)
  const implied = fixture()
  implied.participants[0].votes[ids[0]] = { value: null, revision: 4 }
  setIn(implied, implied.participants[0], ids[0], true)
  assert.deepEqual(implied.participants[0].votes[ids[0]], { value: 'watch', revision: 5, activeExposureMs: null, timingSource: 'implied' })
  assert.equal(Object.keys(implied.participants[0].votes).at(-1), ids[0])
  // The match was validated before the write; a compatibility agree can also supply a late joiner's Yep.
  room.participants[1].votes[ids[0]] = { value: null, revision: 2 }
  room = send(room, 1, { type: 'agree', generation: 1, candidateId: ids[0], agreed: true, expectedRosterVersion: room.rosterVersion,
    expectedProposalVersion: room.proposalVersion, expectedOwnAgreementRevision: room.participants[1].agreementRevision })
  assert.deepEqual(room.participants[1].votes[ids[0]], { value: 'watch', revision: 3, activeExposureMs: null, timingSource: 'implied' })
})
test('everyoneIn one starts offer checking, two opens tiebreak, zero closes it and cancels checking', () => {
  let room = mark(mark(fixture(), 0, ids[0]), 1, ids[0])
  assert.equal(room.agreement.state, 'checking'); assert.equal(agreementCandidate(room)?.id, ids[0])
  room = mark(mark(room, 0, ids[1]), 1, ids[1]); assert.ok(room.tiebreak); assert.equal(room.agreement.state, 'none')
  room = mark(mark(room, 0, ids[0], false), 0, ids[1], false)
  assert.equal(room.tiebreak, null); assert.equal(room.agreement.state, 'none')
})
test('same tied set preserves version, seed and picks; changed set rotates seed/version and clears picks', () => {
  let room = pick(tied(), 0, ids[0]); const tie = structuredClone(room.tiebreak!)
  room = mark(room, 0, ids[2]); assert.deepEqual(room.tiebreak, tie); assert.equal(room.participants[0].favorite?.candidateId, ids[0])
  room = mark(room, 1, ids[2]); assert.ok(room.tiebreak!.version > tie.version); assert.notEqual(room.tiebreak!.seed, tie.seed)
  assert.match(room.tiebreak!.seed, /^[0-9a-f]{16}$/); assert.ok(room.participants.every(p => p.favorite === null))
  room = mark(room, 0, ids[2], false); assert.deepEqual(room.tiebreak!.candidateIds, ids.slice(0, 2)); assert.ok(room.tiebreak!.version > tie.version)
})
test('favorite fences generation/version/membership, allows null and replacement until outcome', () => {
  let room = tied()
  for (const change of [{ generation: 0 }, { tiebreakVersion: 0 }, { candidateId: ids[2] }]) assert.throws(() => send(room, 0,
    { type: 'pick_favorite', generation: 1, tiebreakVersion: room.tiebreak!.version, candidateId: ids[0], ...change }), /The tiebreak changed/)
  room = pick(room, 0, ids[0]); room = pick(room, 0, ids[1]); room = pick(room, 0, null)
  assert.equal(room.tiebreak!.outcome, null); assert.deepEqual(proposalSnapshot(room, room.hostId).shared.tiebreak!.favorites.map(f => f.count), [0, 0])
  room = pick(pick(room, 0, ids[1]), 1, ids[1]); assert.deepEqual(room.tiebreak!.outcome, { candidateId: ids[1], spun: false, among: [ids[1]] })
  assert.equal(room.agreement.state, 'checking'); assert.equal(agreementCandidate(room)?.id, ids[1])
  assert.equal(proposalSnapshot(room, room.hostId).shared.proposal?.candidateId, ids[1], 'legacy proposal follows the winner')
  assert.throws(() => pick(room, 0, null), /The tiebreak changed/)
  assert.throws(() => send(fixture(), 0, { type: 'pick_favorite', generation: 1, tiebreakVersion: 0, candidateId: null }), /The tiebreak changed/)
})
test('most favorites wins and FNV-1a spin is deterministic in tied-set order', () => {
  let room = tied(3); room = pick(pick(pick(room, 0, ids[0]), 1, ids[1]), 2, ids[1])
  assert.deepEqual(room.tiebreak!.outcome, { candidateId: ids[1], spun: false, among: [ids[1]] })
  room = tied(); room.tiebreak!.seed = '0123456789abcdef'
  const a = pick(pick(room, 0, ids[0]), 1, ids[1]), b = pick(pick(room, 1, ids[1]), 0, ids[0])
  assert.deepEqual(a.tiebreak!.outcome, b.tiebreak!.outcome)
  assert.equal(tieHash('hello'), 1335831723)
  assert.deepEqual(a.tiebreak!.outcome, { candidateId: ids[0], spun: true, among: ids.slice(0, 2) })
})
test('leave excludes ins and favorite counts; join closes ties/checks and starts empty; rejoin clears ins', () => {
  let room = pick(tied(), 0, ids[1])
  room = send(room, 1, { type: 'leave' }); assert.equal(room.tiebreak!.outcome?.candidateId, ids[1]); assert.deepEqual(room.participants[1].ins, [])
  const previous = structuredClone(room); const joiner = { ...structuredClone(room.participants[0]), id: 'new', ins: undefined, inRevision: undefined, favorite: undefined, votes: {}, approvedProposalVersion: null, agreementRevision: 0 }
  room.participants.push(joiner); room.rosterVersion++; reconcile(room, previous)
  assert.deepEqual(joiner.ins, []); assert.equal(room.tiebreak, null); assert.equal(room.agreement.state, 'none')
  const old = structuredClone(room); room.participants[1].leftAt = null; room.participants[1].ins = [ids[0]]; room.rosterVersion++; reconcile(room, old)
  assert.deepEqual(room.participants[1].ins, [])
})
test('legacy propose/agree preserve multi-select and project highest counts, then most recent in; own/shared privacy', () => {
  let room = mark(fixture(), 0, ids[1])
  room = send(room, 1, { type: 'propose', generation: 1, expectedRosterVersion: 1, expectedProposalVersion: room.proposalVersion, candidateId: ids[0] })
  assert.deepEqual(room.participants[0].ins, [ids[1]]); assert.equal(room.proposal!.candidateId, ids[0])
  room = mark(room, 0, ids[0]); const snapshot = proposalSnapshot(room, room.hostId)
  assert.equal(snapshot.shared.proposal!.agreeCount, 2); assert.equal(snapshot.own.agreement.agreed, true)
  assert.deepEqual(snapshot.shared.ins, [{ candidateId: ids[0], count: 2 }, { candidateId: ids[1], count: 1 }, { candidateId: ids[2], count: 0 }])
  assert.deepEqual(snapshot.own.ins!.candidateIds, [ids[1], ids[0]])
  assert.equal('favorite' in snapshot.shared, false); assert.equal('participants' in snapshot.own.ins!, false)
  room = send(room, 0, { type: 'agree', generation: 1, expectedRosterVersion: 1, expectedProposalVersion: room.proposalVersion,
    candidateId: ids[0], agreed: false, expectedOwnAgreementRevision: room.participants[0].agreementRevision })
  assert.deepEqual(room.participants[0].ins, [ids[1]])
})
test('memory and relational row mapping preserve ins revisions, favorites and tiebreak, null columns load defaults', async () => {
  const room = pick(tied(), 0, ids[1]), memory = new ProposalMemoryRepository()
  await memory.insert(room); assert.deepEqual((await memory.read(room.id))!.room, room)
  const sql = async () => ({ rows: [], rowcount: 1, cols: [] })
  const repo = new RelationalProposalRepository(sql, 'matches-in-storage-secret-at-least-32')
  // The real row planner/validator and the same decoder the relational read uses, without a live database.
  const plan = (repo as any).plan(room, 0)
  const head = parseRow(tables.room, plan.head)
  assert.equal(head.in_version, room.inVersion)
  assert.equal(head.tiebreak_record, encodeMatches(room))
  const loaded = structuredClone(room); loaded.tiebreak = null
  for (const p of loaded.participants) { delete p.ins; delete p.inRevision; delete p.favorite }
  decodeMatches(loaded, head.tiebreak_record); assert.deepEqual(loaded, room)
  const reader = new RelationalProposalRepository(async (statement, args = []) => {
    const name = statement.match(/ FROM (doc\.yepwatch_\w+)/)![1]
    const table = Object.values(tables).find(t => t.name === name)!
    const names = columns(table)
    const rows = name === tables.room.name ? [[...names.map(k => head[k]), 1, 1]] :
      [...plan.records.values()].filter((r: any) => tables[r.entity as keyof typeof tables].name === name && args.includes(r.row.record_id))
        .map((r: any) => names.map(k => r.row[k] ?? null))
    assert.equal(statement.includes('ANY(?)'), false)
    return { rows, rowcount: rows.length, cols: [] }
  }, 'matches-in-storage-secret-at-least-32')
  const read = (await reader.read(room.id))!.room
  assert.equal(read.inVersion, room.inVersion); assert.deepEqual(read.tiebreak, room.tiebreak)
  assert.deepEqual(read.participants.map(p => [p.ins, p.inRevision, p.favorite]), room.participants.map(p => [p.ins, p.inRevision, p.favorite]))
  const empty = fixture(); decodeMatches(empty, null); assert.equal(empty.tiebreak, null)
  const old = { ...head }; delete old.in_version; delete old.tiebreak_record
  assert.doesNotThrow(() => parseRow(tables.room, old))
})
test('running single-title check cancels on join and resumes only when the new participant is in', () => {
  const before = mark(mark(fixture(), 0, ids[0]), 1, ids[0])
  assert.equal(before.agreement.state, 'checking')
  let room = structuredClone(before)
  room.participants.push({ ...structuredClone(room.participants[0]), id: 'new', ins: [], inRevision: 0, approvedProposalVersion: null, agreementRevision: 0 })
  room.rosterVersion++; reconcile(room, before)
  assert.equal(room.agreement.state, 'none'); assert.equal(agreementCandidate(room), null)
  room = mark(room, 2, ids[0]); assert.equal(room.agreement.state, 'checking')
  assert.equal(proposalSnapshot(room, room.hostId).shared.ins![0].count, 3)
})
test('setup/restart clears ins and tiebreak; legacy stored approvals upgrade without loss', () => {
  const room = fixture(), id = ids[0]
  delete room.participants[0].ins; delete room.participants[0].inRevision
  room.proposalVersion = 3; room.proposal = { candidateId: id, version: 3, previousCandidateId: null, proposerId: room.hostId, baseParticipantIds: room.participants.map(p => p.id) }
  room.participants[0].approvedProposalVersion = 3; room.participants[0].agreementRevision = 2
  initializeIns(room); assert.deepEqual(room.participants[0].ins, [id]); assert.equal(room.participants[0].inRevision, 2)
  const reset = send(tied(), 0, { type: 'restart', expectedRevision: 1, expectedGeneration: 1 })
  assert.deepEqual(proposalSnapshot(reset, reset.hostId).shared.ins, []); assert.equal(reset.tiebreak, null)
  assert.ok(reset.participants.every(p => !p.ins!.length && p.favorite === null))
})

test('a final tiebreak decision stays historical after a join; obsolete transient tie is hidden', () => {
  const room = pick(pick(tied(), 0, ids[1]), 1, ids[1])
  room.phase = 'decided'; room.decision = { candidateId: ids[1], agreementVersion: room.agreement.version, decidedAt: 1, availability: [] }
  room.participants.push({ ...structuredClone(room.participants[0]), id: 'new', ins: [], favorite: null, approvedProposalVersion: null, votes: {} })
  const s = proposalSnapshot(room, room.hostId)
  assert.equal(s.shared.phase, 'decided'); assert.equal(s.shared.decision!.candidateId, ids[1])
  assert.equal(s.shared.tiebreak, null); assert.equal(s.own.favorite, null)
})

test('service commits favorite outcome and fresh offers before the final decision; set_in uses normal command receipts', async () => {
  const repo = new ProposalMemoryRepository(), checked: string[] = []
  const service = new ProposalService(repo, { ...proposalFixtureCatalog, async recheck(room, candidate) {
    checked.push(candidate.id); return candidate.availability
  } }, 'matches-service-secret-at-least-thirty-two')
  const request = (nickname: string) => ({ contractVersion: 3 as const, commandId: nickname, admissionSecret: nickname.repeat(43), nickname })
  const a = await service.create(request('a'))
  const b = await service.join(a.credential.roomId, { ...request('b'), inviteCode: a.invite.code })
  const room = repo.rows.get(a.credential.roomId)!.room
  const base = fixture()
  room.phase = 'choosing'; room.generation = 1; room.candidates = base.candidates; room.screens = base.screens
  for (const p of room.participants) { p.votes = structuredClone(base.participants[0].votes); p.ins = []; p.inRevision = 0; p.screenId = 'room'; p.serviceIds = [1] }
  let sequence = 0
  const command = async (who: typeof a, value: RoomCommand) => {
    const snapshot = await service.read(room.id, who.credential)
    return service.command(room.id, who.credential, { commandId: `cmd_${++sequence}`, sequence: snapshot.own.nextSequence, command: value })
  }
  await command(a, { type: 'set_in', generation: 1, candidateId: ids[0], in: true, expectedOwnInRevision: 0 })
  await command(a, { type: 'set_in', generation: 1, candidateId: ids[1], in: true, expectedOwnInRevision: 1 })
  // Seed the multi-title selection before settlement; the pure transition tests exercise every intervening mark.
  const row = repo.rows.get(room.id)!.room, before = structuredClone(row)
  row.participants[1].ins = ids.slice(0, 2); row.participants[1].inRevision = 2; reconcile(row, before)
  const version = row.tiebreak!.version
  await command(a, { type: 'pick_favorite', generation: 1, tiebreakVersion: version, candidateId: ids[1] })
  const result = await command(b, { type: 'pick_favorite', generation: 1, tiebreakVersion: version, candidateId: ids[1] })
  assert.equal(result.snapshot.shared.phase, 'decided')
  assert.equal(result.snapshot.shared.proposal!.candidateId, ids[1])
  assert.equal(result.snapshot.shared.decision!.candidateId, ids[1]); assert.deepEqual(checked, [ids[1]])
  assert.equal(result.snapshot.shared.decision!.proposalVersion, result.snapshot.shared.proposalVersion)
})


test('stale matches records ignore departed participants and initialize joiners before reconciliation', () => {
  const original = tied(), record = encodeMatches(original)
  for (const joiners of [1, 2]) {
    const loaded = structuredClone(original)
    loaded.participants.splice(1, 1)
    for (let i = 0; i < joiners; i++) loaded.participants.push({
      ...structuredClone(original.participants[1]), id: `joined_${i}`, agreementRevision: 7,
    })
    loaded.rosterVersion++
    decodeMatches(loaded, record)
    assert.deepEqual(loaded.participants[0].ins, ids.slice(0, 2))
    for (const p of loaded.participants.slice(1)) {
      assert.deepEqual(p.ins, [])
      assert.equal(p.inRevision, 7)
      assert.equal(p.favorite, null)
    }
    reconcile(loaded, structuredClone(loaded))
    assert.equal(loaded.tiebreak, null)
    assert.equal(loaded.agreement.state, 'none')
    assert.deepEqual(proposalSnapshot(loaded, loaded.hostId).shared.ins!.map(c => c.count), [1, 1, 0])
  }
  const invalid = JSON.parse(record)
  invalid.participants.push(invalid.participants[0])
  assert.throws(() => decodeMatches(structuredClone(original), JSON.stringify(invalid)), /Invalid matches participants/)
  assert.throws(() => decodeMatches(structuredClone(original), '{'))
  assert.throws(() => decodeMatches(structuredClone(original), JSON.stringify({ participants: [] })))
})

test('set_in continuing shows requires every active participant to have linked, unexpired member progress', () => {
  const now = 1000, room = fixture()
  room.constraints.kinds = ['show_continue']
  room.candidates[0].identity = { kind: 'show_continue', tmdbId: 1, episode: { tmdbId: 2, season: 1, number: 2 } }
  for (const p of room.participants) {
    p.member = { state: 'linked', prefill: null }
    p.memberGrant = { accessToken: 'grant', expiresAt: now + 1 }
  }
  const command = (value: ProposalRoom, inValue = true) => proposalTransition(value, value.hostId, {
    commandId: 'progress', sequence: 1,
    command: { type: 'set_in', generation: 1, candidateId: ids[0], in: inValue, expectedOwnInRevision: 0 },
  }, now)
  for (const state of ['guest', 'missing', 'expired'] as const) {
    const invalid = structuredClone(room), other = invalid.participants[1]
    if (state === 'guest') other.member = { state: 'guest', prefill: null }
    if (state === 'missing') delete other.memberGrant
    if (state === 'expired') other.memberGrant!.expiresAt = now
    assert.throws(() => command(invalid), { code: 'member_required', status: 403 })
    assert.deepEqual(invalid.participants[0].ins, [])
    if (state === 'expired') assert.doesNotThrow(() => command(invalid, false))
    other.leftAt = now
    assert.doesNotThrow(() => command(invalid))
  }
  assert.deepEqual(command(room).participants[0].ins, [ids[0]])
})

const propose = (room: ProposalRoom, who: number, candidateId: string) => send(room, who, {
  type: 'propose', generation: room.generation, expectedRosterVersion: room.rosterVersion,
  expectedProposalVersion: room.proposalVersion, candidateId,
})

test('legacy re-propose refreshes an existing in and moves the projected proposal', () => {
  let room = propose(fixture(), 0, ids[1])
  room = propose(room, 1, ids[0])
  assert.equal(room.proposal!.candidateId, ids[0])
  const before = structuredClone(room), actor = before.participants[0]
  room = propose(room, 0, ids[1])
  assert.equal(room.proposal!.candidateId, ids[1])
  assert.deepEqual(room.participants.map(p => p.ins), [[ids[1]], [ids[0]]])
  assert.equal(room.inVersion, before.inVersion! + 1)
  assert.equal(room.participants[0].inOrder![ids[1]], room.inVersion)
  assert.equal(room.proposalVersion, before.proposalVersion + 1)
  assert.equal(room.participants[0].inRevision, actor.inRevision! + 1)
  assert.equal(room.participants[0].agreementRevision, actor.agreementRevision + 1)
  assert.equal(room.participants[0].insAgreementRevision, room.participants[0].agreementRevision)
  assert.throws(() => send(room, 0, { type: 'set_in', generation: room.generation, candidateId: ids[1],
    in: false, expectedOwnInRevision: actor.inRevision! }), /Your I'm in changed/)
  assert.throws(() => send(room, 0, { type: 'agree', generation: room.generation, candidateId: ids[1],
    expectedRosterVersion: room.rosterVersion, expectedProposalVersion: room.proposalVersion,
    agreed: false, expectedOwnAgreementRevision: actor.agreementRevision }), /Your agreement changed/)
})

test('legacy propose moves only the actor and cannot trap legacy clients in a hidden tie', () => {
  let room = tied()
  room = propose(room, 0, ids[2])
  assert.deepEqual(room.participants[0].ins, [ids[2]])
  assert.deepEqual(room.participants[1].ins, ids.slice(0, 2))
  assert.equal(room.tiebreak, null)
  assert.equal(room.proposal!.candidateId, ids[2])
  room = propose(room, 1, ids[2])
  assert.equal(agreementCandidate(room)?.id, ids[2])
})

test('equal counts project the most recently added in, preserved through storage', () => {
  let room = mark(fixture(), 0, ids[2])
  room = mark(room, 1, ids[0])
  assert.equal(room.proposal!.candidateId, ids[0])
  const loaded = structuredClone(room)
  for (const p of loaded.participants) delete p.inOrder
  decodeMatches(loaded, encodeMatches(room))
  reconcile(loaded, structuredClone(loaded))
  assert.equal(loaded.proposal!.candidateId, ids[0])
  room = mark(room, 0, ids[1])
  assert.equal(room.proposal!.candidateId, ids[1])
  room = mark(room, 1, ids[2])
  assert.equal(room.proposal!.candidateId, ids[2], 'counts take precedence over recency')
})

test('old API writes invalidate stale ins in whole-room JSON and relational extension records', () => {
  const original = mark(mark(fixture(), 0, ids[0]), 1, ids[1])
  const record = encodeMatches(original)
  for (const relational of [false, true]) {
    const room = structuredClone(original)
    room.proposalVersion++
    room.proposal = { candidateId: ids[2], version: room.proposalVersion, previousCandidateId: ids[0],
      proposerId: 'person_1', baseParticipantIds: room.participants.map(p => p.id) }
    for (const p of room.participants) { p.approvedProposalVersion = null; p.agreementRevision++ }
    room.participants[1].approvedProposalVersion = room.proposalVersion
    if (relational) decodeMatches(room, record)
    else {
      const repo = new ValkeyRoomRepository({} as never, {} as never, 'valkey-overlap-secret-at-least-thirty-two',
        { accounts: {} as never, deletions: {} as never, retentionDays: 30 })
      Object.assign(room, repo.decode(room.id, repo.encode(room)))
    }
    assert.deepEqual(room.participants.map(p => p.ins), [[], [ids[2]]])
    assert.ok(room.participants.every(p => p.insAgreementRevision === p.agreementRevision))
    assert.equal(room.tiebreak, null)
  }
})

test('roster-only close and reopen never reuse a tiebreak version or accept an old favorite', () => {
  let room = fixture(3)
  for (const who of [0, 1]) for (const id of ids.slice(0, 2)) room = mark(room, who, id)
  room = send(room, 2, { type: 'leave' })
  const version = room.tiebreak!.version
  room = pick(room, 0, ids[0])
  const previous = structuredClone(room)
  room.participants[2].leftAt = null; room.rosterVersion++; reconcile(room, previous)
  assert.equal(room.tiebreak, null)
  room = send(room, 2, { type: 'leave' })
  assert.ok(room.tiebreak!.version > version)
  assert.throws(() => send(room, 0, { type: 'pick_favorite', generation: 1, tiebreakVersion: version, candidateId: ids[0] }), /The tiebreak changed/)
})

test('unrelated in changes preserve a failed offer check but real candidate changes restart it', () => {
  let room = mark(mark(fixture(), 0, ids[0]), 1, ids[0])
  room.agreement.state = 'unavailable'; room.agreement.error = { code: 'no_intersection' }
  const failed = structuredClone(room.agreement)
  room = mark(room, 0, ids[1])
  assert.deepEqual(room.agreement, failed)
  room = mark(room, 1, ids[1])
  assert.equal(room.agreement.state, 'none')
})

test('public tiebreak seed is absent until the outcome exists', () => {
  let room = tied()
  assert.equal('seed' in proposalSnapshot(room, room.hostId).shared.tiebreak!, false)
  room = pick(pick(room, 0, ids[0]), 1, ids[1])
  assert.equal(proposalSnapshot(room, room.hostId).shared.tiebreak!.seed, room.tiebreak!.seed)
})

test('restart advances a legacy in revision from its agreement revision', () => {
  const room = fixture()
  for (const p of room.participants) { delete p.inRevision; p.agreementRevision = 19 }
  const reset = send(room, 0, { type: 'restart', expectedRevision: room.revision, expectedGeneration: room.generation })
  assert.ok(reset.participants.every(p => p.inRevision! >= 20))
})

test('matches migration and schema store the extension without indexing or columnstore', async () => {
  const { readFile } = await import('node:fs/promises')
  for (const file of ['schema.sql', 'migrations/20261115-matches-in.sql']) {
    const sql = await readFile(new URL(file, import.meta.url), 'utf8')
    assert.match(sql, /"?tiebreak_record"? TEXT INDEX OFF STORAGE WITH \(columnstore = false\)/)
  }
})

test('agreement inputs include reaching unanimity while viewing context is missing', () => {
  const base = fixture()
  base.screens[0].confirmed = false
  const room = mark(mark(base, 0, ids[0]), 1, ids[0])
  assert.equal(room.agreement.state, 'unavailable')
  assert.equal(room.agreement.error?.code, 'needs_context')
  const previous = structuredClone(room), ready = structuredClone(room)
  ready.screens[0].confirmed = true; ready.contextVersion++
  reconcile(ready, previous)
  assert.equal(ready.agreement.state, 'checking')
})
