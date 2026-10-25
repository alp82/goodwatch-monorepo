import { forwardRef } from "react"
import type { ExplorerTitle } from "~/domain/explorer"
import { titleToDashed } from "~/utils/helpers"
import { canonicalMediaTitle } from "~/utils/media-presentation"
import { matchColor } from "./color"

export const titlePath = (t: ExplorerTitle) =>
	`/${t.mediaType}/${t.tmdbId}-${titleToDashed(canonicalMediaTitle(t))}`

/** Title and match under a poster near the focus; a press opens the title's quick view. */
export const Caption = forwardRef<
	HTMLDivElement,
	{ title: ExplorerTitle; onClick: () => void }
>(function Caption({ title, onClick }, ref) {
	return (
		<div ref={ref} className="ex-cap" style={{ visibility: "hidden" }}>
			<button type="button" onClick={onClick} className="ex-cap-b">
				<span className="ex-cap-t">{title.title}</span>
				{title.match != null && (
					<span className="ex-cap-m" style={{ color: matchColor(title.match) }}>
						{title.match}%
					</span>
				)}
			</button>
		</div>
	)
})
