import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
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
	// The guess only preselects a country. A plain query, not a Remix fetcher: a fetcher's failed request replaces the
	// whole page with the error page, and a failed query leaves the default.
	const { data: guessedCountry } = useQuery<string | undefined>({
		queryKey: ["guess-country"],
		queryFn: async () => {
			const response = await fetch("/api/guess-country")
			if (!response.ok) throw new Error("Guessing the country failed")
			const data: { country?: string } = await response.json()
			return data.country
		},
	})
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
			const countryCode = userSettings?.country_default || guessedCountry || "US"
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
	}, [settingsFetched, settingsLoading, onboardingCompleted, userSettings, guessedCountry, needsHandle, suggestion])

	return {
		isResolved: settingsFetched,
		currentStep,
		setCurrentStep,
		guessedCountry,
	}
}
