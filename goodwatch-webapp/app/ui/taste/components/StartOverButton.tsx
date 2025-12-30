import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowPathIcon } from "@heroicons/react/24/solid"

interface StartOverButtonProps {
	onStartOver: () => void
}

export default function StartOverButton({ onStartOver }: StartOverButtonProps) {
	const [showConfirm, setShowConfirm] = useState(false)

	const handleClick = () => {
		setShowConfirm(true)
	}

	const handleConfirm = () => {
		setShowConfirm(false)
		onStartOver()
	}

	const handleCancel = () => {
		setShowConfirm(false)
	}

	return (
		<>
			<motion.button
				type="button"
				onClick={handleClick}
				className="px-6 py-3 text-gray-300 hover:text-white rounded-lg transition-colors cursor-pointer"
			>
				<ArrowPathIcon className="w-4 h-4 mr-2 inline" />
				Start Over
			</motion.button>

			<AnimatePresence>
				{showConfirm && (
					<>
						{/* Backdrop */}
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							className="fixed inset-0 bg-black/50 z-50"
							onClick={handleCancel}
						/>
						
						{/* Confirmation Dialog */}
						<motion.div
							initial={{ opacity: 0, scale: 0.9 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.9 }}
							className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md mx-4"
						>
							<div className="bg-gray-900 border border-gray-700 rounded-xl p-6 shadow-2xl">
								<h3 className="text-xl font-bold text-white mb-2">Start Over?</h3>
								<p className="text-gray-300 mb-6">
									This will reset all your ratings and progress. Are you sure you want to start from the beginning?
								</p>
								<div className="flex gap-3">
									<button
										type="button"
										onClick={handleCancel}
										className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
									>
										Cancel
									</button>
									<button
										type="button"
										onClick={handleConfirm}
										className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors font-semibold"
									>
										Start Over
									</button>
								</div>
							</div>
						</motion.div>
					</>
				)}
			</AnimatePresence>
		</>
	)
}
