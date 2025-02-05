import { AnimatePresence, motion } from "framer-motion"
import React from "react"
import { type GetDiscoverResult, useDiscover } from "~/routes/api.discover"
import type { DiscoverParams, DiscoverResult } from "~/server/discover.server"
import { MovieTvCard } from "~/ui/MovieTvCard"
import { Spinner } from "~/ui/wait/Spinner"
import { seededRandom } from "~/utils/random"

export interface MovieTvGridParams {
	discoverParams?: Partial<DiscoverParams>
	discoverResults?: GetDiscoverResult
}

export default function MovieTvGrid({
	discoverParams,
	discoverResults,
}: MovieTvGridParams) {
	const discover = useDiscover({
		params: discoverParams,
		enabled: !discoverResults,
	})
	const results = discoverResults || discover.data || []

	return (
		<div
			className={
				"relative mt-4 grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5"
			}
		>
			{!results.length && (
				<div className="my-6 text-lg italic">
					No results. Try to change your search filters.
				</div>
			)}
			{results.length > 0 && (
				<AnimatePresence>
					{results.map((result: DiscoverResult, index) => {
						const offset = Math.floor(seededRandom(index + 1) * 12) + 6
						return (
							<div key={`${result.media_type}-${result.tmdb_id}`}>
								<motion.div
									initial={{
										y: `-${offset}%`,
										opacity: 0,
									}}
									animate={{ y: "0", opacity: 1 }}
									exit={{
										y: `${offset}%`,
										opacity: 0,
									}}
									transition={{ duration: 0.3, type: "tween" }}
								>
									<MovieTvCard
										details={result as DiscoverResult}
										mediaType={result.media_type}
										prefetch={false}
									/>
								</motion.div>
							</div>
						)
					})}
				</AnimatePresence>
			)}
		</div>
	)
}
