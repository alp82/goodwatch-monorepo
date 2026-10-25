// The score pill in a poster's top-right corner, in list rows and in the quick view's header: one dark pill holding the
// GoodWatch score (its block in the score's colour), the viewer's own score ("you 8", the number in its score colour),
// and one state icon after a hairline (Wishlist, Seen, or a show's status). A fixed size shows all three (S: one
// number, no icon).
//
// In a poster card ("auto") the pill keeps under ~40% of the card's width, by the card's own width:
// - from 11rem (176 px): two numbers, GoodWatch and yours; without your score, GoodWatch and the state icon;
// - 7.5rem to 11rem: one number, yours; without your score, GoodWatch and the state icon;
// - under 7.5rem: one number, yours, else GoodWatch's; no icon. "you" goes under 6.5rem (104 px);
// - the M look from 6.5rem, the S look under it (never the L look); the GoodWatch logo only beside a lone GoodWatch
//   number, from 8rem.
import {
	BookmarkIcon,
	EyeIcon,
	PauseIcon,
	PlayIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import gwLogo from "~/img/goodwatch-logo.webp?no-inline"
import type { Score } from "~/server/scores.server"
import { assetUrl } from "~/utils/asset-url"
import {
	getVibeColorValue,
	goodwatchScoreDisplay,
	goodwatchVibeIndex,
	hasGoodwatchScore,
} from "~/utils/ratings"
import { type PillMark, pillMark, useTitleMarks } from "./marks"
import type { CardSize, PartSize } from "./size"

// The colour of the viewer's score, as on the profile (ui/profile/parts.tsx `vibe`). Not imported from there: that
// module brings the profile's parts along, to every page with a poster card.
const vibe = (score: number) =>
	getVibeColorValue(Math.max(1, Math.min(10, Math.round(score))) as Score)

const MARK_LOOK: Record<
	PillMark,
	{ Icon: typeof PlayIcon; tint: string; name: string }
> = {
	want: {
		Icon: BookmarkIcon,
		tint: "text-amber-400",
		name: "On your Wishlist",
	},
	watching: { Icon: PlayIcon, tint: "text-sky-300", name: "Watching" },
	on_hold: { Icon: PauseIcon, tint: "text-violet-300", name: "On hold" },
	dropped: { Icon: XMarkIcon, tint: "text-pink-300", name: "Dropped" },
	seen: { Icon: EyeIcon, tint: "text-green-300", name: "Seen" },
}

/** The icon of a pill mark, for other surfaces that show the same state. */
export function PillMarkIcon({
	mark,
	className = "",
}: { mark: PillMark; className?: string }) {
	const { Icon, tint, name } = MARK_LOOK[mark]
	return (
		<Icon
			className={`shrink-0 ${tint} ${className}`}
			aria-label={name}
			role="img"
		/>
	)
}

// Each part's classes per size; "auto" steps through them with the card's container queries (S < 6.5rem ≤ M < 11rem ≤ L).
const LOOK = {
	S: {
		h: "h-5",
		num: "text-[12px]",
		you: "text-[9px]",
		icon: "size-3.5",
		px: "px-1",
		markPx: "px-1",
		rule: "h-3",
	},
	M: {
		h: "h-6",
		num: "text-[14px]",
		you: "text-[10px]",
		icon: "size-4",
		px: "px-1",
		markPx: "px-1",
		rule: "h-3",
	},
	L: {
		h: "h-7",
		num: "text-[16px]",
		you: "text-[11px]",
		icon: "size-[18px]",
		px: "px-2",
		markPx: "px-1.5",
		rule: "h-4",
	},
	auto: {
		h: "h-5 @min-[6.5rem]/card:h-6",
		num: "text-[12px] @min-[6.5rem]/card:text-[14px]",
		you: "text-[9px] @min-[6.5rem]/card:text-[10px]",
		icon: "size-3.5 @min-[6.5rem]/card:size-4",
		px: "px-1",
		markPx: "px-1",
		rule: "h-3",
	},
} as const

/** The GoodWatch logo in its block, fixed sizes: on L, and on M from an 8rem card. */
const LOGO: Record<CardSize, string> = {
	S: "hidden",
	M: "hidden h-3 @min-[8rem]/card:inline",
	L: "h-3.5",
}

/**
 * Which parts show, as classes ("hidden" for never, "" for always), for a fixed size or a card's widths ("auto").
 * With the viewer's score in a card, GoodWatch's number shows only from 11rem and the icon never.
 */
function partsOf(
	size: PartSize,
	scored: boolean,
	hasGw: boolean,
	mark: boolean,
) {
	if (size !== "auto") {
		const fromM = size === "S" ? "hidden" : ""
		return {
			gw: scored ? fromM : "",
			mark: fromM,
			label: "",
			logo: LOGO[size],
			pill: "",
		}
	}
	return {
		gw: scored ? "hidden @min-[11rem]/card:inline-flex" : "",
		mark: scored ? "hidden" : "hidden @min-[7.5rem]/card:inline-flex",
		// Still read out under 6.5rem.
		label: "sr-only @min-[6.5rem]/card:not-sr-only",
		logo: !scored && !mark ? "hidden h-3 @min-[8rem]/card:inline" : "hidden",
		// Only a state icon, which a card under 7.5rem leaves out: no pill there.
		pill: !scored && !hasGw ? "hidden @min-[7.5rem]/card:inline-flex" : "",
	}
}

export interface ScorePillProps {
	/** The GoodWatch score as a percent; nothing for a title without one. */
	goodwatch?: number | null
	/** The viewer's own score. */
	score: Score | null
	/** The state icon at the end, see `pillMark`. */
	mark: PillMark | null
	size?: PartSize
	className?: string
}

/** The pill from given values. `TitleScorePill` reads them for a title. */
export function ScorePill({
	goodwatch,
	score,
	mark,
	size = "auto",
	className = "",
}: ScorePillProps) {
	const p = LOOK[size]
	const hasGw = hasGoodwatchScore(goodwatch)
	const scored = score != null
	const showMark = mark != null && size !== "S" && !(size === "auto" && scored)
	const parts = partsOf(size, scored, hasGw, showMark)
	const gwShows = hasGw && parts.gw !== "hidden"
	if (!gwShows && !scored && !showMark) return null
	const show = (cls: string) => cls || "inline-flex"

	const gw = gwShows && (
		<span
			className={`${show(parts.gw)} ${p.h} items-center gap-1 rounded-[5px] ${p.px} bg-vibe-${goodwatchVibeIndex(goodwatch)} ${p.num} font-black tabular-nums text-white`}
		>
			<img
				src={assetUrl(gwLogo)}
				alt=""
				loading="lazy"
				decoding="async"
				className={`${parts.logo} w-auto`}
			/>
			<span className="sr-only">GoodWatch score </span>
			{goodwatchScoreDisplay(goodwatch)}
		</span>
	)
	const you = scored && (
		<span
			className={`inline-flex ${p.h} items-center gap-1 ${p.px} ${p.num} font-black tabular-nums`}
			style={{ color: vibe(score) }}
		>
			<span className={`${parts.label} ${p.you} font-bold text-gray-300`}>
				you<span className="sr-only">r score</span>
			</span>
			{score}
		</span>
	)
	return (
		<span
			data-score-pill=""
			className={`${show(parts.pill)} items-center rounded-md bg-gray-950/90 p-[2px] shadow-md shadow-black/40 ring-1 ring-white/10 ${className}`}
		>
			{gw}
			{you}
			{showMark && (gw || you) && (
				<span
					className={`${show(parts.mark)} mx-px w-px self-center bg-white/25 ${p.rule}`}
					aria-hidden
				/>
			)}
			{showMark && (
				<span className={`${show(parts.mark)} ${p.h} items-center ${p.markPx}`}>
					<PillMarkIcon mark={mark} className={p.icon} />
				</span>
			)}
		</span>
	)
}

/**
 * The pill for a title, from the viewer's member data: their score, and the state icon. `skipWant` leaves the Wishlist
 * bookmark off, for a list that is the Wishlist.
 */
export function TitleScorePill({
	mediaType,
	tmdbId,
	goodwatch,
	size = "auto",
	skipWant = false,
	className,
}: {
	mediaType: "movie" | "show"
	tmdbId: number
	goodwatch?: number | null
	size?: PartSize
	skipWant?: boolean
	className?: string
}) {
	const marks = useTitleMarks(mediaType, tmdbId)
	return (
		<ScorePill
			goodwatch={goodwatch}
			score={marks.score}
			mark={pillMark(marks, skipWant)}
			size={size}
			className={className}
		/>
	)
}
