import React from "react"
import tmdb_logo from "~/img/tmdb-logo.svg"
import type {
	MovieDetails,
	StreamingLink,
	StreamType,
	TVDetails,
} from "~/server/details.server"
import { sections } from "~/ui/details/common"
import type { Section } from "~/utils/scroll"
import {
	duplicateProviderMapping,
	getShorterProviderLabel,
	getStreamingUrl,
} from "~/utils/streaming-links"
import { useUserStreamingProviders } from "~/routes/api.user-settings.get"
import { motion } from "framer-motion"

export interface StreamingBadgesProps {
	details: MovieDetails | TVDetails
	country: string
	media_type: "movie" | "tv"
	links: StreamingLink[]
	countryCodes: string[]
	streamTypes: StreamType[]
	maxProvidersToShow?: number
	navigateToSection: (section: Section) => void
}

export default function StreamingBadges({
	details,
	country,
	media_type,
	links,
	countryCodes,
	streamTypes,
	maxProvidersToShow = 5,
	navigateToSection,
}: StreamingBadgesProps) {
	const userStreamingProviders = useUserStreamingProviders()

	const userStreamingProviderIds = userStreamingProviders.flatMap(
		(provider) => {
			const id = provider.id
			if (id in duplicateProviderMapping) {
				return [id, ...duplicateProviderMapping[id]]
			}
			return [id]
		},
	)

	const filteredLinks = (links || []).filter((link: StreamingLink) =>
		streamTypes.includes(link.stream_type),
	)
	const buyLinks = links.filter(
		(link: StreamingLink) => link.stream_type === "buy",
	)
	const rentLinks = links.filter(
		(link: StreamingLink) => link.stream_type === "rent",
	)

	const PoweredBy = () => {
		return (
			<>
				<div className="mt-6 h-3 flex gap-2 items-center">
					<small>streaming data from</small>
					<a
						href={
							links.length ? links[0].tmdb_url : "https://www.themoviedb.org/"
						}
						target="_blank"
						className=""
						rel="noreferrer"
					>
						<img alt="TMDB" className="h-2 w-auto" src={tmdb_logo} />
					</a>
					<small>and</small>
					<a
						href="https://justwatch.com"
						target="_blank"
						className="ml-0.5 scale-105"
						data-original="https://www.justwatch.com"
						rel="noreferrer"
					>
						<img
							alt="JustWatch"
							className="h-3 w-16"
							src="https://widget.justwatch.com/assets/JW_logo_color_10px.svg"
						/>
					</a>
				</div>
			</>
		)
	}

	const hasFiltered = Boolean(filteredLinks.length)
	const hasBuyOrRent = buyLinks.length + rentLinks.length > 0
	if (!hasFiltered) {
		return hasBuyOrRent ? (
			<div>
				<div className="textsm md:text-lg">
					Only available for streaming to{" "}
					<button
						type="button"
						className="text-indigo-400 hover:underline"
						onClick={() => navigateToSection(sections.streaming)}
					>
						Buy or Rent
					</button>
				</div>
				<PoweredBy />
			</div>
		) : countryCodes?.length ? (
			<div>
				<div className="textsm md:text-lg">
					Only available for streaming in{" "}
					<button
						type="button"
						className="text-indigo-400 hover:underline"
						onClick={() => navigateToSection(sections.streaming)}
					>
						other Countries
					</button>
				</div>
				<PoweredBy />
			</div>
		) : (
			<div className="textsm md:text-lg">
				Not available for streaming right now
			</div>
		)
	}

	// Limit to maxProvidersToShow
	const linksToShow = filteredLinks.slice(0, maxProvidersToShow)
	const extraCount = filteredLinks.length - linksToShow.length

	return (
		<>
			<div>
				<div className="flex flex-wrap items-center gap-2 sm:gap-4">
					{linksToShow.map((link) => {
						const owned = userStreamingProviderIds.includes(link.provider_id)
						return (
							<a
								key={link.provider_id}
								href={getStreamingUrl(link, details, country, media_type)}
								target="_blank"
								className="flex items-center gap-2 text-xs md:text-sm rounded-lg shadow-2xl bg-gray-700/80 brightness-90 hover:brightness-125"
								rel="noreferrer"
							>
								<img
									className={`
										p-1 w-12 h-12 md:w-16 md:h-16
										rounded-xl border-2 ${owned ? "bg-green-900/80 border-green-500/50" : "border-gray-500/50"}
									`}
									src={`https://www.themoviedb.org/t/p/original/${link.provider_logo_path}`}
									title={link.provider_name}
									alt={link.provider_name}
								/>
								{owned && (
									<motion.div
										initial={{ x: -16, opacity: 0 }}
										animate={{ x: 0, opacity: 1 }}
										exit={{ x: -16, opacity: 0 }}
										transition={{ type: "spring", stiffness: 300, damping: 30 }}
										className="hidden sm:block relative -top-1 py-1 pl-1 pr-2 max-w-24 xs:max-w-28 sm:max-w-32 md:max-w-36"
									>
										<div className="text-gray-400 text-[75%]">Watch now on</div>
										<div className="font-semibold">
											{getShorterProviderLabel(link.provider_name)}
										</div>
									</motion.div>
								)}
							</a>
						)
					})}
					{extraCount > 0 && (
						<span className="ml-2 text-xs text-gray-400">
							+{extraCount} more...
						</span>
					)}
				</div>
				{/*<PoweredBy />*/}
			</div>
		</>
	)
}
