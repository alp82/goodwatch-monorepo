// PROTOTYPE — round 2's "One panel", kept for comparison with round 3. Lives only on the
// prototype/score-area branch. The production ScoreRing, rating chips, rate button, and
// episode-ratings link, rearranged into the where-to-watch glass at the bottom of the backdrop.
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { Chips, EpisodesText, HeroFrame, RateBtn, type VariantProps } from "./shared"

// 8 — One panel: the score row joins the where-to-watch glass at the bottom, so the backdrop
// is uncovered at the top and everything you act on sits in one place.
export function Variant8OnePanel(p: VariantProps) {
	const { media, hasEpisodeGrid } = p
	const row = (
		<div className="@container">
			<div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-3 @[50rem]:grid-cols-[auto_1fr_auto] @[50rem]:gap-x-5">
				<ScoreRing media={media} size={52} />
				<RateBtn media={media} className="@[50rem]:col-start-3 @[50rem]:row-start-1" />
				<div className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-2 @[50rem]:col-span-1 @[50rem]:col-start-2 @[50rem]:row-start-1">
					<Chips media={media} layout="fill" className="w-full @[50rem]:flex @[50rem]:w-auto @[50rem]:items-center" />
					{hasEpisodeGrid && <EpisodesText />}
				</div>
			</div>
			<div className="mt-4 h-px bg-white/10" />
		</div>
	)
	return <HeroFrame {...p} bottomTop={row} />
}
