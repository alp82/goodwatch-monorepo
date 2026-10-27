// PROTOTYPE (start page lab, round 4): browse2 d · Rails with a top 10: a's rails, led by c's Top 10 (big numbers, Movies/Shows), with c's genre cloud and its peeks (hover or tap) in place of the genre tiles. Round 4: every rail has previous/next arrows.
import type { BlockVariant } from "../../lab/types"
import { useLab } from "../../lab/types"
import { BrowseShell, GenreCloud, MoodRail, NewOnRail, ServiceRail, TopTen } from "./kit-de"

function RailsTopTen() {
	const { data } = useLab()
	const b = data.guest.browse
	return (
		<BrowseShell id="bw2d-h" title="Where to start" gap="gap-10 md:gap-12" pad="py-10 md:py-14">
			<TopTen id="bw2d-top" movies={b.best.movie} shows={b.best.show} />
			<NewOnRail id="bw2d-new" data={data} />
			<MoodRail id="bw2d-moods" data={data} />
			<ServiceRail id="bw2d-services" data={data} />
			<GenreCloud id="bw2d-genres" data={data} />
		</BrowseShell>
	)
}

export const variant: BlockVariant = { key: "d", name: "Rails with a top 10", C: RailsTopTen }
