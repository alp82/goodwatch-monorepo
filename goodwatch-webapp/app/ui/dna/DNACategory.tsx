import { MapIcon } from "@heroicons/react/24/solid"
import React from "react"
import { Spoiler } from "spoiled"
import { useExplore } from "~/routes/api.explore"
import type { ExploreParams } from "~/server/explore.server"
import type { MediaType } from "~/server/utils/query-db"
import { MovieTvCard } from "~/ui/MovieTvCard"
import { Spinner } from "~/ui/Spinner"
import { DNATag } from "~/ui/dna/DNATag"
import { mapCategoryToVectorName, spoilerCategories } from "~/ui/dna/utils"

export interface DNACategoryProps {
	without: {
		tmdb_id: number
		media_type: MediaType
	}
	category: ExploreParams["category"]
	tags: string[]
	spoilerVisible: boolean
	onRevealSpoiler: () => void
}

export default function DNACategory({
	without,
	category,
	tags,
	spoilerVisible,
	onRevealSpoiler,
}: DNACategoryProps) {
	const isSpoiler = spoilerCategories.includes(category)

	const text = tags.join(", ")
	const explore = useExplore({
		category,
		text,
	})

	const results = explore.data?.results || []
	const categoryPreview = results
		.filter(
			(details) =>
				details.tmdb_id !== without.tmdb_id &&
				details.media_type !== without.media_type,
		)
		.slice(0, 4)

	return (
		<div className="mb-12 bg-gray-800 grid grid-cols-1 md:grid-cols-2">
			<div className="pl-4 py-4 flex flex-col gap-4">
				<h3 className="text-3xl font-extrabold text-gray-400">
					{category}
					{isSpoiler && !spoilerVisible && (
						<span className="ml-4 text-base text-gray-500 font-semibold">
							Click below to reveal spoilers
						</span>
					)}
				</h3>
				<div
					className={`
										mt-1 text-sm leading-6 text-gray-400 sm:col-span-2 sm:mt-0 flex flex-wrap gap-2
										${spoilerCategories.includes(category) && !spoilerVisible ? "cursor-pointer" : ""}
									`}
					onClick={
						spoilerCategories.includes(category) ? onRevealSpoiler : undefined
					}
					onKeyDown={() => null}
				>
					{tags.map((tag) => (
						<Spoiler
							key={tag}
							hidden={isSpoiler && !spoilerVisible}
							theme="dark"
							accentColor={"#55c8f7"}
							density={0.15}
						>
							<DNATag
								category={category}
								label={tag}
								linkDisabled={isSpoiler && !spoilerVisible}
							/>
						</Spoiler>
					))}
				</div>
				<div className="mt-4">
					<a
						href={`/explore/all/${mapCategoryToVectorName(category)}/${text}`}
						className="px-3 py-2 border-2 border-gray-500 bg-slate-700 text-gray-100 text-sm rounded-md hover:bg-slate-600 hover:text-white"
					>
						<MapIcon className="w-4 h-4 inline-block mr-2" />
						Explore: <span className="font-bold">Similar {category}</span>
					</a>
				</div>
			</div>
			<div className="mt-8 md:mt-0 w-full flex items-center gap-2">
				{results.length ? (
					<>
						{categoryPreview.map((details) => (
							<div key={details.tmdb_id} className="">
								<MovieTvCard details={details} mediaType={details.media_type} />
							</div>
						))}
					</>
				) : (
					<div className="mt-4">
						<Spinner size="large" />
					</div>
				)}
			</div>
		</div>
	)
}
