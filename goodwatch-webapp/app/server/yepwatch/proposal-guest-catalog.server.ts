import { matchingIdeaIds } from "./proposal-redesign.ts"
import { roomIntentKeys } from "./proposal-intent.ts"
import { createContinuousCatalog } from "./continuous-catalog.ts"
import { goodwatchCatalog, goodwatchReads } from "./goodwatch.server.ts"
import { enrichContinuousCandidates, warmEnrichment } from "./continuous-presentation.server.ts"
import { proposalCatalog } from "./proposal-catalog.server.ts"
import type { ContinuousMembers } from "./continuous-members.server.ts"
import { sharedSavedContinuations } from "./continuous-saved-progress.ts"
import { titleKeySet } from "./ranked-keys-cache.ts"
import { memberExclusions } from "./proposal-member-exclusions.ts"
import { timed, timedSync } from "./server-timing.ts"
import type { CatalogReads } from "./catalog-adapter.ts"
// Each read of a deck build under its own mark (PreparedDecks logs a slow build with them).
const reads: CatalogReads = {
	...goodwatchReads,
	rankedKeys: (room, limit) => timed("rank", goodwatchReads.rankedKeys(room, limit)),
	displays: (keys) => timed("displays", goodwatchReads.displays(keys)),
	availability: async (titles, screens, fresh) => {
		const offers = await timed("availability", goodwatchReads.availability(titles, screens, fresh))
		// Titles every screen can watch are the deck's likely cards: their extras are read meanwhile, for the page's
		// enrichment once the deck is chosen.
		if (!fresh)
			warmEnrichment(
				titles.filter((t) => {
					const rows = offers.get(t.key)
					return rows?.length === screens.length && rows.every((r) => r.state === "watchable")
				})
			)
		return offers
	},
	// Summed over a batch's parallel reads: time spent reading, not elapsed time.
	episodes: (showId) => timed("episodes", goodwatchReads.episodes(showId)),
}
/** Full catalog/evidence reads, with optional remote saved progress; no issuer or local fixtures. */
export function guestProposalCatalog(members?: ContinuousMembers) {
	const base = createContinuousCatalog(
		reads,
		goodwatchCatalog.metadata,
		{
			rank: async (room, base, limit) => {
				const excluded = titleKeySet(
					(
						await Promise.all(
							room.participants
								.filter(
									(p) =>
										p.member.state === "linked" &&
										!(p as import("./proposal-types.ts").ProposalParticipant)
											.showSeen
								)
								.map((p) => (members ? timed("seen", members.seenOrNone(room, p.id)) : []))
						)
					).flat()
				)
				// Seen titles are filtered out after: read that many more.
				const keys = timedSync("intent", () => roomIntentKeys(
					room as import("./proposal-types.ts").ProposalRoom,
					base,
					limit === undefined ? undefined : limit + excluded.size
				))
				return excluded.size ? keys.filter((key) => !excluded.has(key)) : keys
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
			const attributed = page.candidates.map((c) => ({
				...c,
				ideaIds: matchingIdeaIds(
					room as import("./proposal-types.ts").ProposalRoom,
					c
				)
			}))
			const country = room.screens.find((s) =>
				room.participants.some((p) => p.screenId === s.id)
			)?.country
			return {
				...page,
				candidates: await timed("enrich", enrichContinuousCandidates(
					attributed,
					country ?? "US"
				))
			}
		}
	})
	return {
		...catalog,
		...(members ? memberExclusions(members) : { async excludedKeys() { return [] as string[] } })
	}
}
