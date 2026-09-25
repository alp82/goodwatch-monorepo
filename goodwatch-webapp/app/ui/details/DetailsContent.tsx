import React from "react"
import About from "~/ui/details/About"
import Actors from "~/ui/details/Actors"
import Crew from "~/ui/details/Crew"
import Media from "~/ui/details/Media"
import type { SectionIds } from "~/ui/details/sections"
import Ratings from "~/ui/ratings/Ratings"
import Streaming from "~/ui/streaming/Streaming"
import { extractRatings } from "~/utils/ratings"
import type { Section, SectionProps } from "~/utils/scroll"
import SequelsPrequelsFranchise from "~/ui/details/SequelsPrequelsFranchise"
import DetailsQuestions from "~/ui/details/DetailsQuestions"
import DetailsRelated from "~/ui/details/DetailsRelated"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import type { EpisodeGrid as EpisodeGridData } from "~/server/episode-grid.server"
import EpisodeGrid from "~/ui/details/episode-grid/EpisodeGrid"
import { hasEpisodeGrid } from "~/ui/details/episode-grid/scale"

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
	const { details, actors, crew, videos } = media

	return (
		<div className="flex flex-col gap-12">
			{hasEpisodeGrid(episodeGrid) && (
				<div>
					<EpisodeGrid grid={episodeGrid} headerHeight={headerHeight} />
				</div>
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
			<div {...sectionProps.about}>
				<About media={media} navigateToSection={navigateToSection} />
			</div>
			<div {...sectionProps.actors_and_crew}>
				<Actors actors={actors} />
			</div>
			<div>
				<Crew crew={crew} />
			</div>
			<div {...sectionProps.related}>
				<DetailsRelated media={media} />
			</div>
			<div>
				<SequelsPrequelsFranchise media={media} />
			</div>
			<div {...sectionProps.media}>
				<Media videos={videos || []} />
			</div>
			<div {...sectionProps.faq}>
				<DetailsQuestions media={media} country={country} />
			</div>
		</div>
	)
}
