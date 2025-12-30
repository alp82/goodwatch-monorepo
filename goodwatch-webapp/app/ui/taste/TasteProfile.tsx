import { Link } from "@remix-run/react"
import { motion } from "framer-motion"
import { 
	getUnlockedFeatures, 
	getLockedFeatures,
	getNextUnlockableFeature,
	getCurrentLevel,
	type Feature 
} from "./features"
import { useUserData } from "~/routes/api.user-data"
import { PlayIcon, FingerPrintIcon } from "@heroicons/react/24/solid"
import { 
	FingerprintFeature,
	GenreDetectionFeature,
	DecadeDetectionFeature,
	CreatorDetectionFeature
} from "./features/index"
import { LockedFeatureCard, NextUnlockCard } from "./components/index"

interface TasteProfileProps {
	userId: string
	ratingsCount: number
}

const PROFILE_FEATURE_IDS = ["fingerprint_preview", "fingerprint_detection", "genre_detection", "decade_detection", "creator_detection"]
const EXCLUDED_FEATURE_IDS = ["recommendations", "neighbor_finding"]

function getProfileFeatures(ratingsCount: number) {
	const unlocked = getUnlockedFeatures(ratingsCount)
	const locked = getLockedFeatures(ratingsCount)
	
	const hasFingerprintPreview = unlocked.some(f => f.id === "fingerprint_preview")
	const hasFingerprintFull = unlocked.some(f => f.id === "fingerprint_detection")
	
	const unlockedFiltered = unlocked.filter(f => {
		if (EXCLUDED_FEATURE_IDS.includes(f.id)) return false
		if (f.id === "fingerprint_preview" && hasFingerprintFull) return false
		return true
	})
	
	const lockedFiltered = locked.filter(f => {
		if (EXCLUDED_FEATURE_IDS.includes(f.id)) return false
		if (f.id === "fingerprint_detection" && hasFingerprintPreview) return false
		return true
	})
	
	return { unlocked: unlockedFiltered, locked: lockedFiltered }
}

export default function TasteProfile({ userId, ratingsCount }: TasteProfileProps) {
	const { data: userData } = useUserData()
	const currentRatingsCount = userData ? Object.keys(userData.scores).length : ratingsCount
	
	
	const { unlocked: unlockedFeatures, locked: lockedFeatures } = getProfileFeatures(currentRatingsCount)
	const nextFeature = lockedFeatures[0] || null
	const currentLevel = getCurrentLevel(currentRatingsCount)

	return (
		<div className="min-h-screen bg-gray-950 pt-20 pb-32">
			<div className="max-w-4xl mx-auto px-4">
				<ProfileHeader 
					ratingsCount={currentRatingsCount} 
					level={currentLevel.level}
					levelIcon={currentLevel.icon}
				/>
				
				<div className="mt-8 space-y-6">
					{nextFeature && (
						<NextUnlockCard 
							feature={nextFeature} 
							ratingsCount={currentRatingsCount} 
						/>
					)}
					
					{unlockedFeatures.length > 0 && (
						<section>
							<h2 className="text-lg font-semibold text-gray-300 mb-4">
								Your Taste Insights
							</h2>
							<div className="grid gap-4">
								{unlockedFeatures.map((feature) => {
									switch (feature.id) {
										case "fingerprint_preview":
										case "fingerprint_detection":
											return (
												<FingerprintFeature
													key={feature.id}
													feature={feature}
													ratingsCount={currentRatingsCount}
												/>
											)
										case "genre_detection":
											return (
												<GenreDetectionFeature
													key={feature.id}
													feature={feature}
												/>
											)
										case "decade_detection":
											return (
												<DecadeDetectionFeature
													key={feature.id}
													feature={feature}
												/>
											)
										case "creator_detection":
											return (
												<CreatorDetectionFeature
													key={feature.id}
													feature={feature}
												/>
											)
										default:
											return null
									}
								})}
							</div>
						</section>
					)}
					
					{lockedFeatures.length > 1 && (
						<section>
							<h2 className="text-lg font-semibold text-gray-500 mb-4">
								Coming Up
							</h2>
							<div className="grid gap-3">
								{lockedFeatures.slice(1).map((feature) => (
									<LockedFeatureCard 
										key={feature.id} 
										feature={feature} 
										ratingsCount={currentRatingsCount}
									/>
								))}
							</div>
						</section>
					)}
				</div>

				<div className="mt-12 text-center">
					<Link
						to="/taste/quiz"
						className="inline-flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg transition-colors"
					>
						<PlayIcon className="w-5 h-5" />
						Continue Rating
					</Link>
				</div>
			</div>
		</div>
	)
}

function ProfileHeader({ 
	ratingsCount, 
	level,
	levelIcon 
}: { 
	ratingsCount: number
	level: number
	levelIcon: string
}) {
	return (
		<motion.div 
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			className="text-center"
		>
			<div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 mb-4">
				<FingerPrintIcon className="w-10 h-10 text-white" />
			</div>
			<h1 className="text-3xl font-bold text-white mb-2">Your Taste Profile</h1>
			<div className="flex items-center justify-center gap-4 text-gray-400">
				<span className="text-2xl">{levelIcon}</span>
				<span>Level {level}</span>
				<span className="text-gray-600">•</span>
				<span>{ratingsCount} ratings</span>
			</div>
		</motion.div>
	)
}
