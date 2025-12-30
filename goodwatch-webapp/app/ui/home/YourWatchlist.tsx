import { Link } from "@remix-run/react"
import { SwiperSlide } from "swiper/react"
import { BookmarkIcon } from "@heroicons/react/24/solid"
import { MovieTvCard } from "~/ui/MovieTvCard"
import ListSwiper from "~/ui/ListSwiper"

interface WatchlistItemData {
	tmdb_id: number
	media_type: "movie" | "show"
	title: string
	poster_path: string
}

interface YourWatchlistProps {
	watchlistItems: WatchlistItemData[]
}

export default function YourWatchlist({ watchlistItems }: YourWatchlistProps) {
	if (watchlistItems.length === 0) {
		return null
	}

	return (
		<section>
			<div className="flex items-center justify-between mb-4">
				<h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
					<BookmarkIcon className="w-6 h-6 text-amber-400" />
					Your Watchlist
				</h2>
				<Link
					to="/wishlist"
					className="text-sm text-gray-400 hover:text-amber-400 transition-colors"
				>
					See all →
				</Link>
			</div>
			<ListSwiper>
				{watchlistItems.map((item) => (
					<SwiperSlide key={`${item.media_type}-${item.tmdb_id}`}>
						<MovieTvCard
							details={item}
							mediaType={item.media_type}
							prefetch={true}
						/>
					</SwiperSlide>
				))}
			</ListSwiper>
		</section>
	)
}
