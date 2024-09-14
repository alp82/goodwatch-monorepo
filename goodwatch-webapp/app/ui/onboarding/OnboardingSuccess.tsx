import { CheckCircleIcon } from "@heroicons/react/24/solid"
import { motion } from "framer-motion"
import React from "react"
import { useSetUserSettings } from "~/routes/api.user-settings.set"
import { SubHeader } from "~/ui/main/SubHeader"

export const OnboardingSuccess = () => {
	const setUserSettings = useSetUserSettings()
	const handleFinish = () => {
		setUserSettings.mutate({
			settings: {
				onboarding_status: "finished",
			},
		})
	}

	return (
		<>
			<motion.div
				initial={{ backgroundColor: "#D97706" }} // bg-amber-600
				animate={{ backgroundColor: ["#D97706", "#1F2937"] }} // bg-amber-600 to bg-gray-800
				transition={{ duration: 1.2, ease: "circOut" }}
			>
				<SubHeader />
			</motion.div>
			<div className="flex items-start justify-center min-h-screen">
				<motion.div
					initial={{ opacity: 0, y: -50 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.8, ease: "easeOut" }}
					className="mt-40 bg-gray-800 border-8 border-gray-200/20 rounded-xl shadow-lg p-6 sm:p-12 max-w-md text-center"
				>
					<motion.div
						initial={{ scale: 0.8 }}
						animate={{ scale: 1 }}
						transition={{ duration: 0.6, ease: "easeOut" }}
						className="flex justify-center mb-6"
					>
						<CheckCircleIcon className="h-16 w-16 text-green-500" />
					</motion.div>
					<motion.h2
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.3, duration: 0.8 }}
						className="text-3xl font-bold mb-6 text-white"
					>
						You're all set!
					</motion.h2>
					<motion.p
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.5, duration: 0.8 }}
						className="text-xl text-gray-200 leading-relaxed"
					>
						Time to dive in and explore the world of{" "}
						<span className="font-semibold accent">Movies</span> and{" "}
						<span className="font-semibold accent">TV Shows</span>.
					</motion.p>

					<motion.button
						whileHover={{ scale: 1.05 }}
						whileTap={{ scale: 0.95 }}
						className="mt-8 bg-indigo-700 hover:bg-indigo-600 py-2 px-4 rounded-lg text-white text-xl font-semibold shadow-lg"
						onClick={handleFinish}
					>
						Continue
					</motion.button>
				</motion.div>
			</div>
		</>
	)
}
