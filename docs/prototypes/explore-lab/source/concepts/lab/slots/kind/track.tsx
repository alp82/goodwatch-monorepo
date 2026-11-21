// PROTOTYPE - throwaway (prototype/explore-r5). What every `kind` variant is built from: the round 4 track (white 6%,
// a white pill on what is picked) with one difference, the pill is a single lit window that travels and stretches. The
// window is a clip over a white copy of the words, so a word turns dark exactly where the pill covers it, and "both"
// is the pill grown over both words (the union), never a third look.
//
// Nothing here changes layout while it moves: the cells have fixed widths and only the clip animates.
import { useNavigation } from "@remix-run/react"
import {
	type MotionValue,
	animate,
	motion,
	useMotionTemplate,
	useMotionValue,
	useReducedMotion,
	useTransform,
} from "framer-motion"
import { type HTMLAttributes, type ReactNode, type Ref, useEffect } from "react"
import type { Kind } from "../../../../kit/address"
import { SPRING } from "../../../../kit/ui"
import type { KindProps } from "./slot"

/** Cell widths in px: the bold 14px words with the pill's 12px sides. Fixed, so the server draws the final control. */
export const W = { movie: 70, show: 64, both: 56, gap: 4 } as const
const RADIUS = 16

/** A word of the control as a link. `on` only changes the screen reader's "current"; the pill does the showing. */
export const WORD =
	"relative flex h-8 shrink-0 items-center justify-center rounded-full text-sm font-bold whitespace-nowrap text-gray-300 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
/** The same word inside the lit window (decoration: the link is underneath). */
export const WORD_LIT =
	"flex h-8 shrink-0 items-center justify-center text-sm font-bold whitespace-nowrap"

export type KindEntry = KindProps["kinds"][number]

export function byKind(kinds: KindProps["kinds"]) {
	const of = (kind: Kind) => kinds.find((k) => k.kind === kind) as KindEntry
	return { movie: of("movie"), show: of("show"), all: of("all") }
}

/**
 * The kind the control shows: the one a click is already loading, else the page's. The pill moves on the click, not
 * when the next page arrives.
 */
export function useShownKind(kinds: KindProps["kinds"]): Kind {
	const navigation = useNavigation()
	const here = kinds.find((k) => k.on)?.kind ?? "movie"
	if (navigation.state === "idle" || !navigation.location) return here
	const going = navigation.location.pathname + navigation.location.search
	return kinds.find((k) => k.href === going)?.kind ?? here
}

/** Two edges that spring to where they are told (px from the track's left). */
export function useWindow(left: number, right: number) {
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

function useClip(l: MotionValue<number>, r: MotionValue<number>, total: number) {
	const rest = useTransform(r, (v) => total - v)
	return useMotionTemplate`inset(0px ${rest}px 0px ${l}px round ${RADIUS}px)`
}

/**
 * The track. `children` are the real links (gray words), `lit` the same words in dark for the window, `ghost` an
 * optional second window in faint white that previews where the pill would go.
 */
export function Track({
	label,
	total,
	l,
	r,
	ghost,
	lit,
	children,
	innerRef,
	inner,
	className = "",
}: {
	/** The control's name for screen readers. */
	label: string
	/** The width of all cells and gaps, px. */
	total: number
	l: MotionValue<number>
	r: MotionValue<number>
	ghost?: { l: MotionValue<number>; r: MotionValue<number> }
	lit: ReactNode
	children: ReactNode
	innerRef?: Ref<HTMLDivElement>
	/** Handlers and attributes for the cells' box (a variant that drags listens here). */
	inner?: HTMLAttributes<HTMLDivElement> & { [data: `data-${string}`]: string }
	className?: string
}) {
	const clip = useClip(l, r, total)
	return (
		<nav
			aria-label={label}
			className={`relative flex max-w-full rounded-full bg-white/[0.08] p-1 ring-1 ring-white/[0.14] select-none group-data-[kband]:rounded-l-none group-data-[kband]:shadow-[inset_0_1px_0_rgb(255_255_255/0.14),inset_0_-1px_0_rgb(255_255_255/0.14),inset_-1px_0_0_rgb(255_255_255/0.14)] group-data-[kband]:ring-0 ${className}`}
		>
			<div ref={innerRef} className="relative flex h-8" style={{ width: total }} {...inner}>
				{ghost && <Ghost l={ghost.l} r={ghost.r} total={total} />}
				{children}
				<motion.div
					aria-hidden
					data-kind-pill=""
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

/**
 * The amber edge of the lit pill (round 6: the owner liked the accent and lost it on other picks). It follows the same
 * two edges as the clip, so it is the same on Movies, Shows, and both.
 */
function Edge({ l, r }: { l: MotionValue<number>; r: MotionValue<number> }) {
	const width = useTransform([l, r], ([a, b]: number[]) => b - a)
	return (
		<motion.span
			aria-hidden
			data-kind-edge=""
			className="pointer-events-none absolute inset-y-0 z-30 rounded-full ring-2 ring-amber-400 ring-inset"
			style={{ left: l, width }}
		/>
	)
}

function Ghost({ l, r, total }: { l: MotionValue<number>; r: MotionValue<number>; total: number }) {
	// The layer is 4px larger on every side; an edge at the track's end runs out to the track's rounded edge.
	const left = useTransform(l, (v) => (v <= 0.5 ? 0 : v + 4))
	const right = useTransform(r, (v) => (v >= total - 0.5 ? 0 : total - v + 4))
	const clip = useMotionTemplate`inset(0px ${right}px 0px ${left}px round ${RADIUS + 4}px)`
	return (
		<motion.span
			aria-hidden
			// Round 10: the preview reaches the track's own rounded edge (past the 4px padding), not just the cells.
			className="pointer-events-none absolute -inset-1 bg-white/[0.16]"
			style={{ clipPath: clip }}
		/>
	)
}

/** The hairline that keeps two words two words while one pill covers both. Lives in the lit layer. */
export function Seam({ at }: { at: number }) {
	return (
		<span
			aria-hidden
			className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-gray-950/20"
			style={{ left: at }}
		/>
	)
}

/** What the notes panel says about this slot, whatever the variant. */
export const kindNotes = () => [
	{
		term: "Movies, shows, or both",
		means:
			"Both is the pill grown over both words: one lit shape for one list. It leads to /all/... with the same page; a word alone leads back to /movies/... or /shows/....",
		isNew: true,
	},
	{
		term: "Show mark",
		means:
			'On a mixed list every show carries a small "Show" mark in the poster\'s top left corner; movies carry none. A list of one kind has no marks.',
		isNew: true,
	},
	{
		term: "Search engines and /all",
		means:
			"/all pages are the union of two pages that are already indexable, so they would be noindex, follow and stay out of the sitemap; the titles and internal links point to /movies/... and /shows/.... Worth revisiting for countries and services, where people do search for both at once.",
	},
]
