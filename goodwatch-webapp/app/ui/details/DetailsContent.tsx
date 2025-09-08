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
import DetailsFingerprint from "~/ui/details/DetailsFingerprint"
import DetailsRelated from "~/ui/details/DetailsRelated"
import type { MovieResult, ShowResult } from "~/server/types/details-types"

export interface DetailsContentProps {
	media: MovieResult | ShowResult
	country: string
	sectionProps: SectionProps<SectionIds>
	navigateToSection: (section: Section) => void
}

export default function DetailsContent({
	media,
	country,
	sectionProps,
	navigateToSection,
}: DetailsContentProps) {
	const { details, actors, crew, videos } = media

	return (
		<div className="flex flex-col gap-12">
			{/*<div>*/}
				{/*{ratingsSeasons && ratingsSeasons.length > 1 && <div className="mt-2 ml-4">*/}
				{/*  <a onClick={handleToggleShowSeasonRatings} className="text-lg underline bold cursor-pointer hover:text-indigo-100 hover:bg-indigo-900">*/}
				{/*    {showSeasonRatings ? 'Hide' : 'Show'} Ratings per Season*/}
				{/*  </a>*/}
				{/*  {showSeasonRatings && ratingsSeasons.map((ratingsSeason, index) => (*/}
				{/*    <Ratings key={index} {...ratingsSeason} title={`Season ${index+1}`} compact={true} />*/}
				{/*  ))}*/}
				{/*</div>}*/}
			{/*</div>*/}
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
		</div>
	)
}
