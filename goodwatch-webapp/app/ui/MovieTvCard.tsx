// The poster card, on every surface that shows titles as posters (Discover, rows, person credits, franchises, Watch
// next, My movies tiers, and every scored poster on a profile). The poster links to the title page; over it sit the
// score pill (top right: the GoodWatch score, the viewer's score, one state icon), the age badge (top left, while an
// age limit is on), the logos of the viewer's own services (bottom left) and, on another member's pages, that
// member's score as a filled square (`ownerScore`).
//
// What shows depends on the card's own width (`@container/card`, so the server's HTML is already right), and no part
// covers more than ~40% of it:
// | width            | pill                          | owner's square            | logos | actions                 |
// | from 11rem/176px | GoodWatch + you (or + icon)   | top left, under the badge | 2     | full                    |
// | 7.5rem-11rem     | you (or GoodWatch + icon)     | top left, under the badge | 1     | full                    |
// | 6rem-7.5rem      | yours, else GoodWatch         | top right, instead of it  | 1     | score row as a number   |
// | 4.5rem-6rem      | bare number                   | top right, instead of it  | 0     | no score row            |
// | under 4.5rem     | bare number                   | top right, instead of it  | 0     | none: a tap opens it    |
// The age badge sits top left, under 4.5rem bottom left (beside the score it wouldn't fit).
// The pill's rules are in ui/poster-card/ScorePill.tsx.
//
// The title actions (ui/poster-card/CardActions.tsx) load as their own chunk at the first interaction with the page
// and mount on the first hover, focus or tap: a panel on hover for a pointer, tiles over the art after a first tap on
// a touch screen (a second tap, or Open, goes to the title page). After Not interested the card keeps its place,
// greyed, with Undo, until the list is next loaded. A title already hidden (the Hidden titles page) starts under that
// cover, and its Undo is the page's.
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
import type { Score } from "~/server/scores.server"
import type { TitleCard } from "~/server/title-cards.server"
import { Poster, type PosterProps } from "~/ui/Poster"
import MediaText from "~/ui/media-text/MediaText"
import { presentedText } from "~/ui/media-text/media-text"
import type {
	ActionsPlacement,
	OpenActions,
} from "~/ui/poster-card/CardActions"
import { HiddenCover } from "~/ui/poster-card/HiddenCover"
import { OwnerScore } from "~/ui/poster-card/OwnerScore"
import { TitleScorePill } from "~/ui/poster-card/ScorePill"
import { FOCUS } from "~/ui/poster-card/look"
import { setRevealed, useRevealed } from "~/ui/poster-card/reveal"
import { type ServiceOffer, YourServiceLogos } from "~/ui/poster-card/services"
import { HiddenTileContext } from "~/ui/title-actions/hide-feedback"
import { touchPointerNow, useTouchPointer } from "~/ui/title-actions/pointer"
import { RatingMark } from "~/ui/title-card/RatingMark"
import { onFirstInteraction } from "~/utils/first-interaction"
import { titleToDashed } from "~/utils/helpers"
import {
	type PresentedMedia,
	canonicalMediaTitle,
} from "~/utils/media-presentation"
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

/** The least a card needs, for a surface whose titles come in a shape of their own. */
export interface CardTitle extends PresentedMedia {
	tmdb_id: number
	title: string
	release_year?: number | string | null
	poster_path?: string | null
	/** GoodWatch score, 0 to 100. */
	goodwatch_overall_score_normalized_percent?: number | null
	/** The title's services where the viewer watches; the card shows the viewer's own among them. */
	streaming_links?: readonly ServiceOffer[] | null
}

/** The Hidden titles page's card: the title is Not interested, and Undo takes that back. */
export interface HiddenState {
	onUndo: () => void
	/** Undo is on its way. */
	pending?: boolean
}

interface MovieTvCardProps {
	details:
		| MovieDetails
		| TVDetails
		| DiscoverResult
		| OnboardingResult
		| TitleCard
		| CardTitle
	mediaType: "movie" | "show"
	prefetch?: boolean
	/**
	 * "none" for a page that keeps the router from asking for the title route when the card renders (the start page,
	 * whose scripts all wait for the first paint): the route is looked up at the click instead.
	 */
	discover?: "none"
	/** The title's age rating for the viewer, shown while an age limit is on. */
	rating?: RatingBadge | null
	/** The poster's displayed widths, when the card isn't in the grid. */
	posterSizes?: PosterProps["sizes"]
	/** The widest the poster is drawn, with `posterSizes`, when the cards are smaller than the grid's. */
	posterMaxWidth?: PosterProps["maxWidth"]
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
	/** The title is hidden already: the card starts under its Not interested cover, without actions. */
	hidden?: HiddenState
	/**
	 * On another member's pages: their score for the title, as a filled square. Never on the viewer's own pages, where
	 * the pill's "you" says it.
	 */
	ownerScore?: Score | null
	/** Whose `ownerScore` it is, for the tooltip and screen readers. */
	ownerName?: string | null
}

/** Under this width (4.5rem) the card has no actions: a tap opens the title. */
const NO_ACTIONS_PX = 72

type CardDetails = MovieTvCardProps["details"] & {
	streaming_links?: readonly ServiceOffer[] | null
}

export function MovieTvCard({
	details,
	mediaType,
	prefetch = false,
	discover,
	rating,
	posterSizes,
	posterMaxWidth,
	posterPriority,
	skipOffscreen = false,
	actions: actionsOn = "bottom",
	newOn,
	skipWant = false,
	hidden,
	ownerScore = null,
	ownerName,
}: MovieTvCardProps) {
	const actions = hidden ? false : actionsOn
	const ratings = extractRatings(details)
	const cardKey = useId()
	const touchLater = useTouchPointer()
	// Set by a tap that came before the idle-time answer: the tap itself tells the card it is on a touch screen.
	const [touchNow, setTouchNow] = useState(false)
	const touch = touchLater || touchNow
	const revealed = useRevealed(cardKey)
	const frame = useRef<HTMLDivElement>(null)
	const [armed, setArmed] = useState(false)
	const [open, setOpen] = useState<OpenActions>(null)
	const [tileShown, setTile] = useState(false)
	const tile = tileShown || Boolean(hidden)
	const arm = useCallback(() => setArmed(true), [])
	useEffect(() => {
		if (actions) preloadCardActions()
	}, [actions])

	// A grid whose list reloads keeps this card in place while its Not interested cover shows.
	const keeper = useContext(HiddenTileContext)
	const tmdbId = details.tmdb_id
	const title = details.title
	useEffect(() => {
		if (!tileShown || !keeper) return
		const kept = { mediaType, details: { tmdb_id: tmdbId, title } }
		keeper.keep(kept)
		return () => keeper.release(kept)
	}, [tileShown, keeper, mediaType, tmdbId, title])

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
				discover={discover}
				draggable="false"
				onClick={(event) => {
					// Touch: the first tap shows the actions over the art, the second opens the title.
					if (!actions || tile) return
					// Too narrow for tiles: the tap opens the title.
					if ((frame.current?.offsetWidth ?? NO_ACTIONS_PX) < NO_ACTIONS_PX)
						return
					if (!touch) {
						if (!touchPointerNow()) return
						setTouchNow(true)
					}
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
						maxWidth={posterMaxWidth}
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
					<div className="absolute right-1 top-1 z-[25] flex flex-col items-end gap-1 @min-[11rem]/card:right-2 @min-[11rem]/card:top-2">
						<TitleScorePill
							mediaType={mediaType}
							tmdbId={details.tmdb_id}
							goodwatch={ratings?.goodwatch_overall_score_normalized_percent}
							skipWant={skipWant}
							// The owner's square takes the pill's place under 7.5rem.
							className={
								ownerScore != null
									? "hidden! @min-[7.5rem]/card:inline-flex!"
									: ""
							}
						/>
						{ownerScore != null && (
							<OwnerScore
								score={ownerScore}
								name={ownerName}
								size="auto"
								className="@min-[7.5rem]/card:hidden"
							/>
						)}
					</div>
					{(rating || ownerScore != null) && (
						// Under 4.5rem the badge and the score don't fit side by side: the badge goes to the foot, where no logos
						// show at that width.
						<div className="absolute bottom-1 left-1 flex flex-col items-start gap-1 @min-[4.5rem]/card:top-1 @min-[4.5rem]/card:bottom-auto @min-[11rem]/card:left-2 @min-[11rem]/card:top-2">
							{rating && <RatingMark rating={rating} />}
							{ownerScore != null && (
								<OwnerScore
									score={ownerScore}
									name={ownerName}
									size="auto"
									className="hidden! @min-[7.5rem]/card:inline-flex!"
								/>
							)}
						</div>
					)}
					<YourServiceLogos
						offers={offers}
						newOn={newOn}
						className={`absolute bottom-1.5 left-1.5 transition-opacity @min-[11rem]/card:bottom-2 @min-[11rem]/card:left-2 ${actions ? "can-hover:group-hover/card:opacity-0 can-hover:group-focus-within/card:opacity-0" : ""}`}
					/>
				</div>
			)}
			{hidden && (
				<HiddenCover
					title={details.title}
					onUndo={hidden.onUndo}
					pending={hidden.pending}
				/>
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
						tile={tileShown}
						setTile={setTile}
					/>
				</Suspense>
			)}
		</div>
	)
}
