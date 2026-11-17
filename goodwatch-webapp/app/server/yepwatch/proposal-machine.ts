import {
	initializeIns,
	inCounts,
	favoriteCounts,
	setIn,
	reconcileIns,
	sameIns,
} from "./proposal-matches-in.ts"
import { recordOutcome } from "./proposal-outcome.ts"
import { RANKER_VERSION } from "./proposal-ranker.ts"
import {
	redesignTransition,
	refreshServices,
	candidateEligible,
	candidateMatchesIdeas,
	retireIneligible,
} from "./proposal-redesign.ts"
import { activeRoom, normalizeRoomContext, ROOM_CONTEXT } from "./proposal-context.ts"
import type {
	Candidate,
	CommandEnvelope,
	RoomSnapshot,
	SharedRoomSnapshot,
} from "../../../packages/yepwatch-contracts/proposal.ts"
import {
	continuousTransition,
	continuousSnapshot,
	preflight as basePreflight,
	matches as baseMatches,
} from "./continuous-machine.ts"
import { actor as baseActor, continuousLive } from "./continuous-machine.ts"
import {
	PENDING_IDEA_ATTRIBUTE,
	ideaPending,
} from "../../../packages/yepwatch-contracts/proposal.ts"
import { projectCandidate } from "./machine.ts"
import { requireRoom, memberProgressRequired } from "./errors.ts"
import { CONTINUOUS_LIMITS as L } from "./continuous-types.ts"
import { appendPage } from "./continuous-machine.ts"
import type { ProposalRoom, ProposalParticipant } from "./proposal-types.ts"
export { continuousLive }
export const actor = (room: ProposalRoom, id: string) => baseActor(room, id) as ProposalParticipant
export function matches(room: ProposalRoom): Candidate[] {
	return activeRoom(room).participants.length
		? (baseMatches(activeRoom(room)) as Candidate[]).filter((c) => candidateEligible(room, c))
		: []
}
function readyScreens(room: ProposalRoom) {
	room = activeRoom(room)
	return room.participants.every(
		(p) =>
			p.screenId &&
			room.screens.some(
				(s) => s.id === p.screenId && s.confirmed && s.country && s.serviceIds.length,
			),
	)
}
function allYep(room: ProposalRoom, id: string) {
	room = activeRoom(room)
	return (
		room.participants.length > 0 && room.participants.every((p) => p.votes[id]?.value === "watch")
	)
}
export function averageYepMs(room: ProposalRoom, id: string): number | null {
	room = activeRoom(room)
	if (!matches(room).some((c) => c.id === id)) return null
	const times = room.participants.map((p) => p.votes[id])
	if (
		times.some(
			(v) =>
				v?.timingSource !== "active_exposure" ||
				typeof v.activeExposureMs !== "number" ||
				!Number.isInteger(v.activeExposureMs) ||
				v.activeExposureMs < 0 ||
				v.activeExposureMs > 1200000,
		)
	)
		return null
	return times.reduce((sum, v) => sum + v.activeExposureMs!, 0) / times.length
}
function agreementSelection(room: ProposalRoom) {
	const required = activeRoom(room).participants.length
	if (!required) return null
	const everyone = inCounts(
		room,
		matches(room).map((c) => c.id),
	).filter((c) => c.count === required)
	const id = room.tiebreak
		? room.tiebreak.outcome?.candidateId
		: everyone.length === 1 && sameIns(room.confirmedIns, [everyone[0].candidateId])
			? everyone[0].candidateId
			: null
	return id && everyone.some((c) => c.candidateId === id) ? id : null
}
function signature(room: ProposalRoom) {
	room = activeRoom(room)
	const candidateId = agreementSelection(room)
	return JSON.stringify([
		room.generation,
		room.rosterVersion,
		room.contextVersion,
		candidateId,
		agreementCandidate(room)?.id ?? null,
		room.participants.map((p) => [p.id, p.screenId, p.votes[candidateId ?? ""]?.value ?? null]),
	])
}
export function agreementCandidate(room: ProposalRoom): Candidate | null {
	room = activeRoom(room)
	const required = room.participants.length
	const everyone = inCounts(
		room,
		matches(room).map((c) => c.id),
	).filter((c) => c.count === required)
	const candidateId = room.tiebreak
		? room.tiebreak.outcome?.candidateId
		: everyone.length === 1 && sameIns(room.confirmedIns, [everyone[0].candidateId])
			? everyone[0].candidateId
			: null
	if (
		!candidateId ||
		!required ||
		!room.proposal ||
		room.participants.some((p) => p.revoked) ||
		!readyScreens(room) ||
		!allYep(room, candidateId) ||
		!everyone.some((c) => c.candidateId === candidateId)
	)
		return null
	const c = room.candidates.find((c) => c.id === candidateId)
	if (
		c?.identity.kind === "show_continue" &&
		!room.participants.every((p) => p.member.state === "linked" && p.memberGrant)
	)
		return null
	return c && candidateEligible(room, c) ? c : null
}
function clearApprovals(room: ProposalRoom) {
	for (const p of room.participants) {
		p.approvedProposalVersion = null
		p.agreementRevision++
	}
}
export function reconcile(room: ProposalRoom, previous: ProposalRoom) {
	const oldSignature = signature(previous)
	const oldAgreement = structuredClone(previous.agreement)
	if (
		room.proposal &&
		!room.candidates.some((c) => c.id === room.proposal!.candidateId && candidateEligible(room, c))
	) {
		room.proposal = null
		room.proposalVersion++
	}
	reconcileIns(
		room,
		previous,
		matches(room).map((c) => c.id),
		matches(previous).map((c) => c.id),
	)
	if (signature(room) === oldSignature) {
		room.agreement = oldAgreement
		return
	}
	const allApproved =
		agreementSelection(room) &&
		activeRoom(room).participants.length > 0 &&
		room.proposal &&
		activeRoom(room).participants.every((p) => p.approvedProposalVersion === room.proposal!.version)
	room.agreement = {
		version: oldAgreement.version + 1,
		state: agreementCandidate(room)
			? "checking"
			: allApproved && !readyScreens(room)
				? "unavailable"
				: "none",
		error: allApproved && !readyScreens(room) ? { code: "needs_context" } : null,
	}
}
export function projectedCandidate(c: Candidate): Candidate {
	const base = continuousSnapshotCandidate(c)
	return {
		...base,
		viewingDuration: c.viewingDuration
			? { minutes: c.viewingDuration.minutes, scope: c.viewingDuration.scope }
			: null,
	}
}
function continuousSnapshotCandidate(c: Candidate): Omit<Candidate, "viewingDuration"> {
	return {
		...projectCandidate(c),
		...(c.reason === undefined
			? {}
			: { reason: c.reason == null ? null : { code: c.reason.code, text: c.reason.text } }),
		...(c.tagline === undefined ? {} : { tagline: c.tagline }),
		...(c.certification === undefined ? {} : { certification: c.certification }),
		...(c.scores === undefined ? {} : { scores: c.scores == null ? null : { ...c.scores } }),
		...(c.essence === undefined ? {} : { essence: c.essence }),
		...(c.effects === undefined
			? {}
			: {
					effects:
						c.effects?.map((e) => ({ line: e.line, strength: e.strength, color: e.color })) ?? null,
				}),
		...(c.notFor === undefined ? {} : { notFor: c.notFor }),
		...(c.highlights === undefined
			? {}
			: {
					highlights:
						c.highlights == null ? null : c.highlights.map((h) => ({ key: h.key, label: h.label })),
				}),
		...(c.people === undefined
			? {}
			: {
					people:
						c.people == null
							? null
							: { directors: [...c.people.directors], cast: [...c.people.cast] },
				}),
		...(c.backdropUrl === undefined ? {} : { backdropUrl: c.backdropUrl }),
		...(c.trailerUrl === undefined ? {} : { trailerUrl: c.trailerUrl }),
		...(c.goodwatchScore === undefined ? {} : { goodwatchScore: c.goodwatchScore }),
		...(c.genres === undefined ? {} : { genres: [...c.genres] }),
	}
}
export function proposalSnapshot(room: ProposalRoom, participantId: string): RoomSnapshot {
	const legacy = continuousSnapshot(room, participantId, true)
	const active = activeRoom(room)
	const p = actor(room, participantId)
	const proposal = room.proposal
	const ins =
		room.phase === "setup"
			? []
			: inCounts(
					room,
					matches(room).map((c) => c.id),
				)
	const tie =
		room.tiebreak &&
		active.participants.length > 0 &&
		room.tiebreak.candidateIds.every(
			(id) => ins.find((c) => c.candidateId === id)?.count === active.participants.length,
		)
			? room.tiebreak
			: null
	const shared: SharedRoomSnapshot = {
		...legacy.shared,
		contractVersion: 3,
		ins,
		inVersion: room.inVersion ?? 0,
		tiebreak: tie
			? {
					version: tie.version,
					candidateIds: [...tie.candidateIds],
					...(tie.outcome ? { seed: tie.seed } : {}),
					outcome: structuredClone(tie.outcome),
					favorites: favoriteCounts(room),
				}
			: null,
		// A pending idea's stored marker carries its search reservation: phones see only the marker itself.
		ideas: (room.ideas ?? []).map(({ rankedKeys: _, interpretedAt: __, ...idea }) =>
			ideaPending(idea)
				? { ...structuredClone(idea), attributes: [{ ...PENDING_IDEA_ATTRIBUTE }] }
				: structuredClone(idea),
		),
		disabledServiceIds: [...(room.disabledServiceIds ?? [])],
		participants: legacy.shared.participants.map((person) => ({
			...person,
			serviceIds: actor(room, person.participantId).serviceIds ?? null,
			dropped: actor(room, person.participantId).leftAt != null,
		})),
		// Preserve durable votes and completed decisions, but never serve stale nonmatching cards in an active deck.
		candidates: room.candidates
			.filter((c) => room.phase !== "choosing" || candidateMatchesIdeas(room, c))
			.map(projectedCandidate),
		matches: matches(room).map((c) => ({
			candidateId: c.id,
			averageYepMs: averageYepMs(room, c.id),
		})),
		proposalVersion: room.proposalVersion,
		proposal: proposal
			? {
					candidateId: proposal.candidateId,
					version: proposal.version,
					previousCandidateId: proposal.previousCandidateId,
					agreeCount: active.participants.filter(
						(p) => p.approvedProposalVersion === proposal.version,
					).length,
					requiredCount: active.participants.length,
					averageYepMs: averageYepMs(room, proposal.candidateId),
				}
			: null,
		decision: room.decision
			? {
					candidateId: room.decision.candidateId,
					proposalVersion: room.proposalVersion,
					decidedAt: room.decision.decidedAt,
					availability: projectedCandidate({
						...room.candidates.find((c) => c.id === room.decision!.candidateId)!,
						availability: room.decision.availability,
					}).availability,
				}
			: null,
	}
	// A recovered departure is an acknowledgement, not continuing room access.
	if (p.leftAt != null) {
		shared.phase = "setup"
		shared.hostParticipantId = p.id
		shared.participants = []
		shared.screens = []
		shared.ideas = []
		shared.disabledServiceIds = []
		shared.constraints = {
			kinds: ["movie", "show_start"],
			moods: [],
			maxMinutes: null,
		}
		shared.candidates = []
		shared.matches = []
		shared.ins = []
		shared.inVersion = 0
		shared.tiebreak = null
		shared.proposal = null
		shared.decision = null
		shared.agreement = { version: 0, state: "none", error: null }
		shared.stream = { version: 0, state: "exhausted", reason: "catalog_end" }
	}
	const { pick: _, ...own } = legacy.own
	return {
		shared,
		own: {
			...own,
			nextCandidateId: shared.candidates.find((c) => p.votes[c.id]?.value == null)?.id ?? null,
			ins: {
				candidateIds:
					p.leftAt == null
						? [
								...(p.ins ??
									(proposal && p.approvedProposalVersion === proposal.version
										? [proposal.candidateId]
										: [])),
							]
						: [],
				revision: p.inRevision ?? p.agreementRevision,
			},
			favorite: p.leftAt == null && tie ? structuredClone(p.favorite ?? null) : null,
			showSeen: p.showSeen ?? false,
			left: p.leftAt != null,
			canHost: p.leftAt == null && room.hostId === p.id,
			votes: Object.entries(p.votes).map(([candidateId, v]) => ({
				candidateId,
				value: v.value,
				revision: v.revision,
				activeExposureMs: v.activeExposureMs ?? null,
				timingSource: v.timingSource ?? "unavailable",
			})),
			agreement: {
				proposalVersion: room.proposalVersion,
				agreed: !!proposal && p.approvedProposalVersion === proposal.version,
				revision: p.agreementRevision,
				isProposer: proposal?.proposerId === p.id,
			},
		},
	}
}
/**
 * A refill asked for against a stream version someone else's refill (or a vote that reopened the
 * stream) already moved past. Everyone's deck runs low at the same moment in a big room, so these
 * race; the first one fills the deck and the rest have nothing left to do. They succeed as no-ops
 * instead of failing with a conflict: the asker reads the new stream and refills again if it still
 * needs to.
 */
export function staleRefill(room: ProposalRoom, envelope: CommandEnvelope) {
	const c = envelope.command
	return (
		c.type === "refill" &&
		room.phase === "choosing" &&
		c.generation === room.generation &&
		c.expectedStreamVersion < room.stream.version
	)
}
/**
 * Commands that commute with whatever else changed the room since the sender's view: a friend's
 * services, ideas, settings, joins or leaves never make Start, a setting, a proposal, an agreement or
 * Start again fail. Their version fences are taken as the room's current ones. Fences that guard a real
 * conflict stay: the round (generation), the proposal, your own vote and agreement revisions. Start and
 * Start again commute only when they name the round they were pressed in (`expectedGeneration`): it is
 * their only fence against a delayed press landing in a later round. Installed bundles that don't send it
 * keep their strict version fences.
 */
export function commute(room: ProposalRoom, envelope: CommandEnvelope): CommandEnvelope {
	const c = envelope.command
	switch (c.type) {
		case "start":
			if (c.expectedGeneration === undefined) return envelope
			requireRoom(c.expectedGeneration === room.generation, "conflict", "The round changed")
			return {
				...envelope,
				command: {
					...c,
					expectedRosterVersion: room.rosterVersion,
					expectedContextVersion: room.contextVersion,
				},
			}
		case "configure":
		case "assign_screen":
		case "ready":
			return { ...envelope, command: { ...c, expectedContextVersion: room.contextVersion } }
		case "propose":
		case "agree":
			return { ...envelope, command: { ...c, expectedRosterVersion: room.rosterVersion } }
		case "restart":
			if (c.expectedGeneration === undefined) return envelope
			requireRoom(c.expectedGeneration === room.generation, "conflict", "The round changed")
			return { ...envelope, command: { ...c, expectedRevision: room.revision } }
		default:
			return envelope
	}
}
export function preflight(room: ProposalRoom, actorId: string, sent: CommandEnvelope, now: number) {
	const envelope = commute(room, sent)
	if (staleRefill(room, envelope)) return
	if (envelope.command.type === "start")
		requireRoom(
			!!actor(room, room.hostId).nickname.trim(),
			"needs_context",
			"Set your name before starting",
		)
	if (envelope.command.type === "start" || envelope.command.type === "refill")
		basePreflight(activeRoom(room), actorId, { ...envelope, command: envelope.command }, now)
}
export function proposalTransition(
	original: ProposalRoom,
	actorId: string,
	sent: CommandEnvelope,
	now: number,
	page?: Awaited<ReturnType<import("./proposal-types.ts").ProposalCatalog["page"]>>,
	interpretationReserved = false,
): ProposalRoom {
	const envelope = commute(original, sent)
	const c =
		envelope.command.type === "assign_screen" && original.screens.length === 1
			? { ...envelope.command, screenId: ROOM_CONTEXT }
			: envelope.command
	continuousLive(original, now)
	let voted = false
	const me = actor(original, actorId)
	requireRoom(me.leftAt == null || c.type === "leave", "forbidden", "You have left this room", 403)
	if (c.type === "leave") {
		const next = structuredClone(original)
		const leaving = actor(next, actorId)
		if (leaving.leftAt != null) {
			next.revision++
			return next
		}
		leaving.leftAt = now
		leaving.epoch++
		next.rosterVersion++
		next.revision++
		next.tickets = next.tickets.filter((t) => t.participantId !== actorId)
		next.memberIntents = next.memberIntents?.filter((t) => t.participantId !== actorId)
		const remaining = activeRoom(next).participants
		if (next.hostId === actorId && remaining.length) next.hostId = remaining[0].id
		refreshServices(next)
		if (next.phase !== "decided" && activeRoom(next).participants.length > 0) {
			retireIneligible(next)
			next.stream = {
				version: next.stream.version + 1,
				state: "ready",
				reason: null,
			}
		}
		// Keep the room, cards and answers even if everyone drops out.
		// A completed decision is historical and cannot be reopened by a departure.
		if (next.phase !== "decided") reconcile(next, original)
		return next
	}
	if (c.type === "resume_voting") {
		// Keep parsing the legacy command so older installed clients receive an
		// actionable error. A final decision is never reopened; only the owner's
		// explicit restart may begin another round.
		requireRoom(
			false,
			"conflict",
			"This decision is final. The room owner can choose Start again for a new round.",
		)
	}

	const redesigned = redesignTransition(original, actorId, envelope, now, interpretationReserved)
	if (redesigned) {
		reconcile(redesigned, original)
		return redesigned
	}
	let room: ProposalRoom
	if (
		c.type === "set_in" ||
		c.type === "confirm_in" ||
		c.type === "pick_favorite" ||
		c.type === "propose" ||
		c.type === "agree" ||
		c.type === "retry_agreement"
	) {
		room = structuredClone(original)
		initializeIns(room)
		const p = actor(room, actorId)
		if (c.type === "set_in") {
			requireRoom(
				room.phase === "choosing" && room.generation === c.generation,
				"conflict",
				"Pick a current match",
			)
			if (
				c.in &&
				room.candidates.find((v) => v.id === c.candidateId)?.identity.kind === "show_continue" &&
				!activeRoom(room).participants.every(
					(m) => m.member.state === "linked" && m.memberGrant && m.memberGrant.expiresAt > now,
				)
			)
				memberProgressRequired()
			const pending =
				c.in &&
				c.candidateId === room.proposal?.candidateId &&
				room.candidates.some(
					(candidate) => candidate.id === c.candidateId && candidateEligible(room, candidate),
				)
			requireRoom(
				matches(room).some((m) => m.id === c.candidateId) || pending,
				"conflict",
				"Pick a current match",
			)
			requireRoom(p.inRevision === c.expectedOwnInRevision, "conflict", "Your I'm in changed")
			p.matchesCapable = true
			setIn(room, p, c.candidateId, c.in)
		} else if (c.type === "confirm_in") {
			requireRoom(
				room.phase === "choosing" && room.generation === c.generation,
				"conflict",
				"Pick a current match",
			)
			requireRoom(c.inVersion === room.inVersion, "conflict", "The I'm ins changed")
			const people = activeRoom(room).participants
			const everyone = people.length
				? inCounts(
						room,
						matches(room).map((m) => m.id),
					)
						.filter((v) => v.count === people.length)
						.map((v) => v.candidateId)
				: []
			requireRoom(everyone.length > 0, "conflict", "The I'm ins changed")
			if (
				everyone.length === 1 &&
				room.candidates.find((v) => v.id === everyone[0])?.identity.kind === "show_continue" &&
				!people.every(
					(m) => m.member.state === "linked" && m.memberGrant && m.memberGrant.expiresAt > now,
				)
			)
				memberProgressRequired()
			p.matchesCapable = true
			if (
				everyone.length === 1 &&
				sameIns(room.confirmedIns, everyone) &&
				room.agreement.state === "unavailable" &&
				agreementCandidate(room)
			) {
				room.agreement = { version: room.agreement.version + 1, state: "checking", error: null }
				room.revision++
				return room
			}
			room.confirmedIns = everyone
		} else if (c.type === "pick_favorite") {
			const tie = room.tiebreak
			requireRoom(
				room.phase === "choosing" &&
					room.generation === c.generation &&
					tie &&
					!tie.outcome &&
					tie.version === c.tiebreakVersion &&
					(c.candidateId === null || tie.candidateIds.includes(c.candidateId)),
				"conflict",
				"The tiebreak changed",
			)
			p.favorite = { tiebreakVersion: c.tiebreakVersion, candidateId: c.candidateId }
		} else {
			requireRoom(room.phase === "choosing", "conflict", "Choosing is not active")
			requireRoom(room.generation === c.generation, "conflict", "Suggestion generation changed")
			requireRoom(
				room.proposalVersion === c.expectedProposalVersion,
				"conflict",
				"Proposal changed",
			)
			if (c.type === "retry_agreement") {
				requireRoom(
					room.agreement.version === c.expectedAgreementVersion && agreementCandidate(room),
					"conflict",
					"Agreement changed",
				)
				room.agreement = { version: room.agreement.version + 1, state: "checking", error: null }
				room.revision++
				return room
			}
			requireRoom(room.rosterVersion === c.expectedRosterVersion, "conflict", "Room roster changed")
			if (c.type === "propose") {
				requireRoom(
					matches(room).some((m) => m.id === c.candidateId),
					"conflict",
					"Pick a current match",
				)
				for (const id of [...p.ins!]) if (id !== c.candidateId) setIn(room, p, id, false)
				if (p.ins!.includes(c.candidateId)) {
					p.inRevision!++
					p.agreementRevision++
					room.inVersion!++
					p.insAgreementRevision = p.agreementRevision
					p.inOrder![c.candidateId] = room.inVersion!
				}
				setIn(room, p, c.candidateId, true)
			} else {
				requireRoom(
					room.proposal?.candidateId === c.candidateId,
					"conflict",
					"Proposal title changed",
				)
				requireRoom(
					p.agreementRevision === c.expectedOwnAgreementRevision,
					"conflict",
					"Your agreement changed",
				)
				if (
					c.agreed &&
					room.candidates.find((v) => v.id === c.candidateId)?.identity.kind === "show_continue" &&
					!activeRoom(room).participants.every(
						(m) => m.member.state === "linked" && m.memberGrant && m.memberGrant.expiresAt > now,
					)
				)
					memberProgressRequired()
				setIn(room, p, c.candidateId, c.agreed)
			}
			const required = activeRoom(room).participants.length
			const everyone = inCounts(
				room,
				matches(room).map((m) => m.id),
			)
				.filter((v) => v.count === required)
				.map((v) => v.candidateId)
			if (sameIns(everyone, [c.candidateId])) room.confirmedIns = [c.candidateId]
		}
		room.revision++
	} else {
		if (c.type === "refill" && staleRefill(original, envelope)) {
			room = structuredClone(original)
			room.revision++
		} else if (c.type === "refill") {
			preflight(original, actorId, envelope, now)
			room = structuredClone(original)
			retire(room)
			if (room.seenKeys.length >= L.seen || room.candidates.length >= L.active)
				room.stream = {
					version: room.stream.version + 1,
					state: "capacity",
					reason: room.seenKeys.length >= L.seen ? "room_capacity" : "awaiting_answers",
				}
			else {
				requireRoom(page, "catalog_unavailable", "Catalog page unavailable", 503)
				appendPage(room, { ...page, exhausted: false })
			}
			room.revision++
		} else
			room = continuousTransition(
				// A new round must reset retained guests too. Restoring departed
				// voters afterward would reintroduce references to the old deck.
				c.type === "restart" ? original : activeRoom(original),
				actorId,
				{
					...envelope,
					command: c as import("../../../packages/yepwatch-contracts/continuous.ts").RoomCommand,
				},
				now,
				page ? { ...page, exhausted: false } : page,
			) as ProposalRoom
		if (c.type === "setup" || c.type === "restart") {
			if (c.type === "setup") {
				actor(room, actorId).serviceIds = [...(c.screens[0]?.serviceIds ?? [])]
				room.intent = null
			}
			normalizeRoomContext(room)
			room.proposalVersion++
			room.proposal = null
			clearApprovals(room)
			room.inVersion = (room.inVersion ?? 0) + 1
			room.tiebreak = null
			room.confirmedIns = null
			for (const p of room.participants) {
				p.ins = []
				p.inRevision = (p.inRevision ?? p.agreementRevision) + 1
				p.insAgreementRevision = p.agreementRevision
				p.inOrder = {}
				p.favorite = null
			}
		}
		if (c.type === "vote") {
			const valid =
				c.activeExposureMs == null ||
				(Number.isInteger(c.activeExposureMs) &&
					c.activeExposureMs >= 0 &&
					c.activeExposureMs <= 1200000)
			requireRoom(valid, "invalid_request", "Invalid active exposure", 400)
			const v = actor(room, actorId).votes[c.candidateId]
			v.activeExposureMs =
				c.value === "watch" && typeof c.activeExposureMs === "number" ? c.activeExposureMs : null
			v.timingSource = v.activeExposureMs === null ? "unavailable" : "active_exposure"
			if (
				c.value === "watch" &&
				room.proposal?.candidateId === c.candidateId &&
				!room.proposal.baseParticipantIds.includes(actorId)
			)
				room.proposal.baseParticipantIds.push(actorId)
			voted = true
		}
	}
	for (const departed of original.participants.filter((p) => p.leftAt != null))
		if (!room.participants.some((p) => p.id === departed.id))
			room.participants.push(structuredClone(departed))
	// People who left go back to their place: the roster keeps join order (the app colors friends by it).
	const place = new Map(original.participants.map((p, i) => [p.id, i]))
	const last = Number.MAX_SAFE_INTEGER
	room.participants.sort((a, b) => (place.get(a.id) ?? last) - (place.get(b.id) ?? last))
	if (c.type === "start") {
		room.startedAt = now
		room.firstMatchAt = null
		room.outcomeEmittedAt = null
		room.outcome = []
		room.dealtKeys = []
		room.rankerVersion = RANKER_VERSION
		room.tasteSources = page?.tasteSources ?? {
			member: 0,
			profile: 0,
			none: activeRoom(room).participants.length,
		}
	}
	if (c.type === "restart") {
		room.startedAt = null
		room.firstMatchAt = null
		room.outcomeEmittedAt = null
		room.outcome = []
		room.dealtKeys = []
		room.tasteSources = null
	}
	recordOutcome(room, page, now)
	reconcile(room, original)
	// A full deck waits for the others' answers. Once a card can retire, open the stream again so the next
	// refill makes room; nobody would otherwise ask and every deck would stay empty. Checked after departed
	// people are restored, on the same room retire() will see.
	if (
		voted &&
		room.stream.state === "capacity" &&
		room.stream.reason === "awaiting_answers" &&
		retirable(room).size > 0
	)
		room.stream = { version: room.stream.version + 1, state: "ready", reason: null }
	return room
}

/** Cards everyone has answered that no match, proposal or last answer still holds. */
function retirable(room: ProposalRoom) {
	const pinned = new Set([
		...matches(room).map((c) => c.id),
		...(room.proposal ? [room.proposal.candidateId] : []),
		...room.participants.flatMap((p) => (p.lastVotedId ? [p.lastVotedId] : [])),
	])
	return new Set(
		room.candidates
			.filter(
				(c) =>
					!pinned.has(c.id) &&
					activeRoom(room).participants.every((p) => p.votes[c.id]?.value != null),
			)
			.map((c) => c.id),
	)
}
/** Retain current proposal, matches, each actor's last answer, and anything still unanswered. */
export function retire(room: ProposalRoom) {
	recordOutcome(room)
	const remove = retirable(room)
	room.candidates = room.candidates.filter((c) => !remove.has(c.id))
	for (const p of room.participants) for (const id of remove) delete p.votes[id]
}
