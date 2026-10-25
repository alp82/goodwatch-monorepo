// PROTOTYPE - throwaway. A copy of details/DetailsHeader.tsx with a slot for the feedback entry points next to the
// country/language pair (variants B and C).
import ExploreBar from "~/ui/explore/ExploreBar"
import React, { useEffect, useRef } from "react"
import ShareButton from "~/ui/button/ShareButton"
import PreferencePair from "~/ui/media-preference/PreferencePair"
import DetailsInlineNav from "~/ui/details/DetailsInlineNav"
import { publishHeaderHeight } from "~/ui/details/header-height"
import type { ActiveSections, Section } from "~/utils/scroll"
import type {
	ContentRatingResult,
	MovieDetails,
	Release,
	TVDetails,
} from "~/server/details.server"
import AgeRating from "~/ui/details/AgeRating"
import Runtime from "~/ui/details/Runtime"
import Genres from "~/ui/details/Genres"
import { HEADER_GENRE_COUNT } from "~/utils/title-extras"
import Cycle from "~/ui/list/Cycle"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import MediaText from "~/ui/media-text/MediaText"
import { presentedText } from "~/ui/media-text/media-text"

interface DetailsHeaderProps {
	media: MovieResult | ShowResult
	country: string
	activeSections: ActiveSections
	navigateToSection: (section: Section) => void
	/** The sections the navigation lists. */
	sections: Section[]
	/** A picked titles language whose text is still on its way (or did not come): the title stays as it was. */
	textPreview?: "loading" | "failed" | null
	/** PROTOTYPE: controls before the country/language pair. */
	extra?: React.ReactNode
}

const FeedbackHeader: React.FC<DetailsHeaderProps> = ({
	media,
	country,
	activeSections,
	navigateToSection,
	sections,
	textPreview = null,
	extra,
}) => {
	const headerRef = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const header = headerRef.current
		if (header) return publishHeaderHeight(header)
	}, [])
	const { details, mediaType } = media
	const { genres, release_year, title } = details

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
		<div
			ref={headerRef}
			data-details-header
			className="sticky top-16 z-40 bg-black/80 backdrop-blur-sm border-b border-white/15"
		>
			<ExploreBar current={{ tmdb_id: details.tmdb_id, media_type: mediaType, title }} />

			{/* Not positioned: the pair's question anchors under the whole header. */}
			<div className="m-auto px-4 py-3 w-full max-w-7xl">
				<div className="flex items-center justify-between gap-4">
					<div className="flex flex-col gap-2 min-w-0">
						<MediaText
							as="h1"
							value={presentedText(details, "title", title)}
							aria-busy={textPreview === "loading" || undefined}
							data-text-preview={textPreview ?? undefined}
							className="text-xl sm:text-2xl lg:text-3xl font-medium whitespace-nowrap overflow-hidden text-ellipsis"
						/>
						<div className="text-xs md:text-sm lg:text-base text-gray-400 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0">
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
										<span className="hidden sm:inline mx-2">&middot;</span>
										<Runtime minutes={runtime} />
									</>
								) : null}
								{number_of_episodes && number_of_seasons ? (
									<>
										<span className="hidden sm:inline mx-2">&middot;</span>
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
								<span className="hidden sm:inline mx-2">&middot;</span>
								<span className="hidden sm:inline">
									<Genres
										genres={genres.slice(0, HEADER_GENRE_COUNT)}
										type={mediaType === "movie" ? "movie" : "show"}
										compact={true}
									/>
								</span>
							</div>
						</div>
					</div>
					<div className="flex items-center gap-2 sm:gap-4 shrink-0">
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
						{extra}
						<PreferencePair media={media} />
						<ShareButton />
					</div>
				</div>
			</div>
			<DetailsInlineNav
				activeSections={activeSections}
				navigateToSection={navigateToSection}
				sections={sections}
			/>
		</div>
	)
}

export default FeedbackHeader
