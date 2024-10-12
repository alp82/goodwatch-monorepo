"use client"

import { Link } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import type React from "react"
import { useState } from "react"
import logo from "~/img/goodwatch-logo.png"
import { useSetUserSettings } from "~/routes/api.user-settings.set"
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
	},
]

export default function Onboarding() {
	const { user } = useUser()
	const setUserSettings = useSetUserSettings()

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
			settings: {
				country_default: country,
			},
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
			settings: {
				streaming_providers_default: withStreamingProviders,
			},
		})

		setCurrentStep(2)
	}

	// media onboarding finished

	const [finalizeOnboarding, setFinalizeOnboarding] = useState(false)
	const handleFinishOnboarding = () => {
		setFinalizeOnboarding(true)
	}

	// if ((userLoading || userSettingsLoading) && currentStep === 0)
	// 	return (
	// 		<div className="mt-12 flex items-center justify-center">
	// 			<Spinner size="large" />
	// 		</div>
	// 	)
	if (finalizeOnboarding) return <OnboardingSuccess />

	return (
		<AnimatePresence mode="wait">
			<motion.div
				initial={{ y: "-5%", opacity: 0 }}
				animate={{ y: "0", opacity: 1 }}
				exit={{ y: "3%", opacity: 0 }}
				transition={{ duration: 0.5, type: "tween" }}
			>
				<main className="relative flex-grow mx-auto mt-4 sm:mt-8 md:mt-16 pb-2 w-full text-neutral-300">
					<div className="max-w-7xl mx-auto px-4 flex flex-col items-center gap-5 sm:gap-6">
						{currentStep < 2 && (
							<div className="flex flex-col items-center">
								<div className="flex items-center gap-2 text-2xl">
									<span className="hidden sm:block mr-2">Welcome to</span>
									<div className="hidden sm:block flex-shrink-0">
										<Link to="/" prefetch="render">
											<img
												className="h-10 w-auto"
												src={logo}
												alt="GoodWatch Logo"
											/>
										</Link>
									</div>
									<Link to="/" prefetch="render">
										<div className="brand-header text-gray-100">GoodWatch</div>
									</Link>
									<img
										className="ml-2 h-10 w-10 rounded-full"
										src={user?.user_metadata.avatar_url}
										alt={user?.user_metadata.name}
										title={user?.user_metadata.name}
									/>
								</div>

								{currentStep === 0 && (
									<div className="mt-8 text-3xl font-bold accent">
										Let's get <span className="italic">started</span>
									</div>
								)}
							</div>
						)}

						<div
							aria-hidden="true"
							className="my-2 sm:my-4 md:my-6 min-w-48 max-w-72 w-full sm:w-72 md:w-[100rem]"
						>
							<div className="overflow-hidden rounded-full bg-gray-600">
								<div
									style={{ width: `${normalizedProgress}%` }}
									className="h-2 rounded-full bg-amber-400 transition-all"
								/>
							</div>
							<div
								className={`mt-2 grid grid-cols-${steps.length} text-xs sm:text-sm md:text-base font-medium`}
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
										<div
											key={step.label}
											className={`${color} ${align} ${font}`}
										>
											{index < currentStep ? (
												<button
													type="button"
													onClick={() => setCurrentStep(index)}
												>
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

						{steps[currentStep].description && (
							<div className="text-sm sm:text-base md:text-lg text-center leading-relaxed font-semibold">
								{steps[currentStep].description}
							</div>
						)}
						{currentStep === 0 && (
							<SelectCountry onSelect={handleSelectCountry} />
						)}
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
				</main>
			</motion.div>
		</AnimatePresence>
	)
}
