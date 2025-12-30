import { motion, AnimatePresence } from "framer-motion"
import { useEffect } from "react"
import type { Feature } from "../../features"
import { getFeatureProgress } from "../../features"

interface FeatureInfoSheetProps {
	feature: Feature | null
	isUnlocked: boolean
	ratingsCount: number
	isOpen: boolean
	onClose: () => void
}

export default function FeatureInfoSheet({
	feature,
	isUnlocked,
	ratingsCount,
	isOpen,
	onClose,
}: FeatureInfoSheetProps) {
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

	if (!feature) return null

	const progress = getFeatureProgress(feature, ratingsCount)
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

					{/* Modal - Desktop */}
					<div className="hidden md:flex fixed inset-0 items-center justify-center z-50 p-4 pointer-events-none">
						<motion.div
							initial={{ opacity: 0, scale: 0.9 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.9 }}
							className="bg-gray-900 rounded-2xl shadow-2xl ring-1 ring-white/10 max-w-md w-full p-6 space-y-4 pointer-events-auto"
						>
							<div className="flex items-center gap-4">
								<div
									className={`text-5xl ${isUnlocked ? "" : "opacity-30 grayscale"}`}
								>
									{feature.icon}
								</div>
								<div className="flex-1">
									<div className="flex items-center gap-2 mb-1">
										<h3 className="text-xl font-bold text-white">
											{feature.name}
										</h3>
										{isUnlocked && (
											<span className="text-green-500 text-sm">✓</span>
										)}
										{!isUnlocked && (
											<span className="text-gray-500 text-sm">🔒</span>
										)}
									</div>
									<p className="text-sm text-gray-400">
										{feature.shortDescription}
									</p>
								</div>
							</div>

							<p className="text-gray-300 leading-relaxed">
								{feature.fullDescription}
							</p>

							{!isUnlocked && (
								<div className="space-y-3">
									<div>
										<div className="flex items-center justify-between text-sm mb-2">
											<span className="text-gray-400">Progress</span>
											<span className="text-indigo-400 font-medium">
												{ratingsCount}/{feature.unlockAt} ratings
											</span>
										</div>
										<div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
											<motion.div
												className="h-full bg-gradient-to-r from-indigo-600 to-purple-600"
												initial={{ width: 0 }}
												animate={{ width: `${progress}%` }}
												transition={{ duration: 0.5 }}
											/>
										</div>
									</div>

									<div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
										<p className="text-sm font-medium text-gray-300">
											Requirements:
										</p>
										<ul className="space-y-1">
											{feature.requirements.map((req, index) => (
												<li
													key={index}
													className="text-sm text-gray-400 flex items-start gap-2"
												>
													<span className="text-indigo-400 mt-0.5">•</span>
													<span>{req}</span>
												</li>
											))}
										</ul>
										<p className="text-sm text-indigo-400 font-medium mt-3">
											Rate {ratingsNeeded} more to unlock!
										</p>
									</div>
								</div>
							)}

							{isUnlocked && (
								<div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
									<p className="text-sm text-green-400 font-medium">
										✓ This feature is active
									</p>
									<p className="text-xs text-gray-400 mt-1">
										Unlocked at rating #{feature.unlockAt}
									</p>
								</div>
							)}

							<button
								type="button"
								onClick={onClose}
								className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
							>
								Close
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

							<div className="p-6 space-y-4">
								<div className="flex items-center gap-4">
									<div
										className={`text-5xl ${isUnlocked ? "" : "opacity-30 grayscale"}`}
									>
										{feature.icon}
									</div>
									<div className="flex-1">
										<div className="flex items-center gap-2 mb-1">
											<h3 className="text-xl font-bold text-white">
												{feature.name}
											</h3>
											{isUnlocked && (
												<span className="text-green-500 text-sm">✓</span>
											)}
											{!isUnlocked && (
												<span className="text-gray-500 text-sm">🔒</span>
											)}
										</div>
										<p className="text-sm text-gray-400">
											{feature.shortDescription}
										</p>
									</div>
								</div>

								<p className="text-gray-300 leading-relaxed">
									{feature.fullDescription}
								</p>

								{!isUnlocked && (
									<div className="space-y-3">
										<div>
											<div className="flex items-center justify-between text-sm mb-2">
												<span className="text-gray-400">Progress</span>
												<span className="text-indigo-400 font-medium">
													{ratingsCount}/{feature.unlockAt} ratings
												</span>
											</div>
											<div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
												<motion.div
													className="h-full bg-gradient-to-r from-indigo-600 to-purple-600"
													initial={{ width: 0 }}
													animate={{ width: `${progress}%` }}
													transition={{ duration: 0.5 }}
												/>
											</div>
										</div>

										<div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
											<p className="text-sm font-medium text-gray-300">
												Requirements:
											</p>
											<ul className="space-y-1">
												{feature.requirements.map((req, index) => (
													<li
														key={index}
														className="text-sm text-gray-400 flex items-start gap-2"
													>
														<span className="text-indigo-400 mt-0.5">•</span>
														<span>{req}</span>
													</li>
												))}
											</ul>
											<p className="text-sm text-indigo-400 font-medium mt-3">
												Rate {ratingsNeeded} more to unlock!
											</p>
										</div>
									</div>
								)}

								{isUnlocked && (
									<div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
										<p className="text-sm text-green-400 font-medium">
											✓ This feature is active
										</p>
										<p className="text-xs text-gray-400 mt-1">
											Unlocked at rating #{feature.unlockAt}
										</p>
									</div>
								)}

								<button
									type="button"
									onClick={onClose}
									className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
								>
									Close
								</button>
							</div>
						</motion.div>
					</div>
				</>
			)}
		</AnimatePresence>
	)
}
