// The steerable fingerprint: the taste print drawn as one layer per family, with a handle per family on four rings
// (less, usual, more, lots more). Dragging a handle stretches its family's layer and snaps to a ring on release.
// - Scrolling: on the page the big print only claims touches that start on a handle or whose first few px run along
//   the grabbed family's ray (or sideways); other vertical swipes scroll the page.
// - A tap never wraps: on the small print a tap steps one ring up and stops at "lots more" (or calls onTap); on the
//   big print a tap on the current ring steps up the same way.
// Rings, layers and handles move by CSS transform only; a change of `levels` from outside (the dice) animates with
// the same spring as a release.
import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { FAMILY_ORDER, type FamilyId } from "~/domain/for-you-page/contract"
import {
	FAMILY_WORD,
	LEVELS,
	type Level,
	type Levels,
	MAX_SCALE,
	MIN_SCALE,
	RING,
	RING_WORD,
	snapLevel,
} from "~/domain/for-you-page/shape"
import { build } from "~/ui/profile/taste/Whorl"
import { FAMILY_COLOR } from "~/ui/profile/taste/model"
import { useForYou } from "./context"

const BOX = 272
const VIEW = `${-BOX} ${-BOX} ${BOX * 2} ${BOX * 2}`
const EASE = "transform .42s cubic-bezier(.3,1.45,.5,1)"
const TAU = Math.PI * 2

const CSS = `
.steer-print .steer-rings { opacity: 0; transition: opacity .2s ease; }
.steer-print[data-drag] .steer-rings { opacity: 1; }
.steer-print .steer-rings ellipse[data-on] { stroke: #fbbf24; stroke-opacity: .9; stroke-dasharray: none; }
${FAMILY_ORDER.map(
	(f) =>
		`.steer-print[data-drag=${f}] .steer-layer:not([data-f=${f}]) { opacity: .4; } .steer-print[data-drag=${f}] .steer-handle:not([data-f=${f}]) { opacity: .35; }`,
).join("\n")}
.steer-print .steer-layer, .steer-print .steer-handle { transition: ${EASE}, opacity .2s ease; }
.steer-print[data-drag] .steer-layer, .steer-print[data-drag] .steer-handle { transition: opacity .2s ease; will-change: transform; }
`

const angDist = (a: number, b: number) => {
	const d = Math.abs(((a - b) % TAU) + TAU) % TAU
	return Math.min(d, TAU - d)
}
/** One ring up, stopping at "lots more". */
const up = (l: Level): Level => (l === 2 ? 2 : ((l + 1) as Level))

type Anchor = {
	x: number
	y: number
	r: number
	ux: number
	uy: number
	angle: number
}

/** Where each family's handle sits at scale 1, from the print's own rim dots. */
function useGeometry(mini: boolean) {
	const { taste } = useForYou()
	const attributes = taste.attributes
	const rim = useMemo(() => build(attributes, 18, true), [attributes])
	const drawn = useMemo(
		() => (mini ? build(attributes, 8, true) : rim),
		[attributes, mini, rim],
	)
	// One smooth oval round the rim dots (the print is drawn 0.86 wide); the rings are this oval scaled, and each
	// handle sits on it in the direction of its family's rim dots.
	const ring = useMemo(() => {
		const rs = rim.markers.map((m) => Math.hypot(m.x / 0.86, m.y))
		return rs.reduce((s, r) => s + r, 0) / (rs.length || 1) + 8
	}, [rim])
	const anchors = useMemo(() => {
		const out = {} as Record<FamilyId, Anchor>
		for (const f of FAMILY_ORDER) {
			const ms = rim.markers.filter((m) => m.a.family === f)
			const sx = ms.reduce((s, m) => s + m.x / 0.86, 0)
			const sy = ms.reduce((s, m) => s + m.y, 0)
			const th = Math.atan2(sy, sx)
			// Rounded so server and browser Math agree on the handle positions.
			const x = Math.round(0.86 * ring * Math.cos(th) * 10) / 10
			const y = Math.round(ring * Math.sin(th) * 10) / 10
			const r = Math.hypot(x, y)
			out[f] = { x, y, r, ux: x / r, uy: y / r, angle: Math.atan2(y, x) }
		}
		return out
	}, [rim, ring])
	return { drawn, anchors, ring: Math.round(ring * 10) / 10 }
}

export function HandlePrint({
	levels,
	shape,
	onSet,
	mini = false,
	liveRef,
	className = "",
	label,
	onTap,
	sheet = false,
}: {
	levels: Levels
	/** The recipe's own shape: a faint ghost dot shows where the recipe put each handle. */
	shape: Levels | null
	onSet: (f: FamilyId, l: Level) => void
	mini?: boolean
	/** A text element outside the print that shows "Humor: lots more" while dragging. */
	liveRef?: React.RefObject<HTMLElement>
	className?: string
	label: string
	/** Small print: a tap (no movement past 6 px, under 450 ms) calls this instead of stepping a ring. */
	onTap?: () => void
	/** In a drawer: every touch on the print reshapes (nothing to scroll behind it). */
	sheet?: boolean
}) {
	const { drawn, anchors, ring } = useGeometry(mini)
	const root = useRef<HTMLDivElement>(null)
	const layers = useRef<Partial<Record<FamilyId, SVGSVGElement | null>>>({})
	const handles = useRef<Partial<Record<FamilyId, HTMLElement | null>>>({})
	const ringEls = useRef<Partial<Record<Level, SVGEllipseElement | null>>>({})
	const [w, setW] = useState(mini ? 88 : 330)
	const [active, setActive] = useState<FamilyId | null>(null)

	useEffect(() => {
		const el = root.current
		if (!el) return
		const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
		ro.observe(el)
		return () => ro.disconnect()
	}, [])
	const k = w / (BOX * 2) // px per view unit
	// Small print: drawn a bit smaller so a handle at "lots more" still sits inside the box.
	const fit = mini ? Math.min(1, (w / 2 - 8) / (ring * MAX_SCALE * k)) : 1

	const handleTransform = (f: FamilyId, s: number) => {
		const a = anchors[f]
		return `translate(-50%, -50%) translate(${(a.x * s * k).toFixed(1)}px, ${(a.y * s * k).toFixed(1)}px)`
	}

	const paths = useMemo(() => {
		const out = Object.fromEntries(
			FAMILY_ORDER.map((f) => [f, [] as { d: string; o: number }[]]),
		) as Record<FamilyId, { d: string; o: number }[]>
		for (const t of drawn.turns)
			for (const p of t.paths) out[p.family].push({ d: p.d, o: p.opacity })
		return out
	}, [drawn])

	// ---------- the gesture ----------
	const drag = useRef<{
		f: FamilyId
		id: number
		s0: number
		s: number
		ux: number
		uy: number
		x0: number
		y0: number
		cx: number
		cy: number
		denom: number
		moved: boolean
		t0: number
		snap: Level
		/** Touch only: null until the first few px of movement decide between reshaping and scrolling the page. */
		lock: "drag" | "scroll" | null
	} | null>(null)

	const setLive = (f: FamilyId, l: Level, on: boolean) => {
		const el = liveRef?.current
		if (!el) return
		el.textContent = on ? `${FAMILY_WORD[f]}: ${RING_WORD[l]}` : ""
		el.style.opacity = on ? "1" : "0"
	}
	const markRing = (l: Level | null) => {
		for (const x of LEVELS) {
			const el = ringEls.current[x]
			if (!el) continue
			if (x === l) el.setAttribute("data-on", "")
			else el.removeAttribute("data-on")
		}
	}

	const apply = (f: FamilyId, s: number) => {
		const layer = layers.current[f]
		if (layer) layer.style.transform = `scale(${s.toFixed(4)})`
		const h = handles.current[f]
		if (h) h.style.transform = handleTransform(f, s)
	}

	/** Shows the grab: rings fade in, the other families dim, the live pill names the ring. */
	const grab = (f: FamilyId) => {
		root.current?.setAttribute("data-drag", f)
		setActive(f)
		markRing(levels[f])
		setLive(f, levels[f], true)
	}

	const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.button !== 0 || drag.current) return
		const el = root.current
		if (!el) return
		const rect = el.getBoundingClientRect()
		const cx = rect.left + rect.width / 2
		const cy = rect.top + rect.height / 2
		const ang = Math.atan2(e.clientY - cy, e.clientX - cx)
		// On a handle: that family. Anywhere else: the nearest family by angle.
		const onHandle = (e.target as Element).closest<HTMLElement>(
			"[data-print-handle]",
		)
		let f: FamilyId = (onHandle?.dataset.f as FamilyId) ?? FAMILY_ORDER[0]
		if (!onHandle)
			for (const x of FAMILY_ORDER)
				if (angDist(ang, anchors[x].angle) < angDist(ang, anchors[f].angle))
					f = x
		const a = anchors[f]
		const s0 = RING[levels[f]]
		try {
			e.currentTarget.setPointerCapture(e.pointerId)
		} catch {}
		drag.current = {
			f,
			id: e.pointerId,
			s0,
			s: s0,
			ux: a.ux,
			uy: a.uy,
			x0: e.clientX,
			y0: e.clientY,
			cx,
			cy,
			// The finger follows the handle 1:1 on the big print; on the small one a step is at least ~25 px.
			denom: Math.max(a.r * (rect.width / (BOX * 2)), 100),
			moved: false,
			t0: performance.now(),
			snap: levels[f],
			lock:
				e.pointerType !== "touch" || mini || sheet || onHandle ? "drag" : null,
		}
		if (drag.current.lock) grab(f)
	}

	// The browser only scrolls if the first touchmoves aren't cancelled; cancel them once a drag is decided.
	useEffect(() => {
		const el = root.current
		if (!el || mini) return
		const onMove = (e: TouchEvent) => {
			if (drag.current?.lock === "drag" && e.cancelable) e.preventDefault()
		}
		el.addEventListener("touchmove", onMove, { passive: false })
		return () => el.removeEventListener("touchmove", onMove)
	}, [mini])

	const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		const d = drag.current
		if (!d || e.pointerId !== d.id) return
		const dx = e.clientX - d.x0
		const dy = e.clientY - d.y0
		if (!d.lock) {
			// Decide by the first 5 px: along the family's ray (within ~30 degrees) or sideways = reshape; mostly
			// vertical = a page scroll, which the browser takes over (it sends pointercancel).
			const len = Math.hypot(dx, dy)
			if (len < 5) return
			const along = Math.abs(dx * d.ux + dy * d.uy) / len
			d.lock = along >= 0.87 || Math.abs(dx) >= Math.abs(dy) ? "drag" : "scroll"
			if (d.lock === "drag") grab(d.f)
		}
		if (d.lock === "scroll") return
		if (!d.moved && Math.hypot(dx, dy) < 6) return
		d.moved = true
		let s = d.s0 + (dx * d.ux + dy * d.uy) / d.denom
		// Rubber band past the outer and inner rings.
		if (s > MAX_SCALE) s = MAX_SCALE + (s - MAX_SCALE) * 0.25
		if (s < MIN_SCALE) s = MIN_SCALE - (MIN_SCALE - s) * 0.25
		d.s = s
		apply(d.f, s)
		const l = snapLevel(s)
		if (l !== d.snap) {
			d.snap = l
			markRing(l)
			setLive(d.f, l, true)
		}
	}

	const finish = (e: React.PointerEvent<HTMLDivElement>, cancel = false) => {
		const d = drag.current
		if (!d || e.pointerId !== d.id) return
		drag.current = null
		let l: Level = snapLevel(d.s)
		const tap =
			!cancel &&
			d.lock !== "scroll" &&
			!d.moved &&
			performance.now() - d.t0 < 450
		if (tap && onTap) {
			root.current?.removeAttribute("data-drag")
			setActive(null)
			markRing(null)
			setLive(d.f, levels[d.f], false)
			onTap()
			return
		}
		if (cancel || d.lock === "scroll") l = levels[d.f]
		else if (tap) {
			if (mini) l = up(levels[d.f])
			else {
				const dist = Math.hypot(e.clientX - d.cx, e.clientY - d.cy)
				const want = snapLevel(dist / (anchors[d.f].r * k))
				l = want === levels[d.f] ? up(levels[d.f]) : want
			}
		}
		root.current?.removeAttribute("data-drag")
		// Hand the final transform back with the spring transition on (React's style will match it).
		requestAnimationFrame(() => apply(d.f, RING[l]))
		setActive(null)
		markRing(null)
		setLive(d.f, l, false)
		if (tap && l === 2 && levels[d.f] === 2) {
			// Already at the outer ring: say so instead of wrapping round.
			const el = liveRef?.current
			if (el) {
				el.textContent = `${FAMILY_WORD[d.f]}: lots more already`
				el.style.opacity = "1"
				window.setTimeout(() => {
					if (!drag.current) el.style.opacity = "0"
				}, 1100)
			}
		}
		if (l !== levels[d.f]) onSet(d.f, l)
	}

	const onKey = (f: FamilyId, e: React.KeyboardEvent) => {
		const more = e.key === "ArrowUp" || e.key === "ArrowRight"
		const less = e.key === "ArrowDown" || e.key === "ArrowLeft"
		if (!more && !less) return
		e.preventDefault()
		const l = Math.max(-1, Math.min(2, levels[f] + (more ? 1 : -1))) as Level
		if (l !== levels[f]) onSet(f, l)
	}

	const stroke = mini ? 9 : 2.6
	// The ridges never change, so a grab (one re-render for the ray stops) doesn't re-diff ~1,300 paths.
	const art = useMemo(
		() =>
			Object.fromEntries(
				FAMILY_ORDER.map((f) => [
					f,
					<Fragment key={f}>
						{paths[f].map((p, i) => (
							<path
								// biome-ignore lint/suspicious/noArrayIndexKey: geometry is fixed
								key={i}
								d={p.d}
								fill="none"
								stroke={FAMILY_COLOR[f]}
								strokeOpacity={p.o}
								strokeWidth={stroke}
								strokeLinecap="round"
							/>
						))}
						{!mini &&
							drawn.markers
								.filter((m) => m.a.family === f)
								.map((m) => (
									<circle
										key={m.a.key}
										cx={m.x}
										cy={m.y}
										r={m.r}
										fill={m.a.edge > 0 ? FAMILY_COLOR[f] : "transparent"}
										stroke={FAMILY_COLOR[f]}
										strokeWidth={m.a.edge > 0 ? 0 : 1.2}
									/>
								))}
					</Fragment>,
				]),
			) as Record<FamilyId, React.ReactNode>,
		[paths, drawn, mini, stroke],
	)
	return (
		<div
			ref={root}
			className={`steer-print relative aspect-square select-none ${mini || sheet ? "touch-none" : "touch-pan-y"} ${className}`}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={(e) => finish(e)}
			onPointerCancel={(e) => finish(e, true)}
			// biome-ignore lint/a11y/useSemanticElements: one control drawn as a print, not a form fieldset
			role="group"
			aria-label={label}
			data-print={mini ? "mini" : sheet ? "sheet" : "page"}
		>
			<style>{CSS}</style>
			<div
				className="absolute inset-0"
				style={fit < 1 ? { transform: `scale(${fit.toFixed(3)})` } : undefined}
			>
				{/* The rings: an oval round the print at less / usual / more / lots more, shown while dragging. */}
				<svg
					viewBox={VIEW}
					className="steer-rings pointer-events-none absolute inset-0 size-full"
					aria-hidden="true"
				>
					{LEVELS.map((l) => (
						<ellipse
							key={l}
							ref={(el) => {
								ringEls.current[l] = el
							}}
							rx={Math.round(0.86 * ring * RING[l] * 10) / 10}
							ry={Math.round(ring * RING[l] * 10) / 10}
							fill="none"
							stroke="white"
							strokeOpacity={l === 0 ? 0.4 : 0.22}
							strokeWidth={mini ? 5 : 1.5}
							strokeDasharray={l === 0 ? undefined : mini ? "10 8" : "5 5"}
						/>
					))}
					{/* The four stops on the grabbed family's ray; the words are in the live pill. */}
					{active &&
						LEVELS.map((l) => {
							const a = anchors[active]
							const s = RING[l]
							return (
								<circle
									key={l}
									cx={a.x * s}
									cy={a.y * s}
									r={mini ? 14 : 6}
									fill="#030712"
									stroke={FAMILY_COLOR[active]}
									strokeWidth={mini ? 6 : 2.5}
								/>
							)
						})}
				</svg>
				{/* The print, one layer per family; the stretch is the layer's scale. */}
				{FAMILY_ORDER.map((f) => (
					<svg
						key={f}
						ref={(el) => {
							layers.current[f] = el
						}}
						viewBox={VIEW}
						data-f={f}
						className="steer-layer pointer-events-none absolute inset-0 size-full"
						style={{
							transform: `scale(${RING[levels[f]]})`,
							transformOrigin: "50% 50%",
						}}
						aria-hidden="true"
					>
						{art[f]}
					</svg>
				))}
				{/* Where the recipe put each handle, when you have moved it away. */}
				{shape && (
					<svg
						viewBox={VIEW}
						className="pointer-events-none absolute inset-0 size-full"
						aria-hidden="true"
					>
						{FAMILY_ORDER.filter((f) => shape[f] !== levels[f]).map((f) => {
							const a = anchors[f]
							const s = RING[shape[f]]
							return (
								<circle
									key={f}
									cx={Math.round(a.x * s * 10) / 10}
									cy={Math.round(a.y * s * 10) / 10}
									r={mini ? 16 : 9}
									fill="none"
									stroke={FAMILY_COLOR[f]}
									strokeWidth={mini ? 6 : 2}
									strokeDasharray={mini ? "6 5" : "3 3"}
									opacity={0.8}
								/>
							)
						})}
					</svg>
				)}
				{/* The handles. Pointer input goes to the whole print (nearest sector); they are the keyboard way. */}
				{FAMILY_ORDER.map((f) => {
					const l = levels[f]
					return (
						<span
							key={f}
							ref={(el) => {
								handles.current[f] = el
							}}
							data-f={f}
							data-print-handle=""
							role="slider"
							tabIndex={0}
							aria-label={`${FAMILY_WORD[f]} handle`}
							aria-valuemin={-1}
							aria-valuemax={2}
							aria-valuenow={l}
							aria-valuetext={RING_WORD[l]}
							onKeyDown={(e) => onKey(f, e)}
							className={`steer-handle absolute top-1/2 left-1/2 grid place-items-center outline-none focus-visible:ring-2 focus-visible:ring-white ${
								mini
									? "size-3 rounded-full"
									: "h-7 min-w-7 touch-none rounded-full px-2 before:absolute before:-inset-3.5 before:rounded-full before:content-['']"
							}`}
							style={{
								transform: handleTransform(f, RING[l]),
								background: l === 0 ? "#030712" : FAMILY_COLOR[f],
								boxShadow: `0 0 0 ${mini ? 1 : 2.5}px ${FAMILY_COLOR[f]}, 0 0 0 ${mini ? 2.5 : 5}px rgba(3,7,18,.85)`,
							}}
						>
							{!mini && (
								<span
									className={`text-[11px] leading-none font-black tracking-wide uppercase ${l === 0 ? "" : "text-gray-950"}`}
									style={l === 0 ? { color: FAMILY_COLOR[f] } : undefined}
								>
									{FAMILY_WORD[f]}
									{l !== 0 && (
										<span className="ml-1">
											{l === -1 ? "−" : l === 1 ? "+" : "++"}
										</span>
									)}
								</span>
							)}
						</span>
					)
				})}
			</div>
		</div>
	)
}
