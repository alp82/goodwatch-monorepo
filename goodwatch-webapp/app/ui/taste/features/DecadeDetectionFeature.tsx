import { motion } from "framer-motion"
import { useRef } from "react"
import { useTasteDecades } from "~/routes/api.taste-profile.decades"
import type { Feature } from "../features"
import type { DecadeStat } from "~/server/taste-profile.server"
import { decades as decadeConfig } from "~/ui/explore/category/decades"
import { getVibeColorValue } from "~/utils/ratings"
import type { Score } from "~/server/scores.server"

interface DecadeDetectionFeatureProps {
	feature: Feature
}

const TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/w500"

const ALL_DECADES = ["1920s", "1930s", "1940s", "1950s", "1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"]

function getDecadeBackdrop(decade: string): string | null {
	const config = decadeConfig[decade]
	if (config?.backdrop_path) {
		return `${TMDB_BACKDROP_BASE}/${config.backdrop_path}`
	}
	return null
}

function ScoreBadge({ score }: { score: number }) {
	const roundedScore = Math.round(score) as Score
	return (
		<span 
			className="text-xs px-2 py-0.5 font-bold text-white rounded"
			style={{ backgroundColor: getVibeColorValue(roundedScore) }}
		>
			★ {score.toFixed(1)}
		</span>
	)
}

export default function DecadeDetectionFeature({ feature }: DecadeDetectionFeatureProps) {
	const { data: decadeData, isLoading } = useTasteDecades()

	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			className="rounded-xl border border-gray-700/50 bg-gray-900/50 overflow-hidden"
		>
			<div className="flex items-center gap-3 p-4 border-b border-gray-700/50 bg-gray-800/30">
				<span className="text-2xl">{feature.icon}</span>
				<div className="flex-1">
					<h3 className="font-semibold text-white">Time Travel</h3>
					<p className="text-sm text-gray-400">Your journey through the eras of cinema</p>
				</div>
			</div>
			<div className="py-4">
				{isLoading ? (
					<DecadeLoadingSkeleton />
				) : (
					<DecadeTimeline decades={decadeData?.decades || []} />
				)}
			</div>
		</motion.div>
	)
}

function DecadeTimeline({ decades }: { decades: DecadeStat[] }) {
	const scrollRef = useRef<HTMLDivElement>(null)

	if (decades.length === 0) {
		return <p className="text-gray-500 text-sm px-4">Rate more titles to see your decade preferences.</p>
	}

	const maxCount = Math.max(...decades.map(d => d.count))
	const maxScore = Math.max(...decades.map(d => d.avgScore))

	const getHighlightScore = (stat: DecadeStat): number => {
		const countNorm = stat.count / maxCount
		const scoreNorm = stat.avgScore / maxScore
		return countNorm * 0.6 + scoreNorm * 0.4
	}

	const decadesWithScores = decades
		.map(d => ({ ...d, highlightScore: getHighlightScore(d) }))
		.sort((a, b) => {
			const aNum = parseInt(a.decade)
			const bNum = parseInt(b.decade)
			return aNum - bNum
		})
	
	const topDecade = decadesWithScores.reduce((a, b) => a.highlightScore > b.highlightScore ? a : b)
	const topIndex = decadesWithScores.findIndex(d => d.decade === topDecade.decade)

	const getSizeMultiplier = (index: number): number => {
		const distance = Math.abs(index - topIndex)
		if (distance === 0) return 1.0
		if (distance === 1) return 0.75
		if (distance === 2) return 0.55
		return 0.45
	}

	const baseWidth = 200
	const baseHeight = 130

	return (
		<div 
			ref={scrollRef}
			className="flex items-end justify-center gap-4 overflow-x-auto pb-4 px-6 scrollbar-hide"
		>
			{decadesWithScores.map((stat, i) => {
				const isTop = stat.decade === topDecade.decade
				const backdrop = getDecadeBackdrop(stat.decade)
				const sizeMultiplier = getSizeMultiplier(i)
				const width = Math.round(baseWidth * sizeMultiplier)
				const height = Math.round(baseHeight * sizeMultiplier)

				return (
					<motion.div
						key={stat.decade}
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: i * 0.05 }}
						className="flex flex-col items-center flex-shrink-0 py-2"
					>
						<div 
							className={`
								relative rounded-xl overflow-hidden transition-all duration-300
								${isTop ? "ring-2 ring-purple-500 ring-offset-2 ring-offset-gray-900" : ""}
							`}
							style={{ width, height }}
						>
							{backdrop ? (
								<img
									src={backdrop}
									alt={stat.decade}
									className="absolute inset-0 w-full h-full object-cover"
								/>
							) : (
								<div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800" />
							)}
							<div className="absolute inset-0 bg-black/30" />
							<div className="absolute top-2 right-2 px-2 py-0.5 bg-purple-600/90 rounded text-xs font-bold text-white">
								{stat.count} Titles
							</div>
						</div>

						<div className="flex flex-col items-center mt-3 h-16">
							<span className={`font-semibold ${isTop ? "text-white text-xl" : "text-gray-300 text-base"}`}>
								{stat.decade}
							</span>
							<div className="mt-1">
								<ScoreBadge score={stat.avgScore} />
							</div>
						</div>
					</motion.div>
				)
			})}
		</div>
	)
}

function DecadeLoadingSkeleton() {
	return (
		<div className="flex gap-6 overflow-hidden px-4">
			{[1, 2, 3, 4, 5, 6, 7].map((i) => (
				<div key={i} className="flex flex-col items-center flex-shrink-0">
					<div className="w-28 h-20 bg-gray-800 rounded-xl animate-pulse" />
					<div className="w-3 h-3 rounded-full bg-gray-700 mt-3 animate-pulse" />
					<div className="w-12 h-4 bg-gray-800 rounded mt-2 animate-pulse" />
					<div className="w-14 h-5 bg-gray-800 rounded mt-1 animate-pulse" />
				</div>
			))}
		</div>
	)
}
