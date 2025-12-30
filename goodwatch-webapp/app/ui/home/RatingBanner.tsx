import { Link } from "@remix-run/react"
import { motion } from "framer-motion"
import { SparklesIcon, StarIcon } from "@heroicons/react/24/solid"
import { GUEST_LIMITS } from "../taste/features"

interface RatingBannerProps {
	scoresCount: number
}

export default function RatingBanner({ scoresCount }: RatingBannerProps) {
	if (scoresCount >= GUEST_LIMITS.FIRST_UNLOCK) {
		return null
	}

	const isZeroRatings = scoresCount === 0
	const remainingRatings = GUEST_LIMITS.FIRST_UNLOCK - scoresCount

	if (isZeroRatings) {
		return (
			<motion.div
				initial={{ opacity: 0, y: -10 }}
				animate={{ opacity: 1, y: 0 }}
				className="w-full max-w-4xl mx-auto"
			>
				<Link
					to="/taste"
					className="block p-6 bg-gradient-to-r from-amber-900/40 via-amber-800/30 to-amber-900/40 border border-amber-600/50 rounded-2xl hover:border-amber-500/70 transition-all group"
				>
					<div className="flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
						<div className="flex-shrink-0 p-3 bg-amber-600/20 rounded-full">
							<StarIcon className="w-8 h-8 text-amber-400" />
						</div>
						<div className="flex-1">
							<h3 className="text-xl font-bold text-white mb-1">
								Rate movies to unlock personalized recommendations
							</h3>
							<p className="text-gray-300">
								Your ratings help us understand your taste. Rate just <span className="font-semibold text-amber-400">{GUEST_LIMITS.FIRST_UNLOCK} titles</span> to get started!
							</p>
						</div>
						<div className="flex-shrink-0">
							<span className="inline-flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl transition-colors group-hover:scale-105 transform">
								<SparklesIcon className="w-5 h-5" />
								Start Rating
							</span>
						</div>
					</div>
				</Link>
			</motion.div>
		)
	}

	return (
		<motion.div
			initial={{ opacity: 0, y: -10 }}
			animate={{ opacity: 1, y: 0 }}
			className="w-full max-w-4xl mx-auto"
		>
			<Link
				to="/taste"
				className="block p-4 bg-gray-800/50 border border-gray-700/50 rounded-xl hover:border-amber-600/50 transition-all group"
			>
				<div className="flex items-center gap-4 text-center md:text-left">
					<div className="flex-shrink-0">
						<div className="flex gap-1">
							{[...Array(GUEST_LIMITS.FIRST_UNLOCK)].map((_, i) => (
								<StarIcon
									key={i}
									className={`w-5 h-5 ${i < scoresCount ? "text-amber-400" : "text-gray-600"}`}
								/>
							))}
						</div>
					</div>
					<div className="flex-1">
						<p className="text-gray-300">
							<span className="font-semibold text-white">{remainingRatings} more rating{remainingRatings > 1 ? "s" : ""}</span> to unlock personalized recommendations
						</p>
					</div>
					<div className="flex-shrink-0">
						<span className="text-amber-400 font-medium group-hover:text-amber-300 transition-colors">
							Continue →
						</span>
					</div>
				</div>
			</Link>
		</motion.div>
	)
}
