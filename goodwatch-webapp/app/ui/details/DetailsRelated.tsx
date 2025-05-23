import type React from "react"
import { useMemo } from "react"
import type { MovieDetails, TVDetails } from "~/server/details.server"
import { useDiscover } from "~/routes/api.discover"
import { SEPARATOR_SECONDARY, SEPARATOR_TERTIARY } from "~/utils/navigation"
import { FilmIcon, TvIcon } from "@heroicons/react/24/solid"
import type { DiscoverResults } from "~/server/discover.server"
import MovieTvSwiper from "~/ui/explore/MovieTvSwiper"

export interface DetailsRelatedProps {
	details: MovieDetails | TVDetails
}

function RelatedSwiper({
	icon: Icon,
	heading,
	results,
}: { icon: React.ElementType; heading: string; results: DiscoverResults }) {
	return (
		<>
			<h2 className="my-6 flex items-center gap-2 text-2xl font-bold">
				<Icon className="h-7 p-0.5 w-auto" />
				{heading}
			</h2>
			<div className="mt-4">
				<MovieTvSwiper results={results} />
			</div>
		</>
	)
}

export default function DetailsRelated({ details }: DetailsRelatedProps) {
	const similarityCategories = [
		"Sub-Genres",
		"Mood",
		"Themes",
		"Plot",
		"Pacing",
		"Narrative",
		"Dialog",
		"Outcast",
		"Time",
		"Place",
	]

	const discoverMovies = useDiscover({
		params: {
			type: "movies",
			minScore: "50",
			similarTitles: `${details.tmdb_id}${SEPARATOR_SECONDARY}${details.media_type}${SEPARATOR_SECONDARY}${similarityCategories.join(SEPARATOR_TERTIARY)}`,
			sortBy: "aggregated_score",
		},
	})
	const discoverShows = useDiscover({
		params: {
			type: "tv",
			minScore: "50",
			similarTitles: `${details.tmdb_id}${SEPARATOR_SECONDARY}${details.media_type}${SEPARATOR_SECONDARY}${similarityCategories.join(SEPARATOR_TERTIARY)}`,
			sortBy: "aggregated_score",
		},
	})

	const filterResults = (data: typeof discoverMovies.data) =>
		data?.pages
			.flat()
			.filter(
				(det) =>
					det.tmdb_id !== details.tmdb_id ||
					det.media_type !== details.media_type,
			) ?? []

	const resultsMovies = useMemo(
		() => filterResults(discoverMovies.data),
		[discoverMovies.data],
	)
	const resultsShows = useMemo(
		() => filterResults(discoverShows.data),
		[discoverShows.data],
	)

	return (
		<>
			<RelatedSwiper
				icon={FilmIcon}
				heading="Related Movies"
				results={resultsMovies}
			/>
			<div className="mt-16">
				<RelatedSwiper
					icon={TvIcon}
					heading="Related TV Shows"
					results={resultsShows}
				/>
			</div>
		</>
	)
}
