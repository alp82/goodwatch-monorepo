import type React from "react"
import { useState } from "react"
import { useOnboardingMedia } from "~/routes/api.onboarding.media"
import SelectCountry from "~/ui/onboarding/SelectCountry"
import { SelectMedia } from "~/ui/onboarding/SelectMedia"
import SelectStreaming from "~/ui/onboarding/SelectStreaming"

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
	const onboardingCompleted = false
	if (onboardingCompleted) return children

	// prefetch data

	useOnboardingMedia({ searchTerm: "" })

	// step progress

	// TODO start step 0
	// const [currentStep, setCurrentStep] = useState(0)
	const [currentStep, setCurrentStep] = useState(2)
	const MIN_PROGRESS = 10
	const normalizedProgress =
		MIN_PROGRESS +
		(100 - 100 / steps.length) * (currentStep / (steps.length - 1))

	// country selection

	const [selectedCountry, setSelectedCountry] = useState<string | undefined>()
	const handleSelectCountry = (country: string) => {
		localStorage.setItem("country", country)

		setSelectedCountry(country)
		setCurrentStep(1)
	}

	// streaming selection

	const [selectedStreaming, setSelectedStreaming] = useState<
		string[] | undefined
	>()
	const handleSelectStreaming = (selectedProviders: string[]) => {
		const withStreamingProviders = selectedProviders
			.map((item) => item)
			.join(",")
		localStorage.setItem("withStreamingProviders", withStreamingProviders)

		setSelectedStreaming(selectedProviders)
		setCurrentStep(2)
	}

	// media onboarding

	const [finalizeOnboarding, setFinalizeOnboarding] = useState(false)
	const handleFinishOnboarding = () => {
		setFinalizeOnboarding(true)
	}

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
