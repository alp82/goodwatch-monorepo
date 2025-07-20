import React, { useState } from "react"

// A generic interface for badge-like features like Double Features
export interface FeatureData {
	name: string
	description: string
	icon: string
	score: number
}

export interface BadgeCardProps {
	feature: FeatureData
}

export function BadgeCard({ feature }: BadgeCardProps) {
	const [isExpanded, setIsExpanded] = useState(false)

	const details = {
		icon: feature.icon,
		label: feature.name,
		description: feature.description,
		// Using static colors for now, can be customized later
		primaryColor: "#4A5568", // gray-700
		secondaryColor: "#718096", // gray-600
	}

	if (!feature) {
		return null
	}

	return (
		<div
			className="rounded-lg p-4 transition-all duration-300 ease-in-out"
			style={{
				background: `linear-gradient(135deg, ${details.primaryColor} 0%, ${details.secondaryColor} 100%)`,
			}}
		>
			<div className="flex items-center justify-between">
				<div className="flex items-center">
					<span className="text-2xl mr-3">{details.icon}</span>
					<h4 className="font-bold text-white text-lg">{details.label}</h4>
					<span className="ml-2 text-sm font-semibold text-gray-300 bg-gray-800 bg-opacity-50 px-2 py-1 rounded-full">{`${Math.round(
						feature.score
					)}`}</span>
				</div>
				<button
					onClick={() => setIsExpanded(!isExpanded)}
					className="text-white font-bold text-xl"
				>
					{isExpanded ? "−" : "+"}
				</button>
			</div>
			{isExpanded && (
				<div className="mt-3 text-white">
					<p>{details.description}</p>
				</div>
			)}
		</div>
	)
}
