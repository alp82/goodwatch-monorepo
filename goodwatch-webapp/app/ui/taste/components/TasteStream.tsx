import { motion } from "framer-motion"
import { Link } from "@remix-run/react"
import { LockClosedIcon, SparklesIcon } from "@heroicons/react/24/outline"
import type { LastRatedItem, ScoringMedia } from "~/ui/scoring/types"
import { FEATURES, getNextUnlockableFeature, getUnlockedFeatures } from "../features"
import RatingHistory from "./RatingHistory"
import Button from "~/ui/button/Button"
import { ArrowRightIcon } from "@heroicons/react/20/solid"

interface TasteStreamProps {
	lastRated: LastRatedItem[]
	ratingsCount: number
	isGuest: boolean
	onSelectLastRated?: (media: ScoringMedia) => void
	selectedMediaId?: number | null
	recommendationsUnlocked: boolean
	recommendationsShown: boolean
	onViewPicks: () => void
	onContinueRating: () => void
}

export default function TasteStream({
	lastRated,
	ratingsCount,
	isGuest,
	onSelectLastRated,
	selectedMediaId,
	recommendationsUnlocked,
	recommendationsShown,
	onViewPicks,
	onContinueRating,
}: TasteStreamProps) {
	const nextFeature = getNextUnlockableFeature(ratingsCount)
	const unlockedFeatures = getUnlockedFeatures(ratingsCount)
	const lastUnlockedFeature = unlockedFeatures[unlockedFeatures.length - 1]
	
	// Determine current target threshold
	const currentTarget = nextFeature?.unlockAt || lastUnlockedFeature?.unlockAt || FEATURES[0].unlockAt
	const previousTarget = lastUnlockedFeature?.unlockAt || 0
	
	// Calculate progress toward next feature
	let progress = 0
	if (nextFeature) {
		const range = currentTarget - previousTarget
		const current = ratingsCount - previousTarget
		progress = range > 0 ? Math.max(0, Math.min(100, (current / range) * 100)) : 100
	} else {
		progress = 100
	}
	
	// How many placeholders to show (based on first unlock)
	const placeholderCount = FEATURES[0].unlockAt

	return (
		<div className="w-full px-3 md:px-4">
			<div className="max-w-6xl mx-auto">
				{/* Glass container */}
				<div className="relative bg-gray-800/60 backdrop-blur-sm rounded-xl border border-gray-700/50 overflow-hidden">
					{/* Progress fill background */}
					<motion.div
						className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-cyan-500/20"
						initial={{ width: 0 }}
						animate={{ width: `${progress}%` }}
						transition={{ duration: 0.5, ease: "easeOut" }}
					/>
					
					{/* Single Row Layout for both Mobile and Desktop */}
					<div className="relative flex items-center justify-between gap-2 md:gap-4 px-3 py-2 md:px-4 md:py-3">
						{/* Left */}
						{recommendationsShown ? (
							<Button
								onClick={onContinueRating}
								highlight="emerald"
								mode="dark"
								size="sm"
							>
								<span>Continue Rating</span>
								<ArrowRightIcon className="w-4 h-4" />
							</Button>
						) : (
							<div className="flex flex-col gap-1 items-center">
								<RatingHistory
									lastRated={lastRated}
									placeholderCount={placeholderCount}
									onSelectLastRated={onSelectLastRated}
									selectedMediaId={selectedMediaId}
									/>
								
								{lastRated.length > 0 && (
									<div className="whitespace-nowrap text-xs text-gray-500">
										Misclicked? Change your last 5 ratings
									</div>
								)}
							</div>
						)}
						
						{/* Center: Progress + Messaging */}
						{!recommendationsShown && <div className="hidden md:flex flex-1 flex-col items-center justify-center gap-1 min-w-0">
							<div className="text-lg text-white">
								<span className="font-extrabold">{ratingsCount}</span>/<span className="font-medium">{currentTarget}</span> ratings
							</div>
							{nextFeature && (
								<div className="mt-1 hidden md:flex items-center gap-4 bg-gray-700/70 rounded-lg px-3 py-2">
									<span className="text-md text-gray-500 uppercase">Next:</span>
									<div className="flex flex-col gap-1">
										<span className="text-sm/3 text-gray-300 font-semibold">
											{nextFeature.icon} {nextFeature.name}
										</span>
										<span className="text-xs/3 text-gray-300">
											{nextFeature.shortDescription}
										</span>
									</div>
								</div>
							)}
							{!nextFeature && (
								<div className="mt-1 hidden md:block text-xs text-cyan-400">
									All levels unlocked
								</div>
							)}
						</div>}

						{/* Right: Action Buttons (vertical stack) */}
						<div className="md:ml-24 flex flex-col gap-1.5">
							{/* Save Progress Button (guests only) */}
							{isGuest && (
								<Link to="/sign-up?redirectTo=/taste">
									<Button
										disabled={lastRated.length == 0}
										highlight="gray"
										mode="light"
										size={recommendationsShown ? "sm" : "xs"}
									>
										<span>Save My Taste</span>
									</Button>
								</Link>
							)}
							
							{/* Picks For You Button */}
							{!recommendationsShown ? <Button
								disabled={!recommendationsUnlocked}
								onClick={recommendationsUnlocked ? onViewPicks : undefined}
								highlight={recommendationsUnlocked ? "cyan" : undefined}
								mode="dark"
								size="xs"
							>
								{recommendationsUnlocked 
									? <SparklesIcon className="w-3.5 h-3.5" />
									: <LockClosedIcon className="w-3.5 h-3.5" />
								}
								<span>For You</span>
							</Button> : null}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
