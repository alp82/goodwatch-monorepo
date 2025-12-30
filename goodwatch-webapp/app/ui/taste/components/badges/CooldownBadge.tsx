import { motion, AnimatePresence } from "framer-motion"
import { useState } from "react"
import type { Feature } from "../../features"

interface CooldownBadgeProps {
	feature: Feature
	ratingsNeeded: number
	progress: number
}

export default function CooldownBadge({ feature, ratingsNeeded, progress }: CooldownBadgeProps) {
	const [showTooltip, setShowTooltip] = useState(false)
	
	return (
		<div className="relative flex items-center gap-3">
			{/* Badge */}
			<motion.button
				type="button"
				onMouseEnter={() => setShowTooltip(true)}
				onMouseLeave={() => setShowTooltip(false)}
				className="relative w-12 h-12 md:w-14 md:h-14 cursor-pointer flex-shrink-0"
				whileHover={{ scale: 1.05 }}
				whileTap={{ scale: 0.95 }}
			>
				{/* Outer gold border */}
				<div className="absolute inset-0 rounded-lg bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 p-[3px]">
					{/* Inner dark border */}
					<div className="w-full h-full rounded-md bg-gradient-to-br from-amber-800 via-amber-900 to-amber-950 p-[2px]">
						{/* Content with conic gradient progress */}
						<div 
							className="relative w-full h-full rounded-sm overflow-hidden"
							style={{
								background: `radial-gradient(circle at 30% 30%, #3b82f6 0%, #1e40af 50%, #0f172a 100%), 
									conic-gradient(from 0deg at 50% 50%, 
										#3b82f6 0deg, 
										#60a5fa ${progress * 3.6}deg, 
										#0a0a0a ${progress * 3.6}deg, 
										#0a0a0a 360deg)`,
								backgroundBlendMode: 'overlay, normal'
							}}
						>
							{/* Icon background */}
							<div className="absolute inset-0 flex items-center justify-center">
								<span className="text-3xl md:text-4xl opacity-30">{feature.icon}</span>
							</div>
							
							{/* Number overlay */}
							<div className="absolute inset-0 flex items-center justify-center">
								<span className="text-3xl md:text-4xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" style={{ WebkitTextStroke: '1.5px black' }}>
									{ratingsNeeded}
								</span>
							</div>
						</div>
					</div>
				</div>
			</motion.button>
			
			{/* Inline label */}
			<div className="hidden md:flex flex-col">
				<div className="text-white font-semibold text-sm leading-tight">{feature.name}</div>
				<div className="text-gray-400 text-xs">{ratingsNeeded} more to unlock</div>
			</div>
			
			{/* Tooltip for mobile */}
			<AnimatePresence>
				{showTooltip && (
					<motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 10 }}
						className="md:hidden absolute top-full mt-2 left-0 z-50 pointer-events-none"
					>
						<div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
							<div className="text-white font-semibold text-sm">{feature.name}</div>
							<div className="text-gray-400 text-xs">{ratingsNeeded} more to unlock</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}
