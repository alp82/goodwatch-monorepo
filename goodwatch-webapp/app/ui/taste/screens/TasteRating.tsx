import { useSearchParams, Link } from "@remix-run/react"
import { readJourney, rememberJourney, journeyTitleHref } from "../journey-session"
import { useJourneyPrototype } from "../JourneyPrototypeContext"
import JourneyProgress from "../JourneyProgress"
import RecommendationSwiper from "../components/RecommendationSwiper"
import { useState, useEffect } from "react"
import SingleItemScorer from "~/ui/scoring/SingleItemScorer"
import TasteStream from "../components/TasteStream"
import UnlockCelebration from "../components/UnlockCelebration"
import RecommendationsView from "../components/RecommendationsView"
import type { FingerprintPreviewResult } from "~/server/fingerprint-preview.server"
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
	const journey = useJourneyPrototype()
	const [params, setParams] = useSearchParams()
	const [showPicks, setShowPicks] = useState(Boolean(journey))
	const [showWishlist, setShowWishlist] = useState(false)
	
	useEffect(() => {
		if (!journey) return
		const view = params.get("view") || readJourney().view || "picks"
		setShowWishlist(view === "wishlist")
		setShowPicks(view === "picks")
	}, [params])
	useEffect(() => {
		if (!journey) return
		const frame = requestAnimationFrame(() => window.scrollTo(0, readJourney().scrollY || 0))
		return () => cancelAnimationFrame(frame)
	}, [])
	function changeView(view: "picks" | "rate" | "wishlist") {
		setShowWishlist(view === "wishlist"); setShowPicks(view === "picks")
		if (journey) {
			rememberJourney({view, scrollY: 0})
			const next = new URLSearchParams(params); next.set("view", view)
			setParams(next, { replace: true, preventScrollReset: true })
		}
	}
	const handleViewPicks = () => changeView("picks")
	const handleDismissPicks = () => changeView("rate")
	
	const unlockedFeatures = getUnlockedFeatures(ratingsCount)
	const currentFeature = unlockedFeatures[unlockedFeatures.length - 1] || null
	
	const showCelebration = !journey && justUnlockedFeature !== null
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
								{journey ? "Find something you want to watch. Rate familiar titles to make it more personal." : "Rate movies and shows to unlock recommendations"}
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
					onWishlist={() => changeView("wishlist")}
				/>
			</div>

			{journey && <JourneyProgress ratingsCount={ratingsCount} />}
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
					
					{showWishlist && journey && <section className="rounded-2xl border border-gray-700/50 bg-gray-900/95 p-4 md:p-6"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-semibold">Your Wishlist</h2><button type="button" className="text-sm text-cyan-300 hover:text-cyan-200" onClick={handleViewPicks}>Back to discoveries →</button></div>{journey.wishlist.length ? <RecommendationSwiper recommendations={journey.wishlist.map(title => ({ ...title, matchPercentage: 0 }))} /> : <p className="py-10 text-center text-gray-400">See something interesting? Choose Want to See to keep it here.</p>}</section>}
					{showRecommendations && !showWishlist && (
						<RecommendationsView
							variant={!journey && fingerprintPreview ? 'fingerprint' : 'regular'}
							recommendations={recommendations}
							currentFeature={currentFeature || getUnlockedFeatures(5)[0]}
							ratingsCount={ratingsCount}
							onStartOver={onStartOver}
							fingerprintData={fingerprintPreview || undefined}
							isGuest={isGuest}
						/>
					)}
					
					{!showCelebration && !showRecommendations && !showWishlist && (
						<>
						{journey && <div className="mb-2 text-right"><Link to={journeyTitleHref(media)} onClick={journey.rememberJourney} className="text-sm text-cyan-300 hover:text-cyan-200">Explore {media.title} →</Link></div>}
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
						</>
					)}
				</div>
			</div>
			
			{/* Motivational text - Mobile only (below scorer) */}
			{!showCelebration && !showRecommendations && !showWishlist && (
				<div className="md:hidden px-3 py-4 text-center">
					<p className="text-gray-500 text-sm">
						Keep swiping to build your taste profile
					</p>
				</div>
			)}
		</div>
	)
}
