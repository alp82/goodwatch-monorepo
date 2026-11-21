// Movies & Shows: the control at the start of the Browse row that picks movies, shows, or both together (`/all/...`).
// A word picks that kind alone. The "&" between them is the small extra control: it grows the pill over both words, and
// the lit control then reads as the phrase it means. Pressed again it lets go, back to the word you had.
//
// The pill is one lit window that travels and stretches: a clip over a dark copy of the words, so a word turns dark
// exactly where the pill covers it. Nothing changes layout while it moves: the cells have fixed widths and only the
// clip animates.
import { Link, useNavigation } from "@remix-run/react"
import {
	type MotionValue,
	animate,
	motion,
	useMotionTemplate,
	useMotionValue,
	useReducedMotion,
	useTransform,
} from "framer-motion"
import { type ReactNode, useEffect, useRef, useState } from "react"
import type { Kind } from "~/domain/browse/address"
import { SPRING } from "./motion"

export interface KindChoice {
	kind: Kind
	label: string
	/** The same page for this kind. */
	href: string
	/** Whether the page is this kind. */
	on: boolean
}

/** Cell widths in px: the bold 14px words with the pill's 12px sides. Fixed, so the server draws the final control. */
const W = { movie: 70, show: 64 } as const
const AMP = 22
const TOTAL = W.movie + AMP + W.show
const RADIUS = 16
const WINDOW: Record<Kind, [number, number]> = {
	movie: [0, W.movie],
	show: [W.movie + AMP, TOTAL],
	all: [0, TOTAL],
}

/** A word of the control as a link. `aria-current` is for screen readers; the pill does the showing. */
const WORD =
	"relative flex h-8 shrink-0 items-center justify-center rounded-full text-sm font-bold whitespace-nowrap text-gray-300 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
/** The same word inside the lit window (decoration: the link is underneath). */
const WORD_LIT = "flex h-8 shrink-0 items-center justify-center text-sm font-bold whitespace-nowrap"
const AMP_CELL = "flex h-8 shrink-0 items-center justify-center text-[15px] leading-none font-bold"

const byKind = (kinds: KindChoice[]) => {
	const of = (kind: Kind) => kinds.find((k) => k.kind === kind) as KindChoice
	return { movie: of("movie"), show: of("show"), all: of("all") }
}

/** The kind to show: the one a click is already loading, else the page's. The pill moves on the click. */
function useShownKind(kinds: KindChoice[]): Kind {
	const navigation = useNavigation()
	const here = kinds.find((k) => k.on)?.kind ?? "movie"
	if (navigation.state === "idle" || !navigation.location) return here
	const going = navigation.location.pathname + navigation.location.search
	return kinds.find((k) => k.href === going)?.kind ?? here
}

/** Two edges that spring to where they are told (px from the track's left). */
function useWindow(left: number, right: number) {
	const reduce = useReducedMotion()
	const l = useMotionValue(left)
	const r = useMotionValue(right)
	useEffect(() => {
		if (reduce) {
			l.set(left)
			r.set(right)
			return
		}
		const a = animate(l, left, SPRING)
		const b = animate(r, right, SPRING)
		return () => {
			a.stop()
			b.stop()
		}
	}, [left, right, reduce, l, r])
	return { l, r }
}

export function KindControl({ kinds }: { kinds: KindChoice[] }) {
	const k = byKind(kinds)
	const shown = useShownKind(kinds)
	// The word to fall back to when the "&" lets go.
	const last = useRef<Exclude<Kind, "all">>(shown === "all" ? "movie" : shown)
	if (shown !== "all") last.current = shown
	const [peek, setPeek] = useState(false)
	const both = shown === "all"
	const lit = useWindow(...WINDOW[shown])
	const ghost = useWindow(...WINDOW[peek ? "all" : shown])
	const back = k[last.current]
	return (
		<Track
			l={lit.l}
			r={lit.r}
			ghost={ghost}
			lit={
				<>
					<span className={WORD_LIT} style={{ width: W.movie }}>
						Movies
					</span>
					<span className={AMP_CELL} style={{ width: AMP }}>
						&amp;
					</span>
					<span className={WORD_LIT} style={{ width: W.show }}>
						Shows
					</span>
				</>
			}
		>
			<Link
				to={k.movie.href}
				prefetch="intent"
				aria-current={shown === "movie" ? "page" : undefined}
				title={both ? "Only movies" : undefined}
				className={WORD}
				style={{ width: W.movie }}
			>
				Movies
			</Link>
			<Link
				to={both ? back.href : k.all.href}
				prefetch="intent"
				aria-label={both ? `Only ${back.label.toLowerCase()}` : "Movies and shows together"}
				aria-current={both ? "page" : undefined}
				title={both ? `Only ${back.label.toLowerCase()}` : "Movies and shows together"}
				onPointerEnter={() => setPeek(true)}
				onPointerLeave={() => setPeek(false)}
				onFocus={() => setPeek(true)}
				onBlur={() => setPeek(false)}
				onClick={() => setPeek(false)}
				// The hit area reaches a little into both words: 34px wide for a finger.
				className={`${AMP_CELL} relative z-10 rounded-full text-gray-400 outline-none transition-colors before:absolute before:inset-y-0 before:-inset-x-1.5 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400`}
				style={{ width: AMP }}
			>
				&amp;
			</Link>
			<Link
				to={k.show.href}
				prefetch="intent"
				aria-current={shown === "show" ? "page" : undefined}
				title={both ? "Only shows" : undefined}
				className={WORD}
				style={{ width: W.show }}
			>
				Shows
			</Link>
		</Track>
	)
}

function useClip(l: MotionValue<number>, r: MotionValue<number>) {
	const rest = useTransform(r, (v) => TOTAL - v)
	return useMotionTemplate`inset(0px ${rest}px 0px ${l}px round ${RADIUS}px)`
}

/**
 * The track. `children` are the real links (gray words), `lit` the same words in dark for the window, `ghost` a second
 * window in faint white that previews where the pill would go. Inside the Browse row (`data-kband` on a parent) the
 * track drops its left rounding: its band runs on to the screen's left edge.
 */
function Track({
	l,
	r,
	ghost,
	lit,
	children,
}: {
	l: MotionValue<number>
	r: MotionValue<number>
	ghost: { l: MotionValue<number>; r: MotionValue<number> }
	lit: ReactNode
	children: ReactNode
}) {
	const clip = useClip(l, r)
	return (
		<nav
			aria-label="Movies, shows, or both"
			className="relative flex max-w-full rounded-full bg-white/[0.08] p-1 ring-1 ring-white/[0.14] select-none group-data-[kband]:rounded-l-none group-data-[kband]:shadow-[inset_0_1px_0_rgb(255_255_255/0.14),inset_0_-1px_0_rgb(255_255_255/0.14),inset_-1px_0_0_rgb(255_255_255/0.14)] group-data-[kband]:ring-0"
		>
			<div className="relative flex h-8" style={{ width: TOTAL }}>
				<Ghost l={ghost.l} r={ghost.r} />
				{children}
				<motion.div
					aria-hidden
					className="pointer-events-none absolute inset-0 z-20 flex bg-white text-gray-950"
					style={{ clipPath: clip }}
				>
					{lit}
				</motion.div>
				<Edge l={l} r={r} />
			</div>
		</nav>
	)
}

/** The amber edge of the lit pill: it follows the same two edges as the clip, alike on Movies, Shows, and both. */
function Edge({ l, r }: { l: MotionValue<number>; r: MotionValue<number> }) {
	const width = useTransform([l, r], ([a, b]: number[]) => b - a)
	return (
		<motion.span
			aria-hidden
			className="pointer-events-none absolute inset-y-0 z-30 rounded-full ring-2 ring-amber-400 ring-inset"
			style={{ left: l, width }}
		/>
	)
}

/** The preview window: it reaches the track's own rounded edge (past the 4px padding), not just the cells. */
function Ghost({ l, r }: { l: MotionValue<number>; r: MotionValue<number> }) {
	const left = useTransform(l, (v) => (v <= 0.5 ? 0 : v + 4))
	const right = useTransform(r, (v) => (v >= TOTAL - 0.5 ? 0 : TOTAL - v + 4))
	const clip = useMotionTemplate`inset(0px ${right}px 0px ${left}px round ${RADIUS + 4}px)`
	return (
		<motion.span
			aria-hidden
			className="pointer-events-none absolute -inset-1 bg-white/[0.16]"
			style={{ clipPath: clip }}
		/>
	)
}
