import React from "react"
import type { MovieDetails, TVDetails } from "~/server/details.server"
import Cast from "~/ui/Cast"
import Collection from "~/ui/Collection"
import Crew from "~/ui/Crew"
import Description from "~/ui/Description"
import Keywords from "~/ui/Keywords"
import Videos from "~/ui/Videos"
import type { SectionIds } from "~/ui/details/common"
import Ratings from "~/ui/ratings/Ratings"
import Streaming from "~/ui/streaming/Streaming"
import { extractRatings } from "~/utils/ratings"
import type { SectionProps } from "~/utils/scroll"
import DNA from "../dna/DNA"

export interface DetailsContentProps {
	details: MovieDetails | TVDetails
	sectionProps: SectionProps<SectionIds>
}

export default function DetailsContent({
	details,
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
				{tagline && (
					<div className="mt-8 mb-6">
						<blockquote className="relative border-l-4 lg:border-l-8 border-gray-600 bg-gray-800 py-2 pl-4 sm:pl-6">
							<p className="text-white italic sm:text-xl">{tagline}</p>
						</blockquote>
					</div>
				)}
				<Description description={synopsis} />
				{collection && (
					<Collection collection={collection} movieId={details.tmdb_id} />
				)}
			</div>
			<div {...sectionProps.crew}>
				<Crew crew={crew} />
			</div>
			<div {...sectionProps.cast}>
				<Cast cast={cast} />
			</div>
			<div {...sectionProps.dna}>
				<DNA type={media_type === "movie" ? "movies" : "tv"} dna={dna} />
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
					countryCodes={streaming_country_codes}
				/>
			</div>
			<div {...sectionProps.videos}>
				<Videos videos={videos || []} />
			</div>
		</div>
	)
}
