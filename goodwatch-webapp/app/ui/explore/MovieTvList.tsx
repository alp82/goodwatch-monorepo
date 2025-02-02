import React from "react"
import { FreeMode } from "swiper/modules"
import { Swiper, SwiperSlide } from "swiper/react"
import { useDiscover } from "~/routes/api.discover"
import type { DiscoverParams } from "~/server/discover.server"
import { MovieTvCard } from "~/ui/MovieTvCard"

export interface MovieTvListParams {
	discoverParams: Partial<DiscoverParams>
}

export default function MovieTvList({ discoverParams }: MovieTvListParams) {
	const discover = useDiscover({ params: discoverParams })
	const results = discover.data || []

	return (
		<div className="flex gap-8 items-center">
			<div className="w-full">
				<Swiper
					breakpoints={{
						320: {
							slidesPerView: 2,
						},
						480: {
							slidesPerView: 4,
						},
						640: {
							slidesPerView: 6,
						},
						768: {
							slidesPerView: 8,
						},
						1024: {
							slidesPerView: 8,
						},
					}}
					freeMode={{
						enabled: true,
					}}
					grabCursor={true}
					loop={true}
					modules={[FreeMode]}
					slidesPerView={2}
				>
					{results.map((details) => (
						<SwiperSlide key={details.tmdb_id}>
							<div className="w-32 xl:w-44 transition-transform ease-in-out duration-200">
								<MovieTvCard
									details={details}
									mediaType={discoverParams.type === "movies" ? "movie" : "tv"}
									prefetch={false}
								/>
							</div>
						</SwiperSlide>
					))}
				</Swiper>
			</div>
		</div>
	)
}
