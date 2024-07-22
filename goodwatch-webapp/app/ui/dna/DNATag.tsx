import React from "react"
import type { ExploreParams } from "~/server/explore.server"
import { getCategoryColor, mapCategoryToVectorName } from "~/ui/dna/utils"

export interface DNATagProps {
	type: ExploreParams["type"]
	category: string
	label: string
}

export function DNATag({ type, category, label }: DNATagProps) {
	const vectorCategory = mapCategoryToVectorName(category)

	return (
		<a href={`/explore/${type}/${vectorCategory}/${label}`}>
			<span
				className={`${getCategoryColor(category)} text-white text-sm border-gray-600 border-2 px-2 rounded-md`}
			>
				{label}
			</span>
		</a>
	)
}
