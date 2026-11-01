import { rankedKey } from "./proposal-redesign.ts"
import { roomIntentKeys } from "./proposal-intent.ts"
import { createContinuousCatalog } from "./continuous-catalog.ts"
import { goodwatchCatalog, goodwatchReads } from "./goodwatch.server.ts"
import { enrichContinuousCandidates } from "./continuous-presentation.server.ts"
import { proposalCatalog } from "./proposal-catalog.server.ts"
import type { ContinuousMembers } from "./continuous-members.server.ts"
import { sharedSavedContinuations } from "./continuous-saved-progress.ts"
/** Full catalog/evidence reads, with optional remote saved progress; no issuer or local fixtures. */
export function guestProposalCatalog(members?: ContinuousMembers) {
	const base = createContinuousCatalog(
		goodwatchReads,
		goodwatchCatalog.metadata,
		{
			rank: async (room, base) => {
				const excluded = new Set(
					(
						await Promise.all(
							room.participants
								.filter(
									(p) =>
										p.member.state === "linked" &&
										!(p as import("./proposal-types.ts").ProposalParticipant)
											.showSeen
								)
								.map((p) => members?.seen(room, p.id) ?? [])
						)
					).flat()
				)
				return roomIntentKeys(
					room as import("./proposal-types.ts").ProposalRoom,
					base
				).filter(
					(key) =>
						!excluded.has(
							`${key >= 2_000_000_000_000 ? "show" : "movie"}_${
								key % 1_000_000_000_000
							}`
						)
				)
			},
			...(members
				? {
						savedContinuations: async (room) =>
							sharedSavedContinuations(
								await Promise.all(
									room.participants.map((p) => members.progress(room, p.id))
								)
							)
				  }
				: {})
		}
	)
	const catalog = proposalCatalog({
		...base,
		async page(room) {
			const page = await base.page(room)
			const on = (
				(room as import("./proposal-types.ts").ProposalRoom).ideas ?? []
			).filter((i) => i.on)
			const attributed = page.candidates.map((c) => {
				const ranked = on.filter((i) => i.rankedKeys.includes(rankedKey(c)))
				return { ...c, ideaIds: (ranked.length ? ranked : on).map((i) => i.id) }
			})
			const country = room.screens.find((s) =>
				room.participants.some((p) => p.screenId === s.id)
			)?.country
			return {
				...page,
				candidates: await enrichContinuousCandidates(
					attributed,
					country ?? "US"
				)
			}
		}
	})
	return {
		...catalog,
		async excludedKeys(room: import("./proposal-types.ts").ProposalRoom) {
			if (!members) return []
			return (
				await Promise.all(
					room.participants
						.filter(
							(p) =>
								p.leftAt == null && p.member.state === "linked" && !p.showSeen
						)
						.map((p) => members.seen(room, p.id))
				)
			).flat()
		}
	}
}
