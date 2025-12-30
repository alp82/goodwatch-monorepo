import { useState } from "react"
import { Link } from "@remix-run/react"
import { motion } from "framer-motion"
import { SwiperSlide } from "swiper/react"
import { useDiscover } from "~/routes/api.discover"
import { moods } from "~/ui/explore/category/moods"
import { MovieTvCard } from "~/ui/MovieTvCard"
import ListSwiper from "~/ui/ListSwiper"

const FEATURED_MOODS = [
	{ key: "feel-good", label: "Feel Good", emoji: "❤" },
	{ key: "suspense", label: "Suspense", emoji: "⏳" },
	{ key: "funny", label: "Funny", emoji: "😂" },
	{ key: "mind-bending", label: "Mind Benders", emoji: "🌀" },
	{ key: "adrenaline", label: "Adrenaline", emoji: "🔥" },
] as const

export default function MoodSelector() {
	const [selectedMood, setSelectedMood] = useState<string | null>(null)

	const moodConfig = selectedMood ? moods[selectedMood] : null
	const fingerprintConditions = moodConfig?.discoverParams?.fingerprintConditions

	const { data, isLoading } = useDiscover({
		params: {
			type: "all",
			country: "US",
			language: "en",
			fingerprintConditions: fingerprintConditions || "",
			sortBy: "popularity",
			sortDirection: "desc",
		},
		enabled: !!selectedMood && !!fingerprintConditions,
	})

	const results = data?.pages?.flat() ?? []

	return (
		<section className="w-full bg-gray-800/30 rounded-xl p-6 border border-gray-800 text-sm md:text-base">
			<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
				<div>
					<h2 className="text-2xl md:text-3xl font-bold text-white">
						What's the vibe tonight?
					</h2>
					<p className="text-gray-400 mt-1">
						Select a mood to get instant recommendations
					</p>
				</div>

				<div className="flex flex-wrap gap-2">
					{FEATURED_MOODS.map((mood) => (
						<button
							key={mood.key}
							type="button"
							onClick={() => setSelectedMood(mood.key)}
							className={`px-2 md:px-4 py-1 md:py-2 rounded-full text-sm font-medium transition-all ${
								selectedMood === mood.key
									? "bg-amber-500 text-white"
									: "bg-gray-800 text-gray-300 hover:bg-gray-700"
							}`}
						>
							<span className="mr-1.5">{mood.emoji}</span>
							{mood.label}
						</button>
					))}
				</div>
			</div>

			{selectedMood && (
				<motion.div
					key={selectedMood}
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3 }}
				>
					{isLoading ? (
						<div className="flex items-center justify-center h-48">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
						</div>
					) : results.length > 0 ? (
						<ListSwiper>
							{results.slice(0, 20).map((details) => (
								<SwiperSlide key={`${details.media_type}-${details.tmdb_id}`}>
									<MovieTvCard details={details} mediaType={details.media_type} />
								</SwiperSlide>
							))}
						</ListSwiper>
					) : (
						<div className="text-center text-gray-400 py-8">
							No results found for this mood
						</div>
					)}

					{moodConfig && (
						<div className="mt-4 text-center flex flex-col md:flex-row flex-wrap justify-center gap-2 md:gap-8">
							<span>
								{moodConfig.label}:
							</span>
							<Link
								to={`/movies/moods/${selectedMood}`}
								className="text-amber-400 hover:text-amber-300 font-medium"
							>
								Explore Movies →
							</Link>
							<Link
								to={`/shows/moods/${selectedMood}`}
								className="text-amber-400 hover:text-amber-300 font-medium"
							>
								Explore Shows →
							</Link>
						</div>
					)}
				</motion.div>
			)}

			{!selectedMood && (
				<div className="text-center text-gray-500 py-12 border border-dashed border-gray-700 rounded-xl">
					<p className="text-lg">Select a mood above to see recommendations</p>
				</div>
			)}
		</section>
	)
}
