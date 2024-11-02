import { Link } from "@remix-run/react"
import React from "react"
import { getCategoryColor, mapCategoryToVectorName } from "~/ui/dna/dna_utils"

export interface DNATagProps {
	category: string
	label: string
	onClick?: () => void
	linkDisabled?: boolean
}

export function DNATag({ category, label, linkDisabled = false }: DNATagProps) {
	const vectorCategory = mapCategoryToVectorName(category)

	const tagElement = (
		<span
			className={`px-2 py-1 ${getCategoryColor(category)} text-white text-xs xs:text-sm sm:text-base border-gray-600 border-2 rounded-md`}
		>
			{label}
		</span>
	)

	return linkDisabled ? (
		tagElement
	) : (
		<Link to={`/explore/all/${vectorCategory}/${label}`} prefetch="intent">
			{tagElement}
		</Link>
	)
}
