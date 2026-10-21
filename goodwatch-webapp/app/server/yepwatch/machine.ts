import type { Candidate, CommandEnvelope, EpisodeIdentity, ProgressConflict, RoomCommand, RoomSnapshot, SharedRoomSnapshot } from '../../../packages/yepwatch-contracts/index.ts'
import type { Participant, Room } from './types.ts'
import { LIMITS } from './types.ts'
import { requireRoom } from './errors.ts'
export function live(room: Room, now: number) { requireRoom(room.expiresAt > now, 'expired', 'Room expired', 410) }
export function participant(room: Room, id: string): Participant {
  const p = room.participants.find(p => p.id === id)
  requireRoom(p, 'unauthorized', 'Participant unavailable', 401); return p
}
export function progressConflicts(room: Room, p: Participant): ProgressConflict[] {
  const result: ProgressConflict[] = []
  for (const c of room.candidates) {
    if (c.identity.kind !== 'show_continue') continue
    const episode = c.identity.episode
    const own = p.progress.find(s => s.showId === c.identity.tmdbId)
    if (own && own.input.state !== 'unknown' && own.approvedEpisodeId === episode.tmdbId) continue
    const ownNext = own?.input.state === 'continue' ? own.input.nextEpisodeId : null
    result.push({ showId: c.identity.tmdbId, reason: !own || own.input.state === 'unknown' ? 'missing_progress' : ownNext === episode.tmdbId ? 'rewind_or_spoiler_approval' : 'different_next_episode', ownNextEpisodeId: ownNext, proposedEpisode: episode })
  }
  return result
}
export function shared(room: Room): SharedRoomSnapshot {
  return structuredClone({
    contractVersion: 1, roomId: room.id, revision: room.revision, phase: room.phase, expiresAt: room.expiresAt,
    rosterVersion: room.rosterVersion, contextVersion: room.contextVersion, hostParticipantId: room.hostId,
    participants: room.participants.map(p => ({ participantId: p.id, nickname: p.nickname, screenId: p.screenId, ready: p.ready,
      participation: room.round ? room.round.memberIds.includes(p.id) ? 'included' : 'waiting' : 'invited',
      completedCount: room.round?.memberIds.includes(p.id) ? Object.values(p.votes).filter(v => v.value !== null).length : 0, presence: 'unknown' })),
    screens: room.screens.map(s => ({ id: s.id, label: s.label, country: s.country, serviceIds: [...s.serviceIds], confirmed: s.confirmed })), constraints: { kinds: [...room.constraints.kinds], maxMinutes: room.constraints.maxMinutes, moods: [...room.constraints.moods] },
    round: room.round ? { version: room.round.version, rosterVersion: room.round.rosterVersion, contextVersion: room.round.contextVersion, candidateCount: room.candidates.length, completed: room.phase !== 'voting' } : null,
    candidates: room.candidates.map(projectCandidate), episodeProposals: room.episodeProposals.map(p => ({ showId: p.showId, episode: projectEpisode(p.episode), version: p.version })),
    shortlist: room.shortlist ? { version: room.shortlistVersion, proposalVersion: room.proposalVersion, candidateIds: room.shortlist, proposedCandidateId: room.proposedId,
      consentCount: room.round!.memberIds.filter(id => { const c = participant(room, id).consent; return c?.proposalVersion === room.proposalVersion && c.accepted }).length } : null,
    decision: room.decision ? { candidateId: room.decision.candidateId, proposalVersion: room.decision.proposalVersion, decidedAt: room.decision.decidedAt, availability: projectAvailability(room.decision.availability) } : null,
  }) as SharedRoomSnapshot
}
function projectEpisode(e: EpisodeIdentity): EpisodeIdentity { return { tmdbId: e.tmdbId, season: e.season, number: e.number, ...(e.displaySeason === undefined ? {} : { displaySeason: e.displaySeason }), ...(e.displayNumber === undefined ? {} : { displayNumber: e.displayNumber }), ...(e.presentationVersion === undefined ? {} : { presentationVersion: e.presentationVersion }) } }
function projectAvailability(rows: Candidate['availability']): Candidate['availability'] {
  return rows.map(a => ({ screenId: a.screenId, state: a.state, scope: a.scope, checkedAt: a.checkedAt,
    offers: a.offers.map(o => ({ serviceId: o.serviceId, name: o.name, url: o.url, kind: o.kind, offerType: o.offerType })) }))
}
/** Whitelist nested transport fields too: catalog objects must never smuggle private metadata into a broadcast. */
export function projectCandidate(c: Candidate): Candidate {
  const identity = c.identity
  const e = identity.kind === 'movie' ? null : identity.episode
  return { id: c.id, title: c.title, year: c.year, overview: c.overview, posterUrl: c.posterUrl, runtimeMinutes: c.runtimeMinutes,
    identity: identity.kind === 'movie' ? { kind: 'movie', tmdbId: identity.tmdbId } : { kind: identity.kind, tmdbId: identity.tmdbId, episode: {
      tmdbId: e!.tmdbId, season: e!.season, number: e!.number,
      ...(e!.displaySeason === undefined ? {} : { displaySeason: e!.displaySeason }), ...(e!.displayNumber === undefined ? {} : { displayNumber: e!.displayNumber }), ...(e!.presentationVersion === undefined ? {} : { presentationVersion: e!.presentationVersion }),
    } }, availability: projectAvailability(c.availability) }
}
export function snapshot(room: Room, id: string): RoomSnapshot {
  const p = participant(room, id)
  return { shared: shared(room), own: structuredClone({ participantId: id, roundCompleted: p.complete, nextSequence: p.nextSequence, canHost: id === room.hostId,
    votes: Object.entries(p.votes).map(([candidateId, vote]) => ({ candidateId, ...vote })), progress: p.progress,
    progressConflicts: progressConflicts(room, p), shortlistPreference: p.preference, consent: p.consent }) }
}
function host(room: Room, p: Participant) { requireRoom(room.hostId === p.id, 'forbidden', 'Host capability required', 403) }
function setup(room: Room) { requireRoom(room.phase === 'setup', 'conflict', 'Start a new round before changing setup') }
function fence(actual: number, expected: number) { requireRoom(actual === expected, 'conflict', 'State version changed') }
function included(room: Room, p: Participant) { requireRoom(room.round?.memberIds.includes(p.id), 'forbidden', 'Participant waits until next round', 403) }
/** Reused before discovery and at the authoritative transition; adapter work grants no permission to commit. */
export function preflightStartRound(room: Room, actorId: string, command: Extract<RoomCommand, { type: 'start_round' }>, now: number) {
  live(room, now)
  host(room, participant(room, actorId)); setup(room)
  fence(room.rosterVersion, command.expectedRosterVersion); fence(room.contextVersion, command.expectedContextVersion)
  requireRoom(room.participants.every(m => m.ready && m.screenId), 'needs_context', 'Everyone must confirm a viewing screen and be ready')
}
export function transition(original: Room, actorId: string, envelope: CommandEnvelope, now: number, prepared?: Candidate[], rechecked?: Candidate['availability'], proposedEpisode?: EpisodeIdentity): Room {
  const room = structuredClone(original); live(room, now)
  const p = participant(room, actorId); const c = envelope.command
  switch (c.type) {
    case 'setup':
      host(room, p); setup(room); fence(room.contextVersion, c.expectedContextVersion)
      room.screens = c.screens; room.constraints = c.constraints; room.contextVersion++
      for (const member of room.participants) { member.ready = false; if (!c.screens.some(s => s.id === member.screenId)) member.screenId = null }
      p.screenId = c.screenId
      break
    case 'assign_screen':
      setup(room); fence(room.contextVersion, c.expectedContextVersion)
      requireRoom(room.screens.some(s => s.id === c.screenId), 'invalid_request', 'Unknown screen', 400)
      p.screenId = c.screenId; p.ready = false; room.rosterVersion++
      break
    case 'ready':
      setup(room); fence(room.contextVersion, c.expectedContextVersion)
      requireRoom(p.screenId && room.screens.some(s => s.id === p.screenId && s.confirmed && s.country && s.serviceIds.length), 'needs_context', 'Confirm your viewing screen')
      p.ready = c.ready
      break
    case 'show_progress':
      setup(room)
      p.progress = [...p.progress.filter(s => s.showId !== c.showId), { showId: c.showId, input: c.input, approvedEpisodeId: c.approvedEpisodeId }]
      requireRoom(p.progress.length <= 30, 'limit_reached', 'Too many continuation selections', 400)
      p.ready = false; room.contextVersion++
      // Changing private inputs invalidates readiness without publishing those inputs.
      for (const member of room.participants) member.ready = false
      break
    case 'propose_episode': {
      host(room, p); setup(room); fence(room.contextVersion, c.expectedContextVersion)
      requireRoom(proposedEpisode?.tmdbId === c.episodeId, 'catalog_unavailable', 'Canonical episode unavailable', 503)
      const previous = room.episodeProposals.find(s => s.showId === c.showId)
      room.episodeProposals = [...room.episodeProposals.filter(s => s.showId !== c.showId), { showId: c.showId, episode: projectEpisode(proposedEpisode), version: (previous?.version ?? 0) + 1 }]
      requireRoom(room.episodeProposals.length <= 30, 'limit_reached', 'Too many proposed shows')
      room.contextVersion++
      for (const member of room.participants) { member.ready = false; const progress = member.progress.find(s => s.showId === c.showId); if (progress) progress.approvedEpisodeId = null }
      break
    }
    case 'start_round': {
      preflightStartRound(room, actorId, c, now)
      requireRoom(prepared, 'catalog_unavailable', 'Candidate adapter unavailable', 503)
      requireRoom(prepared.length > 0, 'no_intersection', 'No eligible candidates; adjust context or progress')
      requireRoom(prepared.length <= LIMITS.deck && new Set(prepared.map(x => x.id)).size === prepared.length, 'catalog_unavailable', 'Invalid candidate deck', 503)
      requireRoom(prepared.every(x => room.constraints.kinds.includes(x.identity.kind)), 'catalog_unavailable', 'Unexpected candidate kind', 503)
      requireRoom(prepared.every(x => { const identity = x.identity; return identity.kind !== 'show_continue' || room.episodeProposals.some(p => p.showId === identity.tmdbId && p.episode.tmdbId === identity.episode.tmdbId) }), 'needs_progress', 'Publish a shared episode proposal before continuation voting')
      room.candidates = prepared
      // Every participant explicitly agrees to the selected continuation episode; disagreement never silently rewinds or skips.
      requireRoom(room.participants.every(m => progressConflicts(room, m).length === 0), 'needs_progress', 'Continuation requires each person’s explicit episode agreement')
      for (const member of room.participants) { member.votes = {}; member.complete = false; member.preference = null; member.consent = null }
      room.roundVersion++; room.round = { version: room.roundVersion, rosterVersion: room.rosterVersion, contextVersion: room.contextVersion, memberIds: room.participants.map(m => m.id) }
      room.phase = 'voting'; break
    }
    case 'vote': {
      requireRoom(room.phase === 'voting', 'conflict', 'Voting round is closed'); included(room, p); fence(room.round!.version, c.roundVersion)
      requireRoom(!p.complete, 'conflict', 'Round already completed by participant')
      requireRoom(room.candidates.some(x => x.id === c.candidateId), 'invalid_request', 'Candidate outside deck', 400)
      const old = p.votes[c.candidateId] ?? { value: null, revision: 0 }; fence(old.revision, c.expectedVoteRevision)
      p.votes[c.candidateId] = { value: c.value, revision: old.revision + 1 }; break
    }
    case 'complete_round':
      requireRoom(room.phase === 'voting', 'conflict', 'Voting round is closed'); included(room, p); fence(room.round!.version, c.roundVersion)
      requireRoom(room.candidates.every(x => p.votes[x.id]?.value != null), 'conflict', 'Finish every candidate before comparing')
      p.complete = true
      if (room.round!.memberIds.every(id => participant(room, id).complete)) {
        // Conservative initial agreement: only unanimous watch candidates; no one’s individual choices/counts are exposed.
        room.shortlist = room.candidates.filter(x => room.round!.memberIds.every(id => participant(room, id).votes[x.id]?.value === 'watch')).slice(0, 5).map(x => x.id)
        room.shortlistVersion++; room.phase = 'shortlist'
      }
      break
    case 'shortlist_preference':
      requireRoom(room.phase === 'shortlist', 'conflict', 'No active shortlist'); included(room, p); fence(room.shortlistVersion, c.shortlistVersion)
      requireRoom(room.shortlist?.includes(c.candidateId), 'invalid_request', 'Candidate outside shortlist', 400); p.preference = c.candidateId; break
    case 'propose':
      host(room, p); requireRoom(room.phase === 'shortlist', 'conflict', 'No active shortlist'); fence(room.shortlistVersion, c.shortlistVersion)
      requireRoom(room.shortlist?.includes(c.candidateId), 'invalid_request', 'Candidate outside shortlist', 400)
      room.proposedId = c.candidateId; room.proposalVersion++; for (const member of room.participants) member.consent = null; break
    case 'consent':
      requireRoom(room.phase === 'shortlist' && room.proposedId, 'conflict', 'No active proposal'); included(room, p); fence(room.proposalVersion, c.proposalVersion)
      p.consent = { proposalVersion: c.proposalVersion, accepted: c.accepted }; break
    case 'decide':
      host(room, p); requireRoom(room.phase === 'shortlist' && room.proposedId, 'conflict', 'No active proposal'); fence(room.proposalVersion, c.proposalVersion)
      requireRoom(room.round!.memberIds.every(id => { const consent = participant(room, id).consent; return consent?.proposalVersion === c.proposalVersion && consent.accepted }), 'conflict', 'Everyone must consent to this proposal')
      requireRoom(rechecked && rechecked.length > 0 && rechecked.every(a => a.state === 'watchable'), 'no_intersection', 'Availability needs rechecking before decision')
      room.decision = { candidateId: room.proposedId!, proposalVersion: c.proposalVersion, decidedAt: now, availability: rechecked }; room.phase = 'decided'; break
    case 'new_round':
      host(room, p); fence(room.revision, c.expectedRevision)
      room.phase = 'setup'; room.round = null; room.candidates = []; room.shortlist = null; room.proposedId = null; room.decision = null; room.contextVersion++; room.rosterVersion++
      for (const member of room.participants) { member.ready = false; member.votes = {}; member.complete = false; member.preference = null; member.consent = null }
      break
  }
  room.revision++
  return room
}
