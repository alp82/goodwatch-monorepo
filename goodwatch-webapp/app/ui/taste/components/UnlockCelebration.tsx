import { motion } from "framer-motion"
import { FingerPrintIcon } from "@heroicons/react/20/solid"
import type { Feature } from "../features"

interface UnlockCelebrationProps {
	unlockedFeature: Feature
	onReveal: () => void
	onContinueRating: () => void
}

function RevealButton({ onClick, unlockedFeature }: { onClick: () => void; unlockedFeature: Feature }) {
	return (
		<motion.button
			type="button"
			onClick={onClick}
			className="relative flex items-center gap-3 px-6 py-4
				bg-gradient-to-br from-amber-800 via-amber-700 to-amber-800 hover:from-amber-700 hover:via-amber-600 hover:to-amber-700
				border-4 border-amber-500/30 rounded-2xl shadow-xl cursor-pointer transition-colors"
			whileHover={{ scale: 1.02 }}
			whileTap={{ scale: 0.98 }}
			initial={{ scale: 0.9, opacity: 0 }}
			animate={{ scale: 1, opacity: 1 }}
			transition={{ type: "spring", stiffness: 300, damping: 25 }}
		>
			<span className="text-4xl">{unlockedFeature.icon}</span>
			
			<div className="flex flex-col items-start">
				<span className="text-white text-3xl font-extrabold">Reveal</span>				
				{unlockedFeature && (
					<div className="text-gray-300 text-sm">
						 {unlockedFeature.shortDescription}
					</div>
				)}
			</div>
		</motion.button>
	)
}

export default function UnlockCelebration({
	unlockedFeature,
	onReveal,
	onContinueRating,
}: UnlockCelebrationProps) {
	return (
		<div 
			className="relative w-full flex items-center justify-center rounded-2xl border border-gray-700/50"
			style={{ 
				height: '550px',
				background: 'radial-gradient(ellipse at center, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)'
			}}
		>
			{/* Soft vignette overlay */}
			<div className="absolute inset-0 rounded-2xl pointer-events-none" 
				style={{
					background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)'
				}}
			/>
			
			<div className="flex flex-col items-center gap-4 text-center px-8">
				<FingerPrintIcon className="h-24 text-amber-400" />

				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.1 }}
					className="mb-6"
				>
					<h2 className="text-2xl md:text-3xl font-semibold text-white mb-2">
						{unlockedFeature?.name || "Recommendations"} Ready
					</h2>
					<p className="text-gray-400 text-lg">
						We found some promising picks based on the titles you enjoyed.
					</p>
				</motion.div>

				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.2 }}
					className="mb-6"
				>
					<RevealButton onClick={onReveal} unlockedFeature={unlockedFeature} />
				</motion.div>
				
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.3 }}
					className="mb-6"
				>
					<p className="text-gray-500 text-sm mt-2">
						These are initial taste signals - more ratings will improve your recommendations.
					</p>
				</motion.div>

				<motion.button
					type="button"
					onClick={onContinueRating}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.4 }}
					className="mt-6 text-blue-400 hover:text-blue-300 text-sm transition-colors cursor-pointer"
				>
					Continue Rating Instead
				</motion.button>
			</div>
		</div>
	)
}
