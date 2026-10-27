// PROTOTYPE (start page lab, round 4): browse2 e · Rails, new first, tighter: d's parts reordered for a first visit (new on streaming, Top 10, moods, services, genres) with less space between them. Round 4: every rail has previous/next arrows.
import type { BlockVariant } from "../../lab/types"
import { useLab } from "../../lab/types"
import { BrowseShell, GenreCloud, MoodRail, NewOnRail, ServiceRail, TopTen } from "./kit-de"

function RailsNewFirst() {
	const { data } = useLab()
	const b = data.guest.browse
	return (
		<BrowseShell id="bw2e-h" title="What to watch now" gap="gap-7 md:gap-9" pad="py-8 md:py-10">
			<NewOnRail id="bw2e-new" data={data} />
			<TopTen id="bw2e-top" movies={b.best.movie} shows={b.best.show} />
			<MoodRail id="bw2e-moods" data={data} />
			<ServiceRail id="bw2e-services" data={data} />
			<GenreCloud id="bw2e-genres" data={data} compact />
		</BrowseShell>
	)
}

export const variant: BlockVariant = { key: "e", name: "Rails, new first, tighter", C: RailsNewFirst }
