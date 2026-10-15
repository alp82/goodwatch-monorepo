// A source's mark in the Imports list: its official logo, unchanged, or a letter tile. Decorative: the name is
// always written beside it.
import { assetUrl } from "~/utils/asset-url"
import type { ImportSourceEntry } from "./ImportSources"

export function SourceMark({ source }: { source: ImportSourceEntry }) {
	if (!source.logo)
		return (
			<span
				aria-hidden
				className={`${source.tile.className} flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-black tracking-tight`}
			>
				{source.tile.text}
			</span>
		)
	// TMDB's mark is wider than tall; it sits on TMDB's own dark blue.
	const padded = source.id === "tmdb"
	return (
		<span
			aria-hidden
			className={`flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg ${padded ? "bg-[#0d253f] p-1" : ""}`}
		>
			<img
				src={assetUrl(source.logo)}
				alt=""
				width={40}
				height={40}
				loading="lazy"
				className="size-full object-contain"
			/>
		</span>
	)
}
