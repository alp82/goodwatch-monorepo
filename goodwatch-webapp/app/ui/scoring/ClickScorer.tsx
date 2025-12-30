import { motion } from "framer-motion"
import { BookmarkIcon, ForwardIcon, FilmIcon, TvIcon, InformationCircleIcon } from "@heroicons/react/24/outline"
import type { Score } from "~/server/scores.server"
import type { ScoringMedia } from "./types"
import { getScoreTextClass, getScoreLabelText, getScoreBgClass, getVibeColorValue } from "~/utils/ratings"
import { useState } from "react"
import Button from "~/ui/button/Button"
import GenreBadge from "~/ui/badge/GenreBadge"
import ScoreIndicator from "./ScoreIndicator"

interface ClickScorerProps {
	media: ScoringMedia
	onScore: (score: Score) => void
	onSkip: () => void
	onPlanToWatch: () => void
	isGuest?: boolean
}

export default function ClickScorer({ media, onScore, onSkip, onPlanToWatch }: ClickScorerProps) {
	const [hoveredScore, setHoveredScore] = useState<Score | null>(null)

	const handleScoreClick = (score: Score) => {
		onScore(score)
	}

	const backdropUrl = media.backdrop_path 
		? `https://image.tmdb.org/t/p/w1280${media.backdrop_path}`
		: null
	const posterUrl = `https://image.tmdb.org/t/p/w500${media.poster_path}`
	const mediaTypeLabel = media.media_type === "movie" ? "Movie" : "Show"
	const MediaTypeIcon = media.media_type === "movie" ? FilmIcon : TvIcon

	return (
		<div className="relative w-full h-full flex flex-col">
			{/* Score Label */}
			<div className="h-8 flex gap-1 items-center justify-center mb-2 text-lg">
				<span className="text-white font-medium">Score how much <em className="italic font-extrabold text-shadow-[0_0_6px_rgba(255,255,255,0.2)]">you</em> enjoyed it</span>
				<span className="text-gray-500 mx-2">·</span>
				<span className="text-gray-500">Keep scoring to build your taste profile</span>
			</div>

			{/* Rating Bar - Full Width with Numbers Inside */}
			<div className="w-full flex">
				{Array.from({ length: 10 }, (_, i) => {
					const score = (i + 1) as Score
					const isHovered = hoveredScore !== null && score <= hoveredScore
					const isFirst = i === 0
					const isLast = i === 9
					
					return (
						<button
							key={score}
							type="button"
							className={`
								flex-1 h-16 flex items-center justify-center
								cursor-pointer
								${isFirst ? 'rounded-tl-lg' : ''} ${isLast ? 'rounded-tr-lg' : ''}
								${isHovered ? getScoreBgClass(hoveredScore!, hoveredScore) : getScoreBgClass(score, score)}
							`}
							onMouseEnter={() => setHoveredScore(score)}
							onMouseLeave={() => setHoveredScore(null)}
							onClick={() => handleScoreClick(score)}
						>
							<span className={`text-lg font-bold ${isHovered ? 'text-white' : 'text-white/70'}`}>
								{score}
							</span>
						</button>
					)
				})}
			</div>

			{/* Poster + Backdrop Side by Side with Overlays */}
			<div className="w-full flex relative">
				{/* Poster */}
				<div className="flex-shrink-0 z-10 relative">
					<div className="h-64 md:h-80 lg:h-96 aspect-[2/3] relative">
						<img
							src={posterUrl}
							alt={media.title}
							className="w-full h-full object-cover"
						/>
						
						{/* Color Overlay on Poster */}
						{hoveredScore && (
							<div 
								className="absolute inset-0 pointer-events-none transition-opacity duration-200 z-10"
								style={{ 
									backgroundColor: getVibeColorValue(hoveredScore),
									opacity: 0.35
								}}
							/>
						)}
					</div>
				</div>

				{/* Backdrop */}
				<div className="flex-1 relative">
					{backdropUrl ? (
						<img
							src={backdropUrl}
							alt=""
							className="w-full h-64 md:h-80 lg:h-96 object-cover object-center"
						/>
					) : (
						<div className="w-full h-64 md:h-80 lg:h-96 bg-gradient-to-br from-gray-800 to-gray-900" />
					)}

					{/* Color Overlay on Backdrop */}
					{hoveredScore && (
						<div 
							className="absolute inset-0 pointer-events-none transition-opacity duration-200 z-10"
							style={{ 
								backgroundColor: getVibeColorValue(hoveredScore),
								opacity: 0.35,
							}}
						/>
					)}

					{/* Title & Genres Overlay - Top */}
					<div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/90 via-black/60 to-transparent pt-4 pb-8 pl-4 pr-20">
						<h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white drop-shadow-lg">
							{media.title}
							{media.release_year && (
								<span className="text-gray-300 font-normal ml-2">({media.release_year})</span>
							)}
						</h2>
						{media.genres && media.genres.length > 0 && (
							<div className="flex flex-wrap gap-2 mt-3">
								{media.genres.slice(0, 4).map((genre) => (
									<GenreBadge key={genre} genre={genre} />
								))}
							</div>
						)}
						
						{/* Media Type Badge */}
						<div className="absolute top-4 right-4 flex items-center gap-1 px-2 py-1 bg-black/40 rounded text-xs font-medium text-gray-300">
							<MediaTypeIcon className="w-3.5 h-3.5" />
							<span>{mediaTypeLabel}</span>
						</div>
					</div>

					{/* Bottom Action Bar - Inside Image */}
					<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-12 pb-5 px-6">
						<div className="flex justify-end gap-4">
							<div>
								<Button icon={BookmarkIcon} highlight="sky" mode="dark" size="sm" onClick={onPlanToWatch}>
									Want to See
								</Button>
							</div>

							<div>
								<Button icon={ForwardIcon} highlight="stone" mode="dark" iconPosition="right" size="sm" onClick={onSkip}>
									Skip
								</Button>
							</div>
						</div>
					</div>
				</div>
			</div>

			{hoveredScore && (
				<motion.div
					initial={{ opacity: 0, scale: 0.8 }}
					animate={{ opacity: 1, scale: 1 }}
					className="absolute top-58 left-1/2 -translate-x-1/2 z-20"
				>
					<ScoreIndicator score={hoveredScore} />
				</motion.div>
			)}

			{/* Details Section - Always Visible */}
			<div className="w-full bg-gray-900/95 px-8 py-6 rounded-b-lg">
				<div className="flex gap-8">
					{/* Synopsis */}
					<div className="flex-1">
						<h3 className="text-lg font-semibold text-white mb-3">Description</h3>
						{media.synopsis ? (
							<p className="text-gray-300 text-lg leading-relaxed">
								{media.synopsis}
							</p>
						) : (
							<p className="text-gray-500 text-lg italic">Not available</p>
						)}
					</div>

					{/* Essence Tags */}
					{media.essence_tags && media.essence_tags.length > 0 && (
						<div className="w-104 flex-shrink-0">
							<h3 className="text-lg font-semibold text-white mb-3">Tags</h3>
							<div className="flex flex-wrap gap-2">
								{media.essence_tags.slice(0, 8).map((tag) => (
									<span
										key={tag}
										className="px-2.5 py-1 bg-gray-800 text-gray-300 text-sm rounded-full"
									>
										{tag}
									</span>
								))}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
