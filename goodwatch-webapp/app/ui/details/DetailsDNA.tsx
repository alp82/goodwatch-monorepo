import React from "react"
import type { MovieDetails, TVDetails } from "~/server/details.server"
import dnaIcon from "~/img/dna-icon.svg"
import {
	getDNAForCategory,
	getSortedCategories,
	spoilerCategories,
} from "~/ui/dna/dna_utils"
import Genres from "~/ui/details/Genres"
import { Spoiler } from "spoiled"
import { DNATag } from "~/ui/dna/DNATag"

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
			const isSpoiler = spoilerCategories.includes(category)
			const dnaForCategory = getDNAForCategory(dna, category).slice(0, 6)
			return {
				label: category,
				content: (
					<div className="flex flex-col gap-4">
						{isSpoiler && !spoilerVisible && (
							<span className="text-base text-gray-500 font-semibold">
								Click below to reveal spoilers
							</span>
						)}
						<div
							className={`
						mt-1 text-gray-400 sm:col-span-2 sm:mt-0 flex flex-wrap gap-2 
						${spoilerCategories.includes(category) && !spoilerVisible ? "cursor-pointer" : ""}
					`}
							onClick={
								spoilerCategories.includes(category)
									? handleRevealSpoiler
									: undefined
							}
							onKeyDown={() => null}
						>
							{dnaForCategory.map((dnaItem) => (
								<Spoiler
									key={dnaItem.id}
									hidden={isSpoiler && !spoilerVisible}
									theme="dark"
									accentColor={"#55c8f7"}
									density={0.15}
								>
									<DNATag
										id={dnaItem.id}
										category={dnaItem.category}
										label={dnaItem.label}
										linkDisabled={isSpoiler && !spoilerVisible}
									/>
								</Spoiler>
							))}
						</div>
					</div>
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
