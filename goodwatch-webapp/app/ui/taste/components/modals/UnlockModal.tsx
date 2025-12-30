import { motion, AnimatePresence } from "framer-motion"
import { useEffect } from "react"
import type { Feature } from "../../features"

interface UnlockModalProps {
	feature: Feature
	isOpen: boolean
	onClose: () => void
}

export default function UnlockModal({
	feature,
	isOpen,
	onClose,
}: UnlockModalProps) {
	useEffect(() => {
		if (isOpen) {
			document.body.style.overflow = "hidden"
		} else {
			document.body.style.overflow = "unset"
		}
		return () => {
			document.body.style.overflow = "unset"
		}
	}, [isOpen])

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Backdrop */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
						className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 cursor-pointer"
					/>

					{/* Modal - Desktop */}
					<div className="hidden md:flex fixed inset-0 items-center justify-center z-50 p-4 pointer-events-none">
						<motion.div
							initial={{ opacity: 0, scale: 0.9, y: 20 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.9, y: 20 }}
							className="bg-gray-900 rounded-2xl shadow-2xl ring-1 ring-white/10 max-w-md w-full overflow-hidden pointer-events-auto"
						>
							{/* Confetti/Celebration Effect */}
							<div className="relative bg-gradient-to-br from-indigo-600 to-purple-600 p-8 text-center">
								<motion.div
									initial={{ scale: 0 }}
									animate={{ scale: 1 }}
									transition={{ type: "spring", delay: 0.2 }}
									className="text-6xl mb-4"
								>
									{feature.icon}
								</motion.div>
								<motion.h2
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.3 }}
									className="text-2xl font-bold text-white mb-2"
								>
									{feature.name}
								</motion.h2>
								<motion.p
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									transition={{ delay: 0.4 }}
									className="text-indigo-100 text-sm"
								>
									Unlocked!
								</motion.p>
							</div>

							<div className="p-6 space-y-4">
								<p className="text-gray-300 text-center leading-relaxed">
									{feature.fullDescription}
								</p>

								{feature.id === 'recommendations' && (
									<p className="text-indigo-300 text-sm text-center">
										Look for the ✨ For You badge on posters!
									</p>
								)}

								<motion.button
									type="button"
									onClick={onClose}
									className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors cursor-pointer"
									whileHover={{ scale: 1.02 }}
									whileTap={{ scale: 0.98 }}
								>
									Continue Rating
								</motion.button>
							</div>
						</motion.div>
					</div>

					{/* Bottom Sheet - Mobile */}
					<div className="md:hidden fixed inset-0 z-50 flex items-end pointer-events-none">
						<motion.div
							initial={{ y: "100%" }}
							animate={{ y: 0 }}
							exit={{ y: "100%" }}
							transition={{ type: "spring", damping: 30, stiffness: 300 }}
							className="w-full bg-gray-900 rounded-t-3xl shadow-2xl ring-1 ring-white/10 max-h-[85vh] overflow-hidden pointer-events-auto"
						>
							{/* Drag Handle */}
							<div className="flex justify-center pt-3 pb-2">
								<div className="w-12 h-1.5 bg-gray-700 rounded-full" />
							</div>

							{/* Content */}
							<div className="relative bg-gradient-to-br from-indigo-600 to-purple-600 p-8 text-center">
								<motion.div
									initial={{ scale: 0 }}
									animate={{ scale: 1 }}
									transition={{ type: "spring", delay: 0.2 }}
									className="text-6xl mb-4"
								>
									{feature.icon}
								</motion.div>
								<motion.h2
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.3 }}
									className="text-2xl font-bold text-white mb-2"
								>
									{feature.name}
								</motion.h2>
								<motion.p
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									transition={{ delay: 0.4 }}
									className="text-indigo-100 text-sm"
								>
									Unlocked!
								</motion.p>
							</div>

							<div className="p-6 space-y-4">
								<p className="text-gray-300 text-center leading-relaxed">
									{feature.fullDescription}
								</p>

								{feature.id === 'recommendations' && (
									<p className="text-indigo-300 text-sm text-center">
										Look for the ✨ For You badge on posters!
									</p>
								)}

								<motion.button
									type="button"
									onClick={onClose}
									className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors cursor-pointer"
									whileTap={{ scale: 0.98 }}
								>
									Continue Rating
								</motion.button>
							</div>
						</motion.div>
					</div>
				</>
			)}
		</AnimatePresence>
	)
}
