import { useEffect, useState } from "react"
import { motion, useMotionValue, useTransform, useAnimation } from "framer-motion"
import { FilmIcon, TvIcon } from "@heroicons/react/24/outline"

import { BookmarkIcon, ForwardIcon } from "@heroicons/react/24/outline"
import type { ScoringMedia } from "./types"
import type { Score } from "~/server/scores.server"
import { scoreLabels, getVibeColorValue } from "~/utils/ratings"
import GenreBadge from "~/ui/badge/GenreBadge"
import Button from "~/ui/button/Button"
import ScoreIndicator from "./ScoreIndicator"

interface SwipeScorerProps {
	media: ScoringMedia
	nextMedia?: ScoringMedia | null
	onScore: (score: Score) => void
	onSkip: () => void
	onPlanToWatch: () => void
	isGuest?: boolean
	isFirstItem?: boolean
}

const SCORE_THRESHOLD = 25 // Minimum horizontal drag to trigger scoring
const DRAG_DISTANCE = 140

export default function SwipeScorer({ media, nextMedia, onScore, onSkip, onPlanToWatch, isGuest = false, isFirstItem = false }: SwipeScorerProps) {
	const [isDragging, setIsDragging] = useState(false)
	const mediaTypeLabel = media.media_type === "movie" ? "Movie" : "Show"
	const MediaTypeIcon = media.media_type === "movie" ? FilmIcon : TvIcon
	const [currentScore, setCurrentScore] = useState<Score>(5)
	const [hasPassedThreshold, setHasPassedThreshold] = useState(false)
	const [hasInteracted, setHasInteracted] = useState(false)
	const x = useMotionValue(0)
	const controls = useAnimation()
	const rotate = useTransform(x, [-DRAG_DISTANCE*2, -DRAG_DISTANCE, DRAG_DISTANCE, DRAG_DISTANCE*2], [-16, -8, 8, 16])
	
	// Next poster reveal - scales and fades in as current is dragged
	const nextScale = useTransform(
		x,
		[-DRAG_DISTANCE*2, -DRAG_DISTANCE, -SCORE_THRESHOLD, 0, SCORE_THRESHOLD, DRAG_DISTANCE, DRAG_DISTANCE*2],
		[1, 0.8, 0.72, 0.68, 0.72, 0.8, 1]
	)
	const nextOpacity = useTransform(
		x,
		[-DRAG_DISTANCE, -SCORE_THRESHOLD, 0, SCORE_THRESHOLD, DRAG_DISTANCE],
		[1, 0.6, 0.4, 0.6, 1]
	)

	const calculateScore = (dragX: number): Score => {
		// Center zone is a dead zone - calculate score based on distance from threshold edges
		// Left side: scores 1-5 (threshold to -DRAG_DISTANCE)
		// Right side: scores 6-10 (threshold to +DRAG_DISTANCE)
		
		if (Math.abs(dragX) < SCORE_THRESHOLD) {
			// In dead zone - return neutral score based on direction hint
			return dragX < 0 ? 5 : 6
		}
		
		const scoringRange = DRAG_DISTANCE - SCORE_THRESHOLD // Usable range per side
		
		const distanceFromThreshold = Math.abs(dragX) - SCORE_THRESHOLD
		const normalized = Math.min(distanceFromThreshold / scoringRange, 1)
		
		if (dragX < 0) {
			// Left side: map from -SCORE_THRESHOLD to -DRAG_DISTANCE → scores 5 down to 1
			// 0 = just past threshold (score 5), 1 = max distance (score 1)
			const score = Math.round(5 - normalized * 4)
			return Math.max(1, score) as Score
		}
		
		// Right side: map from +SCORE_THRESHOLD to +DRAG_DISTANCE → scores 6 up to 10
		// 0 = just past threshold (score 6), 1 = max distance (score 10)
		const score = Math.round(6 + normalized * 4)
		return Math.min(10, score) as Score
	}


	useEffect(() => {
		const unsubscribe = x.on("change", (latest) => {
			setCurrentScore(calculateScore(latest))
			setHasPassedThreshold(Math.abs(latest) >= SCORE_THRESHOLD)
		})
		
		return unsubscribe
	}, [x])

	const overlayColor = useTransform(x, (latest) => {
		const score = calculateScore(latest)
		return getVibeColorValue(score)
	})

	const overlayOpacity = useTransform(
		x,
		[-DRAG_DISTANCE, -SCORE_THRESHOLD, 0, SCORE_THRESHOLD, DRAG_DISTANCE],
		[0.6, 0.3, 0, 0.3, 0.6],
	)

	const handleDragEnd = () => {
		setIsDragging(false)
		setHasInteracted(true)

		if (hasPassedThreshold) {
			const score = currentScore
			onScore(score)
		}
		
		x.set(0)
		setHasPassedThreshold(false)
	}

	// Play preview animation on first item
	useEffect(() => {
		if (isFirstItem && !hasInteracted) {
			const playPreview = async () => {
				await new Promise(resolve => setTimeout(resolve, 800))
				await controls.start({
					x: 90,
					transition: { duration: 0.7, ease: [0.4, 0, 0.2, 1] }
				})
				await controls.start({
					x: -90,
					transition: { duration: 0.8, ease: [0.4, 0, 0.2, 1] }
				})
				await controls.start({
					x: 0,
					transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] }
				})
			}
			playPreview()
		}
	}, [isFirstItem, hasInteracted, controls])

	return (
		<div className="relative w-full h-full flex items-center justify-center overflow-hidden">
			{/* Next Poster Preview - Hidden behind current */}
			{nextMedia && (
				<motion.div 
					className="absolute w-full max-w-sm select-none pointer-events-none"
					style={{ scale: nextScale, opacity: nextOpacity }}
				>
					<div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-xl">
						<img
							src={`https://image.tmdb.org/t/p/w500${nextMedia.poster_path}`}
							alt={nextMedia.title}
							className="w-full h-full object-cover"
							draggable={false}
						/>
						{/* Darkened overlay for depth */}
						<div className="absolute inset-0 bg-black/30" />
					</div>
				</motion.div>
			)}

			{/* Score Indicator - Shows when threshold is passed */}
			{isDragging && hasPassedThreshold && (
				<motion.div
					initial={{ opacity: 0, scale: 0.8 }}
					animate={{ opacity: 1, scale: 1 }}
					className="absolute top-30 left-1/2 -translate-x-1/2 z-10"
				>
					<ScoreIndicator score={currentScore} />
				</motion.div>
			)}

			{/* Swipe CTA - Shows when in center zone */}
			{!hasPassedThreshold && (
				<motion.div
					initial={{ opacity: 0, scale: 0.9 }}
					animate={{ opacity: 1, scale: 1 }}
					className="absolute top-48 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
				>
					
					<div className="relative flex items-center gap-4">
						<motion.div
							animate={{ x: [-8, 0, -8] }}
							transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
							className="bg-gradient-to-br from-black/40 to-black/50 backdrop-blur-sm rounded-full p-2 shadow-lg"
						>
							<svg className="w-10 h-10 text-white drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
								<path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
							</svg>
						</motion.div>
						
						<div className="bg-gradient-to-br from-black/70 to-black/90 rounded-full p-4 shadow-2xl ring-4 ring-white/20">
							<svg className="w-10 h-10 text-white drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
								<path strokeLinecap="round" strokeLinejoin="round" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
							</svg>
						</div>
						
						<motion.div
							animate={{ x: [8, 0, 8] }}
							transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
							className="bg-gradient-to-br from-black/40 to-black/50 backdrop-blur-sm rounded-full p-2 shadow-lg"
						>
							<svg className="w-10 h-10 text-white drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
								<path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
							</svg>
						</motion.div>
					</div>

				</motion.div>
			)}

			{/* Initial Hint - Shows when not dragging */}
			{!isDragging && !hasInteracted && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 4 }}
					className="absolute top-60 left-1/2 -translate-x-1/2 p-1.5 rounded-md bg-gray-900/80 text-gray-200 text-sm flex items-center gap-2 pointer-events-none z-10"
				>
					<span>Drag to Score</span>
				</motion.div>
			)}

			<div className="w-full max-w-sm select-none">
				<motion.div
					className="relative cursor-grab active:cursor-grabbing touch-none"
					style={{ x, rotate }}
					drag="x"
					dragConstraints={{ left: -DRAG_DISTANCE, right: DRAG_DISTANCE }}
					dragElastic={0.2}
					dragMomentum={false}
					onDragStart={() => setIsDragging(true)}
					onDragEnd={handleDragEnd}
					animate={isFirstItem && !hasInteracted ? controls : { x: 0, rotate: 0 }}
					transition={{ type: "spring", stiffness: 300, damping: 30 }}
				>
					{/* Movie Poster */}
					<div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl">
						<img
							src={`https://image.tmdb.org/t/p/w500${media.poster_path}`}
							alt={media.title}
							className="w-full h-full object-cover pointer-events-none select-none"
							draggable={false}
						/>

						{/* Color Overlay */}
						<motion.div
							className="absolute inset-0 pointer-events-none"
							style={{
								backgroundColor: overlayColor,
								opacity: overlayOpacity,
							}}
						/>

						{/* Title Overlay */}
						<div className="absolute top-0 left-0 right-0 bg-gradient-to-t from-transparent via-black/70 to-black/95 p-6">
							<h2 className="text-white text-2xl font-bold">
								{media.title}
								{media.release_year && (
									<span className="text-gray-300 font-normal ml-2">({media.release_year})</span>
								)}
							</h2>

							{/* Genres inline */}
							{media.genres && media.genres.length > 0 && (
								<div className="flex flex-wrap gap-1.5 mt-2">
									{media.genres.slice(0, 3).map((genre) => (
										<GenreBadge key={genre} genre={genre} size="sm" />
									))}
								</div>
							)}
						</div>

						<div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4">
							{/* Action Buttons */}
							<div className="flex items-center justify-center gap-2 mb-2">
								<Button icon={BookmarkIcon} highlight="sky" mode="dark" size="sm" onClick={onPlanToWatch}>
									Want to See
								</Button>
								<Button icon={ForwardIcon} iconPosition="right" size="sm" onClick={onSkip}>
									Skip
								</Button>
							</div>
							{/* Media Type Badge */}
							<div className="flex justify-end">
								<div className="flex items-center gap-1 px-2 py-1 bg-black/40 rounded text-xs font-medium text-gray-300">
									<MediaTypeIcon className="w-3.5 h-3.5" />
									<span>{mediaTypeLabel}</span>
								</div>
							</div>
						</div>
					</div>
				</motion.div>
			</div>
		</div>
	)
}
