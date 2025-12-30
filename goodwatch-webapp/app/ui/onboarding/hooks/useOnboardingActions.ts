import { useState } from "react"
import { useNavigate } from "@remix-run/react"
import { useSetUserSettings } from "~/routes/api.user-settings.set"
import type { OnboardingStep } from "./useOnboardingStep"

export const useOnboardingActions = (
	setCurrentStep: (step: OnboardingStep) => void,
	guessedCountry?: string
) => {
	const navigate = useNavigate()
	const setUserSettings = useSetUserSettings()
	const [isDismissed, setIsDismissed] = useState(() => 
		sessionStorage.getItem("onboarding-banner-dismissed") === "true"
	)

	const continueFromImport = () => {
		const countryCode = guessedCountry || "US"
		setCurrentStep({ type: 'country', countryCode })
	}

	const confirmCountry = (countryCode: string) => {
		setUserSettings.mutate(
			{
				settings: {
					country_default: countryCode,
					onboarding_country_completed: "yes",
				},
			},
			{
				onSuccess: () => {
					setCurrentStep({ type: 'streaming' })
				}
			}
		)
	}

	const completeStreaming = (streamingProviderIds: string[]) => {
		setUserSettings.mutate(
			{
				settings: {
					streaming_providers_default: streamingProviderIds.join(","),
					onboarding_streaming_completed: "yes",
				},
			},
			{
				onSuccess: () => {
					setCurrentStep({ type: 'complete' })
				}
			}
		)
	}

	const continueToQuiz = () => {
		navigate("/taste")
		setIsDismissed(true)
		sessionStorage.setItem("onboarding-banner-dismissed", "true")
	}

	const dismiss = () => {
		setIsDismissed(true)
		sessionStorage.setItem("onboarding-banner-dismissed", "true")
	}

	return {
		isDismissed,
		continueFromImport,
		confirmCountry,
		completeStreaming,
		continueToQuiz,
		dismiss,
	}
}
