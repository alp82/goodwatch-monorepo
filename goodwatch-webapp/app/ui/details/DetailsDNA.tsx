import React from "react"
import type { MovieDetails, TVDetails } from "~/server/details.server"
import dnaIcon from "~/img/dna-icon.svg"
import { getDNAForCategory } from "~/ui/dna/dna_utils"
import Genres from "~/ui/details/Genres"

export interface DetailsDNAProps {
	details: MovieDetails | TVDetails
}

export default function DetailsDNA({ details }: DetailsDNAProps) {
	const { dna, genres, media_type, synopsis, tagline } = details

	const items = [
		{
			label: "Genres",
			content: (
				<Genres
					genres={genres}
					subgenres={getDNAForCategory(dna, "Sub-Genres")}
					type={media_type}
				/>
			),
		},
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
