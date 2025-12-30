import { motion } from "framer-motion"
import { useTasteCreators } from "~/routes/api.taste-profile.creators"
import type { Feature } from "../features"
import type { CreatorStat } from "~/server/taste-profile.server"
import { getVibeColorValue } from "~/utils/ratings"
import type { Score } from "~/server/scores.server"

interface CreatorDetectionFeatureProps {
	feature: Feature
}

const TMDB_PROFILE_BASE = "https://image.tmdb.org/t/p/w185"

function getProfileImage(profilePath: string | null): string | null {
	if (!profilePath) return null
	return `${TMDB_PROFILE_BASE}${profilePath}`
}

function ScoreBadge({ score }: { score: number }) {
	const roundedScore = Math.round(score) as Score
	return (
		<span 
			className="text-xs px-2 py-0.5 font-bold text-white rounded"
			style={{ backgroundColor: getVibeColorValue(roundedScore) }}
		>
			★ {score.toFixed(1)}
		</span>
	)
}

export default function CreatorDetectionFeature({ feature }: CreatorDetectionFeatureProps) {
	const { data: creatorData, isLoading } = useTasteCreators()

	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			className="rounded-xl border border-gray-700/50 bg-gray-900/50 overflow-hidden"
		>
			<div className="flex items-center gap-3 p-4 border-b border-gray-700/50 bg-gray-800/30">
				<span className="text-2xl">{feature.icon}</span>
				<div className="flex-1">
					<h3 className="font-semibold text-white">{feature.name}</h3>
					<p className="text-sm text-gray-400">{feature.shortDescription}</p>
				</div>
			</div>
			<div className="p-4">
				{isLoading ? (
					<CreatorLoadingSkeleton />
				) : (
					<CreatorDisplay 
						directors={creatorData?.directors || []} 
						actors={creatorData?.actors || []} 
					/>
				)}
			</div>
		</motion.div>
	)
}

function CreatorDisplay({ directors, actors }: { directors: CreatorStat[]; actors: CreatorStat[] }) {
	if (directors.length === 0 && actors.length === 0) {
		return <p className="text-gray-500 text-sm">Rate more titles to see your favorite creators.</p>
	}

	const sortedDirectors = [...directors].sort((a, b) => b.avgScore - a.avgScore)
	const sortedActors = [...actors].sort((a, b) => b.avgScore - a.avgScore)

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
			{sortedDirectors.length > 0 && (
				<div>
					<h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Your Top Directors</h4>
					<div className="space-y-2">
						{sortedDirectors.slice(0, 5).map((director, i) => (
							<DirectorCard key={director.id} director={director} rank={i + 1} />
						))}
					</div>
				</div>
			)}
			{sortedActors.length > 0 && (
				<div>
					<h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Your Top Actors</h4>
					<div className="flex flex-wrap gap-4">
						{sortedActors.slice(0, 10).map((actor) => (
							<ActorCard key={actor.id} actor={actor} />
						))}
					</div>
				</div>
			)}
		</div>
	)
}

function DirectorCard({ director, rank }: { director: CreatorStat; rank: number }) {
	const profileImage = getProfileImage(director.profilePath)
	const isTopThree = rank <= 3

	return (
		<motion.div
			initial={{ opacity: 0, x: -10 }}
			animate={{ opacity: 1, x: 0 }}
			transition={{ delay: rank * 0.05 }}
			className={`
				flex items-center gap-3 p-2 rounded-lg
				${isTopThree ? "bg-gray-800/50" : ""}
			`}
		>
			<div className="relative">
				{profileImage ? (
					<img
						src={profileImage}
						alt={director.name}
						className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-700"
					/>
				) : (
					<div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center ring-2 ring-gray-600">
						<span className="text-gray-400 text-lg">{director.name.charAt(0)}</span>
					</div>
				)}
			</div>
			<div className="flex-1 min-w-0">
				<p className="text-white font-medium truncate">{director.name}</p>
				<div className="flex items-center gap-2 text-xs">
					<span className="text-gray-400">{director.count} Films</span>
					<ScoreBadge score={director.avgScore} />
				</div>
			</div>
			{isTopThree && (
				<span className="text-2xl font-bold text-gray-600">#{rank}</span>
			)}
		</motion.div>
	)
}

function ActorCard({ actor }: { actor: CreatorStat }) {
	const profileImage = getProfileImage(actor.profilePath)

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.9 }}
			animate={{ opacity: 1, scale: 1 }}
			className="mb-10 flex flex-col items-center w-16"
		>
			<div className="relative">
				{profileImage ? (
					<img
						src={profileImage}
						alt={actor.name}
						className="w-14 h-14 rounded-full object-cover ring-2 ring-blue-500/50"
					/>
				) : (
					<div className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center ring-2 ring-blue-500/50">
						<span className="text-gray-400 text-xl">{actor.name.charAt(0)}</span>
					</div>
				)}
			</div>
			<p className="text-white text-xs font-medium mt-2 text-center truncate w-full">
				{actor.name.split(" ").pop()}
			</p>
			<p className="text-gray-400 text-[10px]">{actor.count} Films</p>
			<ScoreBadge score={actor.avgScore} />
		</motion.div>
	)
}

function CreatorLoadingSkeleton() {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
			<div>
				<div className="h-3 bg-gray-800 rounded w-24 mb-3 animate-pulse" />
				<div className="space-y-2">
					{[1, 2, 3, 4, 5].map((i) => (
						<div key={i} className="flex items-center gap-3 p-2">
							<div className="w-12 h-12 rounded-full bg-gray-800 animate-pulse" />
							<div className="flex-1">
								<div className="h-4 bg-gray-800 rounded w-32 mb-1 animate-pulse" />
								<div className="h-3 bg-gray-800 rounded w-20 animate-pulse" />
							</div>
						</div>
					))}
				</div>
			</div>
			<div>
				<div className="h-3 bg-gray-800 rounded w-20 mb-3 animate-pulse" />
				<div className="flex flex-wrap gap-4">
					{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
						<div key={i} className="flex flex-col items-center w-16">
							<div className="w-14 h-14 rounded-full bg-gray-800 animate-pulse" />
							<div className="h-3 bg-gray-800 rounded w-12 mt-2 animate-pulse" />
							<div className="h-4 bg-gray-800 rounded w-10 mt-1 animate-pulse" />
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
