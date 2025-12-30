import { motion, AnimatePresence } from "framer-motion"
import type { Feature } from "../../features"

interface FeatureTooltipProps {
	feature: Feature
	isUnlocked: boolean
	isOpen: boolean
	onClose: () => void
	ratingsCount: number
}

export default function FeatureTooltip({
	feature,
	isUnlocked,
	isOpen,
	onClose,
	ratingsCount,
}: FeatureTooltipProps) {
	const ratingsNeeded = feature.unlockAt - ratingsCount

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
						className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 cursor-pointer"
					/>

					{/* Tooltip - Desktop */}
					<div className="hidden md:flex fixed inset-0 items-center justify-center z-50 p-4 pointer-events-none">
						<motion.div
							initial={{ opacity: 0, scale: 0.9 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.9 }}
							className="bg-gray-900 rounded-xl shadow-2xl ring-1 ring-white/10 max-w-sm w-full p-5 space-y-3 pointer-events-auto"
						>
							<div className="flex items-start gap-3">
								<div
									className={`text-4xl ${isUnlocked ? "" : "opacity-30 grayscale"}`}
								>
									{feature.icon}
								</div>
								<div className="flex-1">
									<h3 className="text-lg font-bold text-white">
										{feature.name}
									</h3>
									<p className="text-xs text-gray-400">
										{feature.shortDescription}
									</p>
								</div>
							</div>

							<p className="text-sm text-gray-300 leading-relaxed">
								{feature.fullDescription}
							</p>

							<button
								type="button"
								onClick={onClose}
								className="w-full px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium cursor-pointer"
							>
								{isUnlocked ? "Close" : `${ratingsNeeded} more to unlock`}
							</button>
						</motion.div>
					</div>

					{/* Bottom Sheet - Mobile */}
					<div className="md:hidden fixed inset-0 z-50 flex items-end pointer-events-none">
						<motion.div
							initial={{ y: "100%" }}
							animate={{ y: 0 }}
							exit={{ y: "100%" }}
							transition={{ type: "spring", damping: 30, stiffness: 300 }}
							className="w-full bg-gray-900 rounded-t-3xl shadow-2xl ring-1 ring-white/10 max-h-[85vh] overflow-y-auto pointer-events-auto"
						>
							{/* Drag Handle */}
							<div className="flex justify-center pt-3 pb-2">
								<div className="w-12 h-1.5 bg-gray-700 rounded-full" />
							</div>

							<div className="p-5 space-y-3">
								<div className="flex items-start gap-3">
									<div
										className={`text-4xl ${isUnlocked ? "" : "opacity-30 grayscale"}`}
									>
										{feature.icon}
									</div>
									<div className="flex-1">
										<h3 className="text-lg font-bold text-white">
											{feature.name}
										</h3>
										<p className="text-xs text-gray-400">
											{feature.shortDescription}
										</p>
									</div>
								</div>

								<p className="text-sm text-gray-300 leading-relaxed">
									{feature.fullDescription}
								</p>

								<button
									type="button"
									onClick={onClose}
									className="w-full px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium cursor-pointer"
								>
									{isUnlocked ? "Close" : `${ratingsNeeded} more to unlock`}
								</button>
							</div>
						</motion.div>
					</div>
				</>
			)}
		</AnimatePresence>
	)
}
