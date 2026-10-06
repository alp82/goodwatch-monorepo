import React from "react"
import About from "~/ui/details/About"
import Actors from "~/ui/details/Actors"
import Crew from "~/ui/details/Crew"
import Media from "~/ui/details/Media"
import type { SectionIds } from "~/ui/details/sections"
import Ratings from "~/ui/ratings/Ratings"
import Streaming from "~/ui/streaming/Streaming"
import { extractRatings } from "~/utils/ratings"
import type { PropsForSection, Section, SectionProps } from "~/utils/scroll"
import SequelsPrequelsFranchise from "~/ui/details/SequelsPrequelsFranchise"
import DetailsQuestions from "~/ui/details/DetailsQuestions"
import DetailsRelated from "~/ui/details/DetailsRelated"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import type { EpisodeGrid as EpisodeGridData } from "~/server/episode-grid.server"
import EpisodeGrid from "~/ui/details/episode-grid/EpisodeGrid"
import { hasEpisodeGrid } from "~/ui/details/episode-grid/scale"
import { belowFoldProps, useBelowFold } from "~/ui/details/below-fold"
import {
	aboutHeight,
	actorsHeight,
	crewHeight,
	episodeGridHeight,
	mediaHeight,
	questionsHeight,
	relatedHeight,
	sequelsHeight,
	type ReservedHeight,
} from "~/ui/details/section-heights"
import { titleQuestions } from "~/ui/details/titleQuestions"
import { Measured } from "~/measure/ablation"

export interface DetailsContentProps {
	media: MovieResult | ShowResult
	country: string
	episodeGrid?: EpisodeGridData | null
	/** Height of the sticky title header, so anchored sections scroll clear of it. */
	headerHeight?: number
	sectionProps: SectionProps<SectionIds>
	navigateToSection: (section: Section) => void
}

export default function DetailsContent({
	media,
	country,
	episodeGrid,
	headerHeight,
	sectionProps,
	navigateToSection,
}: DetailsContentProps) {
	const { details, cast, cast_total, crew, videos } = media
	const questions = titleQuestions(media, country)
	// Every section here starts below the first screen, so each one skips its layout until it is near the viewport.
	const { skipping } = useBelowFold()
	const section = (
		reserved: ReservedHeight,
		props?: PropsForSection<SectionIds>,
	) => ({
		...props,
		...belowFoldProps(skipping, reserved, props?.className),
	})

	return (
		<div className="flex flex-col gap-12">
			{hasEpisodeGrid(episodeGrid) && (
				<Measured name="episodes"><div {...section(episodeGridHeight(episodeGrid))}>
					<EpisodeGrid grid={episodeGrid} headerHeight={headerHeight} />
				</div></Measured>
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
			<Measured name="about_crew" part="about"><div {...section(aboutHeight(), sectionProps.about)}>
				<About media={media} navigateToSection={navigateToSection} />
			</div></Measured>
			<Measured name="actors"><div {...section(actorsHeight(media), sectionProps.actors_and_crew)}>
				<Actors
					cast={cast}
					total={cast_total}
					mediaType={media.mediaType}
					tmdbId={details.tmdb_id}
				/>
			</div></Measured>
			<Measured name="about_crew" part="crew"><div {...section(crewHeight(media))}>
				<Crew crew={crew} />
			</div></Measured>
			<Measured name="related"><div {...section(relatedHeight(media), sectionProps.related)}>
				<DetailsRelated media={media} />
			</div></Measured>
			<Measured name="sequels"><div {...section(sequelsHeight(media))}>
				<SequelsPrequelsFranchise media={media} />
			</div></Measured>
			<Measured name="media"><div {...section(mediaHeight(media), sectionProps.media)}>
				<Media
					videos={videos || []}
					title={details.title}
					backdropPath={details.backdrop_path}
				/>
			</div></Measured>
			<Measured name="faq"><div {...section(questionsHeight(questions.length), sectionProps.faq)}>
				<DetailsQuestions
					media={media}
					country={country}
					questions={questions}
				/>
			</div></Measured>
		</div>
	)
}
