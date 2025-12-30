import { useState } from "react"
import SingleItemScorer from "~/ui/scoring/SingleItemScorer"
import TasteStream from "../components/TasteStream"
import UnlockCelebration from "../components/UnlockCelebration"
import RecommendationsView from "../components/RecommendationsView"
import type { FingerprintPreviewResult, FingerprintRecommendation } from "~/server/fingerprint-preview.server"
import type { ScoringMedia, LastRatedItem } from "~/ui/scoring/types"
import type { Score } from "~/server/scores.server"
import type { Feature } from "../features"
import type { Recommendation } from "../types"
import { getUnlockedFeatures } from "../features"

interface TasteRatingProps {
	media: ScoringMedia
	nextMedia?: ScoringMedia | null
	ratingsCount: number
	onScore: (score: Score) => void
	onSkip: () => void
	onPlanToWatch: () => void
	onStartOver: () => void
	lastRated?: LastRatedItem[]
	recommendations?: Recommendation[]
	isGuest?: boolean
	onSelectLastRated?: (media: ScoringMedia) => void
	selectedMediaId?: number | null
	recommendationsUnlocked: boolean
	justUnlockedFeature: Feature | null
	onDismissCelebration: () => void
	fingerprintPreview?: FingerprintPreviewResult | null
}

export default function TasteRating({
	media,
	nextMedia,
	ratingsCount,
	onScore,
	onSkip,
	onPlanToWatch,
	onStartOver,
	lastRated,
	recommendations = [],
	isGuest = false,
	onSelectLastRated,
	selectedMediaId,
	recommendationsUnlocked,
	justUnlockedFeature,
	onDismissCelebration,
	fingerprintPreview,
}: TasteRatingProps) {
	const [showPicks, setShowPicks] = useState(false)
	
	const handleViewPicks = () => setShowPicks(true)
	const handleDismissPicks = () => setShowPicks(false)
	
	const unlockedFeatures = getUnlockedFeatures(ratingsCount)
	const currentFeature = unlockedFeatures[unlockedFeatures.length - 1] || null
	
	const showCelebration = justUnlockedFeature !== null
	const showRecommendations = !showCelebration && showPicks

	return (
		<div className="flex flex-col relative min-h-screen">
			{/* Header - Always visible */}
			<div className="px-3 py-3 md:px-4 md:py-4 w-full">
				<div className="max-w-6xl mx-auto">
					<div className="flex items-center justify-between">
						{/* Left: Title */}
						<div>
							<h1 className="mb-1 text-2xl md:text-3xl lg:text-4xl font-bold text-white">
								Your Taste Profile
							</h1>
							<p className="text-gray-400 text-md md:text-lg lg:text-xl">
								Rate movies and shows to unlock recommendations
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Taste Stream - Always visible */}
			<div className="mb-2">
				<TasteStream
					lastRated={lastRated || []}
					ratingsCount={ratingsCount}
					isGuest={isGuest}
					onSelectLastRated={onSelectLastRated}
					selectedMediaId={selectedMediaId}
					recommendationsUnlocked={recommendationsUnlocked}
					recommendationsShown={showRecommendations}
					onViewPicks={handleViewPicks}
					onContinueRating={handleDismissPicks}
				/>
			</div>

			{/* Content Area - 3 possible views */}
			<div className="flex-1 px-3 py-2 md:px-4 md:py-4">
				<div className="max-w-6xl mx-auto">
					{showCelebration && justUnlockedFeature && (
						<UnlockCelebration
							unlockedFeature={justUnlockedFeature}
							onReveal={() => {
								onDismissCelebration()
								setShowPicks(true)
							}}
							onContinueRating={onDismissCelebration}
						/>
					)}
					
					{showRecommendations && (
						<RecommendationsView
							variant={fingerprintPreview ? 'fingerprint' : 'regular'}
							recommendations={recommendations}
							currentFeature={currentFeature}
							ratingsCount={ratingsCount}
							onStartOver={onStartOver}
							fingerprintData={fingerprintPreview || undefined}
							isGuest={isGuest}
						/>
					)}
					
					{!showCelebration && !showRecommendations && (
						<SingleItemScorer
							media={media}
							nextMedia={nextMedia}
							onScore={onScore}
							onSkip={onSkip}
							onPlanToWatch={onPlanToWatch}
							lastRated={lastRated}
							ratingsCount={ratingsCount}
							isGuest={isGuest}
						/>
					)}
				</div>
			</div>
			
			{/* Motivational text - Mobile only (below scorer) */}
			{!showCelebration && !showRecommendations && (
				<div className="md:hidden px-3 py-4 text-center">
					<p className="text-gray-500 text-sm">
						Keep swiping to build your taste profile
					</p>
				</div>
			)}
		</div>
	)
}
