import { motion } from "framer-motion"
import { useScoresCount } from "~/hooks/useUserDataAccessors"
import RatingBanner from "~/ui/home/RatingBanner"
import MoodSelector from "~/ui/home/MoodSelector"
import TrendingSection from "~/ui/home/TrendingSection"
import RecommendedForYou from "~/ui/home/RecommendedForYou"
import YourWatchlist from "~/ui/home/YourWatchlist"

interface TrendingItem {
	tmdb_id: number
	title: string
	poster_path: string
}

interface RecommendationItem {
	tmdb_id: number
	media_type: "movie" | "show"
	title: string
	poster_path: string
	match_percentage: number
}

interface WatchlistItemData {
	tmdb_id: number
	media_type: "movie" | "show"
	title: string
	poster_path: string
}

interface LoggedInHomeProps {
	trendingMovies: TrendingItem[]
	trendingTV: TrendingItem[]
	recommendations: RecommendationItem[]
	watchlistItems: WatchlistItemData[]
}

export default function LoggedInHome({
	trendingMovies,
	trendingTV,
	recommendations,
	watchlistItems,
}: LoggedInHomeProps) {
	const scoresCount = useScoresCount()

	return (
		<div className="w-full max-w-7xl mx-auto px-4 space-y-12">
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.1 }}
			>
				<h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
					Welcome back! 👋
				</h1>
				<p className="text-gray-400">
					Here's what's happening in the world of movies and shows
				</p>
			</motion.div>

			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.3 }}
			>
				<RecommendedForYou 
					recommendations={recommendations} 
					scoresCount={scoresCount} 
				/>
			</motion.div>

			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.2 }}
			>
				<RatingBanner scoresCount={scoresCount} />
			</motion.div>

			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.4 }}
			>
				<YourWatchlist watchlistItems={watchlistItems} />
			</motion.div>

			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.5 }}
			>
				<MoodSelector />
			</motion.div>

			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.6 }}
			>
				<TrendingSection 
					trendingMovies={trendingMovies} 
					trendingTV={trendingTV} 
				/>
			</motion.div>
		</div>
	)
}
