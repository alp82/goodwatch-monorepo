import React from "react"
import { MovieTvCard } from "~/ui/MovieTvCard"
import type { DiscoverResults } from "~/server/discover.server"
import ListSwiper from "~/ui/ListSwiper"
import { POSTER_ROW_SIZES } from "~/ui/Poster"
import { SwiperSlide } from "swiper/react"

export interface MovieTvSwiperProps {
	results: DiscoverResults
}

export default function MovieTvSwiper({ results }: MovieTvSwiperProps) {
	return (
		<ListSwiper>
			{results.map((details) => (
				<SwiperSlide key={`${details.media_type}-${details.tmdb_id}`}>
					<MovieTvCard details={details} mediaType={details.media_type} posterSizes={POSTER_ROW_SIZES} />
				</SwiperSlide>
			))}
		</ListSwiper>
	)
}
