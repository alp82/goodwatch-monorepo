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
	const { dna = [] } = details
	const hasDNA = dna.length > 0
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
					{/*<h3 className="text-xl font-bold">Tropes</h3>*/}
					{/*<p>*/}
					{/*	powered by{" "}*/}
					{/*	<a*/}
					{/*		href="https://tvtropes.org/"*/}
					{/*		target="_blank"*/}
					{/*		rel="noreferrer"*/}
					{/*		className="text-blue-400 hover:text-blue-500 cursor-pointer"*/}
					{/*	>*/}
					{/*		TV Tropes*/}
					{/*	</a>*/}
					{/*</p>*/}
					{/*<div className="mt-4 flex flex-col gap-2 tropes">*/}
					{/*	{details.tropes.map((trope) => {*/}
					{/*		return (*/}
					{/*			<div key={trope.name} className="grid grid-cols-4 gap-4">*/}
					{/*				<a*/}
					{/*					href={trope.url}*/}
					{/*					target="_blank"*/}
					{/*					rel="noreferrer"*/}
					{/*					className="text-blue-400 hover:text-blue-500 cursor-pointer"*/}
					{/*				>*/}
					{/*					{trope.name}*/}
					{/*				</a>*/}
					{/*				<div*/}
					{/*					className="col-span-3"*/}
					{/*					dangerouslySetInnerHTML={{ __html: trope.html }}*/}
					{/*				/>*/}
					{/*			</div>*/}
					{/*		)*/}
					{/*	})}*/}
					{/*</div>*/}
				</div>
			) : (
				<InfoBox text="No DNA found for this title. Please try again later, we are working on it." />
			)}
		</div>
	)
}
