import type {
	Candidate,
	CommandEnvelope,
	RoomSnapshot,
	SharedRoomSnapshot,
} from "../../../packages/yepwatch-contracts/continuous.ts"
import { projectCandidate } from "./machine.ts"
import { RoomError, memberProgressRequired, requireRoom } from "./errors.ts"
import {
	CONTINUOUS_LIMITS as L,
	titleIdentity,
	type ContinuousRoom,
	type ContinuousParticipant,
	type CandidatePage,
} from "./continuous-types.ts"
export function continuousLive(room: ContinuousRoom, now: number) {
	requireRoom(room.expiresAt > now, "expired", "Room expired", 410)
}
export function actor(room: ContinuousRoom, id: string) {
	const p = room.participants.find((p) => p.id === id)
	requireRoom(p, "forbidden", "Room membership unavailable", 403)
	return p
}
function fence(actual: number, expected: number) {
	requireRoom(actual === expected, "conflict", "State version changed")
}
function host(room: ContinuousRoom, p: ContinuousParticipant) {
	requireRoom(
		room.hostId === p.id,
		"forbidden",
		"Host capability required",
		403,
	)
}
function choosing(room: ContinuousRoom) {
	requireRoom(room.phase === "choosing", "conflict", "Choosing is not active")
}
export function matches(room: ContinuousRoom) {
	const screens = new Set(room.participants.map((p) => p.screenId))
	return room.candidates.filter(
		(c) =>
			(c.identity.kind !== "show_continue" ||
				room.participants.every(
					(p) => p.member.state === "linked" && !!p.memberGrant,
				)) &&
			room.participants.length > 0 &&
			!screens.has(null) &&
			[...screens].every((id) =>
				c.availability.some(
					(a) => a.screenId === id && a.state === "watchable",
				),
			) &&
			room.participants.every((p) => p.votes[c.id]?.value === "watch"),
	)
}
export function agreementCandidate(room: ContinuousRoom) {
	const id = room.participants[0]?.pick.candidateId
	return id && room.participants.every((p) => p.pick.candidateId === id)
		? (matches(room).find((c) => c.id === id) ?? null)
		: null
}
/** All invalidation paths call one rule. Picks never survive loss of their match. */
export function reconcile(room: ContinuousRoom) {
	const eligible = new Set(matches(room).map((c) => c.id))
	for (const p of room.participants)
		if (p.pick.candidateId && !eligible.has(p.pick.candidateId)) {
			p.pick = { candidateId: null, revision: p.pick.revision + 1 }
		}
	room.agreement = {
		version: room.agreement.version + 1,
		state: agreementCandidate(room) ? "checking" : "none",
		error: null,
	}
}
function screensReady(room: ContinuousRoom) {
	return room.participants.every(
		(p) =>
			p.screenId &&
			room.screens.some(
				(s) =>
					s.id === p.screenId &&
					s.confirmed &&
					s.country &&
					s.serviceIds.length > 0,
			),
	)
}
function canContinue(room: ContinuousRoom, now: number) {
	return room.participants.every(
		(p) =>
			p.member.state === "linked" &&
			p.memberGrant &&
			p.memberGrant.expiresAt > now,
	)
}
function guestKinds(room: ContinuousRoom, now: number) {
	if (
		room.constraints.kinds.includes("show_continue") &&
		!canContinue(room, now)
	)
		memberProgressRequired()
}
function catalogCandidate(c: Candidate): Candidate {
	// Explicit nested projection, plus real optional presentation fields. No catalog object spread.
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
export function continuousSnapshot(
	room: ContinuousRoom,
	participantId: string,
): RoomSnapshot {
	const p = actor(room, participantId)
	const current = matches(room)
	const shared: SharedRoomSnapshot = {
		contractVersion: 2,
		roomId: room.id,
		revision: room.revision,
		expiresAt: room.expiresAt,
		phase: room.phase,
		hostParticipantId: room.hostId,
		rosterVersion: room.rosterVersion,
		contextVersion: room.contextVersion,
		generation: room.generation,
		participants: room.participants.map((p) => ({
			participantId: p.id,
			nickname: p.nickname,
			screenId: p.screenId,
			ready: p.ready,
		})),
		screens: room.screens.map((s) => ({
			id: s.id,
			label: s.label,
			country: s.country,
			serviceIds: [...s.serviceIds],
			confirmed: s.confirmed,
		})),
		constraints: {
			kinds: [...room.constraints.kinds],
			maxMinutes: room.constraints.maxMinutes,
			moods: [...room.constraints.moods],
		},
		candidates: room.candidates.map(catalogCandidate),
		stream: { ...room.stream },
		matches: current.map((c) => ({
			candidateId: c.id,
			pickCount: room.participants.filter((p) => p.pick.candidateId === c.id)
				.length,
		})),
		agreement: structuredClone(room.agreement),
		decision: room.decision
			? {
					...room.decision,
					availability: catalogCandidate({
						...room.candidates.find(
							(c) => c.id === room.decision!.candidateId,
						)!,
						availability: room.decision.availability,
					}).availability,
				}
			: null,
	}
	return {
		shared,
		own: {
			participantId,
			canHost: participantId === room.hostId,
			nextSequence: p.nextSequence,
			votes: Object.entries(p.votes).map(([candidateId, v]) => ({
				candidateId,
				...v,
			})),
			pick: { ...p.pick },
			nextCandidateId:
				room.candidates.find((c) => p.votes[c.id]?.value == null)?.id ?? null,
			member: structuredClone(p.member),
		},
	}
}
export function preflight(
	room: ContinuousRoom,
	actorId: string,
	envelope: CommandEnvelope,
	now: number,
) {
	continuousLive(room, now)
	const p = actor(room, actorId)
	const c = envelope.command
	if (c.type === "start") {
		host(room, p)
		requireRoom(room.phase === "setup", "conflict", "Already choosing")
		fence(room.rosterVersion, c.expectedRosterVersion)
		fence(room.contextVersion, c.expectedContextVersion)
		guestKinds(room, now)
		requireRoom(
			screensReady(room) &&
				room.participants.every(
					(m) => m.ready || (m.id === p.id && c.hostReady === true),
				),
			"needs_context",
			"Confirm every viewing screen and everyone else’s readiness",
		)
	} else if (c.type === "refill") {
		choosing(room)
		fence(room.generation, c.generation)
		fence(room.stream.version, c.expectedStreamVersion)
		guestKinds(room, now)
		requireRoom(
			screensReady(room),
			"needs_context",
			"Confirm all viewing screens",
		)
	}
}
function reset(room: ContinuousRoom) {
	room.phase = "setup"
	room.generation++
	room.candidates = []
	room.seenKeys = []
	room.decision = null
	room.stream = {
		version: room.stream.version + 1,
		state: "ready",
		reason: null,
	}
	for (const p of room.participants) {
		p.votes = {}
		p.lastVotedId = null
		p.pick = { candidateId: null, revision: p.pick.revision + 1 }
		p.ready = false
	}
	reconcile(room)
}
/** Only fully answered nonmatches may retire; slow people and matches pin their cards. */
export function retire(room: ContinuousRoom) {
	const pinned = new Set([
		...matches(room).map((c) => c.id),
		...room.participants.flatMap((p) => (p.lastVotedId ? [p.lastVotedId] : [])),
	])
	const remove = new Set(
		room.candidates
			.filter(
				(c) =>
					!pinned.has(c.id) &&
					room.participants.every((p) => p.votes[c.id]?.value != null),
			)
			.map((c) => c.id),
	)
	room.candidates = room.candidates.filter((c) => !remove.has(c.id))
	for (const p of room.participants) for (const id of remove) delete p.votes[id]
}
export function appendPage(room: ContinuousRoom, page: CandidatePage) {
	requireRoom(
		page.candidates.length <= L.page,
		"catalog_unavailable",
		"Oversized catalog page",
		503,
	)
	const keys = new Set(room.seenKeys)
	const ids = new Set(room.candidates.map((c) => c.id))
	for (const c of page.candidates) {
		const key = titleIdentity(c)
		if (keys.has(key)) continue
		requireRoom(
			!ids.has(c.id) && room.constraints.kinds.includes(c.identity.kind),
			"catalog_unavailable",
			"Invalid catalog page",
			503,
		)
		requireRoom(
			room.candidates.length < L.active && room.seenKeys.length < L.seen,
			"limit_reached",
			"Room suggestion capacity reached",
		)
		room.candidates.push(c)
		room.seenKeys.push(key)
		keys.add(key)
		ids.add(c.id)
	}
	room.stream = {
		version: room.stream.version + 1,
		state: page.exhausted ? "exhausted" : "ready",
		reason: page.exhausted ? "catalog_end" : null,
	}
}
export function continuousTransition(
	original: ContinuousRoom,
	actorId: string,
	envelope: CommandEnvelope,
	now: number,
	page?: CandidatePage,
): ContinuousRoom {
	const room = structuredClone(original)
	const p = actor(room, actorId)
	const c = envelope.command
	continuousLive(room, now)
	switch (c.type) {
		case "setup":
			host(room, p)
			fence(room.contextVersion, c.expectedContextVersion)
			requireRoom(
				room.phase !== "decided",
				"conflict",
				"Restart before editing a decided room",
			)
			if (
				c.constraints.kinds.includes("show_continue") &&
				!canContinue(room, now)
			)
				memberProgressRequired()
			requireRoom(
				new Set(c.screens.map((s) => s.id)).size === c.screens.length,
				"invalid_request",
				"Duplicate screen",
				400,
			)
			requireRoom(
				c.screenId === null || c.screens.some((s) => s.id === c.screenId),
				"invalid_request",
				"Unknown screen",
				400,
			)
			room.screens = c.screens
			room.constraints = c.constraints
			room.contextVersion++
			room.rosterVersion++
			for (const m of room.participants)
				if (!room.screens.some((s) => s.id === m.screenId)) m.screenId = null
			p.screenId = c.screenId
			reset(room)
			break
		case "assign_screen":
			requireRoom(room.phase !== "decided", "conflict", "Room is decided")
			fence(room.contextVersion, c.expectedContextVersion)
			requireRoom(
				room.screens.some((s) => s.id === c.screenId),
				"invalid_request",
				"Unknown screen",
				400,
			)
			p.screenId = c.screenId
			p.ready = false
			room.rosterVersion++
			// Preferences persist, but final agreement must be rechecked for the new screen. No fake offers.
			reconcile(room)
			break
		case "ready":
			requireRoom(room.phase !== "decided", "conflict", "Room is decided")
			fence(room.contextVersion, c.expectedContextVersion)
			requireRoom(
				room.screens.some(
					(s) =>
						s.id === p.screenId &&
						s.confirmed &&
						s.country &&
						s.serviceIds.length,
				),
				"needs_context",
				"Confirm your viewing screen",
			)
			p.ready = c.ready
			break
		case "start":
			preflight(room, actorId, envelope, now)
			requireRoom(
				page && page.candidates.length > 0,
				"no_intersection",
				"No verified candidates yet",
			)
			appendPage(room, page)
			room.generation++
			if (c.hostReady) p.ready = true
			room.phase = "choosing"
			reconcile(room)
			break
		case "vote": {
			choosing(room)
			fence(room.generation, c.generation)
			const candidate = room.candidates.find((x) => x.id === c.candidateId)
			requireRoom(
				candidate,
				"invalid_request",
				"Candidate no longer retained",
				400,
			)
			if (
				candidate.identity.kind === "show_continue" &&
				!canContinue(room, now)
			)
				memberProgressRequired()
			const old = p.votes[c.candidateId] ?? { value: null, revision: 0 }
			fence(old.revision, c.expectedVoteRevision)
			delete p.votes[c.candidateId]
			p.votes[c.candidateId] = { value: c.value, revision: old.revision + 1 }
			p.lastVotedId =
				c.value !== null
					? c.candidateId
					: (Object.entries(p.votes)
							.reverse()
							.find(([, v]) => v.value !== null)?.[0] ?? null)
			reconcile(room)
			break
		}
		case "pick":
			choosing(room)
			fence(room.generation, c.generation)
			fence(room.rosterVersion, c.expectedRosterVersion)
			fence(p.pick.revision, c.expectedPickRevision)
			requireRoom(
				c.candidateId === null ||
					matches(room).some((m) => m.id === c.candidateId),
				"conflict",
				"Pick must be a current match",
			)
			p.pick = { candidateId: c.candidateId, revision: p.pick.revision + 1 }
			reconcile(room)
			break
		case "refill":
			preflight(room, actorId, envelope, now)
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
					503,
				)
				appendPage(room, page)
			}
			break
		case "retry_agreement":
			choosing(room)
			fence(room.generation, c.generation)
			fence(room.agreement.version, c.expectedAgreementVersion)
			requireRoom(
				agreementCandidate(room),
				"conflict",
				"No unanimous current pick",
			)
			reconcile(room)
			break
		case "restart":
			host(room, p)
			fence(room.revision, c.expectedRevision)
			room.contextVersion++
			room.rosterVersion++
			reset(room)
			break
	}
	room.revision++
	return room
}
