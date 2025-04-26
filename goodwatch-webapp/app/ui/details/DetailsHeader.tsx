import type React from "react"
import ShareButton from "~/ui/ShareButton"
import {
	HeartIcon as HeartOutline,
	HeartIcon as HeartSolid,
} from "@heroicons/react/24/solid"
import { HandThumbUpIcon as HandThumbUpOutline } from "@heroicons/react/24/outline"
import type { MediaType } from "~/server/utils/query-db"
import DetailsInlineNav from "~/ui/details/DetailsInlineNav"
import type { Section } from "~/utils/scroll"
import type {
	ContentRatingResult,
	MovieDetails,
	ReleaseDate,
	TVDetails,
} from "~/server/details.server"
import AgeRating from "~/ui/details/AgeRating"
import Runtime from "~/ui/details/Runtime"

interface DetailsHeaderProps {
	details: MovieDetails | TVDetails
	activeSections: string[]
	navigateToSection: (section: Section) => void
	isFavorite?: boolean
	onToggleFavorite?: () => void
	onRate?: () => void
}

const DetailsHeader: React.FC<DetailsHeaderProps> = ({
	details,
	activeSections,
	navigateToSection,
	// TODO wire up props
	isFavorite = false,
	onToggleFavorite,
	onRate,
}) => {
	const { media_type, release_year, title } = details

	let ageRating: ContentRatingResult | ReleaseDate | undefined
	let number_of_episodes: number | undefined
	let number_of_seasons: number | undefined
	let runtime: number | undefined
	if (media_type === "movie") {
		ageRating = (details.certifications || []).find(
			(release) => release.certification,
		)
		runtime = details.runtime
	} else {
		ageRating = (details.certifications || []).find((release) => release.rating)
		number_of_episodes = details.number_of_episodes
		number_of_seasons = details.number_of_seasons
	}

	return (
		<div className="sticky top-16 z-40 bg-black/80 backdrop-blur border-b border-white/15">
			<div className="relative m-auto px-4 py-3 w-full max-w-7xl">
				<div className="flex items-center justify-between gap-4">
					<div className="flex flex-col md:gap-2 min-w-0">
						<h1 className="text-xl md:text-2xl lg:text-3xl font-medium whitespace-nowrap overflow-hidden text-ellipsis">
							{title}
						</h1>
						<span className="text-xs md:text-sm lg:text-base text-gray-400 flex items-center">
							{release_year && (
								<>
									<span className="font-semibold">{release_year}</span>
									<span className="mx-2">&middot;</span>
								</>
							)}
							<span className="font-normal">
								{media_type === "movie" ? "Movie" : "TV Show"}
							</span>
							{runtime ? (
								<>
									<span className="mx-2">&middot;</span>
									<Runtime minutes={runtime} />
								</>
							) : null}
							{number_of_episodes && number_of_seasons ? (
								<>
									<span className="mx-2">&middot;</span>
									<span className="flex gap-1">
										<strong>{number_of_episodes}</strong>
										Episode{number_of_episodes === 1 ? "" : "s"} in
										<strong>{number_of_seasons}</strong>
										Season{number_of_seasons === 1 ? "" : "s"}
									</span>
								</>
							) : null}
							{ageRating && (
								<>
									<span className="mx-2">&middot;</span>
									<AgeRating ageRating={ageRating} />
								</>
							)}
						</span>
					</div>
					<div className="flex items-center gap-4 flex-shrink-0">
						<button
							type="button"
							aria-label={
								isFavorite ? "Remove from favorites" : "Add to favorites"
							}
							onClick={onToggleFavorite}
							className={
								"h-7 w-7 text-pink-400 hover:text-pink-500 focus:outline-none"
							}
						>
							{isFavorite ? (
								<HeartSolid className="h-7 w-7 fill-pink-400" />
							) : (
								<HeartOutline className="h-7 w-7 stroke-pink-400" />
							)}
						</button>
						<button
							type="button"
							aria-label="Rate"
							onClick={onRate}
							className={
								"h-7 w-7 text-blue-400 hover:text-blue-500 focus:outline-none"
							}
						>
							<HandThumbUpOutline className="h-7 w-7 stroke-blue-400" />
						</button>
						<ShareButton />
					</div>
				</div>
			</div>
			<DetailsInlineNav
				activeSections={activeSections}
				navigateToSection={navigateToSection}
			/>
		</div>
	)
}

export default DetailsHeader
