import React from "react"
import type { MovieDetails, TVDetails } from "~/server/details.server"
import dnaIcon from "~/img/dna-icon.svg"
import { getDNAForCategory, getSortedCategories } from "~/ui/dna/dna_utils"
import Genres from "~/ui/details/Genres"
import { DNACategory } from "~/ui/dna/DNACategory"

export interface DetailsDNAProps {
	details: MovieDetails | TVDetails
}

export default function DetailsDNA({ details }: DetailsDNAProps) {
	const { dna, genres, media_type, tropes } = details
	const sortedCategories = getSortedCategories(dna, true, false)

	const [spoilerVisible, setSpoilerVisible] = React.useState(false)
	const handleRevealSpoiler = () => {
		setSpoilerVisible(true)
	}

	const items = [
		{
			label: "Genres",
			content: (
				<Genres
					genres={genres}
					subgenres={getDNAForCategory(dna, "Sub-Genres").slice(0, 4)}
					type={media_type}
				/>
			),
		},
		...sortedCategories.map((category) => {
			const dnaForCategory = getDNAForCategory(dna, category).slice(0, 8)
			return {
				label: category,
				content: (
					<DNACategory
						details={details}
						category={category}
						dnaItems={dnaForCategory}
						spoilerVisible={spoilerVisible}
						onRevealSpoiler={handleRevealSpoiler}
					/>
				),
			}
		}),
	]

	return (
		<>
			<h2 className="mt-6 flex items-center gap-2 text-2xl font-bold">
				<img
					src={dnaIcon}
					className="h-7 p-0.5 w-auto rounded-full border-2 border-amber-400 bg-amber-950/50"
					alt="DNA Icon"
				/>
				DNA
			</h2>
			<div className="mt-4">
				<dl className="divide-y divide-white/15 text-sm/3 xs:text-sm/4 sm:text-sm/5 md:text-md/6 lg:text-lg/6">
					{items.map((item) => (
						<div
							key={item.label}
							className="py-6 sm:grid sm:grid-cols-4 sm:gap-4"
						>
							<dt className="font-medium text-white">{item.label}</dt>
							<dd className="mt-2 sm:mt-0 text-gray-400 sm:col-span-3">
								{item.content}
							</dd>
						</div>
					))}
				</dl>
			</div>
		</>
	)
}
