import React from "react"
import type { MovieDetails, TVDetails } from "~/server/details.server"
import About from "~/ui/details/About"
import Cast from "~/ui/details/Cast"
import Crew from "~/ui/details/Crew"
import Media from "~/ui/details/Media"
import type { SectionIds } from "~/ui/details/common"
import Ratings from "~/ui/ratings/Ratings"
import Streaming from "~/ui/streaming/Streaming"
import { extractRatings } from "~/utils/ratings"
import type { SectionProps } from "~/utils/scroll"
import SequelsPrequelsFranchise from "~/ui/details/SequelsPrequelsFranchise"
import DetailsDNA from "~/ui/details/DetailsDNA"
import DetailsRelated from "~/ui/details/DetailsRelated"

export interface DetailsContentProps {
	details: MovieDetails | TVDetails
	country: string
	sectionProps: SectionProps<SectionIds>
	navigateToSection: (section: Section) => void
}

export default function DetailsContent({
	details,
	country,
	sectionProps,
	navigateToSection,
}: DetailsContentProps) {
	const ratings = extractRatings(details)

	const {
		cast,
		crew,
		media_type,
		streaming_country_codes,
		streaming_links,
		videos,
	} = details

	return (
		<div className="flex flex-col gap-12">
			<div {...sectionProps.about}>
				<About details={details} navigateToSection={navigateToSection} />
			</div>
			<div {...sectionProps.dna}>
				<DetailsDNA details={details} />
			</div>
			<div {...sectionProps.related}>
				<DetailsRelated details={details} />
			</div>
			<div {...sectionProps.sequels}>
				<SequelsPrequelsFranchise details={details} />
			</div>
			<div {...sectionProps.crew}>
				<Crew crew={crew} />
			</div>
			<div {...sectionProps.cast}>
				<Cast cast={cast} />
			</div>
			<div>
				{/*{ratingsSeasons && ratingsSeasons.length > 1 && <div className="mt-2 ml-4">*/}
				{/*  <a onClick={handleToggleShowSeasonRatings} className="text-lg underline bold cursor-pointer hover:text-indigo-100 hover:bg-indigo-900">*/}
				{/*    {showSeasonRatings ? 'Hide' : 'Show'} Ratings per Season*/}
				{/*  </a>*/}
				{/*  {showSeasonRatings && ratingsSeasons.map((ratingsSeason, index) => (*/}
				{/*    <Ratings key={index} {...ratingsSeason} title={`Season ${index+1}`} compact={true} />*/}
				{/*  ))}*/}
				{/*</div>}*/}
			</div>
			<div {...sectionProps.media}>
				<Media videos={videos || []} />
			</div>
			{/*<div>*/}
			{/*	<Streaming*/}
			{/*		details={details}*/}
			{/*		media_type={media_type}*/}
			{/*		links={streaming_links}*/}
			{/*		currentCountryCode={country}*/}
			{/*		countryCodes={streaming_country_codes}*/}
			{/*	/>*/}
			{/*</div>*/}
		</div>
	)
}
