import React, { type ReactNode } from "react"
import type { DNAItem } from "~/server/details.server"
import { DNATag } from "~/ui/dna/DNATag"
import { getDNAForCategory, getSortedCategories } from "~/ui/dna/dna_utils"
import Cycle from "~/ui/list/Cycle"
import type { Section } from "~/utils/scroll"

export interface DNAProps {
	dna: DNAItem[]
	navigateToSection: (section: Section) => void
}

export default function DNAPreview({ dna = [], navigateToSection }: DNAProps) {
	const hasDNA = Object.keys(dna).length > 0

	const sortedCategories = getSortedCategories(dna, false)
	const itemsToCycle = sortedCategories.reduce<ReactNode[]>(
		(items, category) => {
			const dnaForCategory = getDNAForCategory(dna, category)
			return [
				...items,
				...dnaForCategory.map((dnaItem) => (
					<div key={dnaItem.id} className="w-full flex items-center gap-2">
						<span className="font-semibold">{category}:</span>
						<DNATag
							id={dnaItem.id}
							category={dnaItem.category}
							label={dnaItem.label}
						/>
					</div>
				)),
			]
		},
		[],
	)

	return (
		<>
			{hasDNA && (
				<div className="w-full flex items-center flex-wrap gap-4 text-xs sm:text-sm">
					<Cycle items={itemsToCycle} />
					{/*<Sparkles>*/}
					{/*	<div*/}
					{/*		className="ml-1 py-0.5 accent-bg rounded-md pl-1 pr-2 flex items-center justify-center gap-2 font-semibold shadow-sm cursor-pointer"*/}
					{/*		onClick={() => navigateToSection(sections.dna)}*/}
					{/*		onKeyDown={() => null}*/}
					{/*	>*/}
					{/*		<img src={dnaIcon} className="h-3 sm:h-4 w-auto" alt="DNA Icon" />*/}
					{/*		Show DNA*/}
					{/*	</div>*/}
					{/*</Sparkles>*/}
				</div>
			)}
		</>
	)
}
