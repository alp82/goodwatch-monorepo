// Binds the rating flow (flow.ts) to the person for /taste/quiz and the Taste page's start: the shared core
// (use-rating-core.ts, which the living room TV runs too), the picks of the taste view, and "Your ratings".
import { useMemo } from "react"
import type { ScoringMedia } from "~/ui/scoring/types"
import { type FlowView, type RatedEntry, ratingRows } from "./flow"
import { useFlowPicks, useRatingCore } from "./use-rating-core"

export function useRatingFlow({
	titles,
	member,
	view,
}: {
	/** The first titles to ask about, from smart-titles. */
	titles: ScoringMedia[]
	member: boolean
	view: FlowView
}) {
	const core = useRatingCore({
		titles,
		member,
		tasteOpen: view === "taste",
		exposure: "flow",
		source: "rating_flow",
	})
	const { picks, picksKeeper, picksLoading } = useFlowPicks(
		core,
		view === "taste" && core.ready,
	)
	const { scores } = core
	const ratings = useMemo(
		() =>
			ratingRows(
				Object.entries(scores ?? {}).flatMap(([key, value]): RatedEntry[] =>
					value?.score
						? [
								{
									key,
									score: value.score,
									at: Date.parse(String(value.updatedAt)) || 0,
								},
							]
						: [],
				),
			),
		[scores],
	)
	return { ...core, picks, picksKeeper, picksLoading, ratings }
}

export type RatingFlowModel = ReturnType<typeof useRatingFlow>
