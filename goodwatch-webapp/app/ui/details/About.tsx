import { CubeIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import React from "react"
import type { MovieDetails, TVDetails } from "~/server/details.server"
import Collection from "~/ui/details/Collection"
import Description from "~/ui/details/Description"
import { DNATag } from "~/ui/dna/DNATag"
import { getDNAForCategory } from "~/ui/dna/dna_utils"
import { SEPARATOR_SECONDARY } from "~/utils/navigation"

export interface AboutProps {
	details: MovieDetails | TVDetails
}

export default function About({ details }: AboutProps) {
	const { dna, tmdb_id, media_type, synopsis, tagline } = details

	let collection: MovieDetails["collection"] | undefined
	if (media_type === "movie") {
		collection = details.collection
	}

	const mood = getDNAForCategory(dna, "Mood")
	const themes = getDNAForCategory(dna, "Themes")

	return (
		<>
			<h2 className="mt-6 text-2xl font-bold">About</h2>
			{tagline && (
				<div className="my-4">
					<blockquote className="relative border-l-4 lg:border-l-8 border-gray-600 bg-gray-800 py-2 pl-4 sm:pl-6">
						<p className="text-white italic sm:text-xl">{tagline}</p>
					</blockquote>
				</div>
			)}
			{(themes.length > 0 || mood.length > 0) && (
				<div className="my-6 grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] gap-1 sm:gap-4 items-center">
					{themes.length > 0 && (
						<>
							<span className="pt-1 font-semibold text-sm">Themes:</span>
							<span className="flex flex-wrap gap-2">
								{themes.map((dnaItem) => (
									<DNATag
										key={dnaItem.id}
										id={dnaItem.id}
										category={dnaItem.category}
										label={dnaItem.label}
									/>
								))}
							</span>
							<Link
								className="px-3 py-0.5 border-2 border-gray-500 bg-slate-700 text-gray-100 text-sm text-center rounded-md hover:bg-slate-600 hover:text-white"
								to={`/discover?type=all&similarTitles=${tmdb_id}${SEPARATOR_SECONDARY}${media_type}${SEPARATOR_SECONDARY}Themes`}
								prefetch="viewport"
							>
								<CubeIcon className="w-4 h-4 inline-block mr-2" />
								Discover <span className="font-bold">Similar Themes</span>
							</Link>
						</>
					)}
					{mood.length > 0 && (
						<>
							<span className="mt-2 sm:mt-0 pt-1 font-semibold text-sm">
								Mood:
							</span>
							<span className="flex flex-wrap gap-2">
								{mood.map((dnaItem) => (
									<DNATag
										key={dnaItem.id}
										id={dnaItem.id}
										category={dnaItem.category}
										label={dnaItem.label}
									/>
								))}
							</span>
							<Link
								className="px-2 py-0.5 border-2 border-gray-500 bg-slate-700 text-gray-100 text-sm text-center rounded-md hover:bg-slate-600 hover:text-white"
								to={`/discover?type=all&similarTitles=${tmdb_id}${SEPARATOR_SECONDARY}${media_type}${SEPARATOR_SECONDARY}Mood`}
								prefetch="viewport"
							>
								<CubeIcon className="w-4 h-4 inline-block mr-2" />
								Discover <span className="font-bold">Similar Mood</span>
							</Link>
						</>
					)}
				</div>
			)}
			<Description description={synopsis} />
			{collection && (
				<Collection collection={collection} movieId={details.tmdb_id} />
			)}
		</>
	)
}
