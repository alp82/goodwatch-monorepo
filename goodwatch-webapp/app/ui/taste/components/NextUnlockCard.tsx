import { motion } from "framer-motion"
import { Link } from "@remix-run/react"
import type { Feature } from "../features"

interface NextUnlockCardProps {
	feature: Feature
	ratingsCount: number
}

export default function NextUnlockCard({ feature, ratingsCount }: NextUnlockCardProps) {
	const progress = (ratingsCount / feature.unlockAt) * 100
	const remaining = feature.unlockAt - ratingsCount

	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			className="relative rounded-xl border border-amber-600/30 bg-gradient-to-br from-amber-900/10 to-amber-800/5 p-4"
		>
			<div className="flex items-center gap-3">
				<span className="text-3xl">{feature.icon}</span>
				<div className="flex-1">
					<h3 className="font-semibold text-amber-400">Next: {feature.name}</h3>
					<p className="text-sm text-gray-400">{feature.shortDescription}</p>
					<div className="flex items-center gap-2 mt-2">
						<div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden max-w-[200px]">
							<div 
								className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-500"
								style={{ width: `${progress}%` }}
							/>
						</div>
						<span className="text-xs text-amber-300 font-medium">
							{remaining} more {remaining === 1 ? "rating" : "ratings"}
						</span>
					</div>
				</div>
			</div>
			<Link
				to="/taste/quiz"
				className="absolute top-4 right-4 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors"
			>
				Rate Now
			</Link>
		</motion.div>
	)
}
