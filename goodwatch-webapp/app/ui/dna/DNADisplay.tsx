import React, { type ReactNode } from "react"
import dnaIcon from "~/img/dna-icon.svg"
import type { DNA } from "~/server/details.server"
import Sparkles from "~/ui/Sparkles"
import { getCategoryColor, getSortedCategories } from "~/ui/dna/utils"
import Cycle from "~/ui/list/Cycle"
import { useDetailsTab } from "~/utils/navigation"

export interface DNAProps {
	dna: DNA
}

export default function DNADisplay({ dna }: DNAProps) {
	const hasDNA = Object.keys(dna).length > 0

	const { handleDNATab } = useDetailsTab()

	const sortedCategories = getSortedCategories(dna, false)
	const itemsToCycle = sortedCategories
		.reduce<ReactNode[]>((items, category) => {
			return [
				...items,
				...dna[category].map((label) => (
					<div key={`${category}-${label}`} className="flex gap-2 w-full">
						{category}:
						<span
							className={`${getCategoryColor(category)} text-white text-sm border-gray-600 border-2 px-2 rounded-md`}
						>
							{label}
						</span>
					</div>
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
							className="ml-1 h-7 accent-bg rounded-md pl-1 pr-2 flex items-center justify-center gap-2 text-sm font-semibold shadow-sm cursor-pointer"
							onClick={handleDNATab}
						>
							<img src={dnaIcon} className="h-5 w-auto" alt="DNA Icon" />
							Show DNA
						</div>
					</Sparkles>
					<Cycle items={itemsToCycle} />
				</div>
			)}
		</>
	)
}
