import { CheckCircleIcon, SparklesIcon, XMarkIcon, ExclamationCircleIcon } from "@heroicons/react/24/outline"
import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import { useOnboardingRequired } from "~/routes/api.user-settings.get"
import { CountryFlag } from "~/ui/country/CountryFlag"
import { getCountryName } from "~/server/resources/country-names"
import CountrySelector from "~/ui/onboarding/CountrySelector"
import StreamingSelector from "~/ui/onboarding/StreamingSelector"
import { HandlePicker } from "~/ui/share-lists/HandlePicker"
import { useOnboardingStep } from "~/ui/onboarding/hooks/useOnboardingStep"
import { useOnboardingActions } from "~/ui/onboarding/hooks/useOnboardingActions"

export const SmartOnboardingBanner = () => {
	useOnboardingRequired()
	const {
		isResolved,
		currentStep,
		setCurrentStep,
		guessedCountry,
	} = useOnboardingStep()
	const actions = useOnboardingActions(setCurrentStep, guessedCountry)
	
	const [showCountrySelection, setShowCountrySelection] = useState(false)

	// Reset country selection when step changes away from country
	useEffect(() => {
		if (currentStep?.type !== 'country') {
			setShowCountrySelection(false)
		}
	}, [currentStep?.type])

	const handleConfirmCountry = (countryCode: string) => {
		actions.confirmCountry(countryCode)
	}

	const handleChangeCountry = () => {
		setShowCountrySelection(true)
	}

	const handleStreamingComplete = (streamingProviderIds: string[]) => {
		actions.completeStreaming(streamingProviderIds)
	}

	if (!isResolved || !currentStep || actions.isDismissed) return null

	// Determine colors and content - elegant dark gradient
	const bgColor = "from-slate-900 via-slate-800 to-slate-900"
	let content: React.ReactNode = null

	if (currentStep.type === 'country') {
		const countryName = getCountryName(currentStep.countryCode)
		content = showCountrySelection ? (
			<div className="w-full">
				<p className="text-white font-bold text-sm md:text-lg mb-3 md:mb-4">
					Select your country
				</p>
				<CountrySelector 
					initialCountry={currentStep.countryCode}
					onSelect={handleConfirmCountry}
					onCancel={() => setShowCountrySelection(false)}
				/>
			</div>
		) : (
			<>
				<div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
					<div className="flex-shrink-0 scale-75 md:scale-100">
						<CountryFlag countryCode={currentStep.countryCode} />
					</div>
					<div className="flex flex-col gap-1 flex-1 min-w-0">
						<p className="text-white text-md md:text-lg">
							Is <span className="font-bold">{countryName}</span> your country?
						</p>
						<p className="text-white/90 text-xs md:text-sm mt-0.5 md:mt-1">
							We'll show you what you can watch
						</p>
					</div>
				</div>
				<div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
					<button
						type="button"
						onClick={() => handleConfirmCountry(currentStep.countryCode)}
						className="px-6 py-2 bg-emerald-600 text-white hover:bg-emerald-500 rounded-lg font-bold text-sm sm:text-base transition-colors shadow-md hover:shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Yes
					</button>
					<button
						type="button"
						onClick={handleChangeCountry}
						className="px-4 py-2 bg-white/10 text-white hover:bg-white/20 rounded-lg font-semibold text-sm sm:text-base transition-colors cursor-pointer"
					>
						No, let me select
					</button>
				</div>
			</>
		)
	} else if (currentStep.type === 'streaming') {
		content = (
			<div className="w-full">
				<p className="text-white font-bold text-sm md:text-lg mb-3 md:mb-4">
					Which streaming services do you use?
				</p>
				<StreamingSelector onSelect={handleStreamingComplete} />
			</div>
		)
	} else if (currentStep.type === 'handle') {
		content = (
			<div className="flex w-full flex-col gap-3 md:flex-row md:items-start md:gap-8">
				<div className="flex flex-col gap-1 md:w-2/5">
					<p className="text-white font-bold text-sm md:text-lg">
						Choose your handle
					</p>
					<p className="text-white/80 text-xs md:text-sm">
						It's your public profile address and signs every list you share. You can't change it later.
					</p>
					<button
						type="button"
						onClick={actions.dismiss}
						className="mt-1 self-start text-sm text-white/60 underline underline-offset-4 hover:text-white"
					>
						Later
					</button>
				</div>
				<div className="md:flex-1">
					<HandlePicker
						id="onboarding-handle"
						suggestion={currentStep.suggestion}
						submitLabel="Save handle"
						onClaimed={actions.completeHandle}
					/>
				</div>
			</div>
		)
	} else if (currentStep.type === 'complete') {
		content = (
			<>
				<div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
					<CheckCircleIcon className="h-8 w-8 md:h-10 md:w-10 text-white flex-shrink-0" />
					<div className="flex flex-col gap-1 flex-1 min-w-0">
						<p className="text-white font-bold text-lg md:text-xl">
							You are all set! 🎉
						</p>
						<p className="text-white/90 text-xs md:text-sm mt-0.5 md:mt-1">
							The more you rate, the better your recommendations
						</p>
					</div>
				</div>
				<div className="flex items-center gap-4 flex-shrink-0">
					<button
						type="button"
						onClick={actions.continueToQuiz}
						className="px-4 py-2 md:px-6 md:py-3 bg-emerald-600 text-white hover:bg-emerald-500 rounded-lg font-bold md:text-lg transition-colors shadow-md hover:shadow-lg flex items-center gap-1.5 md:gap-2 cursor-pointer whitespace-nowrap"
					>
						<SparklesIcon className="h-4 w-4 md:h-5 md:w-5" />
						<span>Continue Scoring</span>
					</button>
					<button
						type="button"
						onClick={actions.dismiss}
						className="px-4 py-2 md:px-4 md:py-3 bg-white/10 text-white hover:bg-white/20 rounded-lg md:text-lg md:text-base transition-colors cursor-pointer whitespace-nowrap"
					>
						Later
					</button>
				</div>
			</>
		)
	}

	return (
		<>
			{/* Desktop: Top banner */}
			<motion.div
				initial={{ y: -100, opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				exit={{ y: -100, opacity: 0 }}
				transition={{ duration: 0.3, ease: "easeOut" }}
				className={`hidden md:block mt-16 -mb-16 bg-gradient-to-r ${bgColor} shadow-xl`}
			>
				<div className="relative max-w-7xl mx-auto px-4 py-6">
					<div className="flex items-center justify-between gap-4">
						{content}
					</div>
				</div>
			</motion.div>

			{/* Mobile: Backdrop + Bottom drawer */}
			<div className="md:hidden">
				{/* Backdrop overlay */}
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.3 }}
					className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99]"
				/>
				
				{/* Bottom drawer */}
				<motion.div
					initial={{ y: 100, opacity: 0 }}
					animate={{ y: 0, opacity: 1 }}
					exit={{ y: 100, opacity: 0 }}
					transition={{ duration: 0.3, ease: "easeOut" }}
					className={`fixed bottom-0 left-0 right-0 z-[500] bg-gradient-to-t ${bgColor} shadow-2xl`}
				>
					<div className="relative px-4 py-5 min-h-[55vh] max-h-[85vh] overflow-y-auto">
						<div className="flex flex-col gap-4">
							{content}
						</div>
					</div>
				</motion.div>
			</div>
		</>
	)
}
