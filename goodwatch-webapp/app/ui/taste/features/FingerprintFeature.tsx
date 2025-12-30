import { motion } from "framer-motion"
import { useTasteFingerprint } from "~/routes/api.taste-profile.fingerprint"
import type { Feature } from "../features"
import type { FingerprintStat } from "~/server/taste-profile.server"
import { FINGERPRINT_META } from "~/ui/fingerprint/fingerprintMeta"

interface FingerprintFeatureProps {
	feature: Feature
	ratingsCount: number
}

const PREVIEW_COUNT = 5
const FULL_COUNT = 20

function parseColor(rgba: string): { r: number; g: number; b: number } {
	const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
	if (match) {
		return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) }
	}
	return { r: 128, g: 128, b: 128 }
}

type CardSize = "large" | "medium" | "small"

function getCardSize(index: number, score: number): CardSize {
	if (index <= 3) return "large"
	if (index <= 7) return "medium"
	return "small"
}

export default function FingerprintFeature({ feature, ratingsCount }: FingerprintFeatureProps) {
	const { data: fingerprintData, isLoading } = useTasteFingerprint()
	const isFullFingerprint = feature.id === "fingerprint_detection"
	const stats = isFullFingerprint ? fingerprintData?.allKeys : fingerprintData?.topKeys

	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			className="rounded-xl border border-gray-700/50 bg-gray-900/50 overflow-hidden"
		>
			<div className="flex items-center gap-3 p-4 border-b border-gray-700/50 bg-gray-800/30">
				<span className="text-2xl">{feature.icon}</span>
				<div className="flex-1">
					<h3 className="font-semibold text-white">Taste Fingerprint</h3>
					<p className="text-sm text-gray-400">
						The emotional DNA of your movie history
					</p>
				</div>
			</div>
			<div className="p-4">
				{isLoading ? (
					<FingerprintLoadingSkeleton isPreview={!isFullFingerprint} />
				) : (
					<FingerprintCards stats={stats || []} isPreview={!isFullFingerprint} />
				)}
			</div>
		</motion.div>
	)
}

function FingerprintCards({ stats, isPreview }: { stats: FingerprintStat[]; isPreview: boolean }) {
	if (stats.length === 0) {
		return <p className="text-gray-500 text-sm">Rate more titles to see your taste fingerprint.</p>
	}

	const displayStats = isPreview ? stats.slice(0, PREVIEW_COUNT) : stats.slice(0, FULL_COUNT)
	const topTraits = displayStats.slice(0, 3)

	return (
		<div className="space-y-4">
			{!isPreview && topTraits.length > 0 && (
				<div className="p-3 rounded-lg bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/20">
					<p className="text-sm text-gray-300">
						<span className="text-purple-400 font-medium">Your taste signature:</span>{" "}
						You're drawn to <span className="text-white font-medium">{topTraits[0]?.label.toLowerCase()}</span>
						{topTraits[1] && <>, <span className="text-white font-medium">{topTraits[1]?.label.toLowerCase()}</span></>}
						{topTraits[2] && <>, and <span className="text-white font-medium">{topTraits[2]?.label.toLowerCase()}</span></>}
						{" "}in your viewing choices.
					</p>
				</div>
			)}

			<div className="grid grid-cols-6 gap-2 auto-rows-[100px]">
				{displayStats.map((stat, i) => (
					<FingerprintCard 
						key={stat.key} 
						stat={stat} 
						index={i} 
						size={getCardSize(i, stat.normalizedScore)}
					/>
				))}
			</div>

			{isPreview && stats.length > PREVIEW_COUNT && (
				<p className="text-gray-500 text-sm text-center pt-2">
					Unlock full fingerprint at 100 ratings to see all {stats.length} traits
				</p>
			)}
		</div>
	)
}

function FingerprintCard({ stat, index, size }: { stat: FingerprintStat; index: number; size: CardSize }) {
	const meta = FINGERPRINT_META[stat.key]
	const color = meta?.color || "rgba(128, 128, 128, 0.6)"
	const { r, g, b } = parseColor(color)

	const circumference = 2 * Math.PI * 42
	const strokeDashoffset = circumference - (stat.normalizedScore / 100) * circumference

	const sizeConfig = {
		large: {
			gridClass: "col-span-2 row-span-2",
			circleSize: "w-24 h-24",
			emojiSize: "text-4xl",
			labelSize: "text-base",
			strokeWidth: 10,
		},
		medium: {
			gridClass: "col-span-2 row-span-1",
			circleSize: "w-14 h-14",
			emojiSize: "text-2xl",
			labelSize: "text-xs",
			strokeWidth: 8,
		},
		small: {
			gridClass: "col-span-1 row-span-1",
			circleSize: "w-12 h-12",
			emojiSize: "text-xl",
			labelSize: "text-[10px]",
			strokeWidth: 6,
		},
	}

	const config = sizeConfig[size]

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.8 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ delay: index * 0.03 }}
			className={`${config.gridClass} flex flex-col items-center justify-center p-2 rounded-xl bg-gray-800/50 hover:bg-gray-800 transition-colors cursor-pointer`}
		>
			<div className={`relative ${config.circleSize}`}>
				<svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
					<circle
						cx="50"
						cy="50"
						r="42"
						fill="none"
						stroke="rgb(55, 65, 81)"
						strokeWidth={config.strokeWidth}
					/>
					<motion.circle
						cx="50"
						cy="50"
						r="42"
						fill="none"
						stroke={`rgb(${r}, ${g}, ${b})`}
						strokeWidth={config.strokeWidth}
						strokeLinecap="round"
						strokeDasharray={circumference}
						initial={{ strokeDashoffset: circumference }}
						animate={{ strokeDashoffset }}
						transition={{ duration: 0.8, delay: index * 0.03, ease: "easeOut" }}
					/>
				</svg>
				<div className="absolute inset-0 flex items-center justify-center">
					<span className={config.emojiSize}>{stat.emoji}</span>
				</div>
			</div>
			<p className={`${config.labelSize} font-medium text-white mt-2 text-center leading-tight`}>
				{stat.label}
			</p>
			{size === "large" && <p className="text-xs text-gray-400 mt-2">{stat.description}</p>}
		</motion.div>
	)
}

function FingerprintLoadingSkeleton({ isPreview }: { isPreview: boolean }) {
	return (
		<div className="grid grid-cols-5 gap-2 auto-rows-[100px]">
			<div className="col-span-2 row-span-2 flex flex-col items-center justify-center p-2 rounded-xl bg-gray-800/50">
				<div className="w-24 h-24 rounded-full bg-gray-700 animate-pulse" />
				<div className="h-4 bg-gray-700 rounded w-16 mt-2 animate-pulse" />
			</div>
			{Array.from({ length: isPreview ? 3 : 8 }).map((_, i) => (
				<div key={i} className="col-span-1 row-span-1 flex flex-col items-center justify-center p-2 rounded-xl bg-gray-800/50">
					<div className="w-14 h-14 rounded-full bg-gray-700 animate-pulse" />
					<div className="h-3 bg-gray-700 rounded w-12 mt-2 animate-pulse" />
				</div>
			))}
		</div>
	)
}
