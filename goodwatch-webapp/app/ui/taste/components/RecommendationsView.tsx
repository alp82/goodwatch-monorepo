import { useState } from "react"
import { Link } from "@remix-run/react"
import { ArrowRightIcon } from "@heroicons/react/24/outline"
import type { Recommendation } from "../types"
import type { Feature } from "../features"
import type { FingerprintPreviewResult, FingerprintRecommendation } from "~/server/fingerprint-preview.server"
import RecommendationSwiper from "./RecommendationSwiper"
import StartOverButton from "./StartOverButton"
import FingerprintTabs from "./FingerprintTabs"
import FingerprintPosters from "./FingerprintPosters"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"

interface RecommendationsViewProps {
	variant?: 'regular' | 'fingerprint'
	recommendations: Recommendation[]
	currentFeature: Feature
	ratingsCount: number
	onStartOver: () => void
	fingerprintData?: FingerprintPreviewResult
	isGuest?: boolean
}

function getAccuracyLabel(ratingsCount: number): { label: string; color: string } {
	if (ratingsCount < 10) return { label: "Accuracy improving with each rating", color: "text-orange-400" }
	if (ratingsCount < 20) return { label: "Accuracy improving with each rating", color: "text-yellow-400" }
	return { label: "Accuracy improving with each rating", color: "text-green-400" }
}

export default function RecommendationsView({
	variant = 'regular',
	recommendations,
	currentFeature,
	ratingsCount,
	onStartOver,
	fingerprintData,
	isGuest = false,
}: RecommendationsViewProps) {
	const accuracy = getAccuracyLabel(ratingsCount)
	
	// State for fingerprint tabs
	const [selectedKey, setSelectedKey] = useState<string | null>(
		variant === 'fingerprint' && fingerprintData?.topKeys?.[0]?.key 
			? fingerprintData.topKeys[0].key 
			: null
	)
	
	const currentRecommendations = variant === 'fingerprint' && selectedKey && fingerprintData
		? fingerprintData.recommendations[selectedKey] || []
		: []

	return (
		<div 
			className="relative w-full flex flex-col bg-gray-900/95 rounded-2xl border border-gray-700/50 backdrop-blur-sm"
		>
			{/* Header with accuracy indicator */}
			<div className="flex flex-col px-4 md:px-6 py-2 md:py-4 border-b border-gray-700/50 bg-gray-800/50">
				<div>
					<h3 className="text-lg md:text-2xl font-semibold text-white">
						{currentFeature.icon} {currentFeature.name}
					</h3>
					<div className="text-sm md:text-lg text-gray-400">
						Based on {ratingsCount} ratings · <span className={accuracy.color}>{accuracy.label}</span>
					</div>
				</div>
			</div>

			{/* Content Area */}
			<div className="flex-1 px-4 md:px-6 py-4 overflow-hidden">
				{variant === 'fingerprint' && fingerprintData ? (
					<div className="h-full flex flex-col gap-2">
						{/* Fingerprint Tabs */}
						<FingerprintTabs
							keys={fingerprintData.topKeys}
							selectedKey={selectedKey}
							onSelectKey={setSelectedKey}
						/>
						
						{/* Fingerprint Content */}
						{selectedKey && currentRecommendations.length > 0 && (
							<>
								<div className="my-1 md:my-4">
									<h4 className="flex flex-col md:flex-row md:gap-2 text-md">
										<span className="text-gray-400">Your picks with:</span>
										<span className="text-white font-bold">{getFingerprintMeta(selectedKey).description}</span>
										
									</h4>
								</div>
								<RecommendationSwiper recommendations={currentRecommendations} />
							</>
						)}
					</div>
				) : (
					<RecommendationSwiper recommendations={recommendations} />
				)}
			</div>

			{/* Footer Actions */}
			{isGuest && <div className="flex flex-col px-4 md:px-6 py-2 md:py-4 border-t border-gray-700/50 bg-gray-800/50">
				<StartOverButton onStartOver={onStartOver} />
			</div>}

		</div>
	)
}
