import type { CommandEnvelope } from "../../../packages/yepwatch-contracts/proposal.ts"
import type { ProposalRoom } from "./proposal-types.ts"
import { requireRoom } from "./errors.ts"
import { ROOM_CONTEXT } from "./proposal-context.ts"

export const titleKey = (c: ProposalRoom["candidates"][number]) =>
	`${c.identity.kind === "movie" ? "movie" : "show"}_${c.identity.tmdbId}`
export const rankedKey = (c: { identity: { kind: string; tmdbId: number } }) =>
	(c.identity.kind === "movie" ? 1_000_000_000_000 : 2_000_000_000_000) +
	c.identity.tmdbId
export const redesignCommands = new Set([
	"add_idea",
	"edit_idea",
	"remove_idea",
	"set_idea",
	"set_services",
	"set_service_enabled",
	"configure",
	"rename",
	"set_show_seen"
])
/** Null service picks contribute nothing; all present participants still vote and agree. */
export function refreshServices(room: ProposalRoom) {
	const disabled = new Set(room.disabledServiceIds ?? [])
	const services = [
		...new Set(
			room.participants
				.filter((p) => p.leftAt == null)
				.flatMap((p) => p.serviceIds ?? [])
		)
	]
		.filter((id) => !disabled.has(id))
		.sort((a, b) => a - b)
	const first = room.screens[0]
	room.screens = [
		{
			id: ROOM_CONTEXT,
			label: "Our room",
			// No silent default: the host sets the country (configure) before anyone picks services.
			country: first?.country ?? null,
			serviceIds: services,
			confirmed: true
		}
	]
	for (const p of room.participants) {
		p.screenId = ROOM_CONTEXT
		p.ready = true
	}
}
/** Only untouched cards are removed. Undo records count as answers and remain relationally valid. */
export function retireIneligible(
	room: ProposalRoom,
	excluded = new Set<string>()
) {
	const removed = new Set<string>()
	room.candidates = room.candidates.filter((c) => {
		const valid = candidateEligible(room, c) && !excluded.has(titleKey(c))
		if (
			valid ||
			room.participants.some((p) =>
				Object.prototype.hasOwnProperty.call(p.votes, c.id)
			)
		)
			return true
		removed.add(titleKey(c))
		return false
	})
	room.seenKeys = room.seenKeys.filter((k) => !removed.has(k))
}
export function redesignTransition(
	original: ProposalRoom,
	actorId: string,
	envelope: CommandEnvelope,
	now: number,
	interpretationReserved = false
): ProposalRoom | null {
	const c = envelope.command
	if (!redesignCommands.has(c.type)) return null
	const room = structuredClone(original),
		p = room.participants.find((p) => p.id === actorId)!
	requireRoom(
		room.phase === "setup" || room.phase === "choosing",
		"conflict",
		"Room is already decided"
	)
	const host = () =>
		requireRoom(
			room.hostId === actorId,
			"forbidden",
			"Only the host can change this setting",
			403
		)
	room.ideas ??= []
	room.disabledServiceIds ??= []
	if (c.type === "rename") p.nickname = c.nickname
	else if (c.type === "set_show_seen") {
		requireRoom(
			p.member.state === "linked",
			"member_required",
			"Connect GoodWatch first",
			403
		)
		p.showSeen = c.show
	} else if (c.type === "set_services")
		p.serviceIds = [...new Set(c.serviceIds)]
	else if (c.type === "set_service_enabled") {
		host()
		const disabled = new Set(room.disabledServiceIds)
		for (const id of c.serviceIds) {
			if (c.enabled) disabled.delete(id)
			else disabled.add(id)
		}
		room.disabledServiceIds = [...disabled].sort((a, b) => a - b)
	} else if (c.type === "configure") {
		host()
		requireRoom(
			room.contextVersion === c.expectedContextVersion,
			"conflict",
			"Room settings changed"
		)
		if (c.country) {
			if (!room.screens.length) refreshServices(room)
			room.screens[0].country = c.country
		}
		if (c.constraints) room.constraints = structuredClone(c.constraints)
	} else if (c.type === "add_idea") {
		requireRoom(room.ideas.length < 8, "limit_reached", "At most eight ideas")
		requireRoom(
			interpretationReserved || (room.interpretationCount ?? 0) < 24,
			"limit_reached",
			"Room interpretation budget reached"
		)
		room.ideas.push({
			id: envelope.commandId,
			text: c.text,
			authorId: actorId,
			on: room.hostId === actorId,
			attributes: [],
			rankedKeys: [],
			interpretedAt: now
		})
		if (!interpretationReserved)
			room.interpretationCount = (room.interpretationCount ?? 0) + 1
	} else if (
		c.type === "edit_idea" ||
		c.type === "remove_idea" ||
		c.type === "set_idea"
	) {
		const idea = room.ideas.find((i) => i.id === c.ideaId)
		requireRoom(idea, "conflict", "Idea no longer exists")
		if (c.type === "set_idea") {
			host()
			idea.on = c.on
		} else {
			requireRoom(
				idea.authorId === actorId ||
					(c.type === "remove_idea" && room.hostId === actorId),
				"forbidden",
				"Only the author can edit this idea",
				403
			)
			if (c.type === "remove_idea")
				room.ideas = room.ideas.filter((i) => i.id !== idea.id)
			else {
				requireRoom(
					c.text !== idea.text,
					"invalid_request",
					"Change the idea text",
					400
				)
				requireRoom(
					interpretationReserved || (room.interpretationCount ?? 0) < 24,
					"limit_reached",
					"Room interpretation budget reached"
				)
				const replaced = new Set<string>()
				room.candidates = room.candidates.filter((card) => {
					if (
						!card.ideaIds?.includes(idea.id) ||
						room.participants.some((p) =>
							Object.prototype.hasOwnProperty.call(p.votes, card.id)
						)
					)
						return true
					card.ideaIds = card.ideaIds.filter((id) => id !== idea.id)
					if (
						card.ideaIds.some((id) =>
							room.ideas!.some((i) => i.id === id && i.on)
						)
					)
						return true
					replaced.add(titleKey(card))
					return false
				})
				room.seenKeys = room.seenKeys.filter((key) => !replaced.has(key))
				idea.text = c.text
				idea.rankedKeys = []
				idea.attributes = []
				idea.interpretedAt = now
				if (!interpretationReserved)
					room.interpretationCount = (room.interpretationCount ?? 0) + 1
			}
		}
	}
	if (c.type !== "rename") {
		refreshServices(room)
		requireRoom(
			room.phase !== "choosing" || room.screens[0].serviceIds.length > 0,
			"needs_context",
			"Keep at least one enabled service while voting"
		)
		room.contextVersion++
		room.stream = {
			version: room.stream.version + 1,
			state: "ready",
			reason: null
		}
		attributeCandidates(room)
		retireIneligible(room)
	}
	room.revision++
	return room
}

export function candidateEligible(
	room: ProposalRoom,
	c: ProposalRoom["candidates"][number]
): boolean {
	const services = new Set(room.screens[0]?.serviceIds ?? [])
	const on = (room.ideas ?? []).filter((i) => i.on)
	return (
		(c.ideaIds === undefined ||
			c.ideaIds.length === 0 ||
			c.ideaIds.some((id) => on.some((i) => i.id === id))) &&
		room.constraints.kinds.includes(c.identity.kind) &&
        (room.constraints.maxMinutes == null || (c.runtimeMinutes != null && c.runtimeMinutes <= room.constraints.maxMinutes)) &&
		c.availability.some(
			(a) =>
				a.state === "watchable" &&
				a.offers.some((o) => services.has(o.serviceId))
		)
	)
}

export function matchingIdeaIds(
	room: Pick<ProposalRoom, "ideas">,
	candidate: Parameters<typeof rankedKey>[0]
) {
	return (room.ideas ?? [])
		.filter((i) => i.on && i.rankedKeys.includes(rankedKey(candidate)))
		.map((i) => i.id)
}

export function attributeCandidates(room: ProposalRoom) {
	for (const c of room.candidates) {
		if (c.ideaIds === undefined) continue
		c.ideaIds = [
			...new Set([
				...c.ideaIds,
				...matchingIdeaIds(room, c)
			])
		]
	}
}
