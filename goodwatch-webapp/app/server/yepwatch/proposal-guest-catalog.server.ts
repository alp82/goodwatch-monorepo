import { createContinuousCatalog } from "./continuous-catalog.ts"
import { goodwatchCatalog, goodwatchReads } from "./goodwatch.server.ts"
import { enrichContinuousCandidates } from "./continuous-presentation.server.ts"
import { proposalCatalog } from "./proposal-catalog.server.ts"
/** Guest release: existing full catalog/filter/evidence reads, no member/issuer/local-fixture module. */
export function guestProposalCatalog() {
	const base = createContinuousCatalog(
		goodwatchReads,
		goodwatchCatalog.metadata
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
