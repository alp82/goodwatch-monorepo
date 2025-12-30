import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import type { Score } from "~/server/scores.server"
import type { ScoringMedia, LastRatedItem } from "~/ui/scoring/types"
import { fetchSmartTitles } from "~/routes/api.smart-titles"
import { useGuestMovieRecommendations, useGuestShowRecommendations } from "~/routes/api.guest-recommendations"
import { useUserRecommendations } from "~/routes/api.user-recommendations"
import { useFingerprintPreview } from "~/routes/api.fingerprint-preview"
import SignInPrompt from "./components/SignInPrompt"
import FeatureTooltip from "./components/modals/FeatureTooltip"
import type { GuestRating, Recommendation } from "./types"
import { GUEST_LIMITS, isGuestLimitReached, FEATURES, type Feature } from "./features"
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
	const { interactions, ratingsCount, addScore, addSkip, addPlanToWatch, clearInteractions } = useTasteScoring({ isAuthenticated })
	const { activatedFeatures, activateFeature, clearFeatures } = useFeatureActivation({ isAuthenticated, ratingsCount })
	const modals = useFeatureModals()
	useUserData()
	
	const { lastRatedItems: dbLastRatedItems } = useRecentActions({ 
		limit: GUEST_LIMITS.FIRST_UNLOCK, 
		enabled: isAuthenticated 
	})
	
	// Track selected media from recommendations/last rated
	const [selectedMedia, setSelectedMedia] = useState<ScoringMedia | null>(null)
	
	// Track when a feature threshold is crossed (for celebration screen)
	const [justUnlockedFeature, setJustUnlockedFeature] = useState<Feature | null>(null)
	const previousRatingsCount = useRef(ratingsCount)
	
	// Detect threshold crossings
	useEffect(() => {
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

	// Check if guest limit is reached
	const guestLimitReached = !isAuthenticated && isGuestLimitReached(ratingsCount)

	// For guests, derive scored items from interactions (for recommendations)
	const guestScoredItems = useMemo(() => {
		return interactions
			.filter(i => i.type === 'score' && i.score)
			.map(i => ({
				tmdb_id: i.tmdb_id,
				media_type: i.media_type,
				score: i.score!,
			}))
	}, [interactions])

	// For guests, derive items to exclude from recommendations (skips + plan-to-watch)
	const guestExcludeIds = useMemo(() => {
		return interactions
			.filter(i => i.type === 'skip' || i.type === 'plan')
			.map(i => ({
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
		initialTitles: availableTitles,
		isAuthenticated,
		interactions,
		fetchMoreTitles,
		prefetchThreshold: 5,
		batchSize: 20,
	})

	// Fetch recommendations when first unlock threshold is reached (5 ratings)
	const hasRecommendationsUnlocked = ratingsCount >= GUEST_LIMITS.FIRST_UNLOCK

	// For authenticated users, use user recommendations API
	const userRecommendations = useUserRecommendations({
		mediaType: "all",
		limit: 20,
		enabled: isAuthenticated && hasRecommendationsUnlocked,
	})

	// For guests, use guest recommendations APIs with exclusions for skips/plan-to-watch
	const movieRecommendations = useGuestMovieRecommendations({
		scoredItems: guestScoredItems,
		excludeIds: guestExcludeIds,
		limit: 10,
		enabled: !isAuthenticated && hasRecommendationsUnlocked,
	})

	const showRecommendations = useGuestShowRecommendations({
		scoredItems: guestScoredItems,
		excludeIds: guestExcludeIds,
		limit: 10,
		enabled: !isAuthenticated && hasRecommendationsUnlocked,
	})

	// Fingerprint preview unlocks at 15 ratings
	const hasFingerprintPreviewUnlocked = ratingsCount >= 15
	const guestLikedItems = useMemo(() => {
		return interactions
			.filter(i => i.type === 'score' && i.score && i.score >= 6)
			.map(i => ({
				tmdb_id: i.tmdb_id,
				media_type: i.media_type,
			}))
	}, [interactions])

	const fingerprintPreview = useFingerprintPreview({
		userId: isAuthenticated ? userId : undefined,
		likedItems: !isAuthenticated ? guestLikedItems : undefined,
		scoredItems: !isAuthenticated ? guestScoredItems : undefined,
		excludeIds: !isAuthenticated ? guestExcludeIds : undefined,
		enabled: hasFingerprintPreviewUnlocked && (
			isAuthenticated ? true : guestLikedItems.length >= 3
		),
	})


	const { handleScore: scoreHandler, handleSkip: skipHandler, handlePlanToWatch: planToWatchHandler } = useGuestScoring({
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
		setSelectedMedia(prev => 
			prev?.tmdb_id === media.tmdb_id && prev?.media_type === media.media_type 
				? null 
				: media
		)
	}


	const [skippedSignUpPrompt, setSkippedSignUpPrompt] = useState(false)
	const showSignInPrompt = guestLimitReached && !skippedSignUpPrompt

	const handleScore = (score: Score) => {
		if (guestLimitReached) {
			setSkippedSignUpPrompt(false)
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
		if (guestLimitReached) {
			setSkippedSignUpPrompt(false)
			return
		}
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
		if (guestLimitReached) {
			setSkippedSignUpPrompt(false)
			return
		}
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


	const generateRecommendations = (): Recommendation[] => {
		const recommendations: Recommendation[] = []

		// For authenticated users, use user recommendations
		if (isAuthenticated && userRecommendations.data?.recommendations) {
			const userRecs = userRecommendations.data.recommendations.map(rec => ({
				tmdb_id: rec.tmdb_id,
				title: rec.title,
				poster_path: rec.poster_path,
				media_type: rec.media_type,
				release_year: rec.release_year,
				matchPercentage: rec.match_percentage,
			}))
			recommendations.push(...userRecs)
		} else {
			// For guests, use guest recommendations
			// Add movie recommendations if available
			if (movieRecommendations.data?.recommendations) {
				const movieRecs = movieRecommendations.data.recommendations.map(rec => ({
					tmdb_id: rec.tmdb_id,
					title: rec.title,
					poster_path: rec.poster_path,
					media_type: "movie" as const,
					release_year: rec.release_year,
					matchPercentage: rec.match_percentage,
				}))
				recommendations.push(...movieRecs)
			}

			// Add show recommendations if available
			if (showRecommendations.data?.recommendations) {
				const showRecs = showRecommendations.data.recommendations.map(rec => ({
					tmdb_id: rec.tmdb_id,
					title: rec.title,
					poster_path: rec.poster_path,
					media_type: "show" as const,
					release_year: rec.release_year,
					matchPercentage: rec.match_percentage,
				}))
				recommendations.push(...showRecs)
			}
		}

		// If no recommendations yet (not enough data), return empty
		if (recommendations.length === 0) {
			return []
		}

		// Sort by match percentage and return top results
		return recommendations
			.sort((a, b) => b.matchPercentage - a.matchPercentage)
			.slice(0, 20)
	}

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
			.map(interaction => {
				const key = `${interaction.media_type}-${interaction.tmdb_id}`
				const media = mediaCache.current.get(key) ||
					availableTitles.find(t => t.tmdb_id === interaction.tmdb_id && t.media_type === interaction.media_type)
				
				return {
					media: media || { tmdb_id: interaction.tmdb_id, media_type: interaction.media_type, title: '', poster_path: '' } as ScoringMedia,
					score: interaction.score || null,
					actionType: interaction.type,
					timestamp: interaction.timestamp,
				}
			})
	}, [isAuthenticated, interactions, availableTitles])

	// Use DB data for authenticated users, local interactions for guests
	const lastRatedItems = isAuthenticated ? dbLastRatedItems : guestLastRatedItems


	// Show sign-in prompt
	if (showSignInPrompt) {
		return (
			<SignInPrompt
				onSignUp={() => {
					setSkippedSignUpPrompt(true)
					onSignUp?.()
				}}
				onCancel={() => setSkippedSignUpPrompt(true)}
				onStartOver={handleStartOver}
				ratingsCount={ratingsCount}
				onFeatureInfoTap={modals.openFeatureInfo}
				recommendations={generateRecommendations()}
				isGuest={!isAuthenticated}
			/>
		)
	}

	// Remove QuizReveal - guest limit is now handled by SignInPrompt overlay

	// Show loading state when no media available
	if (!currentMedia && titleQueue.isLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-gray-900">
				<div className="text-center">
					<div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
					<p className="text-gray-400 text-lg">Finding movies and shows for you...</p>
				</div>
			</div>
		)
	}

	if (currentMedia) {
		const mediaWithRecommendation = {
			...currentMedia,
			// Use the isRecommended flag from backend if available, otherwise false
			isRecommended: hasRecommendationsUnlocked && (currentMedia.isRecommended || false),
		}
		
		return (
			<>
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
			</>
		)
	}


	return null
}
