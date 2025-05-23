import React, { useState } from "react"
import type {
	MovieDetails,
	StreamingLink,
	StreamType,
	TVDetails,
} from "~/server/details.server"
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
	streamTypes: StreamType[]
	maxProvidersToShow?: number
}

export default function StreamingBadges({
	details,
	country,
	media_type,
	links,
	streamTypes,
	maxProvidersToShow = 5,
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

	const filteredLinks = (links || [])
		.filter((link: StreamingLink) => streamTypes.includes(link.stream_type))
		.sort((a: StreamingLink, b: StreamingLink) => {
			const aOwned = userStreamingProviderIds.includes(a.provider_id)
			const bOwned = userStreamingProviderIds.includes(b.provider_id)
			if (aOwned === bOwned) return 0
			return aOwned ? -1 : 1
		})

	const [showAllEnabled, setShowAllEnabled] = useState(false)
	const handleToggleShowAll = () => {
		setShowAllEnabled((prev) => !prev)
	}

	const linksToShow = showAllEnabled
		? filteredLinks
		: filteredLinks.slice(0, maxProvidersToShow)
	const extraCount = filteredLinks.length - linksToShow.length

	return (
		<>
			<div>
				<div className="flex flex-wrap items-center gap-2 sm:gap-4">
					{linksToShow.length > 0 ? (
						linksToShow.map((link) => {
							const owned = userStreamingProviderIds.includes(link.provider_id)
							return (
								<a
									key={link.provider_id}
									href={getStreamingUrl(link, details, country, media_type)}
									target="_blank"
									className="flex items-center gap-2 text-sm md:text-lg rounded-lg shadow-2xl bg-gray-700/80 brightness-90 hover:brightness-125"
									rel="noreferrer"
								>
									<img
										className={`
										p-1 w-16 h-16 md:w-20 md:h-20
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
											transition={{
												type: "spring",
												stiffness: 300,
												damping: 30,
											}}
											className="hidden sm:block relative -top-1 py-1 pl-1 pr-2 max-w-24 xs:max-w-28 sm:max-w-32 md:max-w-36"
										>
											<div className="text-gray-400 text-[75%]">
												Watch now on
											</div>
											<div className="font-semibold">
												{getShorterProviderLabel(link.provider_name)}
											</div>
										</motion.div>
									)}
								</a>
							)
						})
					) : (
						<div className="flex items-center gap-2 text-xs md:text-sm">
							Not available to stream in <strong>{country}</strong> (
							{streamTypes.join(", ")})
						</div>
					)}
					{!showAllEnabled && extraCount > 0 && (
						<button
							type="button"
							className="ml-2 text-xs text-blue-400 hover:text-blue-500"
							aria-label="Show all streaming links"
							onClick={handleToggleShowAll}
						>
							+{extraCount} more...
						</button>
					)}
					{showAllEnabled && linksToShow.length > maxProvidersToShow && (
						<button
							type="button"
							className="ml-2 text-xs text-blue-400 hover:text-blue-500"
							aria-label="Hide all streaming links"
							onClick={handleToggleShowAll}
						>
							less...
						</button>
					)}
				</div>
			</div>
		</>
	)
}
