// The browse poster card, on every surface that shows titles as posters (Discover, rows, person credits, franchises,
// Watch next and My movies tiers). The poster links to the title page; over it sit the score pill (top right: the
// GoodWatch score, the viewer's score, one state icon) and the logos of the viewer's own services (bottom left). The
// card sizes its parts by its own width (`@container/card`): S under 6.5rem, M from 6.5rem, L from 11rem.
//
// The title actions (ui/poster-card/CardActions.tsx) load as their own chunk at the first interaction with the page
// and mount on the first hover, focus or tap: a panel on hover for a pointer, tiles over the art after a first tap on
// a touch screen (a second tap, or Open, goes to the title page). After Not interested the card keeps its place,
// greyed, with Undo, until the list is next loaded.
import { Link } from "@remix-run/react"
import {
	Suspense,
	lazy,
	useCallback,
	useContext,
	useEffect,
	useId,
	useRef,
	useState,
} from "react"
import type { RatingBadge } from "~/domain/age-content"
import type { MovieDetails, TVDetails } from "~/server/details.server"
import type { DiscoverResult } from "~/server/discover.server"
import type { OnboardingResult } from "~/server/onboarding-media.server"
import type { TitleCard } from "~/server/title-cards.server"
import { Poster, type PosterProps } from "~/ui/Poster"
import MediaText from "~/ui/media-text/MediaText"
import { presentedText } from "~/ui/media-text/media-text"
import type {
	ActionsPlacement,
	OpenActions,
} from "~/ui/poster-card/CardActions"
import { TitleScorePill } from "~/ui/poster-card/ScorePill"
import { FOCUS } from "~/ui/poster-card/look"
import { setRevealed, useRevealed } from "~/ui/poster-card/reveal"
import { type ServiceOffer, YourServiceLogos } from "~/ui/poster-card/services"
import { HiddenTileContext } from "~/ui/title-actions/hide-feedback"
import { useTouchPointer } from "~/ui/title-actions/pointer"
import { RatingMark } from "~/ui/title-card/RatingMark"
import { onFirstInteraction } from "~/utils/first-interaction"
import { titleToDashed } from "~/utils/helpers"
import { canonicalMediaTitle } from "~/utils/media-presentation"
import { extractRatings } from "~/utils/ratings"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

export type { ActionsPlacement }

const loadCardActions = reloadOnStaleChunk(
	() => import("~/ui/poster-card/CardActions"),
)
const CardActions = lazy(loadCardActions)

// Fetched at the first sign that a person uses the page, so the first hover or tap finds the actions loaded and a
// first view without interaction requests nothing.
let preloaded = false
function preloadCardActions() {
	if (preloaded) return
	preloaded = true
	onFirstInteraction(() => void loadCardActions().catch(() => {}))
}

interface MovieTvCardProps {
	details:
		| MovieDetails
		| TVDetails
		| DiscoverResult
		| OnboardingResult
		| TitleCard
	mediaType: "movie" | "show"
	prefetch?: boolean
	/** The title's age rating for the viewer, shown while an age limit is on. */
	rating?: RatingBadge | null
	/** The poster's displayed widths, when the card isn't in the grid. */
	posterSizes?: PosterProps["sizes"]
	/** Set by a page for the cards it shows without scrolling. Every other poster loads lazily. */
	posterPriority?: PosterProps["priority"]
	/**
	 * For a card far down a long grid: the browser skips the poster and its badges until the card is near the
	 * viewport, so a lazy poster isn't requested screens ahead. The box keeps the poster's 2:3 shape meanwhile.
	 */
	skipOffscreen?: boolean
	/**
	 * Where the title actions sit on the poster; `false` leaves them off, for a surface that opens titles its own way.
	 */
	actions?: ActionsPlacement | false
	/** The service the title is new on for the viewer (#489), by id: its logo leads, ringed. */
	newOn?: number | null
	/** The list is the Wishlist: the pill leaves out the Wishlist bookmark. */
	skipWant?: boolean
}

type CardDetails = MovieTvCardProps["details"] & {
	streaming_links?: readonly ServiceOffer[] | null
}

export function MovieTvCard({
	details,
	mediaType,
	prefetch = false,
	rating,
	posterSizes,
	posterPriority,
	skipOffscreen = false,
	actions = "bottom",
	newOn,
	skipWant = false,
}: MovieTvCardProps) {
	const ratings = extractRatings(details)
	const cardKey = useId()
	const touch = useTouchPointer()
	const revealed = useRevealed(cardKey)
	const frame = useRef<HTMLDivElement>(null)
	const [armed, setArmed] = useState(false)
	const [open, setOpen] = useState<OpenActions>(null)
	const [tile, setTile] = useState(false)
	const arm = useCallback(() => setArmed(true), [])
	useEffect(() => {
		if (actions) preloadCardActions()
	}, [actions])

	// A grid whose list reloads keeps this card in place while its Not interested cover shows.
	const keeper = useContext(HiddenTileContext)
	const tmdbId = details.tmdb_id
	const title = details.title
	useEffect(() => {
		if (!tile || !keeper) return
		const kept = { mediaType, details: { tmdb_id: tmdbId, title } }
		keeper.keep(kept)
		return () => keeper.release(kept)
	}, [tile, keeper, mediaType, tmdbId, title])

	const href = `/${mediaType}/${details.tmdb_id}-${titleToDashed(canonicalMediaTitle(details))}`
	const offers = (details as CardDetails).streaming_links
	return (
		<div
			ref={frame}
			data-poster-card=""
			onPointerEnter={actions ? arm : undefined}
			onFocus={actions ? arm : undefined}
			className={`group/card @container/card relative w-full min-w-0 ${open ? "z-30" : ""}`}
		>
			<Link
				to={href}
				prefetch={prefetch ? "viewport" : "intent"}
				draggable="false"
				onClick={(event) => {
					// Touch: the first tap shows the actions over the art, the second opens the title.
					if (!actions || !touch || tile) return
					if (revealed) return setRevealed(null)
					event.preventDefault()
					setArmed(true)
					setRevealed(cardKey)
				}}
				className={`block select-none overflow-hidden rounded-lg border-2 border-gray-800 bg-gray-900 [-webkit-touch-callout:none] can-hover:hover:border-amber-700/50 @min-[8rem]/card:border-4 ${tile ? "[&_img]:grayscale" : ""} ${FOCUS}`}
			>
				<div
					className={
						skipOffscreen
							? "relative aspect-[2/3] [content-visibility:auto]"
							: "relative"
					}
				>
					<Poster
						path={details.poster_path}
						title={details.title}
						lang={details.presentation?.title.language ?? "en"}
						mediaType={mediaType}
						tmdbId={details.tmdb_id}
						sizes={posterSizes}
						priority={posterPriority}
					/>
				</div>
				{/* The link's name for a crawler and a screen reader: the title in its own language, and the year. */}
				<span className="sr-only">
					<MediaText value={presentedText(details, "title", details.title)} />
					{details.release_year ? ` (${details.release_year})` : ""}
				</span>
			</Link>
			{!tile && (
				// Over the poster, outside the link; they let the pointer through to it.
				<div
					data-card-badges=""
					className={`pointer-events-none absolute inset-0 ${skipOffscreen ? "[content-visibility:auto]" : ""}`}
				>
					<TitleScorePill
						mediaType={mediaType}
						tmdbId={details.tmdb_id}
						goodwatch={ratings?.goodwatch_overall_score_normalized_percent}
						skipWant={skipWant}
						className="absolute right-1 top-1 z-[25] @min-[11rem]/card:right-2 @min-[11rem]/card:top-2"
					/>
					{rating && (
						<RatingMark
							rating={rating}
							className="absolute left-1 top-1 @min-[11rem]/card:left-2 @min-[11rem]/card:top-2"
						/>
					)}
					<YourServiceLogos
						offers={offers}
						newOn={newOn}
						className={`absolute bottom-1.5 left-1.5 transition-opacity @min-[11rem]/card:bottom-2 @min-[11rem]/card:left-2 ${actions ? "can-hover:group-hover/card:opacity-0 can-hover:group-focus-within/card:opacity-0" : ""}`}
					/>
				</div>
			)}
			{actions && armed && (
				<Suspense fallback={null}>
					<CardActions
						media={{ mediaType, details }}
						href={href}
						cardKey={cardKey}
						frame={frame}
						placement={actions}
						touch={touch}
						revealed={revealed}
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
