import { Link } from "@remix-run/react"
import React from "react"
import { getCategoryColor, mapCategoryToVectorName } from "~/ui/dna/utils"

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
			className={`${getCategoryColor(category)} text-white text-base border-gray-600 border-2 px-2 py-1 rounded-md`}
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
