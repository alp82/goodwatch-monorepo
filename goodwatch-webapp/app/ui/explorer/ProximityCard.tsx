import { MapPinIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { forwardRef } from "react"
import type { ExplorerCard, ExplorerTitle } from "~/domain/explorer"
import {
	useIsOnWishlist,
	useIsWatched,
	useUserScore,
} from "~/hooks/useUserDataAccessors"
import {
	useWatchedMutation,
	useWishlistMutation,
} from "~/hooks/useUserDataMutations"
import type { MovieResult } from "~/server/types/details-types"
import UserAction from "~/ui/auth/UserAction"
import { ActionButton } from "~/ui/details/hero/ListActions"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { SignUpPrompt } from "~/ui/sign-up-prompt/SignUpPrompt"
import { titleToDashed } from "~/utils/helpers"
import { matchColor } from "./color"
import { TMDB } from "./images"

export const titlePath = (t: ExplorerTitle) =>
	`/${t.mediaType}/${t.tmdbId}-${titleToDashed(t.title)}`

interface ProximityCardProps {
	title: ExplorerTitle
	/** The island it's on, and its color. */
	where: { name: string; color: string }
	/** The near card from the server: why, services, sign-up; null while it loads. */
	card: ExplorerCard | null
	/** Kept open (tapped), rather than shown because the title is nearest the focus. */
	pinned: boolean
	/** "float" beside the poster on wide screens, "sheet" docked at the bottom on phones. */
	form: "float" | "sheet"
	/** Only the top of the card, until it's tapped. */
	peek: boolean
	onPin: () => void
	onClose: () => void
	/** Want to See or Seen it changed, for a short confirmation. */
	onAction: (message: string, seen?: boolean) => void
}

/** Title and match under a poster near the focus: the small form of the card. */
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

/**
 * The card of the title nearest the focus, over the live map: the title's backdrop, its GoodWatch score, its taste
 * match (or the viewer's rating), the services that carry it, why it fits, and Want to See and Seen it.
 */
export const ProximityCard = forwardRef<HTMLDivElement, ProximityCardProps>(
	function ProximityCard(
		{ title, where, card, pinned, form, peek, onPin, onClose, onAction },
		ref,
	) {
		const kind = title.mediaType === "show" ? "Series" : "Film"
		const meta = [
			title.year ? String(title.year) : "",
			kind,
			title.genres.slice(0, 2).join(" and ").toLowerCase(),
		]
			.filter(Boolean)
			.join(", ")
		// The score ring reads only the GoodWatch score from the title's details.
		const media = {
			details: { goodwatch_overall_score_normalized_percent: title.score },
		} as unknown as MovieResult
		return (
			<div
				ref={ref}
				className={`ex-card ex-card-${form} ${peek ? "ex-card-peek" : ""} ${pinned ? "ex-card-pinned" : ""}`}
				style={{ "--isl": where.color } as React.CSSProperties}
				aria-live="polite"
				aria-label={title.title}
				// biome-ignore lint/a11y/useSemanticElements: a non-modal card over the live map, not a <dialog>.
				role="dialog"
				// A peek opens into the full card when it's tapped anywhere.
				onClick={peek ? onPin : undefined}
				onKeyDown={peek ? (e) => e.key === "Enter" && onPin() : undefined}
			>
				<div className="ex-card-hero">
					{title.backdrop ? (
						<img
							src={`${TMDB}/w780${title.backdrop}`}
							alt=""
							className="ex-card-bd"
						/>
					) : null}
					<div className="ex-card-veil" />
					<div className="ex-card-head">
						<span className="ex-card-where">
							<span className="ex-dot" style={{ background: where.color }} />
							{where.name}
						</span>
						<h2 className="ex-card-t">{title.title}</h2>
						<p className="ex-card-meta">{meta}</p>
					</div>
					<div className="ex-card-tools">
						{pinned ? (
							<button
								type="button"
								className="ex-icon"
								onClick={onClose}
								aria-label="Close"
							>
								<XMarkIcon className="ex-i" />
							</button>
						) : (
							<button
								type="button"
								className="ex-icon"
								onClick={onPin}
								aria-label="Keep this card open"
							>
								<MapPinIcon className="ex-i" />
							</button>
						)}
					</div>
				</div>
				<div className="ex-card-body">
					<div className="ex-card-row">
						<ScoreRing media={media} size={40} label={false} />
						<Standing title={title} card={card} />
						<Services title={title} card={card} />
					</div>
					{!peek && (
						<>
							{card?.signUp && (
								<div className="ex-sign-up">
									<SignUpPrompt feature="tasteMatch" size="inline" />
								</div>
							)}
							{card ? (
								card.why && <p className="ex-why">{card.why}</p>
							) : (
								<p className="ex-why ex-why-wait">
									Looking at why it fits you…
								</p>
							)}
							<Actions title={title} onAction={onAction} />
							<Link to={titlePath(title)} className="ex-open">
								Open the title page
							</Link>
						</>
					)}
					{peek && (
						<p className="ex-peek-hint">
							{form === "sheet"
								? "Tap for why it fits you"
								: "Click to keep it open"}
						</p>
					)}
				</div>
			</div>
		)
	},
)

function Standing({
	title,
	card,
}: { title: ExplorerTitle; card: ExplorerCard | null }) {
	const score = useUserScore(title.mediaType, title.tmdbId)
	const rating = score?.score ?? title.rating
	if (rating)
		return (
			<span className="ex-match">
				You rated it <b>{rating}</b>
			</span>
		)
	if (title.match == null || card?.signUp) return null
	return (
		<span className="ex-match">
			<b style={{ color: matchColor(title.match) }}>{title.match}%</b> your
			taste
		</span>
	)
}

function Services({
	title,
	card,
}: { title: ExplorerTitle; card: ExplorerCard | null }) {
	if (!card) return <span className="ex-card-svc" />
	const list = card.services.filter((s) => s.logo).slice(0, 4)
	// Nothing listed while the country's availability still loads (the map knows the title is on the viewer's services).
	if (!list.length && title.services.length)
		return <span className="ex-card-svc" />
	if (!list.length)
		return (
			<span className="ex-card-svc">
				<span className="ex-card-svc-none">Not streaming here</span>
			</span>
		)
	return (
		<span className="ex-card-svc">
			{list.map((s) => (
				<img
					key={s.id}
					src={`${TMDB}/w92${s.logo}`}
					alt={s.name}
					title={s.name}
					className={s.mine ? "ex-svc-mine" : "opacity-50"}
				/>
			))}
		</span>
	)
}

/** Want to See and Seen it, as the title page draws them. */
function Actions({
	title,
	onAction,
}: {
	title: ExplorerTitle
	onAction: ProximityCardProps["onAction"]
}) {
	const want = useIsOnWishlist(title.mediaType, title.tmdbId)
	const watched = useIsWatched(title.mediaType, title.tmdbId)
	const { mutate: updateWishlist, isPending: wantPending } =
		useWishlistMutation()
	const { mutate: updateWatched, isPending: seenPending } = useWatchedMutation()
	const seen = watched || title.seen
	return (
		<div className="ex-acts">
			<ActionButton
				kind="want"
				active={want}
				disabled={wantPending}
				onClick={() => {
					updateWishlist({
						mediaType: title.mediaType,
						tmdbId: title.tmdbId,
						action: want ? "remove" : "add",
					})
					onAction(want ? "Removed from Wishlist" : "Added to Wishlist")
				}}
			/>
			<UserAction
				instructions={
					<>Your history shows every title you ever have watched.</>
				}
			>
				<ActionButton
					kind="seen"
					active={seen}
					disabled={seenPending}
					onClick={() => {
						updateWatched({
							mediaType: title.mediaType,
							tmdbId: title.tmdbId,
							action: watched ? "remove" : "add",
						})
						onAction(watched ? "Unmarked as seen" : "Marked as seen", !watched)
					}}
				/>
			</UserAction>
		</div>
	)
}
