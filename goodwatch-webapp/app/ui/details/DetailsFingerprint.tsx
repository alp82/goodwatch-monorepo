import React from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import fingerprintIcon from "~/img/fingerprint.webp"
import { getDNAForCategory, getSortedCategories } from "~/ui/dna/dna_utils"
import Genres from "~/ui/details/Genres"
import { DNACategory } from "~/ui/dna/DNACategory"
import Pillars from "~/ui/fingerprint/Pillars"
import Badges from "~/ui/fingerprint/Badges"

export interface DetailsFingerprintProps {
	media: MovieResult | ShowResult
}

export default function DetailsFingerprint({
	media,
}: DetailsFingerprintProps) {
	const { details, fingerprint } = media
	const { genres, media_type, tropes } = details
	const { scores, highlightKeys, pillars, essenceTags } = fingerprint

	const highlightScores = highlightKeys.map(key => ({key, score: scores[key]}))
	
	// const [spoilerVisible, setSpoilerVisible] = React.useState(false)
	// const handleRevealSpoiler = () => {
	// 	setSpoilerVisible(true)
	// }

	// const items = [
	// 	{
	// 		label: "Genres",
	// 		content: (
	// 			<Genres
	// 				genres={genres}
	// 				subgenres={getDNAForCategory(dna, "Sub-Genres").slice(0, 4)}
	// 				type={media_type}
	// 			/>
	// 		),
	// 	},
	// 	...sortedCategories.map((category) => {
	// 		const dnaForCategory = getDNAForCategory(dna, category).slice(0, 8)
	// 		return {
	// 			label: category,
	// 			content: (
	// 				<DNACategory
	// 					details={details}
	// 					category={category}
	// 					dnaItems={dnaForCategory}
	// 					spoilerVisible={spoilerVisible}
	// 					onRevealSpoiler={handleRevealSpoiler}
	// 				/>
	// 			),
	// 		}
	// 	}),
	// ]

	return (
		<div className="md:mt-8 lg:max-w-lg space-y-6">
			<h2 className="flex items-center gap-2 text-2xl font-bold">
				<img
					src={fingerprintIcon}
					className="h-7 p-0.5 w-auto bg-amber-950/50"
					alt="Fingerprint Icon"
				/>
				Fingerprint
			</h2>
			
			<Pillars pillars={pillars} />
		</div>
	)
}
