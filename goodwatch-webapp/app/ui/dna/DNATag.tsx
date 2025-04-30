import { Link } from "@remix-run/react"
import React from "react"
import { type DNACategoryName, getCategoryColor } from "~/ui/dna/dna_utils"
import { SEPARATOR_SECONDARY, SEPARATOR_TERTIARY } from "~/utils/navigation"

export interface DNATagProps {
	id: number
	category: DNACategoryName
	label: string
	size?: "normal" | "small"
	onClick?: () => void
	linkDisabled?: boolean
}

export function DNATag({
	id,
	category,
	label,
	size = "normal",
	linkDisabled = false,
}: DNATagProps) {
	const tagElement = (
		<span
			className={`px-2 py-0.5 ${getCategoryColor(category)}/50 hover:brightness-125 text-white text-xs sm:text-sm md:text-md border-gray-600 border-2 rounded-md`}
		>
			{label}
		</span>
	)

	return linkDisabled ? (
		tagElement
	) : (
		<Link
			to={`/discover?type=all&similarDNA=${id}${SEPARATOR_SECONDARY}${category}${SEPARATOR_TERTIARY}${label}&similarDNACombinationType=any`}
			prefetch="intent"
		>
			{tagElement}
		</Link>
	)
}
