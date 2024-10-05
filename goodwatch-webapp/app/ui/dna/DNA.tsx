import React, { useEffect, useState } from "react"
import type { DNA, MovieDetails, TVDetails } from "~/server/details.server"
import type { ExploreParams } from "~/server/explore.server"
import InfoBox from "~/ui/InfoBox"
import DNACategory from "~/ui/dna/DNACategory"
import { getSortedCategories } from "~/ui/dna/utils"

export interface DNAProps {
	details: MovieDetails | TVDetails
	dna: DNA
}

export default function DNA({ details, dna = {} }: DNAProps) {
	// const hasDNA = Object.keys(dna).length > 0
	const [hasDNA, setHasDNA] = useState(false)

	useEffect(() => {
		if (Object.keys(dna).length > 0) setHasDNA(true)
	}, [])
	const sortedCategories = getSortedCategories(dna)

	const [spoilerVisible, setSpoilerVisible] = React.useState(false)
	const handleRevealSpoiler = () => {
		setSpoilerVisible(true)
	}

	return (
		<div>
			<h2 className="text-2xl font-bold">DNA</h2>
			<p className="mt-2 mb-8 text-lg">
				Explore similar movies and shows based on the categories below.
			</p>
			{hasDNA ? (
				<div className="mt-4">
					{sortedCategories.map((category) => (
						<DNACategory
							without={details}
							key={category}
							category={category}
							tags={dna[category]}
							spoilerVisible={spoilerVisible}
							onRevealSpoiler={handleRevealSpoiler}
						/>
					))}
				</div>
			) : (
				<InfoBox text="No DNA found for this title. Please try again later, we are working on it." />
			)}
		</div>
	)
}
