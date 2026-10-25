import type { NewPagesHere } from "~/server/new-on-services-page.server"
import type { EpisodeGrid } from "~/server/episode-grid.server"
import type { TitleSides } from "~/server/title-sides.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import EpisodeGridLink from "~/ui/details/hero/EpisodeGridLink"
import RatingChips from "~/ui/details/hero/RatingChips"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import TitleSidesLine from "~/ui/details/hero/TitleSidesLine"
import { HeroBackdropImage, HeroPoster, TrailerButton } from "~/ui/details/hero/Trailer"
import WhereToWatch from "~/ui/details/hero/WhereToWatch"
import type { SectionIds } from "~/ui/details/sections"
import { TitleControl } from "~/ui/title-actions/TitleControl"
import type { SectionProps } from "~/utils/scroll"

type Media = MovieResult | ShowResult

export interface DetailsHeroProps {
	media: Media
	country: string
	/** The header pair's country, while where-to-watch still shows `country`'s offers (see WhereToWatch). */
	shownCountry?: string
	preview?: "loading" | "failed" | null
	/** The show's episode grid, when it has one: the ratings row draws its miniature from it. */
	episodeGrid?: EpisodeGrid | null
	sectionProps: SectionProps<SectionIds>
	/** Where the title sits in the signed-in member's taste (taste groups); null when the page says nothing about it. */
	sides?: TitleSides | null
	/** The brands with a page of new arrivals in the loaded country, for where to watch's "What's new on" rows (#489). */
	newPages?: NewPagesHere
}

// The title page's overview, one card under the page's header (which has the title).
//
// The banner is the backdrop, with the trailer button in its corner. On it, everything about the title and the
// person: on the left the poster (it opens full screen), the GoodWatch score, one chip per site and, for a show, the
// button down to its episode ratings. On the right, bottom aligned, the person's Seen and score (one control) over
// their list actions (for a tracked show also its status line). Under the banner, behind a line, where to watch across the card,
// then for a member a quiet line on where the title sits in their Taste (taste groups). On a phone the two sides
// stand over each other.
export default function DetailsHero({ media, country, shownCountry, preview, episodeGrid = null, sectionProps, sides = null, newPages }: DetailsHeroProps) {
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
						<div className="flex flex-col gap-4 px-4 pb-4 pt-14 md:flex-row md:items-end md:justify-between md:px-6 md:pb-5 md:pt-28">
							<div className="flex min-w-0 items-end gap-3 md:gap-6">
								<HeroPoster media={media} className="w-[4.5rem] md:w-32" />
								<div data-hero-ratings data-feedback-area="scores" className="flex min-w-0 flex-col gap-2.5">
									<div className="md:hidden">
										<ScoreRing media={media} size={48} />
									</div>
									<div className="hidden md:block">
										<ScoreRing media={media} size={56} />
									</div>
									<div data-hero-sites className="flex min-w-0 flex-wrap items-center gap-3 empty:hidden">
										<RatingChips media={media} fill={false} />
										{episodeGrid && <EpisodeGridLink grid={episodeGrid} />}
									</div>
								</div>
							</div>
							<div className={`flex flex-col gap-2 max-md:w-full md:shrink-0 ${media.mediaType === "show" ? "md:w-[22rem]" : "md:w-[20rem]"}`}>
								<TitleControl media={media} />
							</div>
						</div>
					</div>
					{/* A line between the banner and where to watch, so its offer tabs don't read as part of the controls above. */}
					<WhereToWatch
						media={media}
						country={country}
						shownCountry={shownCountry}
						preview={preview}
						newPages={newPages}
						className="mx-3 border-t border-white/10 pb-3 pt-4 md:mx-6 md:pb-5 md:pt-5"
					/>
					{sides && <TitleSidesLine sides={sides} mediaType={media.mediaType} tmdbId={media.details.tmdb_id} />}
				</section>
			</div>
		</div>
	)
}
