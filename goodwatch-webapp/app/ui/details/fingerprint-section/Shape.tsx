// The fingerprint's drawing: the eight-axis shape over the title's faint print, made to answer a selection. A selected
// effect's slice of the shape steps out and glows (scaled from the center, its rim drawn in its color, its tip grows),
// and its ingredients' ridges light in the print, each named at its own rim position with its score (labels outside
// the circle, nudged apart so they never overlap, a hairline back to the ridge they name). The whole box is one pointer
// surface: the pointer's angle picks the axis, center included; a small dead middle means "nothing".
// Motion: opacity and transform only.
import {
	type MouseEvent,
	type PointerEvent,
	memo,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react"
import { type WhorlAttribute, build } from "~/ui/profile/taste/Whorl"
import { FAMILY_COLOR } from "~/ui/profile/taste/model"
import { AXES, type Reading } from "./reading"
import type { Light, LitKey } from "./selection"

const R = 150
const TAU = Math.PI * 2
const angleOf = (i: number) => -Math.PI / 2 + (i * TAU) / AXES.length
const radiusOf = (s: number) =>
	R * (0.06 + (0.94 * Math.min(10, Math.max(0, s))) / 10)
const r1 = (n: number) => Math.round(n * 10) / 10
const pt = (r: number, a: number) =>
	[r1(r * Math.cos(a)), r1(r * Math.sin(a))] as const
// The print sits a little smaller than the shape's ring, nudged down to center its off-center core.
const PRINT = { dy: 6, k: 0.82 }

/** A closed Catmull-Rom curve through the points, as cubic Beziers: the soft shape. */
function smooth(points: readonly (readonly [number, number])[]) {
	const n = points.length
	const p = (i: number) => points[(i + n) % n]
	let d = `M${p(0)[0]} ${p(0)[1]}`
	for (let i = 0; i < n; i++) {
		const [x0, y0] = p(i - 1)
		const [x1, y1] = p(i)
		const [x2, y2] = p(i + 1)
		const [x3, y3] = p(i + 2)
		const k = 1 / 6
		d += `C${r1(x1 + (x2 - x0) * k)} ${r1(y1 + (y2 - y0) * k)} ${r1(x2 - (x3 - x1) * k)} ${r1(y2 - (y3 - y1) * k)} ${x2} ${y2}`
	}
	return `${d}Z`
}

function wedge(i: number, r: number) {
	const a = angleOf(i)
	const half = Math.PI / AXES.length
	const [x0, y0] = pt(r, a - half)
	const [x1, y1] = pt(r, a + half)
	return `M0 0L${x0} ${y0}A${r} ${r} 0 0 1 ${x1} ${y1}Z`
}

export type Geo = ReturnType<typeof build>

/** The print's geometry for a section's drawings: twelve turns, rim markers included. */
export const printGeometry = (attributes: WhorlAttribute[]): Geo =>
	build(attributes, 12, true)

const RIDGE = 2.6

/**
 * The print's ridges, drawn once per section (about 850 paths): every drawing shows them by reference, twice each
 * (faint, and brighter inside the shape), so the DOM holds them once and not four times (two drawings, phone and wide,
 * that CSS picks from). Runs of one family share a group with its color; the paint order stays the print's own. A
 * sprite: a zero-size SVG, not hidden by `display`, so every browser renders its references. The section draws it once
 * the reader comes near: the print has no words for search engines, and its coordinates were a third of the page's
 * compressed HTML.
 */
export const RidgeSprite = memo(function RidgeSprite({
	id,
	geo,
}: { id: string; geo: Geo }) {
	const runs: {
		family: keyof typeof FAMILY_COLOR
		paths: Geo["turns"][number]["paths"]
	}[] = []
	for (const turn of geo.turns)
		for (const p of turn.paths) {
			const last = runs[runs.length - 1]
			if (last && last.family === p.family) last.paths.push(p)
			else runs.push({ family: p.family, paths: [p] })
		}
	return (
		<svg
			aria-hidden="true"
			focusable="false"
			width="0"
			height="0"
			style={{ position: "absolute", overflow: "hidden" }}
		>
			<defs>
				<g
					id={id}
					transform={`translate(0 ${PRINT.dy}) scale(${PRINT.k})`}
					fill="none"
					strokeWidth={RIDGE}
					strokeLinecap="round"
				>
					{runs.map((run, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: geometry is fixed
						<g key={i} stroke={FAMILY_COLOR[run.family]}>
							{run.paths.map((p, j) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: geometry is fixed
								<path key={j} d={p.d} strokeOpacity={p.opacity} />
							))}
						</g>
					))}
				</g>
			</defs>
		</svg>
	)
})

/** Only the ridges of the lit keys, at full color (what adds a little softer, what holds back dashed). */
function LitRidges({
	geo,
	width,
	keys,
}: { geo: Geo; width: number; keys: LitKey[] }) {
	const byKey = useMemo(() => {
		const m = new Map<
			string,
			{ d: string; family: keyof typeof FAMILY_COLOR }
		>()
		for (const turn of geo.turns)
			for (const p of turn.paths) {
				const cur = m.get(p.key)
				m.set(p.key, { d: (cur?.d ?? "") + p.d, family: p.family })
			}
		return m
	}, [geo])
	return (
		<g transform={`translate(0 ${PRINT.dy}) scale(${PRINT.k})`}>
			{keys.map(({ key, role }) => {
				const p = byKey.get(key)
				if (!p) return null
				return (
					<path
						key={key}
						d={p.d}
						fill="none"
						stroke={FAMILY_COLOR[p.family]}
						strokeOpacity={role === "adds" ? 0.7 : 1}
						strokeWidth={width + 0.9}
						strokeDasharray={
							role === "brake" ? `${width} ${width * 2.4}` : undefined
						}
						strokeLinecap="round"
					/>
				)
			})}
		</g>
	)
}

// --- Rim labels -------------------------------------------------------------------------------------------------

interface Placed {
	k: LitKey
	/** The ridge's rim point. */
	mx: number
	my: number
	/** The label's anchor point and side. */
	x: number
	y: number
	side: "l" | "r" | "c"
	w: number
}

/**
 * Each lit key's label just outside the ring, at its own angle; then labels on the same side are pushed apart until
 * none overlap (and none sits on a lit axis label, which doesn't move). Sizes are in the drawing's units, from the
 * box's real width (`px` = pixels per unit).
 */
function placeLabels(
	keys: LitKey[],
	markers: Map<string, { x: number; y: number }>,
	px: number,
	fixed: { x: number; y: number; w: number }[],
	H: number,
	/** How far a label may reach left / right of the center, in drawing units (the box, plus a bleed on the left). */
	reachL: number,
	reachR: number,
): Placed[] {
	const h = 15 / px
	const placed: (Placed & { fixed?: boolean })[] = []
	for (const k of keys) {
		const m = markers.get(k.key)
		if (!m) continue
		const mx = m.x * PRINT.k
		const my = m.y * PRINT.k + PRINT.dy
		const a = Math.atan2(my, mx)
		const c = Math.cos(a)
		const side = c > 0.34 ? "r" : c < -0.34 ? "l" : "c"
		let [x, y] = pt(R + 8, a)
		if (side === "c") y += (Math.sign(Math.sin(a)) * h) / 2
		const w = (`${k.label} ${k.score}`.length * 6.15 + 6) / px
		// A label that would run out of reach steps inward (over the faint print, on a dark halo).
		if (side === "l") x = Math.max(x, -reachL + w)
		else if (side === "r") x = Math.min(x, reachR - w)
		else x = Math.max(-reachL + w / 2, Math.min(reachR - w / 2, x))
		placed.push({ k, mx, my, x, y, side, w })
	}
	const all: (Placed & { fixed?: boolean })[] = [
		...placed,
		...fixed.map((f) => ({
			k: null as unknown as LitKey,
			mx: 0,
			my: 0,
			x: f.x,
			y: f.y,
			side: "c" as const,
			w: f.w,
			fixed: true,
		})),
	]
	const span = (p: Placed) =>
		p.side === "r"
			? [p.x, p.x + p.w]
			: p.side === "l"
				? [p.x - p.w, p.x]
				: [p.x - p.w / 2, p.x + p.w / 2]
	for (let it = 0; it < 60; it++) {
		let moved = false
		for (let i = 0; i < all.length; i++)
			for (let j = i + 1; j < all.length; j++) {
				const a = all[i]
				const b = all[j]
				if (a.fixed && b.fixed) continue
				const [a0, a1] = span(a)
				const [b0, b1] = span(b)
				if (a1 <= b0 || b1 <= a0) continue
				const dy = b.y - a.y
				const gap = h + 3 / px
				if (Math.abs(dy) >= gap) continue
				const dir = dy === 0 ? (b.my >= a.my ? 1 : -1) : Math.sign(dy)
				const lim = H - h / 2
				if (a.fixed || b.fixed) {
					// Past a fixed label: to its far side, or (if that leaves the box) to its near side.
					const f = a.fixed ? a : b
					const m = a.fixed ? b : a
					if (m.side === "c") {
						// A label above or below the ring meets the lit axis's own label: it steps beside it instead,
						// clear of the axis's glowing tip.
						m.side = m.mx >= f.x ? "r" : "l"
						m.x = f.x + (m.side === "r" ? 1 : -1) * (f.w / 2 + 6 / px)
						m.y = f.y
					} else {
						const side = m === b ? dir : -dir
						const y = f.y + side * (gap + 0.01)
						m.y = Math.abs(y) <= lim ? y : f.y - side * (gap + 0.01)
					}
				} else {
					const push = (gap - Math.abs(dy)) / 2 + 0.01
					a.y -= dir * push
					b.y += dir * push
				}
				moved = true
			}
		if (!moved) break
	}
	for (const p of placed) p.y = Math.max(-H + h / 2, Math.min(H - h / 2, p.y))
	return placed
}

// --- The shape ----------------------------------------------------------------------------------------------------

export function Shape({
	reading,
	geo,
	ridges,
	light,
	pressed,
	onPoint,
	onPick,
	label,
	bleed = 0,
	W = 240,
	H = 222,
	className = "",
}: {
	reading: Reading
	/** The print's geometry (printGeometry); null until the reader comes near, which draws no ridges. */
	geo: Geo | null
	/** The id of the section's RidgeSprite. */
	ridges: string
	light: Light | null
	/** The axes in the committed selection (light may be a hover preview). */
	pressed?: ReadonlySet<string>
	onPoint?: (axis: string | null) => void
	onPick?: (axis: string | null) => void
	label: string
	/** How many pixels rim labels may reach past the box on the left (into the gap beside the rows). */
	bleed?: number
	/** Half the drawing's width and height in its units (the ring's radius is 150). */
	W?: number
	H?: number
	className?: string
}) {
	const id = useId().replace(/:/g, "")
	const box = useRef<HTMLDivElement>(null)
	const [px, setPx] = useState(0.62)
	useEffect(() => {
		const el = box.current
		if (!el) return
		const ro = new ResizeObserver(() => setPx(el.clientWidth / (W * 2) || 0.62))
		ro.observe(el)
		return () => ro.disconnect()
	}, [W])
	const { axes } = reading
	const tips = axes.map((a, i) => pt(radiusOf(a.strength), angleOf(i)))
	const outline = smooth(tips)
	const markers = useMemo(
		() => new Map(geo?.markers.map((m) => [m.a.key, { x: m.x, y: m.y }])),
		[geo],
	)
	const keysLit = !!light?.keys.length
	const showRim = keysLit && !!light
	const labelR = R + 12

	const placed = useMemo(() => {
		if (!showRim || !light) return []
		const fixed = axes
			.filter((a) => light.axes.has(a.axis.id))
			.map((a) => {
				const ang = angleOf(a.index)
				const [x, y] = pt(labelR, ang)
				const w = (a.axis.label.length * 7 + 8) / px
				const h = 16 / px
				// The axis label's center: it's anchored outward from its point.
				return {
					x: x + (Math.cos(ang) * w) / 2,
					y: y + (Math.sin(ang) * h) / 2,
					w,
				}
			})
		return placeLabels(
			light.keys.filter((k) => k.named),
			markers,
			px,
			fixed,
			H,
			W + bleed / px,
			W,
		)
	}, [showRim, light, markers, px, axes, H, W, bleed, labelR])

	// The pointer's axis, by angle from the center; null in the small dead middle.
	const axisAt = (e: { clientX: number; clientY: number }) => {
		const el = box.current
		if (!el) return null
		const rect = el.getBoundingClientRect()
		const x = ((e.clientX - rect.left) / rect.width) * 2 * W - W
		const y = ((e.clientY - rect.top) / rect.height) * 2 * H - H
		if (Math.hypot(x, y) < 16) return null
		const i = Math.round((Math.atan2(y, x) + Math.PI / 2) / (TAU / AXES.length))
		return AXES[((i % AXES.length) + AXES.length) % AXES.length].id
	}

	return (
		<div
			ref={box}
			className={`relative w-full select-none ${className}`}
			style={{ aspectRatio: `${W * 2} / ${H * 2}` }}
		>
			<svg
				viewBox={`${-W} ${-H} ${W * 2} ${H * 2}`}
				className="absolute inset-0 h-full w-full overflow-visible"
				role="img"
				aria-label={label}
			>
				<defs>
					<clipPath id={`${id}-shape`}>
						<path d={outline} />
					</clipPath>
					<radialGradient id={`${id}-fill`}>
						<stop offset="0" stopColor="#fff" stopOpacity=".015" />
						<stop offset="1" stopColor="#fff" stopOpacity=".07" />
					</radialGradient>
					{axes.map((a, i) => (
						<clipPath key={a.axis.id} id={`${id}-w${i}`}>
							<path d={wedge(i, R + 40)} />
						</clipPath>
					))}
					{axes.map((a, i) => (
						<radialGradient
							key={a.axis.id}
							id={`${id}-g${i}`}
							gradientUnits="userSpaceOnUse"
							cx="0"
							cy="0"
							r={radiusOf(a.strength) + 34}
						>
							<stop offset="0" stopColor={a.color} stopOpacity="0" />
							<stop offset=".55" stopColor={a.color} stopOpacity=".1" />
							<stop offset=".86" stopColor={a.color} stopOpacity=".34" />
							<stop offset="1" stopColor={a.color} stopOpacity="0" />
						</radialGradient>
					))}
				</defs>

				{/* The print, faint everywhere, a little brighter inside the shape. */}
				<g
					className="fp-fade"
					opacity={keysLit ? 0.06 : 0.17}
					pointerEvents="none"
				>
					<use href={`#${ridges}`} />
				</g>
				<circle r={R} fill="none" stroke="white" strokeOpacity=".06" />
				{AXES.map((a, i) => {
					const [x, y] = pt(R, angleOf(i))
					return (
						<line
							key={a.id}
							x1={0}
							y1={0}
							x2={x}
							y2={y}
							stroke="white"
							strokeOpacity=".06"
						/>
					)
				})}

				{/* The lit slice's glow, behind the shape: a soft fan out past its tip. */}
				{axes.map((a, i) => {
					const lit = !!light?.axes.has(a.axis.id)
					return (
						<g
							key={a.axis.id}
							className="fp-pop"
							style={{
								transform: lit ? "none" : "scale(.82)",
								opacity: lit ? 1 : 0,
							}}
							pointerEvents="none"
						>
							<path
								d={wedge(i, radiusOf(a.strength) + 34)}
								fill={`url(#${id}-g${i})`}
							/>
						</g>
					)
				})}

				<g className="fp-shape" pointerEvents="none">
					<g clipPath={`url(#${id}-shape)`}>
						<g className="fp-fade" opacity={keysLit ? 0.16 : 0.5}>
							<use href={`#${ridges}`} />
						</g>
					</g>
					<path
						d={outline}
						fill={`url(#${id}-fill)`}
						stroke="white"
						strokeOpacity={light ? 0.45 : 0.6}
						strokeWidth={1.7}
						strokeLinejoin="round"
						className="fp-fade"
					/>
					{/* The lit slice steps out: the shape's own slice, scaled from the center, filled and rimmed in its color. */}
					{axes.map((a, i) => {
						const lit = !!light?.axes.has(a.axis.id)
						return (
							<g
								key={a.axis.id}
								className="fp-pop"
								style={{
									transform: lit ? "scale(1.07)" : "none",
									opacity: lit ? 1 : 0,
								}}
							>
								<g clipPath={`url(#${id}-w${i})`}>
									<path
										d={outline}
										fill={a.color}
										fillOpacity={0.2}
										stroke={a.color}
										strokeWidth={2.6}
										strokeLinejoin="round"
									/>
								</g>
							</g>
						)
					})}
					{axes.map((a, i) => {
						const [x, y] = tips[i]
						const lit = !!light?.axes.has(a.axis.id)
						return (
							<g key={a.axis.id}>
								<line
									x1={0}
									y1={0}
									x2={x * 1.07}
									y2={y * 1.07}
									stroke={a.color}
									strokeWidth={1.5}
									strokeOpacity={0.8}
									className="fp-fade"
									opacity={lit ? 1 : 0}
								/>
								<g transform={`translate(${r1(x)} ${r1(y)})`}>
									<circle
										r={a.counts ? 4.6 : 3.2}
										fill={a.counts ? a.color : "#78716c"}
										stroke="#0c0a09"
										strokeWidth={2}
										className="fp-pop"
										style={{
											transform: lit
												? `translate(${r1(x * 0.07)}px,${r1(y * 0.07)}px) scale(1.55)`
												: "none",
										}}
									/>
								</g>
							</g>
						)
					})}
				</g>

				{keysLit && light && geo && (
					<g key={light.id} className="fp-in" pointerEvents="none">
						<LitRidges geo={geo} width={RIDGE} keys={light.keys} />
					</g>
				)}

				<circle
					r={radiusOf(6.5)}
					fill="none"
					stroke="white"
					strokeOpacity=".22"
					strokeDasharray="2 5"
					strokeLinecap="round"
					pointerEvents="none"
				/>

				{/* Hairlines from each named ridge to its name. */}
				{placed.length > 0 && light && (
					<g key={`l-${light.id}`} className="fp-in" pointerEvents="none">
						{placed.map((p) => {
							const ex =
								p.side === "r"
									? p.x - 2 / px
									: p.side === "l"
										? p.x + 2 / px
										: p.x
							const ey = p.side === "c" ? p.y - (Math.sign(p.y) * 8) / px : p.y
							return (
								<g key={p.k.key}>
									<line
										x1={p.mx}
										y1={p.my}
										x2={ex}
										y2={ey}
										stroke={p.k.color}
										strokeOpacity={0.45}
										strokeWidth={1 / px}
									/>
									<circle
										cx={p.mx}
										cy={p.my}
										r={2.8 / px}
										fill={p.k.color}
										stroke="#0c0a09"
										strokeWidth={1.4 / px}
									/>
								</g>
							)
						})}
					</g>
				)}
			</svg>

			{/* Axis labels round the shape: white for the strongest, quiet for the rest, the axis color when lit. While
			    ingredients are named round the rim, the unlit axis labels step aside. */}
			{axes.map((a, i) => {
				const angle = angleOf(i)
				const bold = reading.bold.has(a.axis.id)
				const lit = !!light?.axes.has(a.axis.id)
				const [x, y] = pt(labelR, angle)
				const tx = -50 + 50 * Math.cos(angle)
				const ty = -50 + 50 * Math.sin(angle)
				return (
					<button
						key={a.axis.id}
						type="button"
						tabIndex={0}
						aria-pressed={!!pressed?.has(a.axis.id)}
						aria-label={`${a.axis.label}, ${a.strength.toFixed(1)} of 10`}
						onFocus={() => onPoint?.(a.axis.id)}
						onBlur={() => onPoint?.(null)}
						onClick={() => onPick?.(a.axis.id)}
						className="fp-fade pointer-events-none absolute flex flex-col items-center rounded-md px-1 leading-tight focus-visible:!opacity-100 focus-visible:outline-2 focus-visible:outline-amber-300"
						style={{
							left: `${((x + W) / (W * 2)) * 100}%`,
							top: `${((y + H) / (H * 2)) * 100}%`,
							transform: `translate(${r1(tx)}%, ${r1(ty)}%)`,
							opacity: showRim && !lit ? 0 : 1,
						}}
					>
						<span
							className={`whitespace-nowrap text-[11.5px] sm:text-[12.5px] ${bold || lit ? "font-semibold" : "font-medium"}`}
							style={{ color: lit ? a.color : bold ? "#f5f5f4" : "#78716c" }}
						>
							{a.axis.label}
						</span>
					</button>
				)
			})}

			{/* The lit ingredients by name, at their rim positions. */}
			{placed.length > 0 && light && (
				<div
					key={light.id}
					className="fp-in pointer-events-none absolute inset-0"
					aria-hidden="true"
				>
					{placed.map((p) => (
						<span
							key={p.k.key}
							className="absolute whitespace-nowrap text-[11.5px] font-medium leading-[15px] [text-shadow:0_0_3px_#0c0a09,0_0_6px_#0c0a09]"
							style={{
								left: `${((p.x + W) / (W * 2)) * 100}%`,
								top: `${((p.y + H) / (H * 2)) * 100}%`,
								transform:
									p.side === "r"
										? "translate(0,-50%)"
										: p.side === "l"
											? "translate(-100%,-50%)"
											: "translate(-50%,-50%)",
							}}
						>
							<span
								style={{
									color: p.k.role === "brake" ? "#a8a29e" : p.k.color,
									opacity: p.k.role === "adds" ? 0.85 : 1,
								}}
							>
								{p.k.label}
							</span>{" "}
							<span
								className={`tabular-nums font-semibold ${p.k.role === "brake" ? "text-gray-400" : "text-gray-100"}`}
							>
								{p.k.score}
							</span>
						</span>
					))}
				</div>
			)}

			{/* One pointer surface over everything: by angle, center included. The axis labels are its keyboard way in. */}
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: the axis label buttons above take the keyboard */}
			<div
				aria-hidden="true"
				className="absolute inset-0 cursor-pointer touch-manipulation"
				onPointerMove={(e: PointerEvent) =>
					e.pointerType === "mouse" && onPoint?.(axisAt(e))
				}
				onPointerLeave={(e: PointerEvent) =>
					e.pointerType === "mouse" && onPoint?.(null)
				}
				onClick={(e: MouseEvent) => onPick?.(axisAt(e))}
			/>
		</div>
	)
}
