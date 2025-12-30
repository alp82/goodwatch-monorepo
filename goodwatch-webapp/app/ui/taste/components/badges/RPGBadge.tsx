import { motion, AnimatePresence } from "framer-motion"
import { useState } from "react"
import type { Feature } from "../../features"

interface RPGBadgeProps {
	feature: Feature
	isUnlocked: boolean
	size?: "small" | "large" | "tiny"
	onTap?: (feature: Feature) => void
}

export default function RPGBadge({ feature, isUnlocked, size = "small", onTap }: RPGBadgeProps) {
	const [showTooltip, setShowTooltip] = useState(false)
	const sizeClasses = size === "tiny" ? "w-6 h-6" : "w-12 h-12 md:w-14 md:h-14"
	const iconSize = size === "tiny" ? "text-sm" : "text-2xl md:text-3xl"
	
	return (
		<div className="relative">
			<motion.button
				type="button"
				onMouseEnter={() => setShowTooltip(true)}
				onMouseLeave={() => setShowTooltip(false)}
				onClick={() => onTap?.(feature)}
				className={`
					relative ${sizeClasses}
					cursor-pointer
					transition-all duration-200
				`}
				whileHover={{ scale: 1.05 }}
				whileTap={{ scale: 0.95 }}
			>
				{/* Outer border - gold/silver */}
				<div className={`
					absolute inset-0 rounded-lg
					${
						isUnlocked
							? "bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600"
							: "bg-gradient-to-br from-gray-600 via-gray-700 to-gray-800"
					}
					p-[3px]
				`}>
					{/* Inner border - darker */}
					<div className={`
						w-full h-full rounded-md
						${
							isUnlocked
								? "bg-gradient-to-br from-amber-800 via-amber-900 to-amber-950"
								: "bg-gradient-to-br from-gray-800 via-gray-900 to-black"
						}
						p-[2px]
					`}>
						{/* Content background */}
						<div className={`
							w-full h-full rounded-sm
							flex items-center justify-center
							${
								isUnlocked
									? "bg-gradient-to-br from-indigo-600 to-purple-700"
									: "bg-gradient-to-br from-gray-800 to-gray-900"
							}
						`}>
							<span className={`${iconSize} ${isUnlocked ? "" : "grayscale opacity-40"}`}>
								{feature.icon}
							</span>
						</div>
					</div>
				</div>
			</motion.button>
			
			{/* Tooltip */}
			<AnimatePresence>
				{showTooltip && (
					<motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 10 }}
						className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
					>
						<div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
							<div className="text-white font-semibold text-sm">{feature.name}</div>
							<div className="text-gray-400 text-xs">{isUnlocked ? "Unlocked" : "Locked"}</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}
