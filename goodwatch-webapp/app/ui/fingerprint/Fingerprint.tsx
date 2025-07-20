import React from "react"
import type { FingerprintResult } from "~/server/utils/fingerprint"
import { BadgeCard } from "./BadgeCard"
import type { GenreBlend, Highlight } from "~/server/utils/mediaDNA"

export interface FingerprintProps {
	fingerprint: FingerprintResult | null
}

export function Fingerprint({ fingerprint }: FingerprintProps) {
	if (!fingerprint) {
		return <div className="text-center p-8">No fingerprint data available.</div>
	}

	const { overview, tags, mediaDNA, socialSuitability, viewingContext } = fingerprint

	return (
		<div className="space-y-8 p-4 md:p-6 lg:p-8 bg-gray-900 text-gray-200 font-sans">
			{/* Overview Section */}
			<div className="mb-10 text-center">
				<h1 className="text-3xl font-bold text-white mb-2">{overview.title}</h1>
				<p className="text-lg text-gray-400 max-w-3xl mx-auto">{overview.body}</p>
			</div>

			{/* Tags Section */}
			{tags && tags.length > 0 && (
				<div className="mb-10 text-center">
					<div className="flex flex-wrap justify-center gap-2">
						{tags.map((tag) => (
							<span key={tag.name} className="bg-gray-700 text-gray-200 px-3 py-1 rounded-full text-sm font-medium">
								{tag.name}
							</span>
						))}
					</div>
				</div>
			)}

			{/* Viewing Guide: Social Suitability & Viewing Context */}
			{(socialSuitability.length > 0 || viewingContext.length > 0) && (
				<div className="mb-10">
					<h2 className="text-2xl font-bold text-white mb-4">Viewing Guide</h2>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
						{socialSuitability.length > 0 && (
							<div>
								<h3 className="text-xl font-semibold text-white mb-3">Best Enjoyed...</h3>
								<div className="space-y-3">
									{socialSuitability.map((item) => (
										<div key={item.id}>
											<p className="font-medium text-gray-200">{item.name}</p>
											<p className="text-sm text-gray-400">{item.description}</p>
										</div>
									))}
								</div>
							</div>
						)}
						{viewingContext.length > 0 && (
							<div>
								<h3 className="text-xl font-semibold text-white mb-3">Viewing Experience</h3>
								<div className="space-y-3">
									{viewingContext.map((item) => (
										<div key={item.id}>
											<p className="font-medium text-gray-200">{item.name}</p>
											<p className="text-sm text-gray-400">{item.description}</p>
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				</div>
			)}

			{/* Level 3: Double Features */}
			{mediaDNA.doubleFeatures && mediaDNA.doubleFeatures.length > 0 && (
				<div className="mb-10">
					<h2 className="text-2xl font-bold text-white mb-4">Double Features</h2>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{mediaDNA.doubleFeatures.map(feature => (
							<BadgeCard key={feature.id} feature={feature} />
						))}
					</div>
				</div>
			)}

			{/* Level 1: Genre Blends */}
			{mediaDNA.genreBlends && mediaDNA.genreBlends.length > 0 && (
				<div className="mb-10">
					<h2 className="text-2xl font-bold text-white mb-4">Genre Blends</h2>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
						{mediaDNA.genreBlends.map((blend: GenreBlend) => (
							<div key={blend.id} className="bg-gray-800/60 p-5 rounded-lg border border-gray-700 shadow-lg backdrop-blur-sm">
								<h3 className="text-xl font-semibold text-white mb-2">{blend.name}</h3>
								<p className="text-gray-400 text-sm mb-4">{blend.description}</p>
								<div className="w-full bg-gray-700 rounded-full h-2.5">
									<div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${blend.score * 10}%` }}></div>
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Level 2: Highlights */}
			{mediaDNA.highlights && mediaDNA.highlights.length > 0 && (
				<div className="mt-8">
					<h2 className="text-2xl font-bold text-white mb-4">Highlights</h2>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
						{mediaDNA.highlights.map((highlight: Highlight) => (
							<div key={highlight.id} className="bg-gray-800/60 p-4 rounded-lg border border-gray-700 flex flex-col text-center items-center shadow-lg backdrop-blur-sm h-full">
								<span className="text-3xl mb-2">{highlight.icon}</span>
								<h4 className="font-bold text-white text-md mb-1">{highlight.name}</h4>
								<div className="w-full bg-gray-700 rounded-full h-2 mt-auto">
									<div className="bg-green-500 h-2 rounded-full" style={{ width: `${highlight.score * 10}%` }}></div>
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	)
}
