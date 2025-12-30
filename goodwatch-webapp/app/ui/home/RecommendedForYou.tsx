import { Link } from "@remix-run/react"
import { SwiperSlide } from "swiper/react"
import { SparklesIcon } from "@heroicons/react/24/solid"
import { MovieTvCard } from "~/ui/MovieTvCard"
import ListSwiper from "~/ui/ListSwiper"

interface RecommendationItem {
	tmdb_id: number
	media_type: "movie" | "show"
	title: string
	poster_path: string
	match_percentage: number
}

interface RecommendedForYouProps {
	recommendations: RecommendationItem[]
	scoresCount: number
}

export default function RecommendedForYou({ recommendations, scoresCount }: RecommendedForYouProps) {
	if (scoresCount < 4 || recommendations.length === 0) {
		return null
	}

	return (
		<section>
			<div className="flex items-center justify-between mb-4">
				<h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
					<SparklesIcon className="w-6 h-6 text-amber-400" />
					Recommended for You
				</h2>
				<Link
					to="/discover"
					className="text-sm text-gray-400 hover:text-amber-400 transition-colors"
				>
					Discover more →
				</Link>
			</div>
			<ListSwiper>
				{recommendations.map((item) => (
					<SwiperSlide key={`${item.media_type}-${item.tmdb_id}`}>
						<div className="relative">
							<MovieTvCard
								details={item}
								mediaType={item.media_type}
								prefetch={true}
							/>
							{item.match_percentage > 0 && (
								<div className="absolute top-2 left-2 px-2 py-0.5 bg-amber-600/90 text-white text-xs font-bold rounded">
									{item.match_percentage}% match
								</div>
							)}
						</div>
					</SwiperSlide>
				))}
			</ListSwiper>
		</section>
	)
}
