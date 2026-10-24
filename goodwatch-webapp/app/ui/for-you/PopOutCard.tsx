// Desktop: the pop-out card.
// - A tap on a result poster lifts that poster out of the grid: a copy drawn at its big size starts scaled down exactly
//   over the grid poster and grows to full size (transform only); the grid poster hides meanwhile. The page behind
//   dims (opacity, no blur), the big poster casts a large soft shadow, and the card (TitleDetail.tsx) fades in beside
//   it with a tiny rise.
// - The card has one fixed size, measured once per open.
// - Next / previous (arrows, arrow keys, a sideways swipe or drag on the card) move the pop-out: the current big poster
//   settles back into its grid slot while the next one lifts from its slot, and the card slides to its new place; its
//   content crossfades. A next poster that is off screen is scrolled into view first; one that isn't rendered fades in.
// - Close: the backdrop, the big poster, the close button or Escape; the poster flies back to its place in the grid (or
//   fades if that place scrolled away). Big posters sit under the card, so one flying home never covers its text.
// Every move is a short ease-out tween: lift 260 ms, home 220 ms, card move 240 ms.
import { AnimatePresence, animate, motion, useMotionValue } from "framer-motion"
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import type { Ranked } from "~/domain/for-you-page/rank"
import {
	CloseButton,
	DetailBody,
	DetailFooter,
	DetailHead,
	detailImages,
} from "./TitleDetail"
import { posterSrc, titleAt, useForYou } from "./context"
import { Crossfade, DIM, DIM_IN, DIM_OUT, EASE_OUT } from "./crossfade"
import { preload, stepTo, useSwipe } from "./swipe"

type Box = { x: number; y: number; w: number; h: number }
type Geo = { poster: Box; card: Box; side: 1 | -1 }
type Size = { w: number; h: number }
type Shown = {
	id: string
	from: Box | null
	closing: boolean
	back: Box | null
}
type Leaving = { r: Ranked; poster: Box; back: Box | null }

const LIFT = { duration: 0.26, ease: EASE_OUT } as const
const BACK = { duration: 0.22, ease: EASE_OUT } as const
const MOVE = { duration: 0.24, ease: EASE_OUT } as const
const GAP = 24
const EDGE = 16

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect

/** The grid poster's image box (the biggest image inside the tapped poster), or null when it is off screen. */
function sourceOf(id: string): { el: HTMLElement; box: Box | null } | null {
	const el = document.querySelector<HTMLElement>(
		`[data-pop-id="${CSS.escape(id)}"]`,
	)
	if (!el) return null
	let best: DOMRect | null = null
	for (const img of el.querySelectorAll("img")) {
		const b = img.getBoundingClientRect()
		if (!best || b.width * b.height > best.width * best.height) best = b
	}
	const b = best ?? el.getBoundingClientRect()
	const on =
		b.bottom > 0 &&
		b.top < window.innerHeight &&
		b.right > 0 &&
		b.left < window.innerWidth &&
		b.width > 0
	return {
		el,
		box: on ? { x: b.left, y: b.top, w: b.width, h: b.height } : null,
	}
}

/** Resolves once the page has stopped scrolling for a moment (or after 900 ms). */
function scrollSettled(): Promise<void> {
	return new Promise((res) => {
		let idle = 0
		const finish = () => {
			window.removeEventListener("scroll", on)
			window.clearTimeout(idle)
			window.clearTimeout(cap)
			res()
		}
		const on = () => {
			window.clearTimeout(idle)
			idle = window.setTimeout(finish, 90)
		}
		const cap = window.setTimeout(finish, 900)
		idle = window.setTimeout(finish, 160)
		window.addEventListener("scroll", on, { passive: true })
	})
}

const clamp = (v: number, lo: number, hi: number) =>
	Math.max(lo, Math.min(hi, v))

/** Where poster and card go for a poster that starts at `from`. */
function geoFor(from: Box | null, size: Size): Geo {
	const vw = document.documentElement.clientWidth
	const vh = window.innerHeight
	const cw = size.w
	const ch = size.h
	const pw = Math.round(Math.min(380, ch / 1.5, vw * 0.26))
	const ph = Math.round(pw * 1.5)
	const sx = from ? from.x + from.w / 2 : vw / 2
	const sy = from ? from.y + from.h / 2 : vh / 2
	// The card goes where there is more room; the pair stays inside the screen.
	const side: 1 | -1 = sx < vw / 2 ? 1 : -1
	const px =
		side === 1
			? clamp(sx - pw / 2, EDGE, vw - EDGE - pw - GAP - cw)
			: clamp(sx - pw / 2, EDGE + cw + GAP, vw - EDGE - pw)
	const py = clamp(sy - ph / 2, EDGE, vh - EDGE - ph)
	const cx = side === 1 ? px + pw + GAP : px - GAP - cw
	const cy = clamp(py + (ph - ch) / 2, EDGE, vh - EDGE - ch)
	return {
		side,
		poster: { x: px, y: py, w: pw, h: ph },
		card: { x: cx, y: cy, w: cw, h: ch },
	}
}

/** The big poster's transform for "drawn over box b" (null: a small fade). */
const toBox = (b: Box | null, t: Box) =>
	b
		? {
				x: b.x - t.x,
				y: b.y - t.y,
				scaleX: b.w / t.w,
				scaleY: b.h / t.h,
				opacity: 1,
			}
		: { x: 0, y: 6, scaleX: 0.97, scaleY: 0.97, opacity: 0 }
const HOME = { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1 }

const CARD =
	"overflow-hidden rounded-3xl bg-gray-900 shadow-[0_30px_80px_-20px_rgba(0,0,0,.95)] ring-1 ring-white/12"
const WIDTH = "w-[28rem]"

export function PopOutCard({
	list,
	openId,
	onOpen,
	onClose,
	answer,
	enabled,
}: {
	list: Ranked[]
	openId: string | null
	onOpen: (r: Ranked) => void
	onClose: () => void
	answer: (r: Ranked) => string | null
	/** Desktop only (phones get the title drawer). */
	enabled: boolean
}) {
	const { pool, detail } = useForYou()
	const keyOf = useCallback((r: Ranked) => pool.keys[r.index], [pool])
	const [shown, setShown] = useState<Shown | null>(null)
	const [size, setSize] = useState<Size | null>(null)
	const [leaving, setLeaving] = useState<Leaving[]>([])
	const [dir, setDir] = useState<-1 | 1>(1)
	// The content's sideways offset and opacity (swipes); the card's offset (moves between posters).
	const cx = useMotionValue(0)
	const co = useMotionValue(1)
	const mx = useMotionValue(0)
	const my = useMotionValue(0)

	// Follow the page's open id: open, or start closing. (Steps set both at once, see go.)
	useEffect(() => {
		if (!enabled) return
		setShown((s) => {
			if (openId && !s) {
				cx.set(0)
				co.set(1)
				mx.set(0)
				my.set(0)
				return {
					id: openId,
					from: sourceOf(openId)?.box ?? null,
					closing: false,
					back: null,
				}
			}
			if (openId && s && (s.id !== openId || s.closing))
				return { ...s, id: openId, closing: false }
			if (!openId && s && !s.closing)
				return { ...s, closing: true, back: sourceOf(s.id)?.box ?? null }
			return s
		})
	}, [openId, enabled, cx, co, mx, my])

	// The grid posters hide while their big copies are out (the open one and any still flying home).
	const hiddenKey = shown
		? [shown.id, ...leaving.map((l) => keyOf(l.r))].join("|")
		: ""
	const hiddenEls = useRef(new Map<string, HTMLElement>())
	useEffect(() => {
		const want = new Set(hiddenKey ? hiddenKey.split("|") : [])
		const map = hiddenEls.current
		for (const [id, el] of map)
			if (!want.has(id)) {
				el.style.visibility = ""
				map.delete(id)
			}
		for (const id of want)
			if (!map.has(id)) {
				const el = sourceOf(id)?.el
				if (el) {
					el.style.visibility = "hidden"
					map.set(id, el)
				}
			}
	}, [hiddenKey])
	useEffect(
		() => () => {
			for (const el of hiddenEls.current.values()) el.style.visibility = ""
		},
		[],
	)

	const index = shown ? list.findIndex((r) => keyOf(r) === shown.id) : -1
	const r = index >= 0 ? list[index] : null
	const geo = shown && size ? geoFor(shown.from, size) : null
	const closing = !!shown?.closing

	// The neighbours' images, decoded ahead.
	useEffect(() => {
		if (index < 0 || !size) return
		for (const n of [list[index + 1], list[index - 1]])
			if (n) {
				const t = titleAt(pool, n.index)
				preload(detailImages(t, detail(t.key), "w500"))
			}
	}, [index, list, size, pool, detail])

	const close = useCallback(() => onClose(), [onClose])

	const busy = useRef(false)
	const go = useCallback(
		async (d: -1 | 1) => {
			const next = list[index + d]
			if (!next || !shown || shown.closing || !size || !geo || !r) {
				animate(cx, 0, BACK)
				animate(co, 1, BACK)
				return
			}
			if (busy.current) return
			busy.current = true
			try {
				const nt = titleAt(pool, next.index)
				const ready = preload(detailImages(nt, detail(nt.key), "w500"))
				// Bring the next poster on screen, then move the pop-out to it.
				let src = sourceOf(nt.key)
				if (src?.el && !src.box) {
					src.el.scrollIntoView({ block: "center", behavior: "smooth" })
					await scrollSettled()
					src = sourceOf(nt.key)
				}
				const from = src?.box ?? null
				const now = geoFor(from, size)
				await stepTo({
					cx,
					co,
					ready,
					swap: () => {
						const back = sourceOf(keyOf(r))?.box ?? null
						setLeaving((ls) => [
							...ls.filter((l) => l.r.index !== r.index),
							{ r, poster: geo.poster, back },
						])
						setDir(d)
						setShown((s) => (s ? { ...s, id: nt.key, from } : s))
						onOpen(next)
						// The card keeps its old place for this frame, then slides to the new one.
						mx.set(mx.get() + geo.card.x - now.card.x)
						my.set(my.get() + geo.card.y - now.card.y)
						animate(mx, 0, MOVE)
						animate(my, 0, MOVE)
					},
				})
			} finally {
				busy.current = false
			}
		},
		[
			list,
			index,
			shown,
			size,
			geo,
			r,
			cx,
			co,
			mx,
			my,
			onOpen,
			pool,
			detail,
			keyOf,
		],
	)

	// Keys while open: Escape closes, arrows step.
	const live = !!shown && !shown.closing
	useEffect(() => {
		if (!live) return
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.stopImmediatePropagation()
				return close()
			}
			if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return
			e.preventDefault()
			e.stopImmediatePropagation()
			go(e.key === "ArrowRight" ? 1 : -1)
		}
		window.addEventListener("keydown", onKey, true)
		return () => window.removeEventListener("keydown", onKey, true)
	}, [live, close, go])

	// The page behind doesn't scroll while the card is out (no overflow toggle, so no scrollbar jump).
	const layer = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const el = layer.current
		if (!el || !live) return
		const stop = (e: Event) => {
			if ((e.target as Element).closest("[data-pop-scroll]")) return
			e.preventDefault()
		}
		el.addEventListener("wheel", stop, { passive: false })
		el.addEventListener("touchmove", stop, { passive: false })
		return () => {
			el.removeEventListener("wheel", stop)
			el.removeEventListener("touchmove", stop)
		}
	}, [live])

	// Measure once per open: the card's fixed size.
	const measureCard = useRef<HTMLDivElement>(null)
	const needSize = !!shown && !size
	useIso(() => {
		if (!needSize) return
		const card = measureCard.current
		if (!card) return
		const room = window.innerHeight - EDGE * 2
		setSize({ w: card.offsetWidth, h: Math.min(card.offsetHeight, room) })
	}, [needSize])

	const swipe = useSwipe({
		cx,
		co,
		canPrev: index > 0,
		canNext: index >= 0 && index < list.length - 1,
		onStep: go,
		onClose: close,
	})

	if (!enabled && !shown) return null
	const done = () => {
		if (!shown?.closing) return
		setShown(null)
		setSize(null)
		setLeaving([])
	}

	// The big posters: the open one, plus any still flying home after a step.
	const posters: {
		r: Ranked
		box: Box
		from: Box | null
		to: ReturnType<typeof toBox>
		home: boolean
	}[] = []
	if (shown && geo && r) {
		for (const l of leaving)
			if (l.r.index !== r.index)
				posters.push({
					r: l.r,
					box: l.poster,
					from: null,
					to: toBox(l.back, l.poster),
					home: true,
				})
		posters.push({
			r,
			box: geo.poster,
			from: shown.from,
			to: closing ? toBox(shown.back, geo.poster) : HOME,
			home: closing,
		})
	}

	return (
		<div ref={layer} data-pop-layer="">
			{/* First the card laid out off screen, to measure it. */}
			{shown && !size && r && (
				<div
					aria-hidden="true"
					className={`pointer-events-none invisible fixed top-0 left-0 ${WIDTH} flex flex-col ${CARD}`}
					ref={measureCard}
				>
					<DetailHead r={r} rank={index + 1} poster="none" />
					<DetailBody r={r} answer={answer(r)} />
					<DetailFooter r={r} onStep={() => {}} canPrev canNext />
				</div>
			)}
			<AnimatePresence>
				{shown && geo && r && (
					<motion.div
						key="backdrop"
						initial={{ opacity: 0 }}
						animate={{ opacity: closing ? 0 : 1 }}
						exit={{ opacity: 0 }}
						transition={closing ? DIM_OUT : DIM_IN}
						onClick={close}
						className={`fixed inset-0 z-[1200] ${DIM}`}
						data-pop-backdrop=""
					/>
				)}
			</AnimatePresence>
			{shown && geo && r && (
				<>
					{posters.map((p) => (
						<BigPoster
							key={keyOf(p.r)}
							poster={titleAt(pool, p.r.index).poster}
							name={titleAt(pool, p.r.index).name}
							box={p.box}
							from={p.from}
							to={p.to}
							home={p.home}
							onClick={close}
							onDone={() => {
								if (p.r.index === r.index) done()
								else
									setLeaving((ls) => ls.filter((l) => l.r.index !== p.r.index))
							}}
						/>
					))}
					{/* The card: one fixed size; it moves by transform only. */}
					<motion.div
						className="fixed z-[1202]"
						style={{
							left: geo.card.x,
							top: geo.card.y,
							width: geo.card.w,
							height: geo.card.h,
							x: mx,
							y: my,
							pointerEvents: closing ? "none" : undefined,
						}}
					>
						<motion.div
							// biome-ignore lint/a11y/useSemanticElements: a positioned card, not a modal <dialog>
							role="dialog"
							aria-label={titleAt(pool, r.index).name}
							initial={{ opacity: 0, y: 4 }}
							animate={closing ? { opacity: 0, y: 0 } : { opacity: 1, y: 0 }}
							transition={
								closing
									? { duration: 0.12, ease: [0.4, 0, 1, 1] }
									: { duration: 0.22, delay: 0.06, ease: EASE_OUT }
							}
							className={`flex h-full flex-col ${CARD}`}
							style={{ touchAction: "pan-y" }}
							data-pop-card=""
							{...swipe}
						>
							<CloseButton onClick={close} />
							<Crossfade
								k={keyOf(r)}
								dir={dir}
								cx={cx}
								co={co}
								className="min-h-0 flex-1"
							>
								<DetailHead r={r} rank={index + 1} poster="none" />
								<div
									className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
									style={{ touchAction: "pan-y" }}
									data-pop-scroll=""
								>
									<DetailBody r={r} answer={answer(r)} />
								</div>
							</Crossfade>
							<DetailFooter
								r={r}
								onStep={go}
								canPrev={index > 0}
								canNext={index < list.length - 1}
							/>
						</motion.div>
					</motion.div>
				</>
			)}
		</div>
	)
}

function BigPoster({
	poster,
	name,
	box,
	from,
	to,
	home,
	onClick,
	onDone,
}: {
	poster: string | null
	name: string
	box: Box
	from: Box | null
	to: ReturnType<typeof toBox>
	home: boolean
	onClick: () => void
	onDone: () => void
}) {
	return (
		<div
			className="fixed z-[1201]"
			style={{
				left: box.x,
				top: box.y,
				width: box.w,
				height: box.h,
				pointerEvents: home ? "none" : undefined,
			}}
		>
			<motion.button
				type="button"
				aria-label="Close"
				onClick={onClick}
				initial={toBox(from, box)}
				animate={to}
				transition={home ? BACK : LIFT}
				onAnimationComplete={() => {
					if (home) onDone()
				}}
				className="absolute inset-0 overflow-hidden rounded-xl bg-gray-800"
				style={{
					transformOrigin: "0 0",
					boxShadow:
						"0 40px 90px -18px rgba(0,0,0,.95), 0 0 0 1px rgba(255,255,255,.12)",
				}}
				data-pop-poster=""
			>
				{/* The grid's small image is cached and shows at once; the sharp one covers it once loaded. */}
				{poster && (
					<>
						<img
							src={posterSrc(poster, "w185")}
							alt=""
							draggable={false}
							className="absolute inset-0 size-full object-cover"
						/>
						<img
							src={posterSrc(poster, "w500")}
							alt={name}
							draggable={false}
							className="absolute inset-0 size-full object-cover"
						/>
					</>
				)}
			</motion.button>
		</div>
	)
}
