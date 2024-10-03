import React from "react"
import type { MediaType } from "~/server/search.server"

export interface GenresProps {
	genres: string[]
	type?: MediaType
	withLinks?: boolean
}

export default function Genres({
	genres,
	type,
	withLinks = true,
}: GenresProps) {
	return (
		<>
			{genres && (
				<div className="flex flex-wrap gap-2 font-medium text-xs sm:text-sm md:text-md">
					{genres.map((genre) => {
						if (withLinks) {
							return (
								<a
									key={genre}
									href={`/discover?type=all&withGenres=${genre.replace("&", "%26")}`}
									className="mr-2 px-2.5 py-0.5 inline-flex items-center rounded-md border-2 border-slate-600 text-slate-100 bg-slate-800 hover:text-white hover:bg-slate-900"
								>
									{genre}
								</a>
							)
						}
						return (
							<span
								key={genre}
								className="mr-2 px-2.5 py-0.5 inline-flex items-center rounded-md border-2 border-slate-600 text-slate-100 bg-slate-800 hover:text-white hover:bg-slate-900"
							>
								{genre}
							</span>
						)
					})}
				</div>
			)}
		</>
	)
}
