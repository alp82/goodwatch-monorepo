import React from "react"
import { type StreamingLink, StreamingProviders } from "~/server/details.server"
import { TmdbImage } from "~/ui/TmdbImage"

export interface StreamingOverlayProps {
	links?: StreamingLink[]
}

export default function StreamingOverlay({ links }: StreamingOverlayProps) {
	// const hasProviders = providers?.flatrate && providers.flatrate.length > 0
	const hasProviders = links?.length
	const uniqueLinks = (links || [])
		.filter((link, index) => {
			return (
				links.findIndex((l) => l.provider_id === link.provider_id) === index
			)
		})
		.slice(0, 5)

	return (
		<div className="hidden @5xs:flex items-center gap-1 absolute top-5 left-1 w-full overflow-hidden opacity-80">
			{hasProviders ? (
				uniqueLinks.map((link, index) => (
					<TmdbImage
						key={`${link.provider_id}`}
						kind="logo"
						path={link.provider_logo_path}
						width={32}
						ratio={1}
						className="w-8 h-8 rounded-lg border-2 border-gray-500"
						alt={link.provider_name}
					/>
				))
			) : (
				<></>
			)}
		</div>
	)
}
