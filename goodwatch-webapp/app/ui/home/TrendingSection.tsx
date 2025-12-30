import { Link } from "@remix-run/react"
import { SwiperSlide } from "swiper/react"
import { MovieTvCard } from "~/ui/MovieTvCard"
import ListSwiper from "~/ui/ListSwiper"

interface TrendingItem {
	tmdb_id: number
	title: string
	poster_path: string
}

interface TrendingSectionProps {
	trendingMovies: TrendingItem[]
	trendingTV: TrendingItem[]
}

export default function TrendingSection({ trendingMovies, trendingTV }: TrendingSectionProps) {
	return (
		<div className="space-y-12">
			{trendingMovies.length > 0 && (
				<section>
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
							<span className="text-amber-400">📈</span>
							Trending Movies
						</h2>
						<Link
							to="/discover/movies"
							className="text-sm text-gray-400 hover:text-amber-400 transition-colors"
						>
							See all →
						</Link>
					</div>
					<ListSwiper>
						{trendingMovies.map((movie) => (
							<SwiperSlide key={movie.tmdb_id}>
								<MovieTvCard
									details={movie}
									mediaType="movie"
									prefetch={true}
								/>
							</SwiperSlide>
						))}
					</ListSwiper>
				</section>
			)}

			{trendingTV.length > 0 && (
				<section>
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
							<span className="text-amber-400">📈</span>
							Trending Shows
						</h2>
						<Link
							to="/discover/show"
							className="text-sm text-gray-400 hover:text-amber-400 transition-colors"
						>
							See all →
						</Link>
					</div>
					<ListSwiper>
						{trendingTV.map((show) => (
							<SwiperSlide key={show.tmdb_id}>
								<MovieTvCard
									details={show}
									mediaType="show"
									prefetch={true}
								/>
							</SwiperSlide>
						))}
					</ListSwiper>
				</section>
			)}
		</div>
	)
}
