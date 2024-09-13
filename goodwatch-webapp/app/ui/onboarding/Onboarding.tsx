import type React from "react"
import { useState } from "react"
import { useOnboardingMedia } from "~/routes/api.onboarding.media"
import { useUserData } from "~/routes/api.user-data"
import { useUserSettings } from "~/routes/api.user-settings.get"
import { useSetUserSettings } from "~/routes/api.user-settings.set"
import { Spinner } from "~/ui/Spinner"
import { OnboardingSuccess } from "~/ui/onboarding/OnboardingSuccess"
import SelectCountry from "~/ui/onboarding/SelectCountry"
import { SelectMedia } from "~/ui/onboarding/SelectMedia"
import SelectStreaming from "~/ui/onboarding/SelectStreaming"
import { useUser } from "~/utils/auth"

const steps = [
	{
		label: "Country",
		description:
			"Select your country to see what's available for you to watch.",
	},
	{
		label: "Streaming",
		description: "Choose your streaming services to discover new content.",
	},
	{
		label: "Ratings",
		description: "Rate shows for personalized recommendations.",
	},
]

interface OnboardingProps {
	children: React.ReactNode
}

export default function Onboarding({ children }: OnboardingProps) {
	const { user, loading } = useUser()
	const { data: userSettings, isFetching: userSettingsLoading } =
		useUserSettings()
	const setUserSettings = useSetUserSettings()

	const isLoggedIn = Boolean(user)
	// TODO
	const onboardingCompleted = userSettings?.onboarding_completed
	// const onboardingCompleted = false

	// step progress

	const [currentStep, setCurrentStep] = useState(0)
	const MIN_PROGRESS = 10
	const normalizedProgress =
		MIN_PROGRESS +
		(100 - 100 / steps.length) * (currentStep / (steps.length - 1))

	// country selection

	const handleSelectCountry = (country: string) => {
		localStorage.setItem("country", country)
		setUserSettings.mutate({
			country_default: country,
		})

		setCurrentStep(1)
	}

	// streaming selection

	const handleSelectStreaming = (selectedProviders: string[]) => {
		const withStreamingProviders = selectedProviders
			.map((item) => item)
			.join(",")

		localStorage.setItem("withStreamingProviders", withStreamingProviders)
		setUserSettings.mutate({
			streaming_providers_default: withStreamingProviders,
		})

		setCurrentStep(2)
	}

	// media onboarding finished

	const [finalizeOnboarding, setFinalizeOnboarding] = useState(false)
	const handleFinishOnboarding = () => {
		setFinalizeOnboarding(true)
	}

	if ((loading || userSettingsLoading) && currentStep === 0)
		return (
			<div className="mt-12 flex items-center justify-center">
				<Spinner size="large" />
			</div>
		)
	if (!isLoggedIn || onboardingCompleted) return children
	if (finalizeOnboarding) return <OnboardingSuccess />

	return (
		<div className="max-w-7xl mx-auto px-4 flex flex-col items-center gap-5 sm:gap-6">
			<div className="mt-8 text-3xl font-bold accent">
				Hello, let's get <span className="italic">started</span>
			</div>

			<div aria-hidden="true" className="my-6 w-56 sm:w-72">
				<div className="overflow-hidden rounded-full bg-gray-600">
					<div
						style={{ width: `${normalizedProgress}%` }}
						className="h-2 rounded-full bg-amber-400 transition-all"
					/>
				</div>
				<div
					className={`mt-2 grid grid-cols-${steps.length} text-sm font-medium`}
				>
					{steps.map((step, index) => {
						const color =
							index < currentStep
								? "text-indigo-300 hover:text-indigo-200"
								: index === currentStep
									? "text-amber-300"
									: "text-gray-200"
						const align =
							index === 0
								? "text-left"
								: index < steps.length - 1
									? "text-center"
									: "text-right"
						const font =
							index < currentStep
								? ""
								: index === currentStep
									? "font-bold"
									: ""

						return (
							<div key={step.label} className={`${color} ${align} ${font}`}>
								{index < currentStep ? (
									<button type="button" onClick={() => setCurrentStep(index)}>
										{step.label}
									</button>
								) : (
									step.label
								)}
							</div>
						)
					})}
				</div>
			</div>

			<div className="m-2 text-lg text-center leading-relaxed font-semibold">
				{steps[currentStep].description}
			</div>
			{currentStep === 0 && <SelectCountry onSelect={handleSelectCountry} />}
			{currentStep === 1 && (
				<SelectStreaming onSelect={handleSelectStreaming} />
			)}
			{currentStep === 2 && (
				<SelectMedia
					onSelect={handleFinishOnboarding}
					onBack={() => setCurrentStep(1)}
				/>
			)}
		</div>
	)
}
