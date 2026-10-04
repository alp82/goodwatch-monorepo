import { Link } from "@remix-run/react"
import React from "react"
import { useGenreLinks } from "~/routes/api.genres.all"
import type { DNAItem } from "~/server/details.server"
import type { MediaType } from "~/server/search.server"
import { DNATag } from "~/ui/dna/DNATag"

export interface GenresProps {
	genres?: string[]
	subgenres?: DNAItem[]
	type?: MediaType
	withLinks?: boolean
	compact?: boolean
}

export default function Genres({
	genres = [],
	subgenres = [],
	type,
	withLinks = true,
	compact = false,
}: GenresProps) {
	const genresToShow = useGenreLinks(genres).data ?? []

	const sizeClasses = compact ? "px-2 py-0.5 text-xs" : "px-2.5 py-0.5"

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
									className={`${sizeClasses} inline-flex items-center rounded-md border-2 border-gray-600 bg-stone-900 hover:brightness-125 text-white`}
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
								className={`${sizeClasses}  inline-flex items-center rounded-md border-2 border-gray-600 bg-stone-900 hover:brightness-125 text-white`}
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
