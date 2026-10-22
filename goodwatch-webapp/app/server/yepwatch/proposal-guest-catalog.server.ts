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
		members ? { savedContinuations: async room => sharedSavedContinuations(await Promise.all(room.participants.map(p => members.progress(room, p.id)))) } : undefined
	)
	return proposalCatalog({
		...base,
		async page(room) {
			const page = await base.page(room)
			const country = room.screens.find((s) =>
				room.participants.some((p) => p.screenId === s.id)
			)?.country
			return {
				...page,
				candidates: await enrichContinuousCandidates(
					page.candidates,
					country ?? "US"
				),
			}
		},
	})
}
