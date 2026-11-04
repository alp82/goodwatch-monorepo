// The fingerprint's drawing: the eight-axis shape over the title's faint print, axis labels round it.
// - Static by default: nothing lit.
// - `light` (a line or a scale pointed at) lights that effect's slice and its ingredients' ridges, each named round the
//   rim with its score.
// - `focus` puts one section (a 45-degree sector round its axis) in a spotlight: the rest dims, the sector's edges and
//   rim take its color and its label shows its value.
// - The pointer picks a section only inside the ring (plus its labels' band), by angle: the same sectors the
//   spotlight draws. A small dead middle keeps the section the pointer came from; past the labels is nothing.
// Motion: opacity only.
import {
	type MouseEvent,
	type PointerEvent,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react"
import type { Geo } from "~/ui/details/fingerprint-section/Shape"
import { AXES, type Reading } from "~/ui/details/fingerprint-section/reading"
import type { Light, LitKey } from "~/ui/details/fingerprint-section/selection"
import { FAMILY_COLOR } from "~/ui/profile/taste/model"
import type { SectionView } from "./print-model"

const R = 150
const TAU = Math.PI * 2
const angleOf = (i: number) => -Math.PI / 2 + (i * TAU) / AXES.length
const radiusOf = (s: number) =>
	R * (0.06 + (0.94 * Math.min(10, Math.max(0, s))) / 10)
const r1 = (n: number) => Math.round(n * 10) / 10
const pt = (r: number, a: number) =>
	[r1(r * Math.cos(a)), r1(r * Math.sin(a))] as const
const PRINT = { dy: 6, k: 0.82 }
const RIDGE = 2.6
/** The pointer's reach: the ring and its labels' band. */
const REACH = R + 34

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

function LitRidges({ geo, keys }: { geo: Geo; keys: LitKey[] }) {
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
						strokeWidth={RIDGE + 0.9}
						strokeDasharray={
							role === "brake" ? `${RIDGE} ${RIDGE * 2.4}` : undefined
						}
						strokeLinecap="round"
					/>
				)
			})}
		</g>
	)
}

/** Lit keys' names round the rim, pushed apart per side so none overlap (a simpler copy of Shape's placement). */
function placeNames(
	keys: LitKey[],
	markers: Map<string, { x: number; y: number }>,
	px: number,
	W: number,
	H: number,
) {
	const h = 15 / px
	const placed = keys
		.filter((k) => k.named && markers.has(k.key))
		.map((k) => {
			const m = markers.get(k.key) as { x: number; y: number }
			const mx = m.x * PRINT.k
			const my = m.y * PRINT.k + PRINT.dy
			const a = Math.atan2(my, mx)
			const side: "l" | "r" = Math.cos(a) >= 0 ? "r" : "l"
			const [x0, y] = pt(R + 10, a)
			const w = (`${k.label} ${k.score}`.length * 6.15 + 6) / px
			const x =
				side === "r"
					? Math.min(Math.max(x0, 18), W - w)
					: Math.max(Math.min(x0, -18), -W + w)
			return { k, mx, my, x, y, side, w }
		})
	for (const side of ["l", "r"] as const) {
		const col = placed.filter((p) => p.side === side).sort((a, b) => a.y - b.y)
		for (let i = 1; i < col.length; i++)
			if (col[i].y - col[i - 1].y < h + 2 / px)
				col[i].y = col[i - 1].y + h + 2 / px
		const over = col.length ? col[col.length - 1].y - (H - h / 2) : 0
		if (over > 0) for (const p of col) p.y -= over
	}
	return placed
}

export function Print({
	reading,
	geo,
	ridges,
	light = null,
	focus = null,
	sections,
	onPoint,
	onPick,
	labels = "all",
	label,
	W = 240,
	H = 200,
	className = "",
}: {
	reading: Reading
	geo: Geo | null
	/** The id of a RidgeSprite on the page. */
	ridges: string
	light?: Light | null
	/** The section in the spotlight. */
	focus?: string | null
	/** The sections, for the spotlight's value and typical arc. */
	sections?: SectionView[]
	/** Mouse only: the section under the pointer, null off it. */
	onPoint?: (axis: string | null) => void
	/** A click or tap: the section under it, null off it. */
	onPick?: (axis: string | null, touch: boolean) => void
	/** "bold": only the strongest axes are named; "none": no axis labels. */
	labels?: "all" | "bold" | "none"
	label: string
	W?: number
	H?: number
	className?: string
}) {
	const id = useId().replace(/:/g, "")
	const box = useRef<HTMLDivElement>(null)
	const pointerType = useRef("mouse")
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
	const names = useMemo(
		() => (light && geo ? placeNames(light.keys, markers, px, W, H) : []),
		[light, geo, markers, px, W, H],
	)
	const showNames = names.length > 0
	const focusSec = focus ? sections?.find((s) => s.id === focus) : undefined
	const interactive = !!(onPoint || onPick)

	const axisAt = (e: { clientX: number; clientY: number }) => {
		const el = box.current
		if (!el) return null
		const rect = el.getBoundingClientRect()
		const x = ((e.clientX - rect.left) / rect.width) * 2 * W - W
		const y = ((e.clientY - rect.top) / rect.height) * 2 * H - H
		const d = Math.hypot(x, y)
		if (d > REACH) return null
		// The middle belongs to no section: the pointer moving through it keeps the one it came from.
		if (d < 14) return undefined
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

				{/* An effect row's slice: a soft fan behind the shape. */}
				{axes.map((a, i) => (
					<path
						key={a.axis.id}
						d={wedge(i, radiusOf(a.strength) + 34)}
						fill={`url(#${id}-g${i})`}
						className="fp-fade"
						opacity={light?.axes.has(a.axis.id) ? 1 : 0}
						pointerEvents="none"
					/>
				))}

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
						strokeOpacity={light || focus ? 0.45 : 0.6}
						strokeWidth={1.7}
						strokeLinejoin="round"
						className="fp-fade"
					/>
					{/* A lit or focused slice: the shape's own slice in its color, in place (it doesn't step out). */}
					{axes.map((a, i) => {
						const lit = !!light?.axes.has(a.axis.id) || focus === a.axis.id
						return (
							<g key={a.axis.id} className="fp-fade" opacity={lit ? 1 : 0}>
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
						return (
							<circle
								key={a.axis.id}
								cx={x}
								cy={y}
								r={a.counts ? 4.6 : 3.2}
								fill={a.counts ? a.color : "#78716c"}
								stroke="#0c0a09"
								strokeWidth={2}
							/>
						)
					})}
				</g>

				{keysLit && light && geo && (
					<g key={light.id} className="fp-in" pointerEvents="none">
						<LitRidges geo={geo} keys={light.keys} />
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

				{/* The spotlight: one layer per sector, so a change of section is a crossfade. */}
				{sections && (
					<g pointerEvents="none">
						{sections.map((sec, i) => {
							const on = focus === sec.id
							const half = Math.PI / AXES.length
							const [ax, ay] = pt(R, angleOf(i) - half)
							const [bx, by] = pt(R, angleOf(i) + half)
							const tr = radiusOf(sec.typical)
							const [tx0, ty0] = pt(tr, angleOf(i) - half)
							const [tx1, ty1] = pt(tr, angleOf(i) + half)
							const big = R + 44
							return (
								<g key={sec.id} className="fp-fade" opacity={on ? 1 : 0}>
									<path
										d={`M${-big} 0a${big} ${big} 0 1 0 ${2 * big} 0a${big} ${big} 0 1 0 ${-2 * big} 0Z${wedge(i, R + 40)}`}
										fillRule="evenodd"
										fill="#0c0a09"
										fillOpacity={0.74}
									/>
									<path
										d={`M0 0L${ax} ${ay}A${R} ${R} 0 0 1 ${bx} ${by}Z`}
										fill="none"
										stroke={sec.color}
										strokeOpacity={0.55}
										strokeWidth={1.2}
										strokeLinejoin="round"
									/>
									<path
										d={`M${tx0} ${ty0}A${tr} ${tr} 0 0 1 ${tx1} ${ty1}`}
										fill="none"
										stroke="white"
										strokeOpacity={0.75}
										strokeWidth={1.8}
										strokeDasharray="3 4"
										strokeLinecap="round"
									/>
								</g>
							)
						})}
					</g>
				)}

				{showNames && light && (
					<g key={`l-${light.id}`} className="fp-in" pointerEvents="none">
						{names.map((p) => (
							<g key={p.k.key}>
								<line
									x1={p.mx}
									y1={p.my}
									x2={p.side === "r" ? p.x - 2 / px : p.x + 2 / px}
									y2={p.y}
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
						))}
					</g>
				)}
			</svg>

			{/* Axis labels: white for the strongest, quiet for the rest, the section color in the spotlight (with its
			    value). While a row's ingredients are named round the rim, the axis labels step aside. */}
			{labels !== "none" &&
				axes.map((a, i) => {
					const bold = reading.bold.has(a.axis.id)
					if (labels === "bold" && !bold) return null
					const angle = angleOf(i)
					const on = focus === a.axis.id
					const [x, y] = pt(R + 12, angle)
					const tx = -50 + 50 * Math.cos(angle)
					const ty = -50 + 50 * Math.sin(angle)
					return (
						<span
							key={a.axis.id}
							aria-hidden="true"
							className="fp-fade pointer-events-none absolute whitespace-nowrap px-1 text-[11.5px] leading-tight sm:text-[12.5px]"
							style={{
								left: `${((x + W) / (W * 2)) * 100}%`,
								top: `${((y + H) / (H * 2)) * 100}%`,
								transform: `translate(${r1(tx)}%, ${r1(ty)}%)`,
								opacity: showNames ? 0 : focus && !on ? 0.3 : 1,
							}}
						>
							<span
								className={bold || on ? "font-semibold" : "font-medium"}
								style={{ color: on ? a.color : bold ? "#f5f5f4" : "#78716c" }}
							>
								{a.axis.label}
							</span>
							{on && (
								<span className="ml-1 font-semibold tabular-nums text-gray-100">
									{a.strength.toFixed(1)}
								</span>
							)}
						</span>
					)
				})}

			{showNames && light && (
				<div
					key={light.id}
					className="fp-in pointer-events-none absolute inset-0"
					aria-hidden="true"
				>
					{names.map((p) => (
						<span
							key={p.k.key}
							className="absolute whitespace-nowrap text-[11.5px] font-medium leading-[15px] [text-shadow:0_0_3px_#0c0a09,0_0_6px_#0c0a09]"
							style={{
								left: `${((p.x + W) / (W * 2)) * 100}%`,
								top: `${((p.y + H) / (H * 2)) * 100}%`,
								transform:
									p.side === "r"
										? "translate(0,-50%)"
										: "translate(-100%,-50%)",
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

			{interactive && (
				// biome-ignore lint/a11y/useKeyWithClickEvents: the section list beside the drawing takes the keyboard
				<div
					aria-hidden="true"
					className="absolute inset-0 touch-manipulation"
					onPointerMove={(e: PointerEvent<HTMLDivElement>) => {
						if (e.pointerType !== "mouse") return
						const axis = axisAt(e)
						if (axis === undefined) return
						e.currentTarget.style.cursor = axis ? "pointer" : "default"
						onPoint?.(axis)
					}}
					onPointerLeave={(e: PointerEvent) =>
						e.pointerType === "mouse" && onPoint?.(null)
					}
					onPointerDown={(e: PointerEvent) => {
						pointerType.current = e.pointerType
					}}
					onClick={(e: MouseEvent) =>
						onPick?.(axisAt(e) ?? null, pointerType.current !== "mouse")
					}
				/>
			)}
		</div>
	)
}
