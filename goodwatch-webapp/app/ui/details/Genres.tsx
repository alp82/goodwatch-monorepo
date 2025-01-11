import { Link } from "@remix-run/react"
import React from "react"
import { useGenres } from "~/routes/api.genres.all"
import type { DNAItem } from "~/server/details.server"
import type { MediaType } from "~/server/search.server"
import { DNATag } from "~/ui/dna/DNATag"

export interface GenresProps {
	genres?: string[]
	subgenres?: DNAItem[]
	type?: MediaType
	withLinks?: boolean
}

export default function Genres({
	genres = [],
	subgenres = [],
	type,
	withLinks = true,
}: GenresProps) {
	const allGenresResult = useGenres()
	const allGenres = allGenresResult?.data || []
	const genresToShow = allGenres.filter((genre) => genres?.includes(genre.name))

	return (
		<>
			{((genres && genres.length > 0) ||
				(subgenres && subgenres.length > 0)) && (
				<div className="flex flex-wrap items-center gap-2 font-medium text-xs sm:text-sm md:text-md">
					{genresToShow.map((genre) => {
						if (withLinks) {
							return (
								<Link
									key={genre.id}
									className="px-2.5 py-0.5 inline-flex items-center rounded-md border-2 border-slate-600 text-slate-100 bg-slate-800 hover:text-white hover:bg-slate-900"
									to={`/discover/all?withGenres=${genre.id}`}
									prefetch="intent"
								>
									{genre.name}
								</Link>
							)
						}
						return (
							<span
								key={genre.id}
								className="px-2.5 py-0.5 inline-flex items-center rounded-md border-2 border-slate-600 text-slate-100 bg-slate-800 hover:text-white hover:bg-slate-900"
							>
								{genre.name}
							</span>
						)
					})}
					{subgenres.map((subgenre) => (
						<DNATag
							key={subgenre.id}
							id={subgenre.id}
							category={subgenre.category}
							label={subgenre.label}
							linkDisabled={!withLinks}
						/>
					))}
				</div>
			)}
		</>
	)
}
