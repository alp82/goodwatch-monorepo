// The big screen: a poster zoomed on past its largest size (or opened with "Big screen") locks to the middle as the
// feature presentation: the poster large, its backdrop behind it under a dark vignette, and the lower-third band with
// the details. Scrolling out (or Escape, a pinch in, a click on the dark, "Back to the map") plays the move back into
// the map. Transform and opacity only (Web Animations), measured once before the first paint.
import { useEffect, useLayoutEffect, useRef } from "react"
import type { ExplorerCard, ExplorerTitle } from "~/domain/explorer"
import type { TitleChange } from "~/ui/title-actions/TitleControl"
import type { Rect } from "./effects/types"
import { TMDB } from "./images"
import { ScreenDetails } from "./ScreenDetails"

const EASE_IN = "cubic-bezier(.2,.75,.12,1)"
const EASE_OUT = "cubic-bezier(.5,0,.3,1)"

const toward = (from: Rect, to: Rect) =>
	`translate(${from.x - to.x}px,${from.y - to.y}px) scale(${from.w / to.w},${from.h / to.h})`

export function PosterScreen({
	title,
	where,
	card,
	from,
	to,
	phone,
	reduce,
	onLanded,
	onRelease,
	onGone,
	onChange,
}: {
	title: ExplorerTitle
	where: { name: string; color: string }
	card: ExplorerCard | null
	/** The poster's rect on the map when it became the screen (stage pixels). */
	from: Rect
	/** Set when it's let go: where it goes back to on the map. */
	to: Rect | null
	phone: boolean
	reduce: boolean
	/** The poster is in place as the screen; its rect. */
	onLanded: (rect: Rect) => void
	onRelease: () => void
	onGone: () => void
	onChange?: (change: TitleChange) => void
}) {
	const root = useRef<HTMLDivElement>(null)
	const bg = useRef<HTMLDivElement>(null)
	const poster = useRef<HTMLImageElement>(null)
	const band = useRef<HTMLDivElement>(null)
	const rect = useRef<Rect | null>(null)
	const release = useRef(onRelease)
	release.current = onRelease
	const ms = (n: number) => (reduce ? 1 : n)

	// In: the poster moves from its place on the map to the middle, the theater darkens, the band slides up.
	useLayoutEffect(() => {
		const el = root.current
		const p = poster.current
		const b = band.current
		if (!el || !p || !b) return
		const W = el.clientWidth
		const H = el.clientHeight
		const t0 = phone ? 16 : 64
		const room = H - b.offsetHeight - (phone ? 24 : 84)
		const h = Math.max(160, Math.min(room, phone ? H * 0.5 : 720))
		const w = Math.min(h / 1.5, W * (phone ? 0.62 : 0.4))
		const r = {
			x: (W - w) / 2,
			y: t0 + Math.max(0, (room - w * 1.5) / 2),
			w,
			h: w * 1.5,
		}
		rect.current = r
		Object.assign(p.style, {
			left: `${r.x}px`,
			top: `${r.y}px`,
			width: `${r.w}px`,
			height: `${r.h}px`,
			visibility: "visible",
		})
		bg.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
			duration: ms(520),
			easing: "ease-out",
			fill: "both",
		})
		b.animate(
			[
				{ transform: "translateY(100%)", opacity: 0 },
				{ transform: "none", opacity: 1 },
			],
			{ duration: ms(520), delay: ms(260), easing: EASE_IN, fill: "both" },
		)
		const a = p.animate(
			[{ transform: toward(from, r) }, { transform: "none" }],
			{ duration: ms(680), easing: EASE_IN, fill: "both" },
		)
		a.onfinish = () => onLanded(r)
	}, [])

	// Out: the reverse, into the poster's place on the map.
	useEffect(() => {
		const r = rect.current
		const p = poster.current
		if (!to || !r || !p) return
		const opts = { duration: ms(720), easing: EASE_OUT, fill: "both" as const }
		bg.current?.animate([{ opacity: 1 }, { opacity: 0 }], opts)
		band.current?.animate(
			[
				{ transform: "none", opacity: 1 },
				{ transform: "translateY(100%)", opacity: 0 },
			],
			{ ...opts, duration: ms(380) },
		)
		const a = p.animate(
			[
				{ transform: "none", opacity: 1 },
				{ transform: toward(to, r), opacity: 1, offset: 0.8 },
				{ transform: toward(to, r), opacity: 0 },
			],
			opts,
		)
		a.onfinish = () => onGone()
	}, [to])

	// Scroll out, pinch in, or Esc lets it go; scrolling in does nothing (it's as close as it gets).
	useEffect(() => {
		const el = root.current
		if (!el) return
		let acc = 0
		const wheel = (e: WheelEvent) => {
			e.preventDefault()
			if (e.deltaY <= 0) return
			acc += e.deltaY * (e.deltaMode === 1 ? 33 : 1)
			if (acc > 30) release.current()
		}
		const pts = new Map<number, { x: number; y: number }>()
		let d0 = 0
		const dist = () => {
			const [a, b] = [...pts.values()]
			return Math.hypot(a.x - b.x, a.y - b.y)
		}
		const down = (e: PointerEvent) => {
			if (e.pointerType !== "touch") return
			pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
			if (pts.size === 2) d0 = dist()
		}
		const move = (e: PointerEvent) => {
			if (!pts.has(e.pointerId)) return
			pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
			if (pts.size === 2 && d0 > 0 && dist() < d0 * 0.82) release.current()
		}
		const up = (e: PointerEvent) => {
			pts.delete(e.pointerId)
			d0 = 0
		}
		const key = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return
			e.preventDefault()
			e.stopImmediatePropagation()
			release.current()
		}
		el.addEventListener("wheel", wheel, { passive: false })
		el.addEventListener("pointerdown", down)
		el.addEventListener("pointermove", move)
		el.addEventListener("pointerup", up)
		el.addEventListener("pointercancel", up)
		window.addEventListener("keydown", key, true)
		return () => {
			el.removeEventListener("wheel", wheel)
			el.removeEventListener("pointerdown", down)
			el.removeEventListener("pointermove", move)
			el.removeEventListener("pointerup", up)
			el.removeEventListener("pointercancel", up)
			window.removeEventListener("keydown", key, true)
		}
	}, [])

	const backdrop = title.backdrop ?? card?.title.backdrop ?? null
	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: Esc and the band's button let it go from the keyboard.
		<div
			ref={root}
			className="absolute inset-0 z-[45] overflow-hidden"
			// biome-ignore lint/a11y/useSemanticElements: a <dialog> can't play the way back into the map before it closes.
			role="dialog"
			aria-label={`${title.title}, feature presentation`}
			onClick={(e) => {
				if (e.target === e.currentTarget || e.target === bg.current) onRelease()
			}}
		>
			<div
				ref={bg}
				className="absolute inset-0 bg-[#030409]"
				style={{ opacity: 0 }}
			>
				{backdrop && (
					<img
						src={`${TMDB}/w1280${backdrop}`}
						alt=""
						className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-50"
					/>
				)}
				<div
					className="pointer-events-none absolute inset-0"
					style={{
						background:
							"radial-gradient(ellipse 70% 62% at 50% 40%, rgba(3,4,9,.2) 0%, rgba(3,4,9,.68) 58%, rgba(3,4,9,.97) 100%)",
					}}
				/>
				<div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-[#030409] via-[#030409]/90 to-transparent" />
			</div>
			<img
				ref={poster}
				src={`${TMDB}/w500${title.poster}`}
				alt={title.title}
				draggable={false}
				className="pointer-events-none absolute rounded-[10px] object-cover ring-1 ring-white/15 will-change-transform"
				style={{
					visibility: "hidden",
					transformOrigin: "0 0",
					boxShadow:
						"0 30px 80px rgba(0,0,0,.75), 0 0 0 1px rgba(0,0,0,.5), 0 0 60px rgba(251,191,36,.12)",
				}}
			/>
			<div
				ref={band}
				className={`absolute inset-x-0 bottom-0 ${phone ? "max-h-[50%] overflow-y-auto" : ""}`}
			>
				<ScreenDetails
					title={title}
					where={where}
					card={card}
					phone={phone}
					onChange={onChange}
					onBack={onRelease}
				/>
			</div>
		</div>
	)
}
