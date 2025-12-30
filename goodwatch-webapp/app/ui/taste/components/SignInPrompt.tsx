import { useState } from "react"
import { motion } from "framer-motion"
import { ArrowRightIcon, UserPlusIcon } from "@heroicons/react/24/outline"
import logo from "~/img/goodwatch-logo.png"
import TasteRotator from "./TasteRotator"
import VerticalTimeline from "./VerticalTimeline"
import type { Feature } from "../features"
import type { Recommendation } from "../types"
import StartOverButton from "./StartOverButton"

interface SignInPromptProps {
	onSignUp: () => void
	onCancel: () => void
	onStartOver?: () => void
	ratingsCount?: number
	onFeatureInfoTap?: (feature: Feature) => void
	recommendations?: Recommendation[]
	isGuest?: boolean
}

export default function SignInPrompt({
	onSignUp, 
	onCancel, 
	onStartOver, 
	ratingsCount = 0, 
	onFeatureInfoTap, 
	recommendations = [],
	isGuest = false,
}: SignInPromptProps) {
	const [isFlipped, setIsFlipped] = useState(false)
	
	const backdropImages = recommendations
		.filter(r => r.backdrop_path || r.poster_path)
		.slice(0, 6)

	return (
		<div className="min-h-screen flex md:items-center justify-center px-4 py-8">
			<div 
				className="relative w-full max-w-4xl h-[600px]"
				style={{ 
					perspective: '1500px',
				}}
			>
				<motion.div
					className="relative w-full h-full"
					style={{ transformStyle: 'preserve-3d' }}
					animate={{ rotateY: isFlipped ? 180 : 0 }}
					transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
				>
					{/* Front Face - Sign Up CTA */}
					<div 
						className="absolute inset-0 rounded-2xl border border-gray-700/50 overflow-hidden"
						style={{ 
							backfaceVisibility: 'hidden',
						}}
					>
						{/* Backdrop collage */}
						{backdropImages.length > 0 && (
							<div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-1 opacity-80">
								{backdropImages.map((rec, i) => (
									<div key={rec.tmdb_id} className="relative overflow-hidden">
										<img
											src={`https://image.tmdb.org/t/p/w780${rec.backdrop_path || rec.poster_path}`}
											alt=""
											className="w-full h-full object-cover"
										/>
									</div>
								))}
							</div>
						)}
						
						{/* Gradient overlay */}
						<div 
							className="absolute inset-0 pointer-events-none"
							style={{
								background: 'radial-gradient(ellipse at center, rgba(15, 23, 42, 0.85) 0%, rgba(15, 23, 42, 0.95) 60%, rgba(15, 23, 42, 1) 100%)'
							}}
						/>
						
						<div className="relative h-full flex flex-col items-center justify-center px-8 py-10">
							{/* Logo */}
							<motion.div
								initial={{ scale: 0 }}
								animate={{ scale: 1 }}
								transition={{ delay: 0.1, type: "spring" }}
								className="mb-4"
							>
								<img
									className="h-10 w-auto"
									src={logo}
									alt="GoodWatch Logo"
								/>
							</motion.div>
							
							{/* Big CTA at top */}
							<motion.div
								initial={{ scale: 0 }}
								animate={{ scale: 1 }}
								transition={{ delay: 0.2 }}
								className="text-center mb-6"
							>
								<h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
									Don't lose your taste profile.
								</h2>
								<p className="text-gray-300 text-lg">
									Continue where you left off, on any device.
								</p>
							</motion.div>
							
							<motion.button
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ delay: 0.3 }}
								type="button"
								onClick={onSignUp}
								className="flex items-center justify-center gap-3 px-10 py-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xl font-bold rounded-2xl transition-all shadow-xl shadow-amber-500/20 cursor-pointer mb-4"
							>
								<UserPlusIcon className="w-7 h-7" />
								Save My Taste
							</motion.button>

							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ delay: 0.4 }}
								className="text-center mb-3"
							>
								<button
									type="button"
									onClick={onCancel}
									className="text-slate-300 hover:text-slate-200 text-md transition-colors cursor-pointer mb-10"
								>
									Maybe Later
								</button>
							</motion.div>
							
							{/* Taste profile rotating text */}
							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ delay: 0.5 }}
								className="text-center mb-3"
							>
								<p className="text-gray-300 text-sm mb-3">Build your unique taste step by step:</p>
								<TasteRotator />
							</motion.div>
							
							{/* Stats */}
							<motion.p
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ delay: 0.6 }}
								className="text-gray-500 text-sm mb-8"
							>
								You've rated <span className="text-white font-semibold">{ratingsCount}</span> items so far
							</motion.p>
							
							{/* Secondary actions */}
							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ delay: 0.7 }}
								className="text-center mb-3"
							>
								<button
									type="button"
									onClick={() => setIsFlipped(true)}
									className="flex items-center gap-1 text-base text-gray-300 hover:text-gray-100 transition-colors cursor-pointer"
								>
									What Your Taste Unlocks
									<ArrowRightIcon className="w-3 h-3" />
								</button>
							</motion.div>
							
							<motion.p
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ delay: 0.8 }}
								className="absolute bottom-4 text-xs text-gray-600"
							>
								Free forever • No ads
							</motion.p>
						</div>
					</div>

					{/* Back Face - Journey Timeline */}
					<div 
						className="absolute inset-0 flex flex-col bg-gray-900/95 rounded-2xl border border-gray-700/50 backdrop-blur-sm overflow-hidden"
						style={{ 
							backfaceVisibility: 'hidden',
							transform: 'rotateY(180deg)'
						}}
					>
						{/* Header */}
						<div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/50">
							<h3 className="text-lg font-semibold text-white">What Your Taste Unlocks</h3>
							<div className="text-sm text-gray-400">
								{ratingsCount} ratings completed
							</div>
						</div>

						{/* Timeline Content */}
						<div className="flex-1 overflow-y-auto px-4 py-4">
							<VerticalTimeline
								ratingsCount={ratingsCount}
								onFeatureTap={onFeatureInfoTap || (() => {})}
								compact
							/>
						</div>

						{/* Footer Actions */}
						<div className="flex flex-col gap-3 px-6 py-4 border-t border-gray-700/50 bg-gray-800/50">
							<div className="flex items-center justify-center gap-4">
								<button
									type="button"
									onClick={() => setIsFlipped(false)}
									className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-colors cursor-pointer"
								>
									Back
								</button>
								
								<button
									type="button"
									onClick={onSignUp}
									className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
								>
									<UserPlusIcon className="w-5 h-5" />
									Save My Taste
								</button>
							</div>
							
							{isGuest && onStartOver && (
								<StartOverButton onStartOver={onStartOver} />
							)}
						</div>
					</div>
				</motion.div>
			</div>
		</div>
	)
}
