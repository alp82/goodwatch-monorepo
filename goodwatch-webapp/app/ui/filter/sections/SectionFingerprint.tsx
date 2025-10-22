import React from "react"
import type { DiscoverParams } from "~/server/discover.server"
import { discoverFilters } from "~/server/types/discover-types"
import EditableSection from "~/ui/filter/sections/EditableSection"
import { useNav } from "~/utils/navigation"
import { Tag } from "~/ui/tags/Tag"

const TIER_OPTIONS = [
	{ value: "1", label: "Low", color: "bg-emerald-600" },
	{ value: "2", label: "Mid", color: "bg-amber-500" },
	{ value: "3", label: "High", color: "bg-rose-600" },
]

const PILLARS = [
	{ name: "Energy", emoji: "⚡", description: "Action, pace, intensity" },
	{ name: "Heart", emoji: "❤️", description: "Emotion, relationships, drama" },
	{ name: "Humor", emoji: "🎭", description: "Comedy, wit, levity" },
	{ name: "World", emoji: "🌍", description: "Setting, worldbuilding, scope" },
	{ name: "Craft", emoji: "🛠️", description: "Technical execution, production" },
	{ name: "Style", emoji: "🎨", description: "Visual aesthetics, cinematography" },
]

interface SectionFingerprintParams {
	params: DiscoverParams
	editing: boolean
	onEdit: () => void
	onClose: () => void
}

export default function SectionFingerprint({
	params,
	editing,
	onEdit,
	onClose,
}: SectionFingerprintParams) {
	const { fingerprintPillars = "", fingerprintPillarMinTier = "1" } = params

	// Parse pillar names: "Energy,Heart,Humor"
	const selectedPillarNames = fingerprintPillars
		.split(",")
		.filter(Boolean)
		.map((name) => name.trim())

	const { updateQueryParams } = useNav<Pick<DiscoverParams, "fingerprintPillars" | "fingerprintPillarMinTier">>()

	const handleTierChange = (tier: string) => {
		updateQueryParams({ fingerprintPillarMinTier: tier })
	}

	const handleTogglePillar = (pillarName: string) => {
		const isSelected = selectedPillarNames.includes(pillarName)
		let updatedPillars: string[]
		
		if (isSelected) {
			updatedPillars = selectedPillarNames.filter((name) => name !== pillarName)
		} else {
			updatedPillars = [...selectedPillarNames, pillarName]
		}
		
		updateQueryParams({ 
			fingerprintPillars: updatedPillars.join(",")
		})
	}

	const handleRemovePillar = (pillarName: string) => {
		const updatedPillars = selectedPillarNames.filter((name) => name !== pillarName)
		updateQueryParams({ 
			fingerprintPillars: updatedPillars.join(",")
		})
	}

	const handleRemoveAll = () => {
		updateQueryParams({
			fingerprintPillars: "",
			fingerprintPillarMinTier: "1",
		})
		onClose()
	}

	const selectedTier = TIER_OPTIONS.find((t) => t.value === fingerprintPillarMinTier) || TIER_OPTIONS[0]

	return (
		<EditableSection
			label={discoverFilters.fingerprint.label}
			color={discoverFilters.fingerprint.color}
			visible={selectedPillarNames.length > 0}
			editing={editing}
			active={true}
			onEdit={onEdit}
			onClose={onClose}
			onRemoveAll={handleRemoveAll}
		>
			{(isEditing) => (
				<div className="flex flex-col flex-wrap gap-4">
					{isEditing && (
						<div className="flex flex-col gap-4">
							<div className="flex flex-col gap-2">
								<span className="text-sm font-semibold">Select Pillars:</span>
								<div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-2">
									{PILLARS.map((pillar) => {
										const isSelected = selectedPillarNames.includes(pillar.name)
										return (
											<button
												key={pillar.name}
												type="button"
												onClick={() => handleTogglePillar(pillar.name)}
												className={`
													px-3 py-2 rounded text-sm font-medium transition-all
													flex items-center gap-2 text-left
													${isSelected 
														? "bg-indigo-600 text-white ring-2 ring-indigo-400" 
														: "bg-gray-700 text-gray-300 hover:bg-gray-600"
													}
												`}
												title={pillar.description}
											>
												<span className="text-lg">{pillar.emoji}</span>
												<span>{pillar.name}</span>
											</button>
										)
									})}
								</div>
								<p className="text-xs text-gray-400 mt-1">
									Select pillars to find titles that excel in these areas
								</p>
							</div>
							
							{selectedPillarNames.length > 0 && (
								<div className="flex flex-col gap-2">
									<span className="text-sm font-semibold">Minimum Tier:</span>
									<div className="flex flex-wrap gap-2">
										{TIER_OPTIONS.map((tier) => (
											<button
												key={tier.value}
												type="button"
												onClick={() => handleTierChange(tier.value)}
												className={`
													px-3 py-1 rounded text-sm font-medium transition-colors
													${tier.value === fingerprintPillarMinTier 
														? `${tier.color} text-white ring-2 ring-white/50` 
														: "bg-gray-700 text-gray-300 hover:bg-gray-600"
													}
												`}
											>
												{tier.label}
											</button>
										))}
									</div>
									<p className="text-xs text-gray-400 mt-1">
										{selectedTier.label} = titles must score {
											selectedTier.value === "3" ? "8+" : 
											selectedTier.value === "2" ? "6+" : "4+"
										}/10 in selected pillars (higher = more selective)
									</p>
								</div>
							)}
						</div>
					)}
					<div className="flex flex-wrap items-center gap-2">
						{selectedPillarNames.length > 0 ? (
							<>
								<span>With</span>
								{selectedPillarNames.map((pillarName) => {
									const pillar = PILLARS.find((p) => p.name === pillarName)
									return (
										<Tag
											key={pillarName}
											onRemove={isEditing ? () => handleRemovePillar(pillarName) : undefined}
										>
											<span className="flex items-center gap-1">
												<span>{pillar?.emoji}</span>
												<span>{pillarName}</span>
											</span>
										</Tag>
									)
								})}
								<span>at {selectedTier.label}+ tier</span>
							</>
						) : null}
					</div>
				</div>
			)}
		</EditableSection>
	)
}
