import type React from "react"
import ShareButton from "~/ui/button/ShareButton"
import DetailsInlineNav from "~/ui/details/DetailsInlineNav"
import type { Section } from "~/utils/scroll"
import type {
	ContentRatingResult,
	MovieDetails,
	Release,
	TVDetails,
} from "~/server/details.server"
import AgeRating from "~/ui/details/AgeRating"
import Runtime from "~/ui/details/Runtime"
import Genres from "~/ui/details/Genres"
import Cycle from "~/ui/list/Cycle"
import type { MovieResult, ShowResult } from "~/server/types/details-types"

interface DetailsHeaderProps {
	media: MovieResult | ShowResult
	country: string
	activeSections: string[]
	navigateToSection: (section: Section) => void
}

const DetailsHeader: React.FC<DetailsHeaderProps> = ({
	media,
	country,
	activeSections,
	navigateToSection,
}) => {
	const { details, mediaType } = media
	const { genres, release_year, title, fingerprint } = details

	const ageCertifications = details.age_certifications || []
	const ageCertification =
		ageCertifications.find((ageCertification) =>
			ageCertification.startsWith(`${country}_`),
		) || ""
	const ageRating = ageCertification.split("_")?.[1]

	let number_of_episodes: number | null = null
	let number_of_seasons: number | null = null
	let runtime: number | null = null
	if (mediaType === "movie") {
		runtime = details.runtime
	} else {
		number_of_episodes = details.number_of_episodes
		number_of_seasons = details.number_of_seasons
	}

	return (
		<div className="sticky top-16 z-40 bg-black/80 backdrop-blur-sm border-b border-white/15">
			<div className="relative m-auto px-4 py-3 w-full max-w-7xl">
				<div className="flex items-center justify-between gap-4">
					<div className="flex flex-col gap-2 min-w-0">
						<h1 className="text-xl sm:text-2xl lg:text-3xl font-medium whitespace-nowrap overflow-hidden text-ellipsis">
							{title}
						</h1>
						<div className="text-xs md:text-sm lg:text-base text-gray-400 flex flex-col xs:flex-row xs:items-center gap-1 xs:gap-0">
							<div className="flex items-center">
								{release_year && (
									<>
										<span className="font-semibold">{release_year}</span>
										<span className="mx-2">&middot;</span>
									</>
								)}
								<span className="font-normal">
									{mediaType === "movie" ? "Movie" : "Show"}
								</span>
							</div>
							<div className="flex items-center">
								{runtime ? (
									<>
										<span className="hidden xs:inline mx-2">&middot;</span>
										<Runtime minutes={runtime} />
									</>
								) : null}
								{number_of_episodes && number_of_seasons ? (
									<>
										<span className="hidden xs:inline mx-2">&middot;</span>
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
								<span className="hidden xs:inline mx-2">&middot;</span>
								<span className="hidden xs:inline">
									<Genres
										genres={genres.slice(0, 2)}
										type={mediaType === "movie" ? "movie" : "tv"}
										compact={true}
									/>
								</span>
							</div>
						</div>
					</div>
					<div className="flex items-center gap-4 shrink-0">
						{/*<button*/}
						{/*	type="button"*/}
						{/*	aria-label={*/}
						{/*		isFavorite ? "Remove from favorites" : "Add to favorites"*/}
						{/*	}*/}
						{/*	onClick={onToggleFavorite}*/}
						{/*	className={*/}
						{/*		"h-7 w-7 text-pink-400 hover:text-pink-500 focus:outline-hidden"*/}
						{/*	}*/}
						{/*>*/}
						{/*	{isFavorite ? (*/}
						{/*		<HeartSolid className="h-7 w-7 fill-pink-400" />*/}
						{/*	) : (*/}
						{/*		<HeartOutline className="h-7 w-7 stroke-pink-400" />*/}
						{/*	)}*/}
						{/*</button>*/}
						{/*<button*/}
						{/*	type="button"*/}
						{/*	aria-label="Rate"*/}
						{/*	onClick={onRate}*/}
						{/*	className={*/}
						{/*		"h-7 w-7 text-blue-400 hover:text-blue-500 focus:outline-hidden"*/}
						{/*	}*/}
						{/*>*/}
						{/*	<HandThumbUpIcon className="h-7 w-7 stroke-blue-400" />*/}
						{/*</button>*/}
						<ShareButton />
					</div>
				</div>
				{fingerprint?.tags && (
					<div className="relative top-5 h-8 text-xs lg:text-sm">
						<Cycle
							items={fingerprint.tags.map((tag) => (
								<span
									key={tag}
									className="relative px-2 py-0.5 rounded-sm border-2 border-amber-900 bg-amber-950 text-white"
								>
									{tag}
								</span>
							))}
						/>
					</div>
				)}
			</div>
			<DetailsInlineNav
				activeSections={activeSections}
				navigateToSection={navigateToSection}
			/>
		</div>
	)
}

export default DetailsHeader
