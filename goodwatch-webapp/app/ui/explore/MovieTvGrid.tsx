import { AnimatePresence, motion } from "framer-motion"
import React from "react"
import { useDiscover } from "~/routes/api.discover"
import type { DiscoverParams, DiscoverResult } from "~/server/discover.server"
import { MovieTvCard } from "~/ui/MovieTvCard"
import { Spinner } from "~/ui/wait/Spinner"

export interface MovieTvGridParams {
	discoverParams: Partial<DiscoverParams>
}

export default function MovieTvGrid({ discoverParams }: MovieTvGridParams) {
	const discover = useDiscover({ params: discoverParams })
	const results = discover.data || []

	return (
		<div
			className={
				"relative mt-4 grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5"
			}
		>
			{discover.isLoading && <Spinner size="medium" />}
			{!results.length && discover.isSuccess && (
				<div className="my-6 text-lg italic">
					No results. Try to change your search filters.
				</div>
			)}
			{results.length > 0 && discover.isSuccess && (
				<AnimatePresence>
					{results.map((result: DiscoverResult, index) => {
						return (
							<div key={`${result.media_type}-${result.tmdb_id}`}>
								<motion.div
									initial={{
										y: `-${Math.floor(Math.random() * 12) + 6}%`,
										opacity: 0,
									}}
									animate={{ y: "0", opacity: 1 }}
									exit={{
										y: `${Math.floor(Math.random() * 12) + 6}%`,
										opacity: 0,
									}}
									transition={{ duration: 0.3, type: "tween" }}
								>
									<MovieTvCard
										details={result as DiscoverResult}
										mediaType={result.media_type}
										prefetch={index < 6}
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
