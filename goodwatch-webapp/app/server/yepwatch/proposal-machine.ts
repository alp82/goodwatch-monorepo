import {
	activeRoom,
	normalizeRoomContext,
	ROOM_CONTEXT,
} from "./proposal-context.ts"
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
import { projectCandidate } from "./machine.ts"
import { requireRoom, memberProgressRequired } from "./errors.ts"
import { CONTINUOUS_LIMITS as L } from "./continuous-types.ts"
import { appendPage } from "./continuous-machine.ts"
import type { ProposalRoom, ProposalParticipant } from "./proposal-types.ts"
export { continuousLive }
export const actor = (room: ProposalRoom, id: string) =>
	baseActor(room, id) as ProposalParticipant
export function matches(room: ProposalRoom): Candidate[] {
	return activeRoom(room).participants.length
		? (baseMatches(activeRoom(room)) as Candidate[])
		: []
}
function readyScreens(room: ProposalRoom) {
	room = activeRoom(room)
	return room.participants.every(
		(p) =>
			p.screenId &&
			room.screens.some(
				(s) =>
					s.id === p.screenId && s.confirmed && s.country && s.serviceIds.length
			)
	)
}
function allYep(room: ProposalRoom, id: string) {
	room = activeRoom(room)
	return (
		room.participants.length > 0 &&
		room.participants.every((p) => p.votes[id]?.value === "watch")
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
				v.activeExposureMs > 1200000
		)
	)
		return null
	return times.reduce((sum, v) => sum + v.activeExposureMs!, 0) / times.length
}
function signature(room: ProposalRoom) {
	room = activeRoom(room)
	return JSON.stringify([
		room.generation,
		room.rosterVersion,
		room.contextVersion,
		room.proposal?.version ?? null,
		room.proposal?.candidateId ?? null,
		room.participants.map((p) => [
			p.id,
			p.screenId,
			p.approvedProposalVersion,
			p.votes[room.proposal?.candidateId ?? ""]?.value ?? null,
		]),
	])
}
export function agreementCandidate(room: ProposalRoom): Candidate | null {
	room = activeRoom(room)
	const proposal = room.proposal
	if (
		!proposal ||
		room.participants.some((p) => p.revoked) ||
		!readyScreens(room) ||
		!allYep(room, proposal.candidateId) ||
		!room.participants.every(
			(p) => p.approvedProposalVersion === proposal.version
		)
	)
		return null
	const c = room.candidates.find((c) => c.id === proposal.candidateId)
	if (
		c?.identity.kind === "show_continue" &&
		!room.participants.every(
			(p) => p.member.state === "linked" && p.memberGrant
		)
	)
		return null
	return c ?? null
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
	const proposal = room.proposal
	if (proposal) {
		const broken =
			!room.candidates.some((c) => c.id === proposal.candidateId) ||
			activeRoom(room).participants.some(
				(p) =>
					p.votes[proposal.candidateId]?.value === "pass" ||
					(proposal.baseParticipantIds.includes(p.id) &&
						p.votes[proposal.candidateId]?.value !== "watch")
			)
		if (broken) {
			room.proposal = null
			room.proposalVersion++
			clearApprovals(room)
		}
	}
	if (signature(room) === oldSignature) {
		room.agreement = oldAgreement
		return
	}
	const allApproved =
		activeRoom(room).participants.length > 0 &&
		room.proposal &&
		activeRoom(room).participants.every(
			(p) => p.approvedProposalVersion === room.proposal!.version
		)
	room.agreement = {
		version: oldAgreement.version + 1,
		state: agreementCandidate(room)
			? "checking"
			: allApproved && !readyScreens(room)
			? "unavailable"
			: "none",
		error:
			allApproved && !readyScreens(room) ? { code: "needs_context" } : null,
	}
}
function projectedCandidate(c: Candidate): Candidate {
	const base = continuousSnapshotCandidate(c)
	return {
		...base,
		viewingDuration: c.viewingDuration
			? { minutes: c.viewingDuration.minutes, scope: c.viewingDuration.scope }
			: null,
	}
}
function continuousSnapshotCandidate(
	c: Candidate
): Omit<Candidate, "viewingDuration"> {
	return {
		...projectCandidate(c),
		...(c.backdropUrl === undefined ? {} : { backdropUrl: c.backdropUrl }),
		...(c.trailerUrl === undefined ? {} : { trailerUrl: c.trailerUrl }),
		...(c.goodwatchScore === undefined
			? {}
			: { goodwatchScore: c.goodwatchScore }),
		...(c.genres === undefined ? {} : { genres: [...c.genres] }),
	}
}
export function proposalSnapshot(
	room: ProposalRoom,
	participantId: string
): RoomSnapshot {
	const legacy = continuousSnapshot(room, participantId)
	const active = activeRoom(room)
	const p = actor(room, participantId)
	const proposal = room.proposal
	const shared: SharedRoomSnapshot = {
		...legacy.shared,
		contractVersion: 3,
		savedServiceIds: [
			...new Set(
				active.participants
					.filter((p) => !p.revoked && p.member.state === "linked")
					.flatMap((p) => p.member.prefill?.serviceIds ?? [])
			),
		].sort((a, b) => a - b),
		participants: legacy.shared.participants.map((person) => ({
			...person,
			dropped: actor(room, person.participantId).leftAt != null,
		})),
		description: room.intent
			? {
					prompt: room.intent.prompt,
					attributes: structuredClone(room.intent.attributes),
			  }
			: null,
		candidates: room.candidates.map(projectedCandidate),
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
						(p) => p.approvedProposalVersion === proposal.version
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
						...room.candidates.find(
							(c) => c.id === room.decision!.candidateId
						)!,
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
		shared.description = null
		shared.savedServiceIds = []
		shared.constraints = {
			kinds: ["movie", "show_start"],
			moods: [],
			maxMinutes: null,
		}
		shared.candidates = []
		shared.matches = []
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
export function preflight(
	room: ProposalRoom,
	actorId: string,
	envelope: CommandEnvelope,
	now: number
) {
	if (envelope.command.type === "start" || envelope.command.type === "refill")
		basePreflight(
			activeRoom(room),
			actorId,
			{ ...envelope, command: envelope.command },
			now
		)
}
export function proposalTransition(
	original: ProposalRoom,
	actorId: string,
	envelope: CommandEnvelope,
	now: number,
	page?: { candidates: Candidate[]; exhausted: boolean }
): ProposalRoom {
	const c =
		envelope.command.type === "assign_screen" && original.screens.length === 1
			? { ...envelope.command, screenId: ROOM_CONTEXT }
			: envelope.command
	continuousLive(original, now)
	const me = actor(original, actorId)
	requireRoom(
		me.leftAt == null || c.type === "leave",
		"forbidden",
		"You have left this room",
		403
	)
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
		next.memberIntents = next.memberIntents?.filter(
			(t) => t.participantId !== actorId
		)
		const remaining = activeRoom(next).participants
		if (next.hostId === actorId && remaining.length)
			next.hostId = remaining[0].id
		// Keep the room, cards and answers even if everyone drops out.
		// A completed decision is historical and cannot be reopened by a departure.
		if (next.phase !== "decided") reconcile(next, original)
		return next
	}
	if (c.type === "resume_voting") {
		// Keep parsing the legacy command so older installed clients receive an
		// actionable error. A final decision is never reopened; only the owner's
		// explicit restart may begin another round.
		requireRoom(false, "conflict", "This decision is final. The room owner can choose Start again for a new round.")
	}

	if (c.type === "configure") {
		const next = proposalTransition(
			original,
			actorId,
			{
				...envelope,
				command: {
					type: "setup",
					expectedContextVersion: c.expectedContextVersion,
					screens: [
						{
							id: ROOM_CONTEXT,
							label: "Our room",
							country: c.country,
							serviceIds: c.serviceIds,
							confirmed: true,
						},
					],
					screenId: ROOM_CONTEXT,
					constraints: c.constraints,
				},
			},
			now
		)
		normalizeRoomContext(next)
		return next
	}
	let room: ProposalRoom
	if (
		c.type === "propose" ||
		c.type === "agree" ||
		c.type === "retry_agreement"
	) {
		room = structuredClone(original)
		const p = actor(room, actorId)
		requireRoom(room.phase === "choosing", "conflict", "Choosing is not active")
		requireRoom(
			room.generation === c.generation,
			"conflict",
			"Suggestion generation changed"
		)
		requireRoom(
			room.proposalVersion === c.expectedProposalVersion,
			"conflict",
			"Proposal changed"
		)
		if (c.type === "retry_agreement") {
			requireRoom(
				room.agreement.version === c.expectedAgreementVersion &&
					agreementCandidate(room),
				"conflict",
				"Agreement changed"
			)
			room.agreement = {
				version: room.agreement.version + 1,
				state: "checking",
				error: null,
			}
			room.revision++
			return room
		}
		requireRoom(
			room.rosterVersion === c.expectedRosterVersion,
			"conflict",
			"Room roster changed"
		)
		if (c.type === "propose") {
			if (room.proposal?.candidateId === c.candidateId) {
				room.revision++
				return room
			}
			requireRoom(
				matches(room).some((m) => m.id === c.candidateId),
				"conflict",
				"Propose a current shared match"
			)
			const previousCandidateId = room.proposal?.candidateId ?? null
			room.proposalVersion++
			clearApprovals(room)
			room.proposal = {
				candidateId: c.candidateId,
				version: room.proposalVersion,
				previousCandidateId,
				proposerId: p.id,
				baseParticipantIds: activeRoom(room).participants.map((p) => p.id),
			}
			p.approvedProposalVersion = room.proposalVersion
		} else {
			requireRoom(
				room.proposal?.candidateId === c.candidateId,
				"conflict",
				"Proposal title changed"
			)
			requireRoom(
				p.agreementRevision === c.expectedOwnAgreementRevision,
				"conflict",
				"Your agreement changed"
			)
			if (c.agreed) {
				if (
					room.candidates.find((v) => v.id === c.candidateId)?.identity.kind ===
						"show_continue" &&
					!activeRoom(room).participants.every(
						(m) =>
							m.member.state === "linked" &&
							m.memberGrant &&
							m.memberGrant.expiresAt > now
					)
				)
					memberProgressRequired()
				if (p.votes[c.candidateId]?.value !== "watch") {
					const old = p.votes[c.candidateId]
					delete p.votes[c.candidateId]
					p.votes[c.candidateId] = {
						value: "watch",
						revision: (old?.revision ?? 0) + 1,
						activeExposureMs: null,
						timingSource: "implied",
					}
					p.lastVotedId = c.candidateId
				}
				if (!room.proposal.baseParticipantIds.includes(p.id))
					room.proposal.baseParticipantIds.push(p.id)
			}
			const next = c.agreed ? room.proposal.version : null
			if (p.approvedProposalVersion !== next) {
				p.approvedProposalVersion = next
				p.agreementRevision++
			}
		}
		room.revision++
	} else {
		if (c.type === "refill") {
			preflight(original, actorId, envelope, now)
			room = structuredClone(original)
			retire(room)
			if (room.seenKeys.length >= L.seen || room.candidates.length >= L.active)
				room.stream = {
					version: room.stream.version + 1,
					state: "capacity",
					reason:
						room.seenKeys.length >= L.seen
							? "room_capacity"
							: "awaiting_answers",
				}
			else {
				requireRoom(
					page,
					"catalog_unavailable",
					"Catalog page unavailable",
					503
				)
				appendPage(room, page)
			}
			room.revision++
		} else
			room = continuousTransition(
				activeRoom(original),
				actorId,
				{ ...envelope, command: c },
				now,
				page
			) as ProposalRoom
		if (c.type === "setup" || c.type === "restart") {
			if (c.type === "setup") room.intent = null
			normalizeRoomContext(room)
			room.proposalVersion++
			room.proposal = null
			clearApprovals(room)
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
				c.value === "watch" && typeof c.activeExposureMs === "number"
					? c.activeExposureMs
					: null
			v.timingSource =
				v.activeExposureMs === null ? "unavailable" : "active_exposure"
			if (
				c.value === "watch" &&
				room.proposal?.candidateId === c.candidateId &&
				!room.proposal.baseParticipantIds.includes(actorId)
			)
				room.proposal.baseParticipantIds.push(actorId)
		}
	}
	for (const departed of original.participants.filter((p) => p.leftAt != null))
		if (!room.participants.some((p) => p.id === departed.id))
			room.participants.push(structuredClone(departed))
	reconcile(room, original)
	return room
}

/** Retain current proposal, matches, each actor's last answer, and anything still unanswered. */
export function retire(room: ProposalRoom) {
	const pinned = new Set([
		...matches(room).map((c) => c.id),
		...(room.proposal ? [room.proposal.candidateId] : []),
		...room.participants.flatMap((p) => (p.lastVotedId ? [p.lastVotedId] : [])),
	])
	const remove = new Set(
		room.candidates
			.filter(
				(c) =>
					!pinned.has(c.id) &&
					activeRoom(room).participants.every(
						(p) => p.votes[c.id]?.value != null
					)
			)
			.map((c) => c.id)
	)
	room.candidates = room.candidates.filter((c) => !remove.has(c.id))
	for (const p of room.participants) for (const id of remove) delete p.votes[id]
}
