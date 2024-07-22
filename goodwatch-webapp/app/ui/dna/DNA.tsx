import React from "react"
import { Spoiler } from "spoiled"
import type { DNA } from "~/server/details.server"
import type { ExploreParams } from "~/server/explore.server"
import InfoBox from "~/ui/InfoBox"
import { DNATag } from "~/ui/dna/DNATag"
import {
	getCategoryColor,
	getSortedCategories,
	spoilerCategories,
} from "~/ui/dna/utils"

export interface DNAProps {
	type: ExploreParams["type"]
	dna: DNA
}

export default function DNADisplay({ type, dna = {} }: DNAProps) {
	const hasDNA = Object.keys(dna).length > 0
	const sortedCategories = getSortedCategories(dna)

	const [revealSpoiler, setRevealSpoiler] = React.useState(false)
	const handleRevealSpoiler = () => {
		setRevealSpoiler(true)
	}

	return (
		<div id="tab-details-dna">
			{hasDNA ? (
				<>
					{sortedCategories.map((category) => (
						<dl key={category} className="divide-y divide-white/10">
							<div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
								<dt className="text-sm font-medium leading-6 text-white">
									{category}
								</dt>
								<dd
									className={`
										mt-1 text-sm leading-6 text-gray-400 sm:col-span-2 sm:mt-0 flex flex-wrap gap-2
										${spoilerCategories.includes(category) && !revealSpoiler ? "cursor-pointer" : ""}
									`}
									onClick={
										spoilerCategories.includes(category)
											? handleRevealSpoiler
											: null
									}
								>
									{dna[category].map((label) => (
										<Spoiler
											key={label}
											hidden={
												spoilerCategories.includes(category) && !revealSpoiler
											}
											theme="dark"
											accentColor={"#55c8f7"}
											density={0.15}
										>
											<DNATag type={type} category={category} label={label} />
										</Spoiler>
									))}
								</dd>
							</div>
						</dl>
					))}
				</>
			) : (
				<InfoBox text="No DNA found for this title. Please try again later, we are working on it." />
			)}
		</div>
	)
}
