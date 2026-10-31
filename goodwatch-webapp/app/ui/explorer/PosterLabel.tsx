// The small label under the hovered poster: title, year, match. The map positions it each frame (transform only).
import { forwardRef } from "react"
import type { ExplorerTitle } from "~/domain/explorer"
import { matchColor } from "./color"

export const PosterLabel = forwardRef<
	HTMLDivElement,
	{ title: ExplorerTitle | null }
>(function PosterLabel({ title }, ref) {
	return (
		<div
			ref={ref}
			aria-hidden="true"
			className="pointer-events-none absolute top-0 left-0 z-[21] will-change-transform"
			style={{ visibility: "hidden" }}
		>
			{title && (
				<div className="flex max-w-[15rem] items-baseline gap-1.5 rounded-lg border border-white/10 bg-gray-950/90 px-2.5 py-1 shadow-lg shadow-black/40">
					<span className="truncate text-[13px] font-bold text-white">
						{title.title}
					</span>
					{title.year && (
						<span className="shrink-0 text-[11.5px] text-gray-400">
							{title.year}
						</span>
					)}
					{title.match != null && (
						<span
							className="shrink-0 text-[11.5px] font-bold"
							style={{ color: matchColor(title.match) }}
						>
							{title.match}%
						</span>
					)}
				</div>
			)}
		</div>
	)
})
