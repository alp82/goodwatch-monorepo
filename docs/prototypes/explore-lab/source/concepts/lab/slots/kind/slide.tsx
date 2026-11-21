// PROTOTYPE - throwaway (prototype/explore-r5). Kind control "Slide": one thumb with three resting places. On a
// word it is that kind alone; pulled by its inner edge it grows over both words; pushed on it lets go of the first.
// Drag it, or use the words (and the small grip on the thumb's edge, which is the "pull me" in one click).
import { Link, useNavigate } from "@remix-run/react"
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion"
import { type KeyboardEvent, type PointerEvent, useEffect, useRef } from "react"
import type { Kind } from "../../../../kit/address"
import { SPRING } from "../../../../kit/ui"
import type { SlotVariant } from "../../contract"
import type { KindProps } from "./slot"
import { Seam, Track, W, WORD, WORD_LIT, byKind, kindNotes, useShownKind } from "./track"

const TOTAL = W.movie + W.gap + W.show
const SEAM = W.movie + W.gap / 2
/** How far the right edge travels to take in Shows, and the left edge to let go of Movies. */
const GROW = W.gap + W.show
const LEAVE = W.movie + W.gap
const ORDER: Kind[] = ["movie", "all", "show"]
const STOP: Record<Kind, number> = { movie: 0, all: 0.5, show: 1 }

// The thumb at t: 0 on Movies, 0.5 over both, 1 on Shows. First the right edge grows, then the left edge lets go.
const leftAt = (t: number) => (t <= 0.5 ? 0 : (t - 0.5) * 2 * LEAVE)
const rightAt = (t: number) => (t <= 0.5 ? W.movie + t * 2 * GROW : TOTAL)
// t as a distance in px along that travel and back, so the moving edge stays under the finger.
const toPx = (t: number) => (t <= 0.5 ? t * 2 * GROW : GROW + (t - 0.5) * 2 * LEAVE)
const toT = (px: number) => (px <= GROW ? px / (2 * GROW) : 0.5 + (px - GROW) / (2 * LEAVE))
const nearest = (t: number): Kind => (t < 0.25 ? "movie" : t > 0.75 ? "show" : "all")

function View({ kinds }: KindProps) {
	const k = byKind(kinds)
	const shown = useShownKind(kinds)
	const navigate = useNavigate()
	const reduce = useReducedMotion()
	const t = useMotionValue(STOP[shown])
	const l = useTransform(t, leftAt)
	const r = useTransform(t, rightAt)
	const drag = useRef<{ id: number; x: number; from: number; moved: boolean; at: number } | null>(
		null,
	)
	const dragged = useRef(false)

	const settle = (to: number) => {
		if (reduce) t.set(to)
		else animate(t, to, SPRING)
	}
	// Follow the page (and a click that is loading) whenever no finger holds the thumb.
	useEffect(() => {
		if (drag.current?.moved) return
		if (reduce) {
			t.set(STOP[shown])
			return
		}
		const a = animate(t, STOP[shown], SPRING)
		return () => a.stop()
	}, [shown, reduce, t])

	const go = (kind: Kind) => {
		settle(STOP[kind])
		if (kind !== shown) navigate(k[kind].href)
	}

	const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
		if (e.button !== 0) return
		dragged.current = false
		drag.current = { id: e.pointerId, x: e.clientX, from: toPx(t.get()), moved: false, at: 0 }
	}
	const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
		const d = drag.current
		if (!d || d.id !== e.pointerId) return
		const dx = e.clientX - d.x
		if (!d.moved) {
			if (Math.abs(dx) < 5) return
			d.moved = true
			dragged.current = true
			e.currentTarget.setPointerCapture(e.pointerId)
		}
		const full = GROW + LEAVE
		const px = d.from + dx
		// Past either end the thumb gives a little, then holds.
		const soft = px < 0 ? px / 4 : px > full ? full + (px - full) / 4 : px
		d.at = soft
		t.set(toT(Math.max(-8, Math.min(full + 8, soft))))
	}
	const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
		const d = drag.current
		drag.current = null
		if (!d || d.id !== e.pointerId || !d.moved) return
		go(nearest(t.get()))
	}
	const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
		if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
		const next = ORDER[ORDER.indexOf(shown) + (e.key === "ArrowRight" ? 1 : -1)]
		if (!next) return
		e.preventDefault()
		go(next)
	}

	// The grip rides the thumb's inner edge and fades as the thumb takes in both words.
	const gripX = useTransform(t, (v) => (v <= 0.5 ? rightAt(v) - 8 : leftAt(v) + 5))
	const gripOpacity = useTransform(t, [0, 0.3, 0.7, 1], [1, 0, 0, 1])
	const both = shown === "all"
	const other = shown === "show" ? k.movie : k.show
	// A small pull toward the other word while the pointer rests on the grip.
	const hint = (on: boolean) => {
		if (both || drag.current || reduce) return
		animate(t, STOP[shown] + (on ? (shown === "movie" ? 0.07 : -0.07) : 0), SPRING)
	}

	return (
		<Track
			label="Movies, shows, or both"
			total={TOTAL}
			l={l}
			r={r}
			className="cursor-grab touch-pan-y active:cursor-grabbing"
			inner={{
				onPointerDown,
				onPointerMove,
				onPointerUp,
				onPointerCancel: onPointerUp,
				onKeyDown,
				// A drag must not also follow the link it started on.
				onClickCapture: (e) => {
					if (!dragged.current) return
					dragged.current = false
					e.preventDefault()
					e.stopPropagation()
				},
				"data-keys": "",
			}}
			lit={
				<>
					<span className={WORD_LIT} style={{ width: W.movie }}>
						Movies
					</span>
					<span className={WORD_LIT} style={{ width: W.show, marginLeft: W.gap }}>
						Shows
					</span>
					{both && <Seam at={SEAM} />}
					<motion.span
						className="absolute top-1/2 left-0 -mt-[5px] flex flex-col gap-[2px]"
						style={{ x: gripX, opacity: gripOpacity }}
					>
						{[0, 1, 2].map((i) => (
							<span key={i} className="block h-[2px] w-[2px] rounded-full bg-gray-950/40" />
						))}
					</motion.span>
				</>
			}
		>
			{(["movie", "show"] as const).map((kind) => (
				<Link
					key={kind}
					to={k[kind].href}
					prefetch="intent"
					draggable={false}
					aria-current={shown === kind ? "page" : undefined}
					title={both ? `Only ${k[kind].label.toLowerCase()}` : undefined}
					className={`${WORD} cursor-[inherit]`}
					style={{ width: W[kind], marginLeft: kind === "show" ? W.gap : 0 }}
				>
					{k[kind].label}
				</Link>
			))}
			{!both && (
				<Link
					to={k.all.href}
					prefetch="intent"
					draggable={false}
					aria-label={`Add ${other.label.toLowerCase()}`}
					title={`Pull to add ${other.label.toLowerCase()}`}
					onPointerEnter={() => hint(true)}
					onPointerLeave={() => hint(false)}
					onFocus={() => hint(true)}
					onBlur={() => hint(false)}
					// The thumb's inner edge: 18px wide, the grip in its middle.
					className="absolute inset-y-0 z-10 w-[18px] -translate-x-1/2 cursor-ew-resize rounded-full outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
					style={{ left: shown === "movie" ? W.movie - 5 : W.movie + W.gap + 5 }}
				/>
			)}
		</Track>
	)
}

export const variant: SlotVariant<never, KindProps> = {
	id: "slide",
	name: "Slide",
	what: "One thumb, three resting places: on Movies, over both, on Shows. Drag it, or pull the grip on its inner edge.",
	order: 2,
	View,
	notes: kindNotes,
}
