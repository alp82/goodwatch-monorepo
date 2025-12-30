import React from 'react'
import type { PillarTiers } from '~/server/utils/fingerprint'

export type PillarName = 'Energy' | 'Heart' | 'Humor' | 'World' | 'Craft' | 'Style'

interface Props { 
	pillars?: PillarTiers
	className?: string
	selectedPillar?: PillarName | null
	onSelect?: (pillar: PillarName) => void
}

const PILLAR_CONFIG = {
	Energy: { emoji: '⚡', colors: ['text-amber-700', 'text-amber-600', 'text-amber-500', 'text-amber-400'] },
	Heart: { emoji: '❤️', colors: ['text-rose-700', 'text-rose-600', 'text-rose-500', 'text-rose-400'] },
	Humor: { emoji: '🎭', colors: ['text-teal-700', 'text-teal-600', 'text-teal-500', 'text-teal-400'] },
	World: { emoji: '🌍', colors: ['text-emerald-700', 'text-emerald-600', 'text-emerald-500', 'text-emerald-400'] },
	Craft: { emoji: '🛠️', colors: ['text-violet-700', 'text-violet-600', 'text-violet-500', 'text-violet-400'] },
	Style: { emoji: '🎨', colors: ['text-sky-700', 'text-sky-600', 'text-sky-500', 'text-sky-400'] },
} as const

export { PILLAR_CONFIG }

export default function Pillars({ pillars, className = '', selectedPillar, onSelect }: Props): JSX.Element {
	const isInteractive = !!onSelect
	const renderMeter = (tier: number | undefined, colors: readonly string[]) => {
		if (tier === undefined) {
			const emptyBars = '░'.repeat(4)
			return <span className="font-mono text-lg text-gray-600">{emptyBars}</span>
		}
		
		const isPerfect = tier === 4
		const filled = '█'.repeat(tier)
		const empty = '░'.repeat(4 - tier)
		
		const coloredBlocks = Array.from({ length: tier }, (_, i) => (
			<span key={i} className={`${colors[i]} brightness-125`}>{filled[i]}</span>
		))
		
		return (
			<span className={`font-mono text-lg w-13 ${isPerfect ? 'border-2 border-slate-300/50 animate-pulse' : ''}`}>
				{isPerfect && (
					<span className="absolute inset-0 -mx-1 w-13 rounded "></span>
				)}
				{coloredBlocks}
				<span className="text-gray-600">{empty}</span>
			</span>
		)
	}

	return (
		<div className={`grid grid-cols-1 gap-2 ${className}`}>
			{Object.entries(PILLAR_CONFIG).map(([pillarName, config]) => {
				const tier = pillars?.[pillarName as keyof PillarTiers]
				const isSelected = selectedPillar === pillarName
				
				return (
					<button 
						key={pillarName}
						type="button"
						onClick={() => onSelect?.(pillarName as PillarName)}
						disabled={!isInteractive}
						className={`
							grid grid-cols-2 items-center gap-4 px-3 py-2 rounded-lg transition-all
							${isInteractive ? 'cursor-pointer hover:bg-white/10' : ''}
							${isSelected ? 'bg-white/15 ring-1 ring-white/30' : ''}
						`}
					>
						<div className="mr-2 flex items-center gap-2">
							<span className="text-lg">{config.emoji}</span>
							<span className="font-medium">{pillarName}</span>
						</div>
						{renderMeter(tier, config.colors)}
					</button>
				)
			})}
		</div>
	)
}
