// PROTOTYPE - throwaway. The Explorer's title card (~/ui/explorer/ProximityCard.tsx), forked for one question: what
// should the way to the title page look like? Today it is a small underlined link under the actions, easy to miss.
// Variants (?variant=<key>), each with the expand motif and the one word "Details":
// - bar: one wide button at the foot of the card.
// - hero: the card's picture is the door, with a "Details" pill on it.
// - tile: a door in the middle of the card, with the poster and what's behind it.
// - current: today's link, to compare.
import {
	ArrowsPointingOutIcon,
	MapPinIcon,
	NoSymbolIcon,
	XMarkIcon,
} from "@heroicons/react/24/solid"
import { Link, useSearchParams } from "@remix-run/react"
import { forwardRef } from "react"
import type { ExplorerCard, ExplorerTitle } from "~/domain/explorer"
import { useUserScore } from "~/hooks/useUserDataAccessors"
import type { MovieResult } from "~/server/types/details-types"
import UserAction from "~/ui/auth/UserAction"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { SignUpPrompt } from "~/ui/sign-up-prompt/SignUpPrompt"
import { ActionButton } from "~/ui/title-actions/ActionButton"
import { TitleScore } from "~/ui/title-actions/TitleScore"
import {
	SEEN_INSTRUCTIONS,
	useTitleActions,
} from "~/ui/title-actions/useTitleActions"
import { titleToDashed } from "~/utils/helpers"
import { matchColor } from "~/ui/explorer/color"
import { TMDB } from "~/ui/explorer/images"

import { titlePath } from "~/ui/explorer/ProximityCard"

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
	/** A score, Want to See, or Seen it changed, for a short confirmation. */
	onAction: (message: string, seen?: boolean) => void
	/** Not interested was turned on; `undo` takes it back. */
	onHide: (undo: () => void) => void
}

/**
 * The card of the title nearest the focus, over the live map: the title's backdrop, its GoodWatch score, its taste
 * match (or the viewer's rating), the services that carry it, why it fits, and the title actions: the score control,
 * Want to See, Seen it, and Not interested as a link beside the one to the title page.
 */
export const OpenCard = forwardRef<HTMLDivElement, ProximityCardProps>(
	function OpenCard(
		{ title, where, card, pinned, form, peek, onPin, onClose, onAction, onHide },
		ref,
	) {
		const variant = useVariant()
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
					{variant === "hero" && !peek && (
						<Link
							to={titlePath(title)}
							className="proto-door-hero"
							aria-label={`Details of ${title.title}`}
						>
							<span className="proto-door-pill">
								<ArrowsPointingOutIcon className="h-4 w-4" aria-hidden />
								Details
							</span>
						</Link>
					)}
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
							<Actions
								title={title}
								onAction={onAction}
								onHide={onHide}
								variant={variant}
							/>
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

/** The score control, Want to See and Seen it as the title page draws them, and the two links under them. */
function Actions({
	title,
	onAction,
	onHide,
	variant,
}: {
	title: ExplorerTitle
	onAction: ProximityCardProps["onAction"]
	onHide: ProximityCardProps["onHide"]
	variant: Variant
}) {
	const media = {
		mediaType: title.mediaType,
		details: { tmdb_id: title.tmdbId, title: title.title },
	}
	const a = useTitleActions(media)
	const seen = a.seen || title.seen
	return (
		<>
			{/* tile: a door in the middle of the card, with the poster and what's behind it. */}
			{variant === "tile" && (
				<Link to={titlePath(title)} className="proto-door-tile">
					<img src={`${TMDB}/w92${title.poster}`} alt="" />
					<span className="proto-door-words">
						<b>Details</b>
						<span>Cast, trailer, where to watch</span>
					</span>
					<ArrowsPointingOutIcon className="h-5 w-5 shrink-0" aria-hidden />
				</Link>
			)}
			<div className="mt-3">
				<TitleScore
					media={media}
					size="compact"
					onRated={() => onAction("Score saved", true)}
				/>
			</div>
			<div className="ex-acts">
				<ActionButton
					kind="want"
					active={a.want}
					disabled={a.wantPending}
					onClick={() => {
						a.toggleWant()
						onAction(a.want ? "Removed from Wishlist" : "Added to Wishlist")
					}}
				/>
				<UserAction instructions={SEEN_INSTRUCTIONS}>
					<ActionButton
						kind="seen"
						active={seen}
						disabled={a.seenPending}
						{...a.seenLog}
						onClick={(event) => {
							// A rated movie stays Seen through its score: the press says so and sends nothing. With the
							// movie watch log the press goes to the log, which answers with its own toast.
							if (!a.toggleSeen(event)) return
							onAction(
								a.seen ? "Unmarked as seen" : "Marked as seen",
								!a.seen,
							)
						}}
					/>
				</UserAction>
			</div>
			{/* bar: one wide button closes the card. */}
			{variant === "bar" && (
				<Link to={titlePath(title)} className="proto-door-bar">
					<ArrowsPointingOutIcon className="h-4 w-4" aria-hidden />
					Details
				</Link>
			)}
			<div
				className={`flex items-center gap-3 ${variant === "current" ? "justify-between" : "justify-end"}`}
			>
				{variant === "current" && (
					<Link to={titlePath(title)} className="ex-open">
						Open the title page
					</Link>
				)}
				{/* For a title the person hasn't seen: not offered once it's seen or scored. */}
				{!seen && a.score == null && title.rating == null && !a.hidden && (
					<button
						type="button"
						className="ex-open cursor-pointer gap-1.5"
						disabled={a.hidePending}
						onClick={() => onHide(a.hide())}
					>
						<NoSymbolIcon className="h-4 w-4" aria-hidden />
						Not interested
					</button>
				)}
			</div>
		</>
	)
}

export const OPEN_VARIANTS = {
	tile: "A door in the middle",
	hero: "The picture is the door",
	bar: "One wide button",
	current: "Today's link",
} as const
type Variant = keyof typeof OPEN_VARIANTS
function useVariant(): Variant {
	const want = useSearchParams()[0].get("variant") ?? ""
	return want in OPEN_VARIANTS ? (want as Variant) : "tile"
}

export const OPEN_CSS = `
.proto-door-bar{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:10px;min-height:46px;border-radius:13px;font-weight:800;font-size:15px;color:#0b0f1c;background:#f4f6ff;box-shadow:0 6px 22px rgba(160,190,255,.3);transition:transform .15s,box-shadow .15s}
.proto-door-bar:hover{transform:translateY(-1px);box-shadow:0 10px 28px rgba(160,190,255,.45)}
.proto-door-hero{position:absolute;inset:0;z-index:1;display:flex;align-items:flex-end;justify-content:flex-end;padding:12px;border-radius:inherit}
.proto-door-hero:hover .proto-door-pill{background:#f4f6ff;color:#0b0f1c}
.proto-door-pill{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px;border-radius:999px;font-weight:800;font-size:14px;color:#fff;background:rgba(10,14,26,.72);border:1px solid rgba(255,255,255,.28);backdrop-filter:blur(8px);transition:background .15s,color .15s}
.ex-card-hero:has(.proto-door-hero){cursor:pointer}
.ex-card-hero:has(.proto-door-hero) .ex-card-bd{transition:transform .35s}
.ex-card-hero:has(.proto-door-hero:hover) .ex-card-bd{transform:scale(1.05)}
.ex-card-hero:has(.proto-door-hero) .ex-card-tools{z-index:2}
.proto-door-tile{display:flex;align-items:center;gap:12px;margin-top:12px;padding:8px 14px 8px 8px;border-radius:14px;color:#fff;background:linear-gradient(to right,color-mix(in srgb,var(--isl) 26%,rgba(255,255,255,.06)),rgba(255,255,255,.06));border:1px solid color-mix(in srgb,var(--isl) 55%,rgba(255,255,255,.18));transition:transform .15s,border-color .15s,background .15s}
.proto-door-tile:hover{transform:translateY(-1px);border-color:#fff}
.proto-door-tile img{width:38px;height:57px;border-radius:6px;object-fit:cover;box-shadow:0 4px 12px rgba(0,0,0,.6)}
.proto-door-words{display:flex;flex:1;min-width:0;flex-direction:column;line-height:1.25}
.proto-door-words b{font-size:16px;font-weight:800}
.proto-door-words span{font-size:12.5px;color:var(--mute)}
`
