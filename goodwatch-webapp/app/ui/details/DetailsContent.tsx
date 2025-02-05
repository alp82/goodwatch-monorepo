import React from "react"
import type { MovieDetails, TVDetails } from "~/server/details.server"
import About from "~/ui/details/About"
import Cast from "~/ui/details/Cast"
import Collection from "~/ui/details/Collection"
import Crew from "~/ui/details/Crew"
import Description from "~/ui/details/Description"
import Videos from "~/ui/details/Videos"
import type { SectionIds } from "~/ui/details/common"
import Ratings from "~/ui/ratings/Ratings"
import Streaming from "~/ui/streaming/Streaming"
import { extractRatings } from "~/utils/ratings"
import type { SectionProps } from "~/utils/scroll"
import DNA from "../dna/DNA"

export interface DetailsContentProps {
	details: MovieDetails | TVDetails
	country: string
	sectionProps: SectionProps<SectionIds>
}

export default function DetailsContent({
	details,
	country,
	sectionProps,
}: DetailsContentProps) {
	const ratings = extractRatings(details)

	const {
		cast,
		crew,
		dna,
		keywords,
		media_type,
		streaming_country_codes,
		streaming_links,
		synopsis,
		tagline,
		videos,
	} = details

	let collection: MovieDetails["collection"] | undefined
	if (media_type === "movie") {
		collection = details.collection
	}

	return (
		<div className="flex flex-col gap-12">
			<div {...sectionProps.about}>
				<About details={details} />
			</div>
			<div {...sectionProps.dna}>
				<DNA details={details} />
			</div>
			<div {...sectionProps.crew}>
				<Crew crew={crew} />
			</div>
			<div {...sectionProps.cast}>
				<Cast cast={cast} />
			</div>
			<div {...sectionProps.ratings}>
				<Ratings ratings={ratings} />
				{/*{ratingsSeasons && ratingsSeasons.length > 1 && <div className="mt-2 ml-4">*/}
				{/*  <a onClick={handleToggleShowSeasonRatings} className="text-lg underline bold cursor-pointer hover:text-indigo-100 hover:bg-indigo-900">*/}
				{/*    {showSeasonRatings ? 'Hide' : 'Show'} Ratings per Season*/}
				{/*  </a>*/}
				{/*  {showSeasonRatings && ratingsSeasons.map((ratingsSeason, index) => (*/}
				{/*    <Ratings key={index} {...ratingsSeason} title={`Season ${index+1}`} compact={true} />*/}
				{/*  ))}*/}
				{/*</div>}*/}
			</div>
			<div {...sectionProps.streaming}>
				<Streaming
					details={details}
					media_type={media_type}
					links={streaming_links}
					currentCountryCode={country}
					countryCodes={streaming_country_codes}
				/>
			</div>
			<div {...sectionProps.videos}>
				<Videos videos={videos || []} />
			</div>
		</div>
	)
}
