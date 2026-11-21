// PROTOTYPE - throwaway (prototype/explore-r5). Eras index, variant "scrub": every year from the first decade to now
// with its standouts, and each decade's story and obsessions for the stage over the ribbon.
import { copyFor } from "../../../../kit/optional"
import type { PlaceRef, ShowTitle } from "../../../../kit/types"
import type { SlotLoader } from "../../contract"
import { type Obsession, decadeYears, lean, times } from "./time.server"

export interface ScrubDecade {
	place: PlaceRef
	short: string | null
	obsessions: string[]
}

export interface ScrubData {
	lede: string | null
	decades: ScrubDecade[]
	words: Record<string, Obsession>
	/** Every year with a well-known title, oldest first. `d` is the decade's index. */
	frames: { year: number; d: number; titles: ShowTitle[] }[]
	/** The frame the ribbon opens on. */
	start: number
}

const score = (t: ShowTitle) => t.card.goodwatch_overall_score_normalized_percent ?? 0

export const load: SlotLoader<ScrubData> = async ({ kit, url }) => {
	const t = times(kit, 4)
	const byDecade = await decadeYears(kit, 4)
	const frames = t.decades.flatMap((d, i) =>
		(byDecade[d.place.slug]?.years ?? []).map((y) => ({
			year: y.year,
			d: i,
			titles: y.titles.map(lean),
		})),
	)
	// A link can carry the year. Otherwise open on a great year of the last forty: the ribbon then has years on both
	// sides, and the first thing on the stage is worth looking at.
	const asked = Number(url.searchParams.get("year"))
	let start = frames.findIndex((f) => f.year === asked)
	if (start < 0) {
		const last = frames[frames.length - 1]?.year ?? 0
		let best = -1
		frames.forEach((f, i) => {
			if (f.year < last - 40 || f.year > last - 8 || f.titles.length < 4) return
			const sum = f.titles.slice(0, 4).reduce((a, x) => a + score(x), 0)
			if (sum > best) {
				best = sum
				start = i
			}
		})
		if (start < 0) start = Math.max(0, frames.length - 4)
	}
	return {
		lede: copyFor(kit.kind, "hub", "decades")?.lede ?? null,
		decades: t.decades.map((d) => ({ place: d.place, short: d.short, obsessions: d.obsessions })),
		words: t.words,
		frames,
		start,
	}
}
