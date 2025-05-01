import React, { useRef } from "react"
import { MovieTvCard } from "~/ui/MovieTvCard"
import { Swiper, SwiperSlide } from "swiper/react"
import { FreeMode, Navigation } from "swiper/modules"
import type { Swiper as SwiperType } from "swiper"
import type { DiscoverResults } from "~/server/discover.server"

export interface MovieTvSwiperProps {
	results: DiscoverResults
}

export default function MovieTvSwiper({ results }: MovieTvSwiperProps) {
	const swiperRef = useRef<SwiperType>()

	return (
		<Swiper
			breakpoints={{
				480: {
					slidesPerView: 5,
					slidesPerGroup: 5,
				},
				640: {
					slidesPerView: 6,
					slidesPerGroup: 6,
				},
				768: {
					slidesPerView: 7,
					slidesPerGroup: 7,
				},
				1024: {
					slidesPerView: 8,
					slidesPerGroup: 8,
				},
				1280: {
					slidesPerView: 9,
					slidesPerGroup: 9,
				},
			}}
			freeMode={true}
			grabCursor={true}
			loop={true}
			modules={[Navigation, FreeMode]}
			navigation={true}
			rewind={true}
			slidesPerView={4}
			slidesPerGroup={4}
			spaceBetween={8}
			speed={100}
			onBeforeInit={(swiper) => {
				swiperRef.current = swiper
			}}
		>
			{results.map((details) => (
				<SwiperSlide key={details.tmdb_id}>
					<div className="">
						<MovieTvCard details={details} mediaType={details.media_type} />
					</div>
				</SwiperSlide>
			))}
			<button
				type="button"
				className="absolute top-1/2 left-0 transform -translate-y-1/2 z-10 p-2 bg-blue-600 text-white rounded-full shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-200 ease-in-out cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
				onClick={() => swiperRef.current?.slidePrev()}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					className="h-6 w-6"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<title>Previous</title>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M15 19l-7-7 7-7"
					/>
				</svg>
			</button>

			<button
				type="button"
				className="absolute top-1/2 right-0 transform -translate-y-1/2 z-10 p-2 bg-blue-600 text-white rounded-full shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-200 ease-in-out cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
				onClick={() => swiperRef.current?.slideNext()}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					className="h-6 w-6"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<title>Next</title>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M9 5l7 7-7 7"
					/>
				</svg>
			</button>
		</Swiper>
	)
}
