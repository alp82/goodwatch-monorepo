import React, { type ReactNode } from "react"
import dnaIcon from "~/img/dna-icon.svg"
import type { DNA } from "~/server/details.server"
import type { ExploreParams } from "~/server/explore.server"
import Sparkles from "~/ui/Sparkles"
import { sections } from "~/ui/details/common"
import { DNATag } from "~/ui/dna/DNATag"
import { getCategoryColor, getSortedCategories } from "~/ui/dna/utils"
import Cycle from "~/ui/list/Cycle"
import type { Section } from "~/utils/scroll"

export interface DNAProps {
	dna: DNA
	navigateToSection: (section: Section) => void
}

export default function DNAPreview({ dna = {}, navigateToSection }: DNAProps) {
	const hasDNA = Object.keys(dna).length > 0

	const sortedCategories = getSortedCategories(dna, false)
	const itemsToCycle = sortedCategories
		.reduce<ReactNode[]>((items, category) => {
			return [
				...items,
				...dna[category].map((label) => (
					<button
						key={`${category}-${label}`}
						type="button"
						className="py-1 px-3 flex items-center gap-2 w-full bg-gray-700 border-2 border-gray-700 hover:bg-gray-600 hover:border-gray-500 rounded-md"
						onClick={() => navigateToSection(sections.dna)}
					>
						<span className="font-semibold">{category}:</span>
						<DNATag category={category} label={label} linkDisabled={true} />
					</button>
				)),
			]
		}, [])
		.sort(() => Math.random() - 0.5)

	return (
		<>
			{hasDNA && (
				<div className="mb-4 sm:mb-0 flex flex-col sm:flex-row sm:items-center flex-wrap gap-3 sm:gap-4">
					<Sparkles>
						<div
							className="ml-1 py-2 accent-bg rounded-md pl-1 pr-2 flex items-center justify-center gap-2 text-base font-semibold shadow-sm cursor-pointer"
							onClick={() => navigateToSection(sections.dna)}
							onKeyDown={() => null}
						>
							<img src={dnaIcon} className="h-6 w-auto" alt="DNA Icon" />
							Show DNA
						</div>
					</Sparkles>
					<Cycle items={itemsToCycle} />
				</div>
			)}
		</>
	)
}
