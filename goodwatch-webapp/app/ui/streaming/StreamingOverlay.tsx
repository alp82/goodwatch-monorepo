import React from "react"
import { type StreamingLink, StreamingProviders } from "~/server/details.server"
import { TmdbImage } from "~/ui/TmdbImage"

export interface StreamingOverlayProps {
	links?: StreamingLink[]
	/**
	 * The service the title is new on for the viewer (#489), by id: its logo leads, ringed in the sky blue of the
	 * signal with a "New" tab, and it stays on a card too narrow for the other logos.
	 */
	newOn?: number | null
}

export default function StreamingOverlay({
	links,
	newOn,
}: StreamingOverlayProps) {
	// const hasProviders = providers?.flatrate && providers.flatrate.length > 0
	const hasProviders = links?.length
	const uniqueLinks = (links || [])
		.filter((link, index) => {
			return (
				links.findIndex((l) => l.provider_id === link.provider_id) === index
			)
		})
		.slice(0, 5)
	const fresh =
		newOn == null
			? undefined
			: uniqueLinks.find((link) => link.provider_id === newOn)
	const others = fresh
		? uniqueLinks.filter((link) => link !== fresh)
		: uniqueLinks

	return (
		<>
			{fresh && (
				<span
					className="pointer-events-none absolute top-5 left-1 z-10 flex flex-col items-center drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]"
					data-new-on={fresh.provider_name}
				>
					<TmdbImage
						kind="logo"
						path={fresh.provider_logo_path}
						width={32}
						ratio={1}
						className="w-8 h-8 rounded-lg border-2 border-sky-400"
						alt={`New on ${fresh.provider_name}`}
					/>
					<span className="-mt-1.5 rounded-full bg-sky-400 px-1.5 py-0.5 text-[9px] font-black uppercase leading-none text-black">
						New
					</span>
				</span>
			)}
			<div
				className={`hidden @5xs:flex items-center gap-1 absolute top-5 ${fresh ? "left-10" : "left-1"} w-full overflow-hidden opacity-80`}
			>
				{hasProviders ? (
					others.map((link, index) => (
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
		</>
	)
}
