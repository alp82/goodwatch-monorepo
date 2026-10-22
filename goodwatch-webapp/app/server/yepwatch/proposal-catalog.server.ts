import type { Candidate } from "../../../packages/yepwatch-contracts/proposal.ts"
import type { ContinuousCatalog } from "./continuous-types.ts"
import type { ProposalCatalog } from "./proposal-types.ts"
/** Transport adaptation of established catalog/watchability methods; no episode entitlement inference. */
export function proposalCatalog(base: ContinuousCatalog): ProposalCatalog {
	const enrich = (
		c: import("../../../packages/yepwatch-contracts/continuous.ts").Candidate
	): Candidate => ({
		...c,
		viewingDuration:
			c.identity.kind === "movie" &&
			c.runtimeMinutes != null &&
			Number.isFinite(c.runtimeMinutes) &&
			c.runtimeMinutes > 0
				? { minutes: c.runtimeMinutes, scope: "movie" }
				: null,
	})
	return {
		metadata: base.metadata,
		page: async (room) => {
			const page = await base.page(room)
			return { ...page, candidates: page.candidates.map(enrich) }
		},
		...(base.refresh
			? {
					refresh: async (room: Parameters<ProposalCatalog["page"]>[0]) =>
						(await base.refresh!(room)).map(enrich),
			  }
			: {}),
		recheck: (room, c) => base.recheck(room, c),
	}
}
