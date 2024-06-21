import { PrefetchPageLinks } from "@remix-run/react";
import React from "react";
import type { TVDetails } from "~/server/details.server";
import type { DiscoverResult } from "~/server/discover.server";
import { Poster } from "~/ui/Poster";
import RatingOverlay from "~/ui/ratings/RatingOverlay";
import StreamingOverlay from "~/ui/streaming/StreamingOverlay";
import { titleToDashed } from "~/utils/helpers";
import { extractRatings } from "~/utils/ratings";

interface TvCardProps {
	tv: TVDetails | DiscoverResult;
	prefetch?: boolean;
}

export function TvCard({ tv, prefetch = false }: TvCardProps) {
	const ratings = extractRatings(tv);
	return (
		<a
			className="flex flex-col w-full border-4 border-transparent hover:bg-indigo-900 hover:border-indigo-900"
			href={`/tv/${tv.tmdb_id}-${titleToDashed(tv.title)}`}
		>
			<div className="relative">
				<RatingOverlay ratings={ratings} />
				<StreamingOverlay links={tv.streaming_links} />
				<Poster path={tv.poster_path} title={tv.title} />
			</div>
			<div className="my-2 px-2">
				<span className="text-sm font-bold">{tv.title}</span>
			</div>
			{prefetch && (
				<PrefetchPageLinks
					page={`/tv/${tv.tmdb_id}-${titleToDashed(tv.title)}`}
				/>
			)}
		</a>
	);
}
