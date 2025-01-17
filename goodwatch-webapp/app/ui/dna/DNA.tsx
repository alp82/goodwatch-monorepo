import React, { useEffect, useState } from "react"
import type { DNAItem, MovieDetails, TVDetails } from "~/server/details.server"
import InfoBox from "~/ui/InfoBox"
import DNACategory from "~/ui/dna/DNACategory"
import { getDNAForCategory, getSortedCategories } from "~/ui/dna/dna_utils"
import { Spinner } from "~/ui/wait/Spinner"

export interface DNAProps {
	details: MovieDetails | TVDetails
}

export default function DNA({ details }: DNAProps) {
	const [hasDNA, setHasDNA] = useState<boolean | null>(null)
	const { dna = [] } = details

	useEffect(() => {
		setHasDNA(Object.keys(dna).length > 0)
	}, [])
	const sortedCategories = getSortedCategories(dna, true, false)

	const [spoilerVisible, setSpoilerVisible] = React.useState(false)
	const handleRevealSpoiler = () => {
		setSpoilerVisible(true)
	}

	return (
		<div>
			<h2 className="text-2xl font-bold">DNA</h2>
			<p className="mt-2 mb-8 text-lg">
				Explore similar movies and shows to{" "}
				<span className="font-bold">
					{details.title}{" "}
					{details.release_year && <>({details.release_year})</>}
				</span>{" "}
				based on the categories below.
			</p>
			{hasDNA ? (
				<div className="mt-4">
					{sortedCategories.map((category) => (
						<DNACategory
							without={details}
							key={category}
							category={category}
							dna={getDNAForCategory(dna, category)}
							spoilerVisible={spoilerVisible}
							onRevealSpoiler={handleRevealSpoiler}
						/>
					))}
				</div>
			) : hasDNA === false ? (
				<InfoBox text="No DNA found for this title. Please try again later, we are working on it." />
			) : (
				<Spinner size="large" />
			)}
		</div>
	)
}
