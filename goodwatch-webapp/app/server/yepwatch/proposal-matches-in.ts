import { randomBytes } from 'node:crypto'
import type { ProposalRoom, ProposalParticipant } from './proposal-types.ts'
import { activeRoom } from './proposal-context.ts'

/** Upgrade stored single-proposal approvals without losing installed clients' selections. */
export function initializeIns(room: ProposalRoom) {
  room.inVersion ??= 0
  room.tiebreak ??= null
  for (const p of room.participants) {
    if (p.insAgreementRevision !== undefined && p.insAgreementRevision !== p.agreementRevision) {
      delete p.ins
      p.inRevision = Math.max(p.inRevision ?? 0, p.agreementRevision)
      p.inOrder = {}
      p.favorite = null
      room.tiebreak = null
    }
    p.ins ??= room.proposal && p.approvedProposalVersion === room.proposal.version ? [room.proposal.candidateId] : []
    p.inRevision ??= p.agreementRevision
    p.favorite ??= null
    p.insAgreementRevision = p.agreementRevision
    p.inOrder ??= {}
  }
}
export function inCounts(room: ProposalRoom, ids: string[]) {
  const people = activeRoom(room).participants
  return ids.map(candidateId => ({ candidateId, count: people.filter(p => p.ins?.includes(candidateId) ||
    (p.ins === undefined && room.proposal?.candidateId === candidateId && p.approvedProposalVersion === room.proposal.version)).length }))
}
export function favoriteCounts(room: ProposalRoom) {
  const tie = room.tiebreak
  return tie ? tie.candidateIds.map(candidateId => ({ candidateId, count: activeRoom(room).participants.filter(p =>
    p.favorite?.tiebreakVersion === tie.version && p.favorite.candidateId === candidateId).length })) : []
}
/** Exact UTF-16 FNV-1a used by the app's tieOutcome. */
export function tieHash(text: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}
export function settleTie(room: ProposalRoom) {
  const tie = room.tiebreak, required = activeRoom(room).participants.length
  if (!tie || tie.outcome || !required) return
  const counts = favoriteCounts(room)
  if (counts.reduce((sum, f) => sum + f.count, 0) !== required) return
  const top = Math.max(...counts.map(f => f.count))
  const among = counts.filter(f => f.count === top).map(f => f.candidateId)
  tie.outcome = { candidateId: among[tieHash(`${tie.seed}:${among.join(',')}`) % among.length], spun: among.length > 1, among }
}
export function setIn(room: ProposalRoom, p: ProposalParticipant, id: string, value: boolean) {
  initializeIns(room)
  if (p.ins!.includes(id) !== value) {
    p.ins = value ? [...p.ins!, id] : p.ins!.filter(c => c !== id)
    p.inRevision!++
    p.agreementRevision++
    room.inVersion!++
    p.insAgreementRevision = p.agreementRevision
    if (value) p.inOrder![id] = room.inVersion!
    else delete p.inOrder![id]
  }
  if (value && p.votes[id]?.value !== 'watch') {
    const revision = (p.votes[id]?.revision ?? 0) + 1
    delete p.votes[id]
    p.votes[id] = { value: 'watch', revision, activeExposureMs: null, timingSource: 'implied' }
    p.lastVotedId = id
  }
}
/** Returns the title eligible for the existing offer check; proposal stays the legacy aggregate. */
export function reconcileIns(room: ProposalRoom, previous: ProposalRoom, ids: string[], oldIds: string[]) {
  initializeIns(room)
  const people = activeRoom(room).participants
  // A seat joining again starts empty. Departed seats cannot contribute or retain a favorite.
  for (const p of room.participants) {
    const old = previous.participants.find(o => o.id === p.id)
    const kept = p.leftAt != null || old?.leftAt != null ? [] : p.ins!.filter(id => room.candidates.some(c => c.id === id) && p.votes[id]?.value === 'watch')
    if (JSON.stringify(kept) !== JSON.stringify(p.ins)) { p.ins = kept; p.inRevision!++; p.agreementRevision++; p.insAgreementRevision = p.agreementRevision }
    if (p.leftAt != null || old?.leftAt != null) p.favorite = null
  }
  const counts = room.phase === 'setup' ? [] : inCounts(room, ids)
  if (JSON.stringify(counts) !== JSON.stringify(previous.phase === 'setup' ? [] : inCounts(previous, oldIds)) &&
      room.inVersion === (previous.inVersion ?? 0)) room.inVersion!++
  const everyone = people.length ? counts.filter(c => c.count === people.length).map(c => c.candidateId) : []
  if (everyone.length >= 2) {
    if (!room.tiebreak || room.tiebreak.candidateIds.length !== everyone.length || room.tiebreak.candidateIds.some(id => !everyone.includes(id))) {
      room.inVersion = Math.max(room.inVersion!, previous.inVersion ?? 0) + 1
      room.tiebreak = { version: room.inVersion, candidateIds: everyone, seed: randomBytes(8).toString('hex'), outcome: null }
      for (const p of room.participants) p.favorite = null
    } else if (room.rosterVersion !== previous.rosterVersion) room.tiebreak.outcome = null
    settleTie(room)
  } else {
    room.tiebreak = null
    for (const p of room.participants) p.favorite = null
  }
  const winner = room.tiebreak?.outcome?.candidateId ?? (everyone.length === 1 ? everyone[0] : null)
  const latest = (id: string) => Math.max(0, ...people.filter(p => p.ins!.includes(id)).map(p => p.inOrder?.[id] ?? 0))
  const best = counts.reduce<{ candidateId: string; count: number } | null>((best, c) =>
    c.count > 0 && (c.count > (best?.count ?? 0) || (best && c.count === best.count && latest(c.candidateId) > latest(best.candidateId))) ? c : best, null)?.candidateId ?? null
  // Preserve the pending title across a late join so legacy agree can supply its implied Yep.
  const pending = !best && room.proposal && room.candidates.some(c => c.id === room.proposal!.candidateId) &&
    people.some(p => p.ins!.includes(room.proposal!.candidateId)) &&
    !people.some(p => p.votes[room.proposal!.candidateId]?.value === 'pass' ||
      (room.proposal!.baseParticipantIds.includes(p.id) && p.votes[room.proposal!.candidateId]?.value !== 'watch')) ? room.proposal.candidateId : null
  const selected = winner ?? best ?? pending
  if (selected !== (room.proposal?.candidateId ?? null) || (selected && (room.inVersion !== (previous.inVersion ?? 0) ||
      room.tiebreak?.outcome?.candidateId !== previous.tiebreak?.outcome?.candidateId))) {
    const old = room.proposal?.candidateId ?? null
    room.proposalVersion = Math.max(room.proposalVersion, previous.proposalVersion + 1)
    room.proposal = selected ? { candidateId: selected, version: room.proposalVersion, previousCandidateId: selected === old ? room.proposal?.previousCandidateId ?? null : old,
      proposerId: people.find(p => p.ins!.includes(selected))!.id, baseParticipantIds: people.filter(p => p.votes[selected]?.value === 'watch').map(p => p.id) } : null
  }
  for (const p of room.participants) p.approvedProposalVersion = room.proposal && p.ins!.includes(room.proposal.candidateId) ? room.proposal.version : null
  return winner
}
