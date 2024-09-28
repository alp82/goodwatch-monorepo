import React from "react"
import type {
	ContentRatingResult,
	MovieDetails,
	ReleaseDate,
	TVDetails,
} from "~/server/details.server"
import Cast from "~/ui/Cast"
import Collection from "~/ui/Collection"
import Crew from "~/ui/Crew"
import Description from "~/ui/Description"
import Keywords from "~/ui/Keywords"
import Videos from "~/ui/Videos"
import DetailsContent from "~/ui/details/DetailsContent"
import DetailsInlineNav from "~/ui/details/DetailsInlineNav"
import DetailsSideNav from "~/ui/details/DetailsSideNav"
import DetailsSummary from "~/ui/details/DetailsSummary"
import { sections } from "~/ui/details/common"
import Ratings from "~/ui/ratings/Ratings"
import Streaming from "~/ui/streaming/Streaming"
import Tabs, { type Tab } from "~/ui/tabs/Tabs"
import { extractRatings } from "~/utils/ratings"
import { useScrollSections } from "~/utils/scroll"
import DNA from "../dna/DNA"

export interface DetailsProps {
	details: MovieDetails | TVDetails
	tab: string
	country: string
	language: string
}

export default function Details({
	details,
	tab,
	country,
	language,
}: DetailsProps) {
	const ratings = extractRatings(details)

	const {
		backdrop_path,
		cast,
		crew,
		dna,
		genres,
		keywords,
		media_type,
		poster_path,
		release_year,
		streaming_country_codes,
		streaming_links,
		synopsis,
		tagline,
		title,
		videos,
	} = details

	let ageRating: ContentRatingResult | ReleaseDate | undefined
	let collection: MovieDetails["collection"] | undefined
	let number_of_episodes: number | undefined
	let number_of_seasons: number | undefined
	let runtime: number | undefined
	if (media_type === "movie") {
		ageRating = (details.certifications || []).find(
			(release) => release.certification,
		)
		collection = details.collection
		runtime = details.runtime
	} else {
		ageRating = (details.certifications || []).find((release) => release.rating)
		number_of_episodes = details.number_of_episodes
		number_of_seasons = details.number_of_seasons
	}

	// Scroll Sections
	const { activeSections, sectionProps, navigateToSection } = useScrollSections(
		{
			sections,
		},
	)

	return (
		<>
			<DetailsSideNav
				activeSections={activeSections}
				navigateToSection={navigateToSection}
			/>

			<DetailsSummary
				details={details}
				country={country}
				navigateToSection={navigateToSection}
			/>

			<DetailsInlineNav
				activeSections={activeSections}
				navigateToSection={navigateToSection}
			/>

			<div id="tabs-details" className="relative flex flex-col items-center">
				<div className="px-4 sm:px-6 lg:px-8 w-full max-w-7xl z-30">
					<DetailsContent details={details} sectionProps={sectionProps} />
				</div>
			</div>
		</>
	)
}
