import { PrefetchPageLinks } from "@remix-run/react";
import React from "react";
import type { MovieDetails } from "~/server/details.server";
import type { DiscoverResult } from "~/server/discover.server";
import type { ExploreResult } from "~/server/explore.server";
import type { OnboardingResult } from "~/server/onboarding-media.server";
import { Poster } from "~/ui/Poster";
import RatingOverlay from "~/ui/ratings/RatingOverlay";
import StreamingOverlay from "~/ui/streaming/StreamingOverlay";
import { titleToDashed } from "~/utils/helpers";
import { extractRatings } from "~/utils/ratings";

interface MovieCardProps {
	movie: MovieDetails | DiscoverResult | ExploreResult | OnboardingResult;
	prefetch?: boolean;
}

export function MovieCard({ movie, prefetch = false }: MovieCardProps) {
	const ratings = extractRatings(movie);
	return (
		<a
			className="flex flex-col w-full border-4 border-transparent hover:bg-indigo-900 hover:border-indigo-900"
			href={`/movie/${movie.tmdb_id}-${titleToDashed(movie.title)}`}
		>
			<div className="relative">
				<RatingOverlay ratings={ratings} />
				{movie.streaming_links && (
					<StreamingOverlay links={movie.streaming_links} />
				)}
				<Poster path={movie.poster_path} title={movie.title} />
			</div>
			<div className="my-2 px-2">
				<span className="text-sm font-bold">{movie.title}</span>
			</div>
			{prefetch && (
				<PrefetchPageLinks
					page={`/movie/${movie.tmdb_id}-${titleToDashed(movie.title)}`}
				/>
			)}
		</a>
	);
}
