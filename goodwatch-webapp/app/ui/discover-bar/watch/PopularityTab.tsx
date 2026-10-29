// Watch > Popularity. How many ratings (Hidden gems to Everyone's seen it) and the place in the Popular order (Popular
// now, Under the radar, Deep cuts), each as preset tiles with glyphs over a stepped slider. Writes `votes` and
// `popularityRank`.
//
// Counts come with `counts=popularity` (optionCounts.popularity) and show only when the response has them.
import { compactCount } from "~/ui/filter-bar/labels"
import type { SubTabView } from "../DiscoverControls"
import { SteppedBlock, fieldCounts } from "./glyph-tiles"
import { tabPad } from "./parts"
import { knownCount } from "./stepped-choices"

export function PopularityTab({ view }: { view: SubTabView }) {
	const { phone } = view
	const total = (field: "votes" | "popularityRank") => {
		const n = knownCount(field, fieldCounts(view, field))
		return n === null ? null : compactCount(n)
	}
	return (
		<div
			className={`${tabPad(phone)} ${phone ? "flex flex-col gap-7" : "grid grid-cols-2 gap-10"}`}
		>
			<section aria-label="How many ratings" className="min-w-0">
				<SteppedBlock
					view={view}
					field="votes"
					title="How many ratings"
					note={total("votes")}
					cols={["grid-cols-2", "grid-cols-2"]}
				/>
			</section>
			<section aria-label="Popularity" className="min-w-0">
				<SteppedBlock
					view={view}
					field="popularityRank"
					title="Popularity"
					note={total("popularityRank")}
					cols={["grid-cols-2", "grid-cols-3"]}
				/>
			</section>
		</div>
	)
}
