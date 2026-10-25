// The score pill in a poster's top-right corner, and in the quick view's header: one dark pill holding the GoodWatch
// score (its block in the score's colour), the viewer's own score ("you 8", the number in its score colour), and one
// state icon after a hairline (Wishlist, Seen, or a show's status). An S card shows one number: the viewer's score,
// else the GoodWatch score, and no icon.
import {
	BookmarkIcon,
	EyeIcon,
	PauseIcon,
	PlayIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import gwLogo from "~/img/goodwatch-logo.webp?no-inline"
import type { Score } from "~/server/scores.server"
import { vibe } from "~/ui/profile/parts"
import { assetUrl } from "~/utils/asset-url"
import {
	goodwatchScoreDisplay,
	goodwatchVibeIndex,
	hasGoodwatchScore,
} from "~/utils/ratings"
import { type PillMark, pillMark, useTitleMarks } from "./marks"
import type { PartSize } from "./size"

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
		h: "h-5 @min-[6.5rem]/card:h-6 @min-[11rem]/card:h-7",
		num: "text-[12px] @min-[6.5rem]/card:text-[14px] @min-[11rem]/card:text-[16px]",
		you: "text-[9px] @min-[6.5rem]/card:text-[10px] @min-[11rem]/card:text-[11px]",
		icon: "size-3.5 @min-[6.5rem]/card:size-4 @min-[11rem]/card:size-[18px]",
		px: "px-1 @min-[11rem]/card:px-2",
		markPx: "px-1 @min-[11rem]/card:px-1.5",
		rule: "h-3 @min-[11rem]/card:h-4",
	},
} as const

/** Shown only from M up (S has one number and no icon). */
const FROM_M: Record<PartSize, string> = {
	S: "hidden",
	M: "",
	L: "",
	auto: "hidden @min-[6.5rem]/card:inline-flex",
}

/** The GoodWatch logo in its block: on L, and on M from an 8rem card. */
const LOGO: Record<PartSize, string> = {
	S: "hidden",
	M: "hidden h-3 @min-[8rem]/card:inline",
	L: "h-3.5",
	auto: "hidden h-3 @min-[8rem]/card:inline @min-[11rem]/card:h-3.5",
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
	// S shows one number: with the viewer's score, GoodWatch's steps aside.
	const gwShows = hasGw && !(size === "S" && score != null)
	const showMark = mark != null && size !== "S"
	if (!gwShows && score == null && !showMark) return null

	const gw = gwShows && (
		<span
			className={`${score != null ? FROM_M[size] || "inline-flex" : "inline-flex"} ${p.h} items-center gap-1 rounded-[5px] ${p.px} bg-vibe-${goodwatchVibeIndex(goodwatch)} ${p.num} font-black tabular-nums text-white`}
		>
			<img src={assetUrl(gwLogo)} alt="" className={`${LOGO[size]} w-auto`} />
			<span className="sr-only">GoodWatch score </span>
			{goodwatchScoreDisplay(goodwatch)}
		</span>
	)
	const you = score != null && (
		<span
			className={`inline-flex ${p.h} items-center gap-1 ${p.px} ${p.num} font-black tabular-nums`}
			style={{ color: vibe(score) }}
		>
			<span className={`${p.you} font-bold text-gray-300`}>
				you<span className="sr-only">r score</span>
			</span>
			{score}
		</span>
	)
	const markOnly = showMark ? FROM_M[size] || "inline-flex" : ""
	return (
		<span
			data-score-pill=""
			className={`inline-flex items-center rounded-md bg-gray-950/90 p-[2px] shadow-md shadow-black/40 ring-1 ring-white/10 ${className}`}
		>
			{gw}
			{you}
			{showMark && (gw || you) && (
				<span
					className={`${markOnly} mx-px w-px self-center bg-white/25 ${p.rule}`}
					aria-hidden
				/>
			)}
			{showMark && (
				<span className={`${markOnly} ${p.h} items-center ${p.markPx}`}>
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
