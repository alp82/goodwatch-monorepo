// Wraps a poster card (a link to the title page) and gives it the title actions: on a device that hovers, a row of
// four icon buttons over the poster on hover or keyboard focus; on phones and tablets a "more" button that opens a
// sheet with the whole set. The frame itself is all the server renders. The actions load as their own chunk at the
// first interaction with the page and mount on the first hover, focus, or press. After Not interested, a "Hidden" tile with Undo
// covers the card until the grid is next loaded.
import { EllipsisHorizontalIcon } from "@heroicons/react/24/solid"
import { type ReactNode, Suspense, lazy, useCallback, useContext, useEffect, useRef, useState } from "react"
import type { ScoredMedia } from "~/ui/user/actions/ScoreAction"
import { onFirstInteraction } from "~/utils/first-interaction"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import { HiddenTileContext } from "./hide-feedback"
import { useTouchPointer } from "./pointer"

const loadCardActions = reloadOnStaleChunk(() => import("./CardActions"))
const CardActions = lazy(loadCardActions)

// Fetched at the first sign that a person uses the page, so the first hover or press finds the actions loaded and a
// first view without interaction requests nothing.
let preloaded = false
function preloadCardActions() {
	if (preloaded) return
	preloaded = true
	onFirstInteraction(() => void loadCardActions().catch(() => {}))
}

/**
 * Where the actions sit on the poster: along the bottom, raised above something else at the bottom (Watch next's
 * Want to See pill), or along the top for a card whose bottom holds text.
 */
export type ActionsPlacement = "bottom" | "raised" | "top"

const MORE_AT: Record<ActionsPlacement, string> = {
	bottom: "bottom-2.5 right-2.5",
	raised: "bottom-14 right-2.5",
	top: "top-2.5 right-2.5",
}

/** What is open on the card: the score popover (hover devices) or the sheet (touch). */
export type OpenActions = "score" | "sheet" | null

export function TitleActionsFrame({
	media,
	placement = "bottom",
	className = "",
	openClassName = "",
	children,
}: {
	media: ScoredMedia
	placement?: ActionsPlacement
	className?: string
	/** Added while the score popover is open, when the pointer is over the popover and no longer over the card. */
	openClassName?: string
	/** The card: one link. */
	children: ReactNode
}) {
	const touch = useTouchPointer()
	const frame = useRef<HTMLDivElement>(null)
	const [armed, setArmed] = useState(false)
	const [open, setOpen] = useState<OpenActions>(null)
	const [tile, setTile] = useState(false)
	const arm = useCallback(() => setArmed(true), [])
	useEffect(preloadCardActions, [])

	// A grid whose list reloads keeps this card in place while the tile shows.
	const keeper = useContext(HiddenTileContext)
	const { mediaType } = media
	const tmdbId = media.details.tmdb_id
	const title = media.details.title
	useEffect(() => {
		if (!tile || !keeper) return
		const kept = { mediaType, details: { tmdb_id: tmdbId, title } }
		keeper.keep(kept)
		return () => keeper.release(kept)
	}, [tile, keeper, mediaType, tmdbId, title])
	return (
		<div
			ref={frame}
			onPointerEnter={arm}
			onFocus={arm}
			className={`group relative ${className} ${open === "score" ? `z-30 ${openClassName}` : ""} ${tile ? "[&>a]:invisible" : ""}`}
		>
			{children}
			{touch && !tile && (
				<button
					type="button"
					aria-label={`Actions for ${media.details.title}`}
					aria-haspopup="dialog"
					onClick={() => {
						setArmed(true)
						setOpen("sheet")
					}}
					className={`absolute z-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg bg-gray-700/90 text-white focus-visible:outline-2 focus-visible:outline-white ${MORE_AT[placement]}`}
				>
					<EllipsisHorizontalIcon className="h-6 w-6" aria-hidden />
				</button>
			)}
			{armed && (
				<Suspense fallback={null}>
					<CardActions
						media={media}
						frame={frame}
						placement={placement}
						touch={touch}
						open={open}
						setOpen={setOpen}
						tile={tile}
						setTile={setTile}
					/>
				</Suspense>
			)}
		</div>
	)
}
