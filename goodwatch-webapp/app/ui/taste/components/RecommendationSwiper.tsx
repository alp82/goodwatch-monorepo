import { useEffect, useState } from "react"
import { Swiper, SwiperSlide } from "swiper/react"
import { FreeMode, Navigation } from "swiper/modules"
import { ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/outline"
import type { Recommendation } from "../types"

interface RecommendationSwiperProps {
	recommendations: Recommendation[]
}

function PosterCard({ recommendation }: { recommendation: Recommendation }) {
	return (
		<div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-lg group">
			<img
				src={`https://image.tmdb.org/t/p/w342${recommendation.poster_path}`}
				alt={recommendation.title}
				className="w-full h-full object-cover"
			/>
			<div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
			<div className="absolute bottom-0 left-0 right-0 p-3">
				<h4 className="text-white font-semibold text-sm truncate">{recommendation.title}</h4>
				<div className="flex items-center gap-2 mt-1">
					{recommendation.release_year && (
						<span className="text-gray-300 text-xs">{recommendation.release_year}</span>
					)}
				</div>
			</div>
		</div>
	)
}

function BackdropCard({ recommendation }: { recommendation: Recommendation }) {
	const imageUrl = recommendation.backdrop_path 
		? `https://image.tmdb.org/t/p/w780${recommendation.backdrop_path}`
		: `https://image.tmdb.org/t/p/w500${recommendation.poster_path}`
	
	return (
		<div className="relative w-full h-32 rounded-xl overflow-hidden shadow-lg">
			<img
				src={imageUrl}
				alt={recommendation.title}
				className="w-full h-full object-cover"
			/>
			<div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
			<div className="absolute bottom-0 left-0 right-0 p-3">
				<h4 className="text-white font-semibold text-base truncate">{recommendation.title}</h4>
				<div className="flex items-center gap-2 mt-0.5">
					{recommendation.release_year && (
						<span className="text-gray-300 text-xs">{recommendation.release_year}</span>
					)}
				</div>
			</div>
		</div>
	)
}

function DesktopSwiper({ recommendations }: RecommendationSwiperProps) {
	return (
		<div className="relative px-10">
			<Swiper
				modules={[Navigation, FreeMode]}
				spaceBetween={16}
				slidesPerView={4}
				slidesPerGroup={1}
				navigation={{
					prevEl: '.swiper-button-prev-desktop',
					nextEl: '.swiper-button-next-desktop',
				}}
				freeMode={true}
				grabCursor={true}
				breakpoints={{
					768: { slidesPerView: 3 },
					1024: { slidesPerView: 4 },
					1280: { slidesPerView: 5 },
				}}
				className="!overflow-visible"
			>
				{recommendations.map((rec, index) => (
					<SwiperSlide key={`${rec.media_type}-${rec.tmdb_id}-${index}`}>
						<PosterCard recommendation={rec} />
					</SwiperSlide>
				))}
			</Swiper>
			
			<button
				type="button"
				className="swiper-button-prev-desktop absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-gray-800/90 hover:bg-gray-700 text-white rounded-full shadow-lg transition-colors cursor-pointer disabled:opacity-30"
			>
				<ChevronLeftIcon className="w-5 h-5" />
			</button>
			<button
				type="button"
				className="swiper-button-next-desktop absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-gray-800/90 hover:bg-gray-700 text-white rounded-full shadow-lg transition-colors cursor-pointer disabled:opacity-30"
			>
				<ChevronRightIcon className="w-5 h-5" />
			</button>
		</div>
	)
}

function MobileSwiper({ recommendations }: RecommendationSwiperProps) {
	return (
		<div className="relative py-8">
			<Swiper
				modules={[Navigation, FreeMode]}
				direction="vertical"
				spaceBetween={12}
				slidesPerView={3}
				slidesPerGroup={1}
				navigation={{
					prevEl: '.swiper-button-prev-mobile',
					nextEl: '.swiper-button-next-mobile',
				}}
				freeMode={true}
				grabCursor={true}
				className="!h-[420px]"
			>
				{recommendations.map((rec, index) => (
					<SwiperSlide key={`${rec.media_type}-${rec.tmdb_id}-${index}`}>
						<BackdropCard recommendation={rec} />
					</SwiperSlide>
				))}
			</Swiper>
			
			<button
				type="button"
				className="swiper-button-prev-mobile absolute left-1/2 -translate-x-1/2 top-0 z-10 p-2 bg-gray-800/90 hover:bg-gray-700 text-white rounded-full shadow-lg transition-colors cursor-pointer disabled:opacity-30"
			>
				<ChevronUpIcon className="w-5 h-5" />
			</button>
			<button
				type="button"
				className="swiper-button-next-mobile absolute left-1/2 -translate-x-1/2 bottom-0 z-10 p-2 bg-gray-800/90 hover:bg-gray-700 text-white rounded-full shadow-lg transition-colors cursor-pointer disabled:opacity-30"
			>
				<ChevronDownIcon className="w-5 h-5" />
			</button>
		</div>
	)
}

export default function RecommendationSwiper({ recommendations }: RecommendationSwiperProps) {
	const [isMobile, setIsMobile] = useState(false)

	useEffect(() => {
		const checkMobile = () => setIsMobile(window.innerWidth < 768)
		checkMobile()
		window.addEventListener("resize", checkMobile)
		return () => window.removeEventListener("resize", checkMobile)
	}, [])

	if (recommendations.length === 0) {
		return (
			<div className="flex items-center justify-center h-64 text-gray-400">
				<p>No recommendations available yet</p>
			</div>
		)
	}

	return isMobile 
		? <MobileSwiper recommendations={recommendations} />
		: <DesktopSwiper recommendations={recommendations} />
}
