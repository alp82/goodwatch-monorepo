import React from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import type { SectionIds } from "~/ui/details/sections"
import EpisodeGridLink from "~/ui/details/hero/EpisodeGridLink"
import ListActions from "~/ui/details/hero/ListActions"
import RateButton from "~/ui/details/hero/RateButton"
import RatingChips from "~/ui/details/hero/RatingChips"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { BackdropTrailer, PosterTrailer, backdropUrl } from "~/ui/details/hero/Trailer"
import WhereToWatch from "~/ui/details/hero/WhereToWatch"
// PROTOTYPE — score-area layout variants (?score=0, 8, 8a..8f), prototype/score-area branch only.
import { ScoreAreaPrototype, ScorePrototypeSwitcher, useScoreVariant } from "~/ui/details/hero/prototype-score-area/ScoreAreaPrototype"
import type { Section, SectionProps } from "~/utils/scroll"

export interface DetailsHeroProps {
	media: MovieResult | ShowResult
	country: string
	/** Whether the page has an episode grid to link to from the score bar. */
	hasEpisodeGrid?: boolean
	sectionProps: SectionProps<SectionIds>
	navigateToSection: (section: Section) => void
}

const GLASS = "md:rounded-xl md:border md:border-white/10 md:bg-black/55 md:backdrop-blur-md"

// Desktop: the poster plays the trailer; beside it the backdrop fills a
// fixed-height panel with scores on a glass bar at the top and streaming plus
// list actions on a glass bar at the bottom.
// Phones: a backdrop banner plays the trailer; score, ratings, streaming, and
// actions follow on one dark surface.
export default function DetailsHero({ media, country, hasEpisodeGrid = false, sectionProps, navigateToSection }: DetailsHeroProps) {
	const scoreVariant = useScoreVariant()
	const prototypeActive = scoreVariant.Component != null
	return (
		<div className="relative mx-auto mb-10 mt-4 max-w-7xl px-4 sm:px-6 lg:px-8">
			<div {...sectionProps.overview}>
				{prototypeActive ? (
					<ScoreAreaPrototype variantKey={scoreVariant.key} media={media} country={country} hasEpisodeGrid={hasEpisodeGrid} navigateToSection={navigateToSection} />
				) : (
				<div className="grid gap-4 md:h-[28.5rem] md:grid-cols-[auto_1fr] md:grid-rows-[minmax(0,1fr)] [&>*]:min-w-0">
					<PosterTrailer media={media} className="hidden aspect-[2/3] md:block md:h-full md:w-[19rem]" />
					<div className="relative flex min-h-0 flex-col rounded-2xl border border-white/10 bg-stone-950 md:rounded-xl md:bg-transparent">
						<div className="absolute inset-0 hidden overflow-hidden rounded-xl md:block" aria-hidden="true">
							<img src={backdropUrl(media)} alt="" className="h-full w-full object-cover object-[center_25%]" />
							<div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />
						</div>
						<BackdropTrailer media={media} className="h-44 rounded-t-2xl md:hidden" />

						{/* The score bar puts the score, the site chips and the rate button on one line when
						    its own width allows (a container query); otherwise the chips move to a second
						    line under the score and the rate button. */}
						<div className={`@container relative z-30 px-4 pt-1 md:m-3 md:py-3 ${GLASS}`}>
							<div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-4 md:gap-x-5 md:gap-y-3 @[50rem]:grid-cols-[auto_1fr_auto]">
								<ScoreRing media={media} size={52} />
								<RateButton media={media} className="@[50rem]:col-start-3 @[50rem]:row-start-1" />
								<div className="col-span-2 flex flex-wrap items-center gap-1.5 @[50rem]:col-span-1 @[50rem]:col-start-2 @[50rem]:row-start-1">
									<div className="w-full md:w-auto">
										<RatingChips media={media} fill />
									</div>
									{hasEpisodeGrid && <EpisodeGridLink />}
								</div>
							</div>
						</div>

						<div className="mx-4 mt-4 h-px bg-white/10 md:hidden" />
						<div className="hidden min-h-8 grow md:block" aria-hidden="true" />

						<div className={`relative flex flex-col gap-4 p-4 md:m-3 md:mt-0 ${GLASS}`}>
							<WhereToWatch media={media} country={country} navigateToSection={navigateToSection} />
							<ListActions media={media} />
						</div>
					</div>
				</div>
				)}
			</div>
			<ScorePrototypeSwitcher />
		</div>
	)
}
