import { motion } from "framer-motion"
import type { Feature } from "../features"
import { FEATURES } from "../features"

interface VerticalTimelineProps {
	ratingsCount: number
	onFeatureTap: (feature: Feature) => void
	compact?: boolean
}

export default function VerticalTimeline({ ratingsCount, onFeatureTap, compact = false }: VerticalTimelineProps) {
	return (
		<div className={`w-full max-w-2xl mx-auto ${compact ? 'py-2' : 'py-6'}`}>
			{!compact && (
				<h2 className="text-xl md:text-2xl font-bold text-white mb-6 md:mb-8 text-center">
					What Your Taste Unlocks
				</h2>
			)}
			
			<div className="relative">
				{/* Vertical line */}
				<div className={`absolute ${compact ? 'left-4' : 'left-6 md:left-8'} top-0 bottom-0 w-0.5 bg-gray-700`} />
				
				{/* Progress line */}
				<motion.div
					className={`absolute ${compact ? 'left-4' : 'left-6 md:left-8'} top-0 w-0.5 bg-gradient-to-b from-blue-500 to-cyan-400`}
					initial={{ height: 0 }}
					animate={{ 
						height: `${(FEATURES.filter(f => ratingsCount >= f.unlockAt).length / FEATURES.length) * 100}%` 
					}}
					transition={{ duration: 1, ease: "easeOut" }}
				/>
				
				{/* Feature items */}
				<div className={compact ? 'space-y-3' : 'space-y-6 md:space-y-8'}>
					{FEATURES.map((feature, index) => {
						const isUnlocked = ratingsCount >= feature.unlockAt
						const isCurrent = ratingsCount < feature.unlockAt && 
							(index === 0 || ratingsCount >= FEATURES[index - 1].unlockAt)
						
						return (
							<motion.button
								key={feature.id}
								type="button"
								onClick={() => onFeatureTap(feature)}
								className="relative flex items-start gap-4 w-full text-left group"
								initial={{ opacity: 0, x: -20 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ delay: index * 0.1 }}
							>
								{/* Icon dot */}
								<div className={`
									relative z-10 ${compact ? 'w-8 h-8' : 'w-12 h-12 md:w-16 md:h-16'} rounded-full border-2 ${compact ? '' : 'md:border-3'} flex-shrink-0
									flex items-center justify-center ${compact ? 'text-sm' : 'text-xl md:text-3xl'} transition-all
									${isUnlocked 
										? 'bg-cyan-400 border-cyan-400 shadow-lg shadow-cyan-400/50' 
										: isCurrent
											? 'bg-gray-700 border-orange-400 animate-pulse'
											: 'bg-gray-800 border-gray-600'}
									group-hover:scale-110
								`}>
									<span className={isUnlocked ? 'opacity-100' : 'opacity-60'}>
										{feature.icon}
									</span>
								</div>
								
								{/* Content */}
								<div className={`flex-1 ${compact ? 'pt-1' : 'pt-2 md:pt-3'}`}>
									<div className="flex items-center justify-between gap-2 mb-1">
										<h3 className={`
											${compact ? 'text-sm' : 'text-base md:text-lg'} font-semibold transition-colors
											${isUnlocked ? 'text-white' : isCurrent ? 'text-orange-400' : 'text-gray-500'}
										`}>
											{feature.name}
										</h3>
										{isUnlocked && (
											<span className="text-xs md:text-sm text-cyan-400 font-semibold">
												✓ Unlocked
											</span>
										)}
										{isCurrent && (
											<span className="text-xs md:text-sm text-orange-400 font-semibold">
												{feature.unlockAt - ratingsCount} more
											</span>
										)}
									</div>
									
									<p className={`
										${compact ? 'text-xs' : 'text-sm md:text-base'} transition-colors
										${isUnlocked ? 'text-gray-300' : 'text-gray-500'}
									`}>
										{feature.shortDescription}
									</p>
								</div>
							</motion.button>
						)
					})}
				</div>
			</div>
			
			{!compact && (
				<div className="mt-8 pt-6 border-t border-gray-700">
					<h3 className="text-lg font-semibold text-white mb-3 text-center">
						What Happens Next
					</h3>
					<p className="text-sm text-gray-400 text-center max-w-md mx-auto">
						Keep rating to unlock personalized recommendations, genre detection, and your complete taste fingerprint.
					</p>
				</div>
			)}
		</div>
	)
}
