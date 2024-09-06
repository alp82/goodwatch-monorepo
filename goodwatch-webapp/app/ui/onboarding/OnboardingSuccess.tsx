import { CheckCircleIcon } from "@heroicons/react/24/solid"
import { motion } from "framer-motion"
import React from "react"

export const OnboardingSuccess = () => {
	return (
		<div className="flex items-center justify-center min-h-screen bg-gradient-to-bl from-indigo-950 to-amber-950">
			<motion.div
				initial={{ opacity: 0, y: -50 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.8, ease: "easeOut" }}
				className="m-2 bg-gray-800 border-8 border-gray-200/20 rounded-xl shadow-lg p-8 max-w-md text-center"
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
					className="text-2xl font-bold mb-4 text-white"
				>
					To infinity, and beyond!
				</motion.h2>
				<motion.p
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.5, duration: 0.8 }}
					className="text-lg text-gray-400"
				>
					You're all set! Time to dive in and explore the world of movies and TV
					shows.
				</motion.p>
				<motion.button
					whileHover={{ scale: 1.05 }}
					whileTap={{ scale: 0.95 }}
					className="mt-6 bg-indigo-700 hover:bg-indigo-600 text-white py-2 px-4 rounded-lg shadow-lg"
					onClick={() => {
						// Add navigation logic here
					}}
				>
					Continue
				</motion.button>
			</motion.div>
		</div>
	)
}
