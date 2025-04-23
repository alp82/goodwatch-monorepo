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

interface DetailsHeaderProps {
	title: string
	releaseYear?: number | string
	mediaType: MediaType
	activeSections: string[]
	navigateToSection: (section: Section) => void
	isFavorite?: boolean
	onToggleFavorite?: () => void
	rating?: number
	onRate?: () => void
}

const DetailsHeader: React.FC<DetailsHeaderProps> = ({
	title,
	releaseYear,
	mediaType,
	activeSections,
	navigateToSection,
	// TODO wire up props
	isFavorite = false,
	onToggleFavorite,
	rating,
	onRate,
}) => {
	return (
		<div className="sticky top-16 z-50 bg-black/80 backdrop-blur border-b border-white/15">
			<div className="relative m-auto px-4 py-3 w-full max-w-7xl">
				<div className="flex items-center justify-between gap-4">
					<div className="flex flex-col md:gap-1 min-w-0">
						<h1 className="text-xl md:text-2xl lg:text-3xl font-medium whitespace-nowrap overflow-hidden text-ellipsis">
							{title}
						</h1>
						<span>
							{releaseYear && (
								<>
									<span className="font-normal text-xs md:text-sm lg:text-base text-gray-400">
										{releaseYear}
									</span>
									<span className="mx-2">&middot;</span>
								</>
							)}
							<span className="font-normal text-xs md:text-sm lg:text-base text-gray-400">
								{mediaType === "movie" ? "Movie" : "TV Show"}
							</span>
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
