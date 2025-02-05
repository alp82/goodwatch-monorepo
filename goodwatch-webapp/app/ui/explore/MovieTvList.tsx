import React from "react"
import { type GetDiscoverResult, useDiscover } from "~/routes/api.discover"
import type { DiscoverParams } from "~/server/discover.server"
import { MovieTvCard } from "~/ui/MovieTvCard"

export interface MovieTvListParams {
	discoverParams?: Partial<DiscoverParams>
	discoverResults?: GetDiscoverResult
}

export default function MovieTvList({
	discoverParams,
	discoverResults,
}: MovieTvListParams) {
	const discover = useDiscover({
		params: discoverParams,
		enabled: !discoverResults,
	})
	const results = discoverResults || discover.data || []

	return (
		<div className="grid grid-flow-col gap-2 auto-cols-[minmax(8rem,12rem)] overflow-hidden">
			{results.slice(0, 8).map((details) => (
				<div
					key={details.tmdb_id}
					className="transition-transform ease-in-out duration-200"
				>
					<MovieTvCard
						details={details}
						mediaType={details.media_type}
						prefetch={false}
					/>
				</div>
			))}
		</div>
	)
}
