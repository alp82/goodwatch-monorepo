import type React from "react"
import { useRef } from "react"
import { Swiper, SwiperSlide } from "swiper/react"
import { FreeMode, Navigation } from "swiper/modules"
import { ChevronLeftIcon } from "@heroicons/react/24/outline"
import { ChevronRightIcon } from "@heroicons/react/24/solid"

export interface ListSwiperProps<T> {
	children: React.ReactNode
}

export default function ListSwiper<T>({ children }: ListSwiperProps<T>) {
	const navigationPrevRef = useRef(null)
	const navigationNextRef = useRef(null)

	return (
		<Swiper
			breakpoints={{
				480: {
					slidesPerView: 5,
					slidesPerGroup: 5,
					spaceBetween: 5,
				},
				640: {
					slidesPerView: 6,
					slidesPerGroup: 6,
					spaceBetween: 6,
				},
				768: {
					slidesPerView: 7,
					slidesPerGroup: 7,
					spaceBetween: 7,
				},
				1024: {
					slidesPerView: 8,
					slidesPerGroup: 8,
					spaceBetween: 8,
				},
				1280: {
					slidesPerView: 9,
					slidesPerGroup: 9,
					spaceBetween: 9,
				},
			}}
			freeMode={true}
			grabCursor={true}
			loop={true}
			modules={[Navigation, FreeMode]}
			navigation={{
				prevEl: navigationPrevRef.current,
				nextEl: navigationNextRef.current,
			}}
			rewind={true}
			slidesPerView={4}
			slidesPerGroup={4}
			spaceBetween={4}
			speed={100}
			onBeforeInit={(swiper) => {
				swiper.params.navigation.prevEl = navigationPrevRef.current
				swiper.params.navigation.nextEl = navigationNextRef.current
			}}
		>
			{children}
			<button
				ref={navigationPrevRef}
				type="button"
				className="absolute top-1/2 left-0 transform -translate-y-1/2 z-10 p-2 bg-blue-600 text-white rounded-full shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-200 ease-in-out cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
			>
				<ChevronLeftIcon className="h-6 w-6" />
			</button>

			<button
				ref={navigationNextRef}
				type="button"
				className="absolute top-1/2 right-0 transform -translate-y-1/2 z-10 p-2 bg-blue-600 text-white rounded-full shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-200 ease-in-out cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
			>
				<ChevronRightIcon className="h-6 w-6" />
			</button>
		</Swiper>
	)
}
