import React, { useEffect, useMemo, useRef } from "react"
import type { EpisodeGrid as EpisodeGridData } from "~/server/episode-grid.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import About from "~/ui/details/About"
import Actors from "~/ui/details/Actors"
import Crew from "~/ui/details/Crew"
import DetailsQuestions from "~/ui/details/DetailsQuestions"
import Media from "~/ui/details/Media"
import SequelsPrequelsFranchise from "~/ui/details/SequelsPrequelsFranchise"
import { belowFoldProps, useBelowFold } from "~/ui/details/below-fold"
import EpisodeGrid from "~/ui/details/episode-grid/EpisodeGrid"
import { hasEpisodeGrid } from "~/ui/details/episode-grid/scale"
import {
	GridWindowNotice,
	useWholeEpisodeGrid,
} from "~/ui/details/episode-grid/whole"
import {
	type ReservedHeight,
	aboutHeight,
	actorsHeight,
	crewHeight,
	episodeGridHeight,
	mediaHeight,
	questionsHeight,
	relatedMapHeight,
	sequelsHeight,
} from "~/ui/details/section-heights"
import type { SectionIds } from "~/ui/details/sections"
import { titleQuestions } from "~/ui/details/titleQuestions"
import Ratings from "~/ui/ratings/Ratings"
import RelatedMap, { useRelatedMap } from "~/ui/related-map/RelatedMap"
import Streaming from "~/ui/streaming/Streaming"
import { TrackedEpisodes, useEpisodeTracking } from "~/ui/tracking/gate"
import { extractRatings } from "~/utils/ratings"
import type { PropsForSection, Section, SectionProps } from "~/utils/scroll"

export interface DetailsContentProps {
	media: MovieResult | ShowResult
	country: string
	episodeGrid?: EpisodeGridData | null
	sectionProps: SectionProps<SectionIds>
	navigateToSection: (section: Section) => void
}

export default function DetailsContent({
	media,
	country,
	episodeGrid,
	sectionProps,
	navigateToSection,
}: DetailsContentProps) {
	const { details, cast, cast_total, crew, videos } = media
	const questions = useMemo(
		() => titleQuestions(media, country),
		[media, country],
	)
	// Every section here starts below the first screen, so each one skips its layout until it is near the viewport.
	const { skipping } = useBelowFold()
	const section = (
		reserved: ReservedHeight,
		props?: PropsForSection<SectionIds>,
	) => ({
		...props,
		...belowFoldProps(skipping, reserved, props?.className),
	})

	// The related titles as a map. A title without a fingerprint has none, and the section is empty.
	const relatedMap = Boolean(useRelatedMap())

	// A member with episode tracking gets the episode list in the grid's place, once they come near it.
	const tracking = useEpisodeTracking(media)
	// A long grid comes as its newest part; the rest loads when the visitor asks or the member's list needs it.
	const whole = useWholeEpisodeGrid(hasEpisodeGrid(episodeGrid) ? episodeGrid : null)
	const grid = whole.shown
	// The button for the rest goes when every season is in; the keyboard focus moves to the grid's heading.
	const partial = Boolean(grid?.window)
	const wasPartial = useRef(partial)
	useEffect(() => {
		if (wasPartial.current && !partial)
			document
				.getElementById("episode-grid-title")
				?.focus({ preventScroll: true })
		wasPartial.current = partial
	}, [partial])
	const gridView = grid && (
		<EpisodeGrid
			grid={grid}
			notice={<GridWindowNotice grid={grid} whole={whole} />}
		/>
	)

	return (
		<div className="flex flex-col gap-12">
			{tracking ? (
				<TrackedEpisodes
					media={media}
					grid={whole.scores}
					onWanted={whole.load}
					wrapper={section(
						grid ? episodeGridHeight(grid) : { phone: 0, desktop: 0 },
						sectionProps.episodes,
					)}
				>
					{gridView}
				</TrackedEpisodes>
			) : (
				grid && (
					<div {...section(episodeGridHeight(grid), sectionProps.episodes)}>
						{gridView}
					</div>
				)
			)}
			{/*<div>*/}
			{/*	<Streaming*/}
			{/*		details={details}*/}
			{/*		media_type={media_type}*/}
			{/*		links={streaming_links}*/}
			{/*		currentCountryCode={country}*/}
			{/*		countryCodes={streaming_country_codes}*/}
			{/*	/>*/}
			{/*</div>*/}
			<div {...section(aboutHeight(), sectionProps.about)}>
				<About media={media} navigateToSection={navigateToSection} />
			</div>
			<div {...section(actorsHeight(media), sectionProps.actors_and_crew)}>
				<Actors
					cast={cast}
					total={cast_total}
					mediaType={media.mediaType}
					tmdbId={details.tmdb_id}
				/>
			</div>
			<div {...section(crewHeight(media))}>
				<Crew crew={crew} />
			</div>
			<div
				{...section(
					relatedMap ? relatedMapHeight() : { phone: 0, desktop: 0 },
					sectionProps.related,
				)}
			>
				<RelatedMap media={media} />
			</div>
			<div {...section(sequelsHeight(media))}>
				<SequelsPrequelsFranchise media={media} />
			</div>
			<div {...section(mediaHeight(media), sectionProps.media)}>
				<Media
					videos={videos || []}
					title={details.title}
					backdropPath={details.backdrop_path}
				/>
			</div>
			<div {...section(questionsHeight(questions.length), sectionProps.faq)}>
				<DetailsQuestions
					media={media}
					country={country}
					questions={questions}
				/>
			</div>
		</div>
	)
}
