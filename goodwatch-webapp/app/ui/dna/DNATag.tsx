import React from "react"
import type { ExploreParams } from "~/server/explore.server"
import { getCategoryColor, mapCategoryToVectorName } from "~/ui/dna/utils"

export interface DNATagProps {
	type: ExploreParams["type"]
	category: string
	label: string
	linkDisabled?: boolean
}

export function DNATag({
	type,
	category,
	label,
	linkDisabled = false,
}: DNATagProps) {
	const vectorCategory = mapCategoryToVectorName(category)

	const tagElement = (
		<span
			className={`${getCategoryColor(category)} text-white text-sm border-gray-600 border-2 px-2 rounded-md`}
		>
			{label}
		</span>
	)

	return linkDisabled ? (
		tagElement
	) : (
		<a
			href={
				linkDisabled ? undefined : `/explore/all/${vectorCategory}/${label}`
			}
		>
			{tagElement}
		</a>
	)
}
