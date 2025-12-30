import { motion } from "framer-motion"
import { useTasteGenres } from "~/routes/api.taste-profile.genres"
import type { Feature } from "../features"
import type { GenreStat } from "~/server/taste-profile.server"
import { genres as genreConfig } from "~/ui/explore/category/genres"
import { getVibeColorValue } from "~/utils/ratings"
import type { Score } from "~/server/scores.server"

interface GenreDetectionFeatureProps {
	feature: Feature
}

const TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/w780"

const genreBackdropMap: Record<string, string> = Object.fromEntries(
	Object.values(genreConfig)
		.filter(g => g.backdrop_path)
		.map(g => [g.label, g.backdrop_path])
)

function getGenreBackdrop(genreName: string): string | null {
	const backdrop = genreBackdropMap[genreName]
	if (backdrop) return `${TMDB_BACKDROP_BASE}/${backdrop}`
	const normalizedName = genreName.toLowerCase().replace(/[^a-z]/g, "")
	for (const [label, path] of Object.entries(genreBackdropMap)) {
		if (label.toLowerCase().replace(/[^a-z]/g, "") === normalizedName) {
			return `${TMDB_BACKDROP_BASE}/${path}`
		}
	}
	return null
}

function ScoreBadge({ score, size = "default" }: { score: number; size?: "small" | "default" | "large" }) {
	const roundedScore = Math.round(score) as Score
	const sizeClasses = {
		small: "text-[10px] px-1.5 py-0.5",
		default: "text-xs px-2 py-0.5",
		large: "text-sm px-2.5 py-1"
	}
	return (
		<span 
			className={`${sizeClasses[size]} font-bold text-white rounded whitespace-nowrap`}
			style={{ backgroundColor: getVibeColorValue(roundedScore) }}
		>
			★ {score.toFixed(1)}
		</span>
	)
}

export default function GenreDetectionFeature({ feature }: GenreDetectionFeatureProps) {
	const { data: genreData, isLoading } = useTasteGenres()

	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			className="rounded-xl border border-gray-700/50 bg-gray-900/50 overflow-hidden"
		>
			<div className="flex items-center gap-3 p-4 border-b border-gray-700/50 bg-gray-800/30">
				<span className="text-2xl">{feature.icon}</span>
				<div className="flex-1">
					<h3 className="font-semibold text-white">{feature.name}</h3>
					<p className="text-sm text-gray-400">{feature.shortDescription}</p>
				</div>
			</div>
			<div className="p-4">
				{isLoading ? (
					<GenreLoadingSkeleton />
				) : (
					<GenreGrid genres={genreData?.genres || []} />
				)}
			</div>
		</motion.div>
	)
}

function GenreGrid({ genres }: { genres: GenreStat[] }) {
	if (genres.length === 0) {
		return <p className="text-gray-500 text-sm">Rate more titles to see your genre preferences.</p>
	}

	const maxCount = Math.max(...genres.map(g => g.count))

	const getGridClass = (index: number, count: number): string => {
		const ratio = count / maxCount
		if (index <= 1) return "col-span-3 row-span-3"
		if (index <= 5) return "col-span-2 row-span-2"
		return "col-span-1 row-span-1"
	}

	const getTextSize = (index: number): string => {
		if (index <= 1) return "text-3xl font-bold"
		if (index <= 5) return "text-2xl font-bold"
		return "text-sm"
	}

	const getScoreSize = (index: number): "small" | "default" | "large" => {
		if (index <= 1) return "large"
		if (index <= 5) return "default"
		return "small"
	}

	return (
		<div className="grid grid-cols-6 gap-2 auto-rows-[70px]">
			{genres.map((genre, i) => {
				const backdrop = getGenreBackdrop(genre.name)
				const gridClass = getGridClass(i, genre.count)
				const textSize = getTextSize(i)
				const scoreSize = getScoreSize(i)
				const isLarge = i <= 1

				return (
					<motion.div
						key={genre.name}
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ delay: i * 0.03 }}
						className={`${gridClass} relative rounded-lg overflow-hidden group cursor-pointer`}
					>
						{backdrop ? (
							<img
								src={backdrop}
								alt={genre.name}
								className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
							/>
						) : (
							<div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800" />
						)}
						<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
						<div className="absolute inset-0 p-3 flex flex-col justify-end">
							<div className="flex items-end justify-between gap-2">
								<h4 className={`${textSize} text-white leading-tight drop-shadow-lg`}>
									{genre.name}
								</h4>
								<ScoreBadge score={genre.avgScore} size={scoreSize} />
							</div>
							{isLarge && (
								<span className="text-sm text-gray-300 mt-1">
									{genre.count} Titles
								</span>
							)}
						</div>
					</motion.div>
				)
			})}
		</div>
	)
}

function GenreLoadingSkeleton() {
	return (
		<div className="grid grid-cols-6 gap-2 auto-rows-[70px]">
			<div className="col-span-3 row-span-3 bg-gray-800 rounded-lg animate-pulse" />
			<div className="col-span-3 row-span-3 bg-gray-800 rounded-lg animate-pulse" />
			<div className="col-span-2 row-span-2 bg-gray-800 rounded-lg animate-pulse" />
			<div className="col-span-2 row-span-2 bg-gray-800 rounded-lg animate-pulse" />
			<div className="col-span-2 row-span-2 bg-gray-800 rounded-lg animate-pulse" />
			<div className="col-span-2 row-span-2 bg-gray-800 rounded-lg animate-pulse" />
			{Array.from({ length: 14 }).map((_, i) => (
				<div key={i} className="col-span-1 row-span-1 bg-gray-800 rounded-lg animate-pulse" />
			))}
		</div>
	)
}
