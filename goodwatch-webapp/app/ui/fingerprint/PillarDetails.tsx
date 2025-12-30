import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { PillarName } from "~/ui/fingerprint/Pillars"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"

const PILLAR_ATTRIBUTES: Record<PillarName, readonly string[]> = {
	Energy: ['adrenaline', 'tension', 'scare', 'fast_pace', 'spectacle', 'violence'],
	Heart: ['romance', 'wholesome', 'pathos', 'melancholy', 'hopefulness', 'catharsis', 'nostalgia', 'coming_of_age', 'family_dynamics', 'wonder'],
	Humor: ['situational_comedy', 'wit_wordplay', 'physical_comedy', 'cringe_humor', 'absurdist_humor', 'satire_parody', 'dark_humor'],
	World: ['world_immersion', 'dialogue_centrality', 'rewatchability', 'ambiguity', 'novelty'],
	Craft: ['direction', 'acting', 'narrative_structure', 'dialogue_quality', 'character_depth', 'intrigue', 'complexity', 'non_linear_narrative', 'meta_narrative'],
	Style: ['cinematography', 'editing', 'music_composition', 'visual_stylization', 'music_centrality', 'sound_centrality'],
}

const PILLAR_DESCRIPTIONS: Record<PillarName, string> = {
	Energy: "Intensity, action, and adrenaline-pumping moments",
	Heart: "Emotional depth, relationships, and feelings",
	Humor: "Comedy styles and what makes you laugh",
	World: "Immersion, setting, and rewatchability",
	Craft: "Storytelling quality and narrative techniques",
	Style: "Visual and audio aesthetics",
}

interface PillarDetailsProps {
	pillar: PillarName | null
	scores?: Record<string, number>
}

export default function PillarDetails({ pillar, scores }: PillarDetailsProps) {
	if (!pillar) {
		return (
			<div className="flex items-center justify-center h-full text-gray-500 text-sm italic">
				Select a pillar to explore its attributes
			</div>
		)
	}

	const attributes = PILLAR_ATTRIBUTES[pillar]
	const config = PILLAR_CONFIG[pillar]
	const description = PILLAR_DESCRIPTIONS[pillar]

	const sortedAttributes = [...attributes].sort((a, b) => {
		const scoreA = scores?.[a] ?? 0
		const scoreB = scores?.[b] ?? 0
		return scoreB - scoreA
	})

	const topAttributes = sortedAttributes.slice(0, 6)

	return (
		<AnimatePresence mode="wait">
			<motion.div
				key={pillar}
				initial={{ opacity: 0, x: 10 }}
				animate={{ opacity: 1, x: 0 }}
				exit={{ opacity: 0, x: -10 }}
				transition={{ duration: 0.2 }}
				className="h-full mt-4"
			>
				<div className="flex flex-col md:flex-row md:items-end gap-1 mb-8 text-lg text-left">
					<h4 className="font-bold text-white">{config.emoji} {pillar}:</h4>
					<p className="ml-2 text-gray-400">{description}</p>
				</div>

				<div className="space-y-2">
					{topAttributes.map((attr, index) => {
						const meta = getFingerprintMeta(attr)
						const score = scores?.[attr] ?? 0
						const normalizedScore = Math.min(score / 10, 1)
						
						const fontSize = 0.7 + normalizedScore * 0.4
						const opacity = 0.5 + normalizedScore * 0.5

						return (
							<motion.div
								key={attr}
								initial={{ opacity: 0, y: 5 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: index * 0.03 }}
								className="flex items-center gap-8"
							>
								<div className="flex items-center gap-2 w-52 text-left">
									<span className="text-xs">{meta.emoji}</span>
									<span 
										className="text-white truncate"
										style={{ 
											fontSize: `${fontSize}rem`,
											opacity,
										}}
									>
										{meta.label}
									</span>
								</div>
								{score > 0 && (
									<div 
										className="h-2 rounded-xs bg-white/20"
										style={{ width: '60px' }}
									>
										<div 
											className="h-full rounded-full transition-all"
											style={{ 
												width: `${normalizedScore * 100}%`,
												backgroundColor: meta.color.replace('0.6', '0.9'),
											}}
										/>
									</div>
								)}
							</motion.div>
						)
					})}
				</div>
			</motion.div>
		</AnimatePresence>
	)
}
