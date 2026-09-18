import { useState, useEffect } from "react"
import { useFetcher } from "@remix-run/react"
import { useUserSettings } from "~/routes/api.user-settings.get"

export type OnboardingStep = 
	| { type: 'country', countryCode: string }
	| { type: 'streaming' }
	| { type: 'complete' }

export const useOnboardingStep = () => {
	const {
		data: userSettings,
		isLoading: settingsLoading,
		isFetched: settingsFetched,
	} = useUserSettings()
	const guessCountryFetcher = useFetcher<{ country: string }>()
	
	const [currentStep, setCurrentStep] = useState<OnboardingStep | null>(null)
	const onboardingCompleted =
		userSettings?.onboarding_country_completed === "yes" &&
		userSettings?.onboarding_streaming_completed === "yes"

	// Fetch country guess on mount
	useEffect(() => {
		if (!guessCountryFetcher.data) {
			guessCountryFetcher.submit({}, {
				method: "get",
				action: "/api/guess-country",
			})
		}
	}, [])

	
	// Determine current step when settings change
	useEffect(() => {
		if (!settingsFetched || settingsLoading) {
			return
		}

		if (onboardingCompleted) {
			setCurrentStep((prev) => {
				if (prev?.type === "complete") {
					return prev
				}
				return null
			})
			return
		}


		// Determine step based on completion status
		const countryCompleted = userSettings?.onboarding_country_completed === "yes"
		const streamingCompleted = userSettings?.onboarding_streaming_completed === "yes"

		if (!countryCompleted) {
			const countryCode = userSettings?.country_default || guessCountryFetcher.data?.country || "US"
			setCurrentStep((prev) => {
				if (prev?.type === "country" && prev.countryCode === countryCode) {
					return prev
				}
				return { type: "country", countryCode }
			})
		} else if (!streamingCompleted) {
			setCurrentStep((prev) => {
				if (prev?.type === "streaming") {
					return prev
				}
				return { type: "streaming" }
			})
		} else {
			setCurrentStep((prev) => {
				if (prev?.type === "complete") {
					return prev
				}
				return { type: "complete" }
			})
		}
	}, [settingsFetched, settingsLoading, onboardingCompleted, userSettings, guessCountryFetcher.data])

	return {
		isResolved: settingsFetched,
		currentStep,
		setCurrentStep,
		guessedCountry: guessCountryFetcher.data?.country,
	}
}
