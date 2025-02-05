import React from "react"
import { Autoplay, EffectCoverflow, FreeMode } from "swiper/modules"
import { Swiper, SwiperSlide } from "swiper/react"
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
		<div className="flex gap-8 items-center">
			<div className="w-full">
				<Swiper
					autoplay={{
						delay: 10000,
						pauseOnMouseEnter: true,
					}}
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
					centeredSlides={true}
					coverflowEffect={{
						rotate: 10,
						stretch: 0,
						depth: 50,
						modifier: 1,
						slideShadows: false,
					}}
					effect="coverflow"
					freeMode={{
						enabled: true,
					}}
					grabCursor={true}
					loop={true}
					modules={[Autoplay, EffectCoverflow, FreeMode]}
					slidesPerView={2}
				>
					{results.map((details) => (
						<SwiperSlide key={details.tmdb_id}>
							<div className="w-32 xl:w-44 transition-transform ease-in-out duration-200">
								<MovieTvCard
									details={details}
									mediaType={details.media_type}
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
