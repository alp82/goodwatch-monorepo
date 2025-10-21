import React, { useState } from "react"
import {
	duplicateProviderMapping,
	getShorterProviderLabel,
	getStreamingUrl,
	ignoredProviders,
} from "~/utils/streaming-links"
import { useUserStreamingProviders } from "~/routes/api.user-settings.get"
import { motion } from "framer-motion"
import type {
	MovieResult,
	ShowResult,
	StreamingLink,
	StreamingService,
	StreamingType,
} from "~/server/types/details-types"

export interface StreamingBadgesProps {
	media: MovieResult | ShowResult
	country: string
	streamTypes: StreamingType[]
	maxProvidersToShow?: number
}

export default function StreamingBadges({
	media,
	country,
	streamTypes,
	maxProvidersToShow = 5,
}: StreamingBadgesProps) {
	const { details, mediaType, streaming_availabilities, streaming_services } =
		media
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

	const filteredLinks = (streaming_availabilities || [])
		.filter((link: StreamingLink) => {
			return streamTypes.includes(link.streaming_type) && !ignoredProviders.includes(link.streaming_service_id)
		})
		.sort((a: StreamingLink, b: StreamingLink) => {
			const aOwned = userStreamingProviderIds.includes(a.streaming_service_id)
			const bOwned = userStreamingProviderIds.includes(b.streaming_service_id)
			if (aOwned === bOwned) return 0
			return aOwned ? a.streaming_service_id - 10000 : b.streaming_service_id
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
				<div className="flex flex-wrap items-center gap-2 sm:gap-3">
					{linksToShow.length > 0 ? (
						linksToShow.map((link) => {
							const streamingService = streaming_services.find(
								(service) => service.tmdb_id === link.streaming_service_id,
							) as StreamingService
							const owned = userStreamingProviderIds.includes(
								link.streaming_service_id,
							)
							return (
								<a
									key={link.streaming_service_id}
									href={getStreamingUrl(link, details, country, mediaType)}
									target="_blank"
									className="flex items-center gap-1.5 text-sm rounded-md shadow-xl bg-gray-700/80 brightness-90 hover:brightness-125"
									rel="noreferrer"
								>
									<img
										className={`
										p-0.5 w-12 h-12 md:w-14 md:h-14
										rounded-lg border-2 ${owned ? "bg-green-900/80 border-green-500/50" : "border-gray-500/50"}
									`}
										src={`https://www.themoviedb.org/t/p/original/${streamingService.logo}`}
										title={streamingService.name}
										alt={streamingService.name}
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
											className="hidden sm:block relative py-0.5 pl-0.5 pr-1.5 max-w-20 xs:max-w-24 sm:max-w-28"
										>
											<div className="text-gray-400 text-xs">
												Watch now on
											</div>
											<div className="font-medium text-sm">
												{getShorterProviderLabel(streamingService.name)}
											</div>
										</motion.div>
									)}
								</a>
							)
						})
					) : (
						<div className="flex items-center gap-2 text-xs">
							Not available to stream in
							<img
								src={`https://purecatamphetamine.github.io/country-flag-icons/3x2/${country}.svg`}
								alt={`Flag of ${country}`}
								className="h-2"
							/>
							<strong>{country}</strong> (
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
