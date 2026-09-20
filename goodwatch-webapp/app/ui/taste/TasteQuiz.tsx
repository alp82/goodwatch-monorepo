import { useInterestDiscovery } from "~/ui/discovery/useInterestDiscovery"
import {
	canGuestRate,
	guestLimitEvent,
	readGuestInteractions,
} from "~/utils/guest-progress"
import {
	TasteExplorationContext,
	readExploration,
	rememberExploration,
	uniqueTitles,
} from "./exploration"
import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import type { Score } from "~/server/scores.server"
import type { ScoringMedia, LastRatedItem } from "~/ui/scoring/types"
import { fetchSmartTitles } from "~/routes/api.smart-titles"
import { useFingerprintPreview } from "~/routes/api.fingerprint-preview"
import FeatureTooltip from "./components/modals/FeatureTooltip"
import type { GuestRating, Recommendation } from "./types"
import { GUEST_LIMITS, FEATURES, type Feature } from "./features"
import TasteRating from "./screens/TasteRating"
import { useTasteScoring } from "./hooks/useTasteScoring"
import { useFeatureActivation } from "./hooks/useFeatureActivation"
import { useFeatureModals } from "./hooks/useFeatureModals"
import { useGuestScoring } from "./hooks/useGuestScoring"
import { useTitleQueue } from "./hooks/useTitleQueue"
import { useRecentActions } from "./hooks/useRecentActions"
import { useUserData } from "~/routes/api.user-data"

const allFeaturesDescending = [...FEATURES].reverse()

interface TasteQuizProps {
	availableTitles: ScoringMedia[]
	onComplete?: (ratings: GuestRating[]) => void
	onSignUp?: () => void
	isAuthenticated?: boolean
	userId?: string
}

export default function TasteQuiz({
	availableTitles,
	onComplete,
	onSignUp,
	isAuthenticated = false,
	userId,
}: TasteQuizProps) {
	const resume = true
	const {
		interactions,
		ratingsCount,
		addScore,
		addSkip,
		addPlanToWatch,
		clearInteractions,
	} = useTasteScoring({ isAuthenticated })
	const { activatedFeatures, activateFeature, clearFeatures } =
		useFeatureActivation({ isAuthenticated, ratingsCount })
	const modals = useFeatureModals()
	useUserData()

	const { lastRatedItems: dbLastRatedItems } = useRecentActions({
		limit: GUEST_LIMITS.FIRST_UNLOCK,
		enabled: isAuthenticated,
	})

	// Track selected media from recommendations/last rated
	const [selectedMedia, setSelectedMedia] = useState<ScoringMedia | null>(null)
	useEffect(() => {
		if (resume) setSelectedMedia(readExploration().selectedMedia || null)
	}, [resume])

	// Track when a feature threshold is crossed (for celebration screen)
	const [justUnlockedFeature, setJustUnlockedFeature] =
		useState<Feature | null>(null)
	const previousRatingsCount = useRef(
		isAuthenticated
			? ratingsCount
			: readGuestInteractions().filter((i) => i.type === "score").length,
	)

	// Detect threshold crossings
	useEffect(() => {
		// Hydration of persisted ratings is not a newly earned unlock.
		if (
			!isAuthenticated &&
			ratingsCount !==
				readGuestInteractions().filter((i) => i.type === "score").length
		)
			return
		const prev = previousRatingsCount.current
		const current = ratingsCount

		// Check if we crossed any feature threshold
		for (const feature of allFeaturesDescending) {
			if (prev < feature.unlockAt && current >= feature.unlockAt) {
				setJustUnlockedFeature(feature)
				break
			}
		}

		previousRatingsCount.current = current
	}, [ratingsCount])

	const handleDismissCelebration = useCallback(() => {
		setJustUnlockedFeature(null)
	}, [])

	// For guests, derive scored items from interactions (for recommendations)
	const guestScoredItems = useMemo(() => {
		return interactions
			.filter((i) => i.type === "score" && i.score)
			.map((i) => ({
				tmdb_id: i.tmdb_id,
				media_type: i.media_type,
				score: i.score!,
			}))
	}, [interactions])

	// For guests, derive items to exclude from recommendations (skips + plan-to-watch)
	const guestExcludeIds = useMemo(() => {
		return interactions
			.filter((i) => i.type === "skip" || i.type === "plan")
			.map((i) => ({
				tmdb_id: i.tmdb_id,
				media_type: i.media_type,
			}))
	}, [interactions])

	// Create fetch function for the queue
	const fetchMoreTitles = useCallback(async () => {
		return fetchSmartTitles({ count: 20 })
	}, [])

	// Use the stable title queue
	const titleQueue = useTitleQueue({
		resume,
		initialTitles: availableTitles,
		isAuthenticated,
		interactions,
		fetchMoreTitles,
		prefetchThreshold: 5,
		batchSize: 20,
	})

	// Fetch recommendations when first unlock threshold is reached (5 ratings)
	useEffect(() => {
		if (!titleQueue.current) return
		rememberExploration({
			ratingQueue: titleQueue.remainingTitles,
			selectedMedia,
		})
	}, [titleQueue.current, selectedMedia])

	const hasRecommendationsUnlocked = ratingsCount >= GUEST_LIMITS.FIRST_UNLOCK
	const discovery = useInterestDiscovery()

	// Fingerprint preview unlocks at 15 ratings
	const hasFingerprintPreviewUnlocked = ratingsCount >= 15
	const guestLikedItems = useMemo(() => {
		return interactions
			.filter((i) => i.type === "score" && i.score && i.score >= 6)
			.map((i) => ({
				tmdb_id: i.tmdb_id,
				media_type: i.media_type,
			}))
	}, [interactions])

	const fingerprintPreview = useFingerprintPreview({
		userId: isAuthenticated ? userId : undefined,
		likedItems: !isAuthenticated ? guestLikedItems : undefined,
		scoredItems: !isAuthenticated ? guestScoredItems : undefined,
		excludeIds: !isAuthenticated ? guestExcludeIds : undefined,
		enabled:
			hasFingerprintPreviewUnlocked &&
			(isAuthenticated ? true : guestLikedItems.length >= 3),
	})

	const {
		handleScore: scoreHandler,
		handleSkip: skipHandler,
		handlePlanToWatch: planToWatchHandler,
	} = useGuestScoring({
		interactions,
		ratingsCount,
		activatedFeatures,
		addScore,
		addSkip,
		addPlanToWatch,
		activateFeature,
		onComplete,
		nextTitle: titleQueue.advance,
	})

	// Handle selection from last rated or recommendations
	const handleSelectLastRated = (media: ScoringMedia) => {
		setSelectedMedia((prev) =>
			prev?.tmdb_id === media.tmdb_id && prev?.media_type === media.media_type
				? null
				: media,
		)
	}

	const handleScore = (score: Score) => {
		const target = selectedMedia || titleQueue.current
		if (
			!isAuthenticated &&
			target &&
			!canGuestRate(target.media_type, target.tmdb_id)
		) {
			window.dispatchEvent(new Event(guestLimitEvent))
			return
		}

		// Use selected media if available, otherwise use current from queue
		const currentMedia = selectedMedia || titleQueue.current
		if (currentMedia) {
			scoreHandler(currentMedia, score)
			// Clear selection after scoring
			if (selectedMedia) {
				setSelectedMedia(null)
			}
		}
	}

	const handleSkip = () => {
		// Use selected media if available, otherwise use current from queue
		const currentMedia = selectedMedia || titleQueue.current
		if (currentMedia) {
			skipHandler(currentMedia)
			// Clear selection after skipping
			if (selectedMedia) {
				setSelectedMedia(null)
			}
		}
	}

	const handlePlanToWatch = () => {
		// Use selected media if available, otherwise use current from queue
		const currentMedia = selectedMedia || titleQueue.current
		if (currentMedia) {
			planToWatchHandler(currentMedia)
			// Clear selection after plan to watch
			if (selectedMedia) {
				setSelectedMedia(null)
			}
		}
	}

	const handleStartOver = () => {
		clearInteractions()
		clearFeatures()
		titleQueue.reset()
		setSelectedMedia(null)
	}

	const generateRecommendations = () => discovery.data?.recommendations || []

	// Determine current media: selected media takes priority over queue
	const currentMedia = selectedMedia || titleQueue.current
	const nextMedia = titleQueue.next

	// Track media info for last rated items (for guests)
	const mediaCache = useRef(new Map<string, ScoringMedia>())

	// Cache current media for last rated display
	if (titleQueue.current) {
		const key = `${titleQueue.current.media_type}-${titleQueue.current.tmdb_id}`
		if (!mediaCache.current.has(key)) {
			mediaCache.current.set(key, titleQueue.current)
		}
	}

	// For guests: convert interactions to LastRatedItem format
	const guestLastRatedItems: LastRatedItem[] = useMemo(() => {
		if (isAuthenticated) return []
		return interactions
			.slice(-GUEST_LIMITS.FIRST_UNLOCK)
			.reverse()
			.map((interaction) => {
				const key = `${interaction.media_type}-${interaction.tmdb_id}`
				const media =
					mediaCache.current.get(key) ||
					availableTitles.find(
						(t) =>
							t.tmdb_id === interaction.tmdb_id &&
							t.media_type === interaction.media_type,
					)

				return {
					media:
						media ||
						({
							tmdb_id: interaction.tmdb_id,
							media_type: interaction.media_type,
							title: "",
							poster_path: "",
						} as ScoringMedia),
					score: interaction.score || null,
					actionType: interaction.type,
					timestamp: interaction.timestamp,
				}
			})
	}, [isAuthenticated, interactions, availableTitles])

	// Use DB data for authenticated users, local interactions for guests
	const lastRatedItems = isAuthenticated
		? dbLastRatedItems
		: guestLastRatedItems

	// Show loading state when no media available
	if (!currentMedia && titleQueue.isLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-gray-900">
				<div className="text-center">
					<div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
					<p className="text-gray-400 text-lg">
						Finding movies and shows for you...
					</p>
				</div>
			</div>
		)
	}

	if (currentMedia) {
		const mediaWithRecommendation = {
			...currentMedia,
			// Use the isRecommended flag from backend if available, otherwise false
			isRecommended:
				hasRecommendationsUnlocked && (currentMedia.isRecommended || false),
		}

		return (
			<TasteExplorationContext.Provider
				value={() =>
					rememberExploration({
						titles: uniqueTitles([
							currentMedia,
							...generateRecommendations(),
							...availableTitles,
						]),
						ratingQueue: titleQueue.remainingTitles,
						selectedMedia,
						scrollY: window.scrollY,
					})
				}
			>
				<TasteRating
					media={mediaWithRecommendation}
					nextMedia={nextMedia}
					ratingsCount={ratingsCount}
					onScore={handleScore}
					onSkip={handleSkip}
					onPlanToWatch={handlePlanToWatch}
					onStartOver={handleStartOver}
					lastRated={lastRatedItems}
					recommendations={generateRecommendations()}
					isGuest={!isAuthenticated}
					onSelectLastRated={handleSelectLastRated}
					selectedMediaId={selectedMedia?.tmdb_id || null}
					recommendationsUnlocked={hasRecommendationsUnlocked}
					justUnlockedFeature={justUnlockedFeature}
					onDismissCelebration={handleDismissCelebration}
					fingerprintPreview={fingerprintPreview.data}
				/>
				{modals.selectedFeature && (
					<FeatureTooltip
						feature={modals.selectedFeature}
						isUnlocked={activatedFeatures.has(modals.selectedFeature.id)}
						isOpen={modals.showFeatureInfo}
						onClose={modals.closeFeatureInfo}
						ratingsCount={ratingsCount}
					/>
				)}
			</TasteExplorationContext.Provider>
		)
	}

	return null
}
