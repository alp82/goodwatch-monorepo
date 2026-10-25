// The quick view: one title's card over the page it was opened from, the same in every place that opens one (For
// you, the explorer, the related map). The place says what its titles are, in which order, and where each one's
// poster is on the screen; the view does the rest.
//
// Wide screens: the poster lifts out of its slot and grows beside the card, and the page dims. Next / previous (the
// arrows under the big poster, ← and →) bring the next title's own poster on screen (scrolling to it when it isn't
// in view) and lift it from there; the card glides to its new place. The poster it leaves does not fly back: its
// slot shows again at once, dimmed like the rest, while the big copy fades out in 180 ms, drifting a little toward
// it. The new poster rises from the dim level to full. Closing works the same way. Transform and opacity only, and
// no blur over anything that moves.
//
// Phones: a bottom drawer over the dimmed page, with a 96 px poster in its head and previous / next beside Details
// and close. A sideways swipe steps, a swipe down closes.
//
// Both: focus moves in on opening, Tab stays in, Escape closes and focus returns to the poster; an overlay opened from
// inside (the score picker, the not-seen question, a status menu, the watch log) keeps its own keys and taps, and goes
// where the view is in the document, so it shows over it in full screen too (ui/overlay.ts).
import {
	AnimatePresence,
	animate,
	motion,
	useIsPresent,
	useMotionValue,
} from "framer-motion"
import {
	type ReactNode,
	createContext,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react"
import { createPortal } from "react-dom"
import { useFocusScope } from "~/ui/for-you/focus"
import { OverlayRoot, inNestedOverlay, nestedOverlayOpen } from "~/ui/overlay"

export type Box = { x: number; y: number; w: number; h: number }

/** Previous / next, where the place has an order. */
export interface Steps {
	onStep: (d: -1 | 1) => void
	canPrev: boolean
	canNext: boolean
}

/** What the content needs of the view: its form, the steps (phones show them in the head), and close. */
interface Frame {
	form: "card" | "drawer"
	steps: Steps | null
	close: () => void
}
const FrameContext = createContext<Frame | null>(null)
export function useQuickViewFrame(): Frame {
	const frame = useContext(FrameContext)
	if (!frame) throw new Error("useQuickViewFrame outside a quick view")
	return frame
}

/** The card's fixed size on wide screens and the drawer's height on phones, so a step never changes either. */
export const CARD = { w: 400, h: 584, drawer: 532 } as const
/** The card's and the drawer's heights without the story (a place that has none). */
export const SHORT = { h: 500, drawer: 448 } as const

export interface QuickViewProps {
	/** How many titles the place has, and which one is open. */
	count: number
	index: number
	onIndex: (index: number) => void
	/** The view is gone (after its closing motion): the place lets go of the open title. */
	onClose: () => void
	/** Next / previous step through the place's order. */
	ordered: boolean
	/** The card beside a lifted poster; false for the phone drawer. */
	wide: boolean
	/** The title's poster in the page: it is hidden while lifted, and focus returns to it. */
	anchorOf: (index: number) => HTMLElement | null
	/** The poster's box on screen, for a place whose posters aren't elements (a canvas). Default: the anchor's image. */
	boxOf?: (index: number) => Box | null
	/** Where focus returns on closing. Default: the anchor (its link or button). */
	focusOf?: (index: number) => HTMLElement | null
	/** The big poster's image (a TMDB path) and the title's name. */
	posterOf: (index: number) => { path: string | null; name: string }
	/** The card's content for a title: QuickViewCard with the place's data. */
	children: (index: number) => ReactNode
	/** Phones: px from the screen's bottom where the drawer stops (For you's taste bar stays below it). */
	bottom?: number
	/** More elements that keep the focus while the view is open (For you's taste bar). */
	scope?: () => (HTMLElement | null | undefined)[]
	/** Where the view goes in the document: the element in full screen, when one is. */
	container?: Element | null
	/** The card's and the drawer's heights, when the place's content is shorter (SHORT). */
	height?: { h: number; drawer: number }
}

const EASE = [0.22, 1, 0.36, 1] as const
const LIFT = { duration: 0.28, ease: EASE } as const
/** The departing big poster, on a step or a close: a quick fade, a small drift toward its slot. */
const OUT = { duration: 0.18, ease: "easeOut" } as const
/** The shade (DIM) leaves a slot at about a quarter of its brightness: a stepped-to poster starts there. */
const DIM_LEVEL = 0.25
const MOVE = { duration: 0.26, ease: EASE } as const
const FADE = { duration: 0.18, ease: "easeOut" } as const
const SHEET = { duration: 0.28, ease: EASE } as const
const GAP = 24
const EDGE = 16
/** The arrows under the big poster: their gap and the buttons. */
const ARROWS = 12 + 44
/** A poster under the site's header isn't in view. */
const TOP_INSET = 72
const DIM = "bg-black/75"

const TMDB = "https://image.tmdb.org/t/p"
const src = (path: string | null, size: string) =>
	path ? `${TMDB}/${size}${path}` : undefined

const clamp = (v: number, lo: number, hi: number) =>
	Math.max(lo, Math.min(hi, v))

/** The biggest image in a poster element, or the element itself. */
function imageRect(el: HTMLElement): DOMRect {
	let best: DOMRect | null = null
	for (const img of el.querySelectorAll("img")) {
		const b = img.getBoundingClientRect()
		if (!best || b.width * b.height > best.width * best.height) best = b
	}
	return best && best.width > 0 ? best : el.getBoundingClientRect()
}

const onScreen = (b: Box | null): Box | null =>
	b &&
	b.w > 0 &&
	b.y + b.h > 0 &&
	b.y < window.innerHeight &&
	b.x + b.w > 0 &&
	b.x < window.innerWidth
		? b
		: null

/** The element that takes the focus back: the poster itself, or its link or button. */
function focusTarget(el: HTMLElement | null): HTMLElement | null {
	if (!el) return null
	if (el.matches("a[href],button,[tabindex]")) return el
	return el.querySelector<HTMLElement>("a[href],button,[tabindex]") ?? el
}

/** Resolves once the page stops scrolling (or after 900 ms). */
function scrollSettled(): Promise<void> {
	return new Promise((resolve) => {
		let idle = 0
		const finish = () => {
			window.removeEventListener("scroll", on, true)
			window.clearTimeout(idle)
			window.clearTimeout(cap)
			resolve()
		}
		const on = () => {
			window.clearTimeout(idle)
			idle = window.setTimeout(finish, 90)
		}
		const cap = window.setTimeout(finish, 900)
		idle = window.setTimeout(finish, 160)
		window.addEventListener("scroll", on, { passive: true, capture: true })
	})
}

type Geo = { side: 1 | -1; poster: Box; card: Box }

function geoFor(from: Box | null, height: number): Geo {
	const vw = document.documentElement.clientWidth
	const vh = window.innerHeight
	const ch = Math.min(height, vh - 2 * EDGE)
	const pw = Math.round(
		Math.min(340, (vh - 2 * EDGE - ARROWS) / 1.5, vw * 0.24),
	)
	const ph = Math.round(pw * 1.5)
	const sx = from ? from.x + from.w / 2 : vw / 2
	const sy = from ? from.y + from.h / 2 : vh / 2
	// The card goes where there is more room; the pair stays on the screen.
	const side: 1 | -1 = sx < vw / 2 ? 1 : -1
	const px =
		side === 1
			? clamp(sx - pw / 2, EDGE, vw - EDGE - pw - GAP - CARD.w)
			: clamp(sx - pw / 2, EDGE + CARD.w + GAP, vw - EDGE - pw)
	const py = clamp(sy - ph / 2, EDGE, vh - EDGE - ph - ARROWS)
	const cx = side === 1 ? px + pw + GAP : px - GAP - CARD.w
	const cy = clamp(py + (ph + ARROWS - ch) / 2, EDGE, vh - EDGE - ch)
	return {
		side,
		poster: { x: px, y: py, w: pw, h: ph },
		card: { x: cx, y: cy, w: CARD.w, h: ch },
	}
}

/** The big poster drawn over box `b` (none: a small fade). */
const over = (b: Box | null, t: Box) =>
	b
		? {
				x: b.x - t.x,
				y: b.y - t.y,
				scaleX: b.w / t.w,
				scaleY: b.h / t.h,
				opacity: 1,
			}
		: { x: 0, y: 8, scaleX: 0.96, scaleY: 0.96, opacity: 0 }
const HOME = { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1 }
/** Faded out, a fifth of the way from the big box `t` toward its slot `b`. */
const toward = (b: Box | null, t: Box, k = 0.2) =>
	b
		? {
				x: (b.x - t.x) * k,
				y: (b.y - t.y) * k,
				scaleX: 1 + (b.w / t.w - 1) * k,
				scaleY: 1 + (b.h / t.h - 1) * k,
				opacity: 0,
			}
		: { x: 0, y: 0, scaleX: 0.96, scaleY: 0.96, opacity: 0 }

/**
 * The wheel or the finger moving by `dy` scrolls something between `target` and `root`: a scrolling region of the
 * view (a status menu with the episode picker) keeps its own scroll; nothing else under the view does.
 */
function scrollsInside(
	target: EventTarget | null,
	root: HTMLElement,
	dy: number,
) {
	for (
		let el = target instanceof Element ? target : null;
		el && el !== root;
		el = el.parentElement
	) {
		if (!(el instanceof HTMLElement) || el.scrollHeight <= el.clientHeight)
			continue
		const { overflowY } = getComputedStyle(el)
		if (overflowY !== "auto" && overflowY !== "scroll") continue
		if (
			dy < 0
				? el.scrollTop > 0
				: el.scrollTop + el.clientHeight < el.scrollHeight - 1
		)
			return true
	}
	return false
}

/** A tap on the dim closes the view, unless it only dismissed something of the view's own. */
function useCloseTap(
	view: React.RefObject<HTMLElement | null>,
	close: () => void,
) {
	const nested = useRef(false)
	return {
		onPointerDown: () => {
			nested.current = nestedOverlayOpen(view.current)
		},
		onClick: () => {
			if (!nested.current) close()
		},
	}
}

/** Escape closes, ← and → step; a nested dialog or menu keeps its own keys. */
function useKeys(
	view: React.RefObject<HTMLElement | null>,
	live: boolean,
	ordered: boolean,
	step: (d: -1 | 1) => void,
	close: () => void,
) {
	const latest = useRef({ step, close })
	latest.current = { step, close }
	useEffect(() => {
		if (!live) return
		const onKey = (e: KeyboardEvent) => {
			if (inNestedOverlay(e.target) || nestedOverlayOpen(view.current)) return
			const t = e.target
			if (t instanceof Element && t.closest("input, textarea, select")) return
			if (e.key === "Escape") {
				e.stopImmediatePropagation()
				e.preventDefault()
				latest.current.close()
			} else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
				// The page's own arrow keys (the explorer's map) never run under the view.
				e.stopImmediatePropagation()
				e.preventDefault()
				if (ordered) latest.current.step(e.key === "ArrowLeft" ? -1 : 1)
			}
		}
		window.addEventListener("keydown", onKey, true)
		return () => window.removeEventListener("keydown", onKey, true)
	}, [view, live, ordered])
}

/** The view, in the document's body or the element in full screen. */
export function QuickView(props: QuickViewProps) {
	const [host, setHost] = useState<Element | null>(null)
	useEffect(() => setHost(props.container ?? document.body), [props.container])
	if (!host) return null
	return createPortal(
		<OverlayRoot.Provider value={host}>
			{props.wide ? <LiftCard {...props} /> : <Drawer {...props} />}
		</OverlayRoot.Provider>,
		host,
	)
}

function useBox(p: QuickViewProps) {
	return (i: number): Box | null => {
		if (p.boxOf) return onScreen(p.boxOf(i))
		const el = p.anchorOf(i)
		if (!el) return null
		const b = imageRect(el)
		return onScreen({ x: b.left, y: b.top, w: b.width, h: b.height })
	}
}

function fullyInView(el: HTMLElement) {
	const b = imageRect(el)
	return b.top >= TOP_INSET && b.bottom <= window.innerHeight - 8
}

function LiftCard(p: QuickViewProps) {
	const boxOf = useBox(p)
	const view = useRef<HTMLDivElement>(null)
	const layer = useRef<HTMLDivElement>(null)
	/** `dim`: reached by a step, so its slot was under the shade. */
	const [cur, setCur] = useState(() => ({
		i: p.index,
		from: boxOf(p.index),
		dim: false,
	}))
	const [leaving, setLeaving] = useState<
		{ i: number; id: number; poster: Box; back: Box | null }[]
	>([])
	const [closing, setClosing] = useState<{ back: Box | null } | null>(null)
	const cardH = p.height?.h ?? CARD.h
	const geo = geoFor(cur.from, cardH)
	const cardX = useMotionValue(geo.card.x)
	const cardY = useMotionValue(geo.card.y)
	const arrX = useMotionValue(geo.poster.x)
	const arrY = useMotionValue(geo.poster.y + geo.poster.h + 12)
	const state = useRef({ cur, geo, closing })
	state.current = { cur, geo, closing }
	const busy = useRef(false)
	const alive = useRef(true)
	const leaveId = useRef(0)
	useEffect(() => {
		alive.current = true
		return () => {
			alive.current = false
		}
	}, [])

	// The place moved to another title by itself (it re-sorted, or the title left): follow it without a motion.
	useEffect(() => {
		if (p.index === state.current.cur.i || state.current.closing) return
		const from = boxOf(p.index)
		const now = geoFor(from, cardH)
		setCur({ i: p.index, from, dim: true })
		cardX.set(now.card.x)
		cardY.set(now.card.y)
		arrX.set(now.poster.x)
		arrY.set(now.poster.y + now.poster.h + 12)
	}, [p.index])

	// Only the open title's poster in the page hides; a departing one shows again at once (and none while closing).
	const hiddenIndex = closing ? null : cur.i
	const hidden = useRef<HTMLElement | null>(null)
	useEffect(() => {
		const el = hiddenIndex == null ? null : p.anchorOf(hiddenIndex)
		if (hidden.current && hidden.current !== el)
			hidden.current.style.visibility = ""
		if (el) el.style.visibility = "hidden"
		hidden.current = el
	}, [hiddenIndex])
	useEffect(
		() => () => {
			if (hidden.current) hidden.current.style.visibility = ""
		},
		[],
	)

	// The page behind doesn't scroll by wheel or finger while the view is out (a step's own scroll still does); a
	// scrolling region inside the view does.
	useEffect(() => {
		const el = layer.current
		if (!el) return
		let lastY = 0
		const onWheel = (e: WheelEvent) => {
			if (!scrollsInside(e.target, el, e.deltaY)) e.preventDefault()
		}
		const onTouchStart = (e: TouchEvent) => {
			lastY = e.touches[0]?.clientY ?? 0
		}
		const onTouchMove = (e: TouchEvent) => {
			const y = e.touches[0]?.clientY ?? lastY
			const dy = lastY - y
			lastY = y
			if (!scrollsInside(e.target, el, dy)) e.preventDefault()
		}
		el.addEventListener("wheel", onWheel, { passive: false })
		el.addEventListener("touchstart", onTouchStart, { passive: true })
		el.addEventListener("touchmove", onTouchMove, { passive: false })
		return () => {
			el.removeEventListener("wheel", onWheel)
			el.removeEventListener("touchstart", onTouchStart)
			el.removeEventListener("touchmove", onTouchMove)
		}
	}, [])

	const go = async (d: -1 | 1) => {
		const { cur, closing } = state.current
		const ni = cur.i + d
		if (busy.current || closing || !p.ordered || ni < 0 || ni >= p.count) return
		busy.current = true
		try {
			const el = p.anchorOf(ni)
			if (el && !p.boxOf && !fullyInView(el)) {
				el.scrollIntoView({ block: "center", behavior: "smooth" })
				await scrollSettled()
				if (!alive.current || state.current.closing) return
			}
			const from = boxOf(ni)
			const old = state.current.geo
			const now = geoFor(from, cardH)
			const back = boxOf(cur.i)
			leaveId.current += 1
			const id = leaveId.current
			setLeaving((ls) => [
				...ls.filter((l) => l.i !== cur.i && l.i !== ni),
				{ i: cur.i, id, poster: old.poster, back },
			])
			setCur({ i: ni, from, dim: true })
			p.onIndex(ni)
			animate(cardX, now.card.x, MOVE)
			animate(cardY, now.card.y, MOVE)
			animate(arrX, now.poster.x, LIFT)
			animate(arrY, now.poster.y + now.poster.h + 12, LIFT)
		} finally {
			busy.current = false
		}
	}
	const steps: Steps | null = p.ordered
		? {
				onStep: (d) => void go(d),
				canPrev: cur.i > 0,
				canNext: cur.i < p.count - 1,
			}
		: null
	const requestClose = () => {
		if (state.current.closing) return
		setClosing({ back: boxOf(state.current.cur.i) })
	}
	const finish = () => {
		if (hidden.current) hidden.current.style.visibility = ""
		hidden.current = null
		p.onClose()
	}
	useKeys(view, !closing, p.ordered, (d) => void go(d), requestClose)
	const tap = useCloseTap(view, requestClose)
	useFocusScope({
		active: !closing,
		scope: () => [layer.current, ...(p.scope?.() ?? [])],
		initial: () => view.current,
		returnTo: () =>
			p.focusOf?.(state.current.cur.i) ??
			focusTarget(p.anchorOf(state.current.cur.i)),
	})

	const pb = geo.poster
	const t = p.posterOf(cur.i)
	return (
		<div ref={layer} className="fixed inset-0 z-[1200]" data-quick-view="">
			<motion.div
				className={`absolute inset-0 ${DIM}`}
				initial={{ opacity: 0 }}
				animate={{ opacity: closing ? 0 : 1 }}
				transition={{ duration: closing ? 0.2 : 0.24 }}
				data-quick-view-dim=""
				{...tap}
			/>
			{/* Big posters fading out after a step, under the open one and the card. */}
			{leaving.map((l) => (
				<motion.div
					key={`l${l.id}`}
					className="pointer-events-none absolute origin-top-left overflow-hidden rounded-xl bg-gray-800 shadow-2xl ring-1 ring-white/15"
					style={{
						left: l.poster.x,
						top: l.poster.y,
						width: l.poster.w,
						height: l.poster.h,
					}}
					initial={HOME}
					animate={toward(l.back, l.poster)}
					transition={OUT}
					onAnimationComplete={() =>
						setLeaving((ls) => ls.filter((x) => x.id !== l.id))
					}
				>
					<PosterImage path={p.posterOf(l.i).path} name="" />
				</motion.div>
			))}
			<motion.button
				type="button"
				key={`c${cur.i}`}
				aria-label="Close"
				tabIndex={-1}
				className="absolute origin-top-left cursor-pointer overflow-hidden rounded-xl bg-gray-800 shadow-[0_30px_80px_-20px_rgba(0,0,0,.95)] ring-1 ring-white/15"
				style={{ left: pb.x, top: pb.y, width: pb.w, height: pb.h }}
				initial={{
					...over(cur.from, pb),
					...(cur.dim && cur.from ? { opacity: DIM_LEVEL } : {}),
				}}
				animate={closing ? toward(closing.back, pb) : HOME}
				transition={closing ? OUT : LIFT}
				onAnimationComplete={() => closing && finish()}
				data-quick-view-poster=""
				{...tap}
			>
				<PosterImage path={t.path} name={t.name} />
			</motion.button>
			{steps && (
				<motion.div
					className="absolute top-0 left-0 flex justify-center"
					style={{ x: arrX, y: arrY, width: pb.w }}
					initial={{ opacity: 0 }}
					animate={{ opacity: closing ? 0 : 1 }}
					transition={{ duration: 0.2, delay: closing ? 0 : 0.15 }}
					data-quick-view-steps=""
				>
					<StepButtons {...steps} />
				</motion.div>
			)}
			<motion.div
				className="absolute top-0 left-0"
				style={{
					x: cardX,
					y: cardY,
					width: CARD.w,
					height: geo.card.h,
					pointerEvents: closing ? "none" : undefined,
				}}
			>
				<motion.div
					ref={view}
					tabIndex={-1}
					// biome-ignore lint/a11y/useSemanticElements: a positioned card over the dimmed page, not a modal <dialog>.
					role="dialog"
					aria-modal="true"
					aria-label={t.name}
					className="relative size-full overflow-hidden rounded-2xl bg-gray-900 shadow-[0_30px_80px_-20px_rgba(0,0,0,.95)] ring-1 ring-white/12 outline-none"
					initial={{ opacity: 0, x: -16 * geo.side }}
					animate={
						closing ? { opacity: 0, x: -16 * geo.side } : { opacity: 1, x: 0 }
					}
					transition={{
						duration: 0.26,
						ease: EASE,
						delay: closing ? 0 : 0.06,
					}}
					data-quick-view-card=""
				>
					<FrameContext.Provider
						value={{ form: "card", steps, close: requestClose }}
					>
						<Crossfade k={cur.i}>{p.children(cur.i)}</Crossfade>
					</FrameContext.Provider>
				</motion.div>
			</motion.div>
		</div>
	)
}

function Drawer(p: QuickViewProps) {
	const view = useRef<HTMLDivElement>(null)
	const layer = useRef<HTMLDivElement>(null)
	const [closing, setClosing] = useState(false)
	/** The control that had the focus when a step began (the head's arrows): its twin in the new content gets it. */
	const refocus = useRef<string | null>(null)
	const steps: Steps | null = p.ordered
		? {
				onStep: (d) => {
					const n = p.index + d
					if (n < 0 || n >= p.count) return
					const at = document.activeElement
					refocus.current =
						at instanceof HTMLElement && view.current?.contains(at)
							? (at.getAttribute("aria-label") ?? "")
							: null
					p.onIndex(n)
				},
				canPrev: p.index > 0,
				canNext: p.index < p.count - 1,
			}
		: null
	const requestClose = () => setClosing(true)
	useKeys(view, !closing, p.ordered, (d) => steps?.onStep(d), requestClose)
	const tap = useCloseTap(view, requestClose)
	useFocusScope({
		active: !closing,
		scope: () => [layer.current, ...(p.scope?.() ?? [])],
		initial: () => view.current,
		returnTo: () => p.focusOf?.(p.index) ?? focusTarget(p.anchorOf(p.index)),
	})
	// The content that had the focus is leaving: the focus goes to the same control in the new one, or the drawer.
	useEffect(() => {
		const label = refocus.current
		refocus.current = null
		if (label === null) return
		const twin = label
			? [
					...(view.current?.querySelectorAll<HTMLElement>(
						`[aria-label="${CSS.escape(label)}"]`,
					) ?? []),
				].find((el) => !el.closest("[inert]"))
			: undefined
		;(twin && !twin.matches(":disabled") ? twin : view.current)?.focus({
			preventScroll: true,
		})
	}, [p.index])
	// The opened title stays in sight above the drawer as it steps.
	useEffect(() => {
		const el = p.anchorOf(p.index)
		if (el && !p.boxOf && !fullyInView(el))
			el.scrollIntoView({ block: "start", behavior: "smooth" })
	}, [p.index])
	// The page behind doesn't scroll while the drawer is up.
	useEffect(() => {
		const html = document.documentElement
		const was = html.style.overflow
		html.style.overflow = "hidden"
		return () => {
			html.style.overflow = was
		}
	}, [])
	const start = useRef<{ x: number; y: number; id: number } | null>(null)
	const dy = useMotionValue(0)
	const bottom = p.bottom ?? 0
	const t = p.posterOf(p.index)
	return (
		<div ref={layer} data-quick-view="">
			<motion.div
				className={`fixed inset-x-0 top-0 z-[1199] ${DIM}`}
				style={{ bottom }}
				initial={{ opacity: 0 }}
				animate={{ opacity: closing ? 0 : 1 }}
				transition={{ duration: 0.22 }}
				data-quick-view-dim=""
				{...tap}
			/>
			<div
				className="pointer-events-none fixed inset-x-0 top-0 z-[1200] overflow-hidden"
				style={{ bottom }}
			>
				<motion.div
					ref={view}
					tabIndex={-1}
					// biome-ignore lint/a11y/useSemanticElements: a sliding drawer over the dimmed page, not a modal <dialog>.
					role="dialog"
					aria-modal="true"
					aria-label={t.name}
					className="pointer-events-auto absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-hidden rounded-t-2xl bg-gray-900 shadow-[0_-18px_40px_-10px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.14)] outline-none"
					style={{
						height: `calc(${p.height?.drawer ?? CARD.drawer}px + ${bottom ? "0px" : "env(safe-area-inset-bottom)"})`,
						y: dy,
						touchAction: "pan-y",
					}}
					initial={{ y: "100%" }}
					animate={{ y: closing ? "100%" : 0 }}
					transition={SHEET}
					onAnimationComplete={() => {
						if (closing) p.onClose()
					}}
					onPointerDown={(e) => {
						if (inNestedOverlay(e.target)) return
						start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
					}}
					onPointerUp={(e) => {
						const s = start.current
						start.current = null
						// The score picker and the menus are portals or popovers: their pointer events still bubble here.
						if (!s || s.id !== e.pointerId || nestedOverlayOpen(view.current))
							return
						const dx = e.clientX - s.x
						const dyy = e.clientY - s.y
						if (dyy > 80 && dyy > Math.abs(dx) * 1.5) return requestClose()
						if (
							!steps ||
							Math.abs(dx) < 50 ||
							Math.abs(dx) < Math.abs(dyy) * 1.5
						)
							return
						steps.onStep(dx < 0 ? 1 : -1)
					}}
					data-quick-view-drawer=""
				>
					<FrameContext.Provider
						value={{ form: "drawer", steps, close: requestClose }}
					>
						<Crossfade k={p.index}>{p.children(p.index)}</Crossfade>
					</FrameContext.Provider>
				</motion.div>
			</div>
		</div>
	)
}

/** The content's crossfade on a step: the old one fades out as the new one fades in, in the same place. */
function Crossfade({ k, children }: { k: number; children: ReactNode }) {
	return (
		<AnimatePresence initial={false}>
			<Layer key={k}>{children}</Layer>
		</AnimatePresence>
	)
}

/** One title's content; a leaving one is inert, so neither a tap nor the focus lands in it. */
function Layer({ children }: { children: ReactNode }) {
	const present = useIsPresent()
	const el = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (!present) el.current?.setAttribute("inert", "")
	}, [present])
	return (
		<motion.div
			ref={el}
			className="absolute inset-0 flex flex-col"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={FADE}
		>
			{children}
		</motion.div>
	)
}

/** The cached small image at once, the sharp one over it once loaded. */
function PosterImage({ path, name }: { path: string | null; name: string }) {
	if (!path) return null
	return (
		<>
			<img
				src={src(path, "w185")}
				alt=""
				draggable={false}
				className="absolute inset-0 size-full object-cover"
			/>
			<img
				src={src(path, "w500")}
				alt={name}
				draggable={false}
				className="absolute inset-0 size-full object-cover"
			/>
		</>
	)
}

function Chevron({ dir }: { dir: -1 | 1 }) {
	return (
		<svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
			<path
				d={dir < 0 ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"}
				fill="none"
				stroke="currentColor"
				strokeWidth="2.2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

/** Previous and next as two round buttons, under the big poster. */
export function StepButtons({ onStep, canPrev, canNext }: Steps) {
	const button =
		"grid size-11 shrink-0 cursor-pointer place-items-center rounded-full bg-gray-900/80 text-gray-200 ring-1 ring-white/15 hover:bg-white/10 disabled:cursor-default disabled:opacity-25"
	return (
		<div className="flex justify-center gap-3">
			<button
				type="button"
				aria-label="Previous title"
				disabled={!canPrev}
				onClick={() => onStep(-1)}
				className={button}
			>
				<Chevron dir={-1} />
			</button>
			<button
				type="button"
				aria-label="Next title"
				disabled={!canNext}
				onClick={() => onStep(1)}
				className={button}
			>
				<Chevron dir={1} />
			</button>
		</div>
	)
}

/** Previous and next as one control in the drawer's head, in the look of Details | close beside it. */
export function HeaderSteps({ onStep, canPrev, canNext }: Steps) {
	const button =
		"grid w-10 cursor-pointer place-items-center text-white hover:bg-white/15 disabled:cursor-default disabled:text-white/25 disabled:hover:bg-transparent"
	return (
		<div className="flex h-10 items-stretch overflow-hidden rounded-xl border border-white/25 bg-gray-950/85">
			<button
				type="button"
				aria-label="Previous title"
				disabled={!canPrev}
				onClick={() => onStep(-1)}
				className={button}
			>
				<Chevron dir={-1} />
			</button>
			<button
				type="button"
				aria-label="Next title"
				disabled={!canNext}
				onClick={() => onStep(1)}
				className={`${button} border-l border-white/20`}
			>
				<Chevron dir={1} />
			</button>
		</div>
	)
}
