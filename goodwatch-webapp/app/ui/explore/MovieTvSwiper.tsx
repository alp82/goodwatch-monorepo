import type React from "react"
import { MovieTvCard } from "~/ui/MovieTvCard"
import { Swiper, SwiperSlide } from "swiper/react"
import { FreeMode, Navigation } from "swiper/modules"
import type { DiscoverResults } from "~/server/discover.server"

export interface MovieTvSwiperProps {
	results: DiscoverResults
}

export default function MovieTvSwiper({ results }: MovieTvSwiperProps) {
	return (
		<Swiper
			breakpoints={{
				480: {
					slidesPerView: 3,
					slidesPerGroup: 3,
				},
				640: {
					slidesPerView: 4,
					slidesPerGroup: 4,
				},
				768: {
					slidesPerView: 5,
					slidesPerGroup: 5,
				},
				1024: {
					slidesPerView: 6,
					slidesPerGroup: 6,
				},
				1280: {
					slidesPerView: 6,
					slidesPerGroup: 6,
				},
			}}
			freeMode={true}
			grabCursor={true}
			loop={true}
			modules={[Navigation, FreeMode]}
			navigation={true}
			slidesPerView={2}
			slidesPerGroup={2}
			spaceBetween={8}
			speed={100}
		>
			{results.map((details) => (
				<SwiperSlide key={details.tmdb_id}>
					<div className="">
						<MovieTvCard details={details} mediaType={details.media_type} />
					</div>
				</SwiperSlide>
			))}
		</Swiper>
	)
}
