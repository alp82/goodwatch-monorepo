import { useState, useEffect } from "react"
import { useFetcher } from "@remix-run/react"
import { useUserSettings, useOnboardingCompleted } from "~/routes/api.user-settings.get"
import type { GuestInteraction, TasteInteraction } from "~/ui/taste/types"
import { ONBOARDING_RATINGS_KEY } from "~/ui/taste/constants"

export type OnboardingStep = 
	| { type: 'import', count: number, isComplete: boolean }
	| { type: 'country', countryCode: string }
	| { type: 'streaming' }
	| { type: 'complete' }

export const useOnboardingStep = () => {
	const { data: userSettings, isLoading: settingsLoading } = useUserSettings()
	const onboardingCompleted = useOnboardingCompleted()
	const guessCountryFetcher = useFetcher<{ country: string }>()
	
	const [currentStep, setCurrentStep] = useState<OnboardingStep | null>(null)
	const [guestInteractions, setGuestInteractions] = useState<GuestInteraction[]>([])

	// Fetch country guess on mount
	useEffect(() => {
		if (!guessCountryFetcher.data) {
			guessCountryFetcher.submit({}, {
				method: "get",
				action: "/api/guess-country",
			})
		}
	}, [])

	
	// Determine initial step - runs once when settings are loaded
	useEffect(() => {
		if (settingsLoading || onboardingCompleted) {
			return
		}

		// Only set initial step if we don't have one yet
		if (currentStep !== null) {
			return
		}

		// Check for guest interactions to import
		const interactionsJson = localStorage.getItem(ONBOARDING_RATINGS_KEY)
		if (interactionsJson) {
			try {
				const interactions = JSON.parse(interactionsJson) as TasteInteraction[]
				const allInteractions: GuestInteraction[] = interactions.map(i => ({
					tmdb_id: i.tmdb_id,
					media_type: i.media_type,
					type: i.type,
					score: i.score,
					timestamp: i.timestamp,
				}))
				
				if (allInteractions.length > 0) {
					setGuestInteractions(allInteractions)
					setCurrentStep({ type: 'import', count: allInteractions.length, isComplete: false })
					return
				}
			} catch (e) {
				console.error("Failed to parse guest interactions", e)
			}
		}

		// Determine step based on completion status
		const countryCompleted = userSettings?.onboarding_country_completed === "yes"
		const streamingCompleted = userSettings?.onboarding_streaming_completed === "yes"

		if (!countryCompleted) {
			const countryCode = userSettings?.country_default || guessCountryFetcher.data?.country || "US"
			setCurrentStep({ type: 'country', countryCode })
		} else if (!streamingCompleted) {
			setCurrentStep({ type: 'streaming' })
		} else {
			setCurrentStep({ type: 'complete' })
		}
	}, [settingsLoading, onboardingCompleted, userSettings, guessCountryFetcher.data])

	return {
		currentStep,
		setCurrentStep,
		guestInteractions,
		setGuestInteractions,
		guessedCountry: guessCountryFetcher.data?.country,
	}
}
