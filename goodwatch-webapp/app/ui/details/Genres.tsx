import { Link } from "@remix-run/react";
import React from "react";
import { Spoiler } from "spoiled";
import type { MediaType } from "~/server/search.server";
import { DNATag } from "~/ui/dna/DNATag";

export interface GenresProps {
	genres?: string[];
	subgenres?: string[];
	type?: MediaType;
	withLinks?: boolean;
}

export default function Genres({
	genres = [],
	subgenres = [],
	type,
	withLinks = true,
}: GenresProps) {
	return (
		<>
			{((genres && genres.length > 0) ||
				(subgenres && subgenres.length > 0)) && (
				<div className="flex flex-wrap items-center gap-2 font-medium text-xs sm:text-sm md:text-md">
					{genres.map((genre) => {
						if (withLinks) {
							return (
								<Link
									key={genre}
									className="px-2.5 py-0.5 inline-flex items-center rounded-md border-2 border-slate-600 text-slate-100 bg-slate-800 hover:text-white hover:bg-slate-900"
									to={`/discover/all?withGenres=${genre.replace("&", "%26")}`}
									prefetch="intent"
								>
									{genre}
								</Link>
							);
						}
						return (
							<span
								key={genre}
								className="px-2.5 py-0.5 inline-flex items-center rounded-md border-2 border-slate-600 text-slate-100 bg-slate-800 hover:text-white hover:bg-slate-900"
							>
								{genre}
							</span>
						);
					})}
					{subgenres.map((subgenre) => (
						<DNATag
							key={subgenre}
							category="Sub-Genres"
							label={subgenre}
							linkDisabled={!withLinks}
						/>
					))}
				</div>
			)}
		</>
	);
}
