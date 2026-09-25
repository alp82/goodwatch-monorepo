import { useState, useEffect } from "react"
import { useFetcher } from "@remix-run/react"
import { useShareViewer } from "~/routes/api.share-lists"
import { useUserSettings } from "~/routes/api.user-settings.get"

// Onboarding runs for signed-in people: country, streaming services, then their handle. The handle step also shows
// on its own for people who finished the first two before handles existed.
export type OnboardingStep = 
	| { type: 'country', countryCode: string }
	| { type: 'streaming' }
	| { type: 'handle', suggestion: string }
	| { type: 'complete' }

export const useOnboardingStep = () => {
	const {
		data: userSettings,
		isLoading: settingsLoading,
		isFetched: settingsFetched,
	} = useUserSettings()
	const guessCountryFetcher = useFetcher<{ country: string }>()
	const viewer = useShareViewer(settingsFetched)
	// Null while unknown. A failed check skips the step rather than blocking onboarding.
	const needsHandle = viewer.isError
		? false
		: viewer.data
			? viewer.data.signedIn && !viewer.data.handle
			: null
	const suggestion = viewer.data?.signedIn ? (viewer.data.suggestedHandle ?? "") : ""
	
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
			if (needsHandle === null) return
			setCurrentStep((prev) => {
				if (needsHandle) {
					return prev?.type === "handle" ? prev : { type: "handle", suggestion }
				}
				// Finishing a step in this visit ends on the confirmation; a visit that starts complete shows nothing.
				if (prev === null || prev.type === "complete") {
					return prev
				}
				return { type: "complete" }
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
		}
	}, [settingsFetched, settingsLoading, onboardingCompleted, userSettings, guessCountryFetcher.data, needsHandle, suggestion])

	return {
		isResolved: settingsFetched,
		currentStep,
		setCurrentStep,
		guessedCountry: guessCountryFetcher.data?.country,
	}
}
