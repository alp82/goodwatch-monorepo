// PROTOTYPE - throwaway. The Explorer's title card (~/ui/explorer/ProximityCard.tsx), forked for one question: what
// should the way to the title page look like? Today it is a small underlined link under the actions, easy to miss.
// The owner chose the card's picture as the door (2026-10-13). Variants (?variant=<key>):
// - hero: the whole header is the link: it wears a ring in the island's color, the title ends in an arrow, and it
//   answers the pointer. "Details" and close (or pin) are one control, top right, with one look. Not interested is
//   gone from the card.
// - current: today's link, to compare.
import {
	ArrowsPointingOutIcon,
	ChevronRightIcon,
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
		{
			title,
			where,
			card,
			pinned,
			form,
			peek,
			onPin,
			onClose,
			onAction,
			onHide,
		},
		ref,
	) {
		const variant = useVariant()
		/** The header is the way to the title page (a peek opens the card first). */
		const door = variant === "hero" && !peek
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
				className={`ex-card ex-card-${form} ${peek ? "ex-card-peek" : ""} ${pinned ? "ex-card-pinned" : ""} ${door ? "proto-has-door" : ""}`}
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
						<h2 className="ex-card-t">
							{title.title}
							{door && (
								<ChevronRightIcon className="proto-door-arrow" aria-hidden />
							)}
						</h2>
						<p className="ex-card-meta">{meta}</p>
					</div>
					{door && (
						<Link
							to={titlePath(title)}
							className="proto-door"
							aria-label={`Details of ${title.title}`}
						/>
					)}
					<div className={door ? "ex-card-tools proto-tools" : "ex-card-tools"}>
						{door && (
							<Link to={titlePath(title)} className="proto-tool-details">
								<ArrowsPointingOutIcon className="h-4 w-4" aria-hidden />
								Details
							</Link>
						)}
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
							onAction(a.seen ? "Unmarked as seen" : "Marked as seen", !a.seen)
						}}
					/>
				</UserAction>
			</div>
			{/* Today's two links. With the header as the door there is neither: Not interested left the card. */}
			{variant === "current" && (
				<div className="flex items-center justify-between gap-3">
					<Link to={titlePath(title)} className="ex-open">
						Open the title page
					</Link>
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
			)}
		</>
	)
}

export const OPEN_VARIANTS = {
	hero: "The header is the door",
	current: "Today's link",
} as const
type Variant = keyof typeof OPEN_VARIANTS
function useVariant(): Variant {
	const want = useSearchParams()[0].get("variant") ?? ""
	return want in OPEN_VARIANTS ? (want as Variant) : "hero"
}

export const OPEN_CSS = `
/* The header as one link: a ring in the island's color says it is one thing, and it answers the pointer. */
.proto-door{position:absolute;inset:0;z-index:1}
.proto-has-door .ex-card-hero{cursor:pointer;overflow:hidden}
.proto-has-door .ex-card-hero::after{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--isl) 75%,transparent);border-radius:inherit;transition:box-shadow .18s}
.proto-has-door .ex-card-hero:hover::after{box-shadow:inset 0 0 0 2px #fff,inset 0 -60px 60px -40px color-mix(in srgb,var(--isl) 60%,transparent)}
.proto-has-door .ex-card-hero:active::after{box-shadow:inset 0 0 0 3px #fff}
.proto-has-door .ex-card-bd{transition:transform .4s cubic-bezier(.2,.8,.2,1)}
.proto-has-door .ex-card-hero:hover .ex-card-bd{transform:scale(1.06)}
.proto-has-door .ex-card-hero:hover .ex-card-t{text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:4px}
.proto-door-arrow{display:inline-block;width:.85em;height:.85em;margin-left:.15em;vertical-align:-.1em;transition:transform .18s}
.proto-has-door .ex-card-hero:hover .proto-door-arrow{transform:translateX(4px)}
/* Details and close (or pin): one control with one look, above the link. */
.proto-tools{z-index:2;display:flex;align-items:stretch;height:40px;right:8px;top:8px;border-radius:12px;background:rgba(10,14,26,.72);border:1px solid rgba(255,255,255,.28);backdrop-filter:blur(8px);overflow:hidden}
.proto-tool-details{display:inline-flex;align-items:center;gap:6px;padding:0 12px;font-weight:800;font-size:14px;color:#fff;transition:background .15s,color .15s}
.proto-tools .ex-icon{width:40px;height:auto;border-radius:0;background:none;backdrop-filter:none;border-left:1px solid rgba(255,255,255,.22)}
.proto-tools .ex-icon:hover{background:rgba(255,255,255,.16)}
.proto-has-door .ex-card-hero:hover .proto-tool-details,.proto-tool-details:hover{background:#f4f6ff;color:#0b0f1c}
.proto-tools:has(.ex-icon:hover) .proto-tool-details{background:none;color:#fff}
/* Pointing at close or pin, the header doesn't say it is a link. */
.proto-has-door .ex-card-hero:has(.ex-icon:hover) .ex-card-t{text-decoration:none}
.proto-has-door .ex-card-hero:has(.ex-icon:hover)::after{box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--isl) 75%,transparent)}
.proto-has-door .ex-card-hero:has(.ex-icon:hover) .ex-card-bd{transform:none}
`
