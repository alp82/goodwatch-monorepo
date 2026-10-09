import type { EpisodeGrid } from "~/server/episode-grid.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import EpisodeGridLink from "~/ui/details/hero/EpisodeGridLink"
import ListActions from "~/ui/details/hero/ListActions"
import OwnScore from "~/ui/details/hero/OwnScore"
import RatingChips from "~/ui/details/hero/RatingChips"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { HeroBackdropImage, HeroPoster, TrailerButton } from "~/ui/details/hero/Trailer"
import WhereToWatch from "~/ui/details/hero/WhereToWatch"
import type { SectionIds } from "~/ui/details/sections"
import type { Section, SectionProps } from "~/utils/scroll"

type Media = MovieResult | ShowResult

export interface DetailsHeroProps {
	media: Media
	country: string
	/** The show's episode grid, when it has one: the ratings row draws its miniature from it. */
	episodeGrid?: EpisodeGrid | null
	sectionProps: SectionProps<SectionIds>
	navigateToSection: (section: Section) => void
}

// The title page's overview, one card under the page's header (which has the title).
//
// The banner is the backdrop, with the trailer button in its corner. On it: the poster, which opens full screen,
// and the ratings as one group. The GoodWatch score and the person's own score, then one chip per site and, for a
// show, the miniature of its episode ratings. Under the banner two blocks: the person's actions with the title
// (for a tracked show also its status line), and where to watch.
//
// Every row runs from its left edge to its right edge: the GoodWatch ring starts the scores and the own score ends
// them, the site chips start their row and the miniature ends it (a movie's chips share the row instead). On a
// phone the two scores stand over each other beside the poster, each as wide as the column.
export default function DetailsHero({ media, country, episodeGrid = null, sectionProps, navigateToSection }: DetailsHeroProps) {
	const sites = (
		<div data-hero-sites className="flex min-w-0 items-center justify-between gap-3 empty:hidden">
			<RatingChips media={media} fill={!episodeGrid} />
			{episodeGrid && <EpisodeGridLink grid={episodeGrid} />}
		</div>
	)
	return (
		<div className="relative mx-auto mb-10 mt-4 max-w-7xl px-4 sm:px-6 lg:px-8">
			<div {...sectionProps.overview}>
				{/* z-30 keeps the country popover above the sections below. */}
				<section data-title-overview className="relative isolate z-30 min-w-0 rounded-2xl border border-white/10 bg-stone-950">
					<div className="relative">
						<div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-t-2xl" aria-hidden="true">
							<HeroBackdropImage media={media} className="h-full w-full object-cover object-[center_22%]" />
							{/* Darker at the bottom and the left, where the scores are. */}
							<div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/60 to-stone-950/10" />
							<div className="absolute inset-0 bg-gradient-to-r from-stone-950/85 via-stone-950/20 to-transparent" />
						</div>
						<TrailerButton media={media} className="absolute right-3 top-3 md:right-5 md:top-4" />
						<div className="px-4 pb-4 pt-14 md:px-6 md:pb-5 md:pt-10">
							<div className="flex items-end gap-3 md:gap-6">
								<HeroPoster media={media} className="w-[4.5rem] md:w-32" />
								<div data-hero-ratings className="min-w-0 flex-1 md:max-w-md">
									<div data-hero-scores className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-3">
										<div className="md:hidden">
											<ScoreRing media={media} size={48} />
										</div>
										<div className="hidden md:block">
											<ScoreRing media={media} size={56} />
										</div>
										<OwnScore media={media} className="max-md:w-full md:min-w-[10.75rem] md:shrink-0" />
									</div>
									<div className="mt-3 max-md:hidden">{sites}</div>
								</div>
							</div>
							<div className="mt-3.5 md:hidden">{sites}</div>
						</div>
					</div>
					<div className="grid grid-cols-[minmax(0,1fr)] gap-2.5 p-3 md:p-5 md:pt-4 lg:grid-cols-2">
						<div className="flex min-w-0 flex-col justify-center rounded-xl bg-white/[0.07] p-3 ring-1 ring-white/10">
							<ListActions media={media} />
						</div>
						<WhereToWatch media={media} country={country} navigateToSection={navigateToSection} className="rounded-xl bg-white/[0.035] p-3 ring-1 ring-white/[0.07]" />
					</div>
				</section>
			</div>
		</div>
	)
}
