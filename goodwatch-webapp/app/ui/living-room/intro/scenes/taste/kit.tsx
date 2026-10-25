// Pieces of the "Your taste" chapter:
// - The data (taste.json): a real member's taste and the For you ranking at a few handle shapes.
// - tl(): a CSS-timed timeline of transform moves and opacity fades on one element (taste.css's m1..m8, o1..o8).
// - <Print>: the For you page's steerable fingerprint (HandlePrint's geometry and look: one layer per family, handles
//   on the four rings), drawn in by bands of ridges and stretched by scripted drags with a pointer.
// - <Picks>: posters that follow a ranking through its states, sliding to their new place, leaving and arriving.
// - <Swap>: lines that replace one another.
import type { CSSProperties, ReactNode } from "react"
import { FAMILY_ORDER, type FamilyId } from "~/domain/for-you-page/contract"
import {
	FAMILY_WORD,
	FLAT,
	LEVELS,
	type Level,
	type Levels,
	RING,
	RING_WORD,
} from "~/domain/for-you-page/shape"
import { build } from "~/ui/profile/taste/Whorl"
import { FAMILY_COLOR } from "~/ui/profile/taste/model"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import taste from "./taste.json"
import "./taste.css"

// ---------- data ----------

type StateName = keyof typeof taste.states
export const ATTRIBUTES = taste.attributes.map((a) => ({
	...a,
	family: a.family as FamilyId,
}))
const titleOf = (key: string) =>
	(taste.titles as Record<string, { title: string; poster: string }>)[key]
const posterUrl = (key: string, size = "w342") => {
	const p = titleOf(key)?.poster
	return p ? tmdbImageUrl(p, size) : ""
}
export const stateKeys = (s: StateName, n: number) =>
	taste.states[s].slice(0, n)

// ---------- timelines ----------

type Move = { at: number; dur: number; to: string; ease?: string }
type Fade = { at: number; dur: number; to: number; ease?: string }
const SPRING = "cubic-bezier(.3,1.3,.5,1)"
const GLIDE = "cubic-bezier(.65,0,.35,1)"
export const OUT = "cubic-bezier(.16,1,.3,1)"

/** A start transform and opacity, then moves and fades at given times (ms at k = 1), sorted by time. */
export function tl(
	t0: string,
	moves: Move[] = [],
	o0 = 1,
	fades: Fade[] = [],
	extra: CSSProperties = {},
): CSSProperties {
	const v: Record<string, string | number> = {}
	const anims: string[] = []
	const ms = [...moves].sort((a, b) => a.at - b.at).slice(0, 8)
	const fs = [...fades].sort((a, b) => a.at - b.at).slice(0, 8)
	let t = t0
	ms.forEach((m, i) => {
		v[`--m${i + 1}a`] = t
		v[`--m${i + 1}b`] = m.to
		t = m.to
		anims.push(
			`intro-taste-m${i + 1} calc(${Math.max(1, m.dur)}ms * var(--k)) ${m.ease ?? SPRING} calc(${m.at}ms * var(--k)) ${i ? "forwards" : "both"}`,
		)
	})
	let o = o0
	fs.forEach((f, i) => {
		v[`--o${i + 1}a`] = o
		v[`--o${i + 1}b`] = f.to
		o = f.to
		anims.push(
			`intro-taste-o${i + 1} calc(${Math.max(1, f.dur)}ms * var(--k)) ${f.ease ?? "ease-out"} calc(${f.at}ms * var(--k)) ${i ? "forwards" : "both"}`,
		)
	})
	return {
		...v,
		transform: t,
		opacity: o,
		animation: anims.length ? anims.join(", ") : undefined,
		...extra,
	} as CSSProperties
}

/** A delay (ms at k = 1) for the one-shot classes (intro-taste-land, -pop, -band, -press). */
export const at = (ms: number, more: CSSProperties = {}) =>
	({ "--d": `${ms}ms`, ...more }) as CSSProperties

// ---------- the print's geometry (HandlePrint's, at scale 1) ----------

const BOX = 272
const VIEW = `${-BOX} ${-BOX} ${BOX * 2} ${BOX * 2}`
/** View units to the print box's cqw. */
const u = (n: number) => `${((n / (BOX * 2)) * 100).toFixed(2)}cqw`
const BANDS = 6
const TURNS = 18
/** How long the pointer takes to glide to a handle. */
const GLIDE_MS = 560

const GEO = (() => {
	const g = build(ATTRIBUTES, TURNS, true)
	const rs = g.markers.map((m) => Math.hypot(m.x / 0.86, m.y))
	const ring = rs.reduce((s, r) => s + r, 0) / (rs.length || 1) + 8
	const anchors = {} as Record<FamilyId, { x: number; y: number }>
	for (const f of FAMILY_ORDER) {
		const ms = g.markers.filter((m) => m.a.family === f)
		const sx = ms.reduce((s, m) => s + m.x / 0.86, 0)
		const sy = ms.reduce((s, m) => s + m.y, 0)
		const th = Math.atan2(sy, sx)
		anchors[f] = {
			x: Math.round(0.86 * ring * Math.cos(th) * 10) / 10,
			y: Math.round(ring * Math.sin(th) * 10) / 10,
		}
	}
	// Ridges per family and band of turns, so a band can draw in and a family can stretch.
	const bands = Object.fromEntries(
		FAMILY_ORDER.map((f) => [
			f,
			Array.from({ length: BANDS }, (_, b) =>
				g.turns
					.slice((b * TURNS) / BANDS, ((b + 1) * TURNS) / BANDS)
					.flatMap((t) => t.paths.filter((p) => p.family === f))
					.map((p) => ({ d: p.d, o: p.opacity })),
			),
		]),
	) as Record<FamilyId, { d: string; o: number }[][]>
	return { g, ring, anchors, bands }
})()

/** Where a family's handle sits at a level, as a translate inside the print box. */
const handleAt = (f: FamilyId, l: Level, dx = 0, dy = 0) => {
	const a = GEO.anchors[f]
	const s = RING[l]
	return `translate(calc(${u(a.x * s)} + ${dx}cqw), calc(${u(a.y * s)} + ${dy}cqw))`
}
/** An attribute's dot on the print's rim (view units), from its key. */
export const markerOf = (key: string) => {
	const m = GEO.g.markers.find((x) => x.a.key === key)
	return m ? { x: m.x, y: m.y, r: m.r } : { x: 0, y: 0, r: 0 }
}
/** A point in view units, pushed `out` times along its ray, as a translate inside the print box. */
export const viewAt = (x: number, y: number, out = 1, dx = 0, dy = 0) =>
	`translate(calc(${u(x * out)} + ${dx}cqw), calc(${u(y * out)} + ${dy}cqw))`
/** A point in view units on the stage (x in cqw, y in cqh), for a print box at `left` cqw, `top` cqh, `size` cqh. */
export function stageOfView(
	box: { left: number; top: number; size: number },
	x: number,
	y: number,
) {
	const side = box.size * (9 / 16)
	return {
		x: box.left + side / 2 + (x / (BOX * 2)) * side,
		y: box.top + box.size / 2 + (y / (BOX * 2)) * box.size,
	}
}

export type Drag = {
	f: FamilyId
	from: Level
	to: Level
	/** When the handle starts moving; the pointer arrives 120 ms before. */
	at: number
	dur: number
}

const familyScale = (s: number) => `scale(${s})`

const Cursor = () => (
	<svg viewBox="0 0 32 40" className="intro-taste-cursor" aria-hidden="true">
		<path
			d="M3 2l24 22-11 1.5 6.5 12-5 2.5-6.5-12.5L3 34z"
			fill="#fff"
			stroke="#0a0e1a"
			strokeWidth="2.2"
			strokeLinejoin="round"
		/>
	</svg>
)

function Knob({ f, l }: { f: FamilyId; l: Level }) {
	const c = FAMILY_COLOR[f]
	return (
		<span
			className="intro-taste-knob"
			style={{
				background: l === 0 ? "#030712" : c,
				color: l === 0 ? c : "#030712",
				boxShadow: `0 0 0 0.9cqw ${c}, 0 0 0 1.8cqw rgba(3,7,18,.85)`,
			}}
		>
			{FAMILY_WORD[f]}
			{l !== 0 && (
				<span style={{ marginLeft: "1cqw" }}>
					{l === -1 ? "−" : l === 1 ? "+" : "++"}
				</span>
			)}
		</span>
	)
}

/**
 * The steerable print. Box size and place come from `style` (a square, in stage units). `drawAt` starts the ridges,
 * `handlesAt` pops the handles in, `drags` stretch families with the pointer, `cursorFrom` is where
 * the pointer glides in from (print cqw), `cursorOut` when it leaves.
 */
export function Print({
	style,
	drawAt = 0,
	handlesAt = 800,
	drags = [],
	cursorFrom = { x: 40, y: 45 },
	cursorOut,
	children,
}: {
	style: CSSProperties
	drawAt?: number
	handlesAt?: number
	drags?: Drag[]
	cursorFrom?: { x: number; y: number }
	cursorOut?: number
	children?: ReactNode
}) {
	const g = GEO.g
	const levels: Levels = { ...FLAT }
	const dragsOf = (f: FamilyId) => drags.filter((d) => d.f === f)
	const release = (d: Drag) => d.at + d.dur
	// While a family is dragged the others dim (the page's data-drag rule) and the rings show.
	const dimFades = (f: FamilyId): Fade[] =>
		drags.flatMap((d) =>
			d.f === f
				? []
				: [
						{ at: d.at - 140, dur: 200, to: 0.4 },
						{ at: release(d) + 60, dur: 260, to: 1 },
					],
		)
	const ringFades: Fade[] = drags.flatMap((d) => [
		{ at: d.at - 160, dur: 200, to: 1 },
		{ at: release(d) + 60, dur: 260, to: 0 },
	])
	for (const d of drags) levels[d.f] = d.from
	return (
		<div className="intro-taste-print" style={style}>
			{/* The rings: less / usual / more / lots more, shown while dragging. */}
			<div className="intro-taste-fill" style={tl("none", [], 0, ringFades)}>
				<svg viewBox={VIEW} aria-hidden="true">
					{LEVELS.map((l) => (
						<ellipse
							key={l}
							rx={Math.round(0.86 * GEO.ring * RING[l] * 10) / 10}
							ry={Math.round(GEO.ring * RING[l] * 10) / 10}
							fill="none"
							stroke="white"
							strokeOpacity={l === 0 ? 0.4 : 0.22}
							strokeWidth={1.5}
							strokeDasharray={l === 0 ? undefined : "5 5"}
						/>
					))}
				</svg>
			</div>
			{/* The four stops on each dragged family's ray. */}
			{drags.map((d, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed script
					key={i}
					className="intro-taste-fill"
					style={tl("none", [], 0, [
						{ at: d.at - 160, dur: 200, to: 1 },
						{ at: release(d) + 60, dur: 260, to: 0 },
					])}
				>
					<svg viewBox={VIEW} aria-hidden="true">
						{LEVELS.map((l) => {
							const a = GEO.anchors[d.f]
							return (
								<circle
									key={l}
									cx={a.x * RING[l]}
									cy={a.y * RING[l]}
									r={6}
									fill="#030712"
									stroke={FAMILY_COLOR[d.f]}
									strokeWidth={2.5}
								/>
							)
						})}
					</svg>
				</div>
			))}
			{/* The print, one layer per family; a stretch is the layer's scale. */}
			{FAMILY_ORDER.map((f) => {
				const ds = dragsOf(f)
				const s0 = RING[ds[0]?.from ?? 0]
				return (
					<div
						key={f}
						className="intro-taste-fam"
						style={tl("none", [], 1, dimFades(f))}
					>
						<div
							className="intro-taste-fill"
							style={tl(
								familyScale(s0),
								ds.map((d) => ({
									at: d.at,
									dur: d.dur,
									to: familyScale(RING[d.to]),
									ease: GLIDE,
								})),
							)}
						>
							{GEO.bands[f].map((paths, b) => (
								<svg
									// biome-ignore lint/suspicious/noArrayIndexKey: fixed geometry
									key={b}
									viewBox={VIEW}
									className="intro-taste-band"
									style={at(drawAt + b * 110)}
									aria-hidden="true"
								>
									{paths.map((p, j) => (
										<path
											// biome-ignore lint/suspicious/noArrayIndexKey: fixed geometry
											key={j}
											d={p.d}
											fill="none"
											stroke={FAMILY_COLOR[f]}
											strokeOpacity={p.o}
											strokeWidth={2.6}
											strokeLinecap="round"
										/>
									))}
									{b === BANDS - 1 &&
										g.markers
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
								</svg>
							))}
						</div>
					</div>
				)
			})}
			{children}
			{/* The handles. */}
			{FAMILY_ORDER.map((f, i) => {
				const ds = dragsOf(f)
				const l0 = ds[0]?.from ?? levels[f]
				return (
					<div
						key={f}
						className="intro-taste-at"
						style={tl(
							handleAt(f, l0),
							ds.map((d) => ({
								at: d.at,
								dur: d.dur,
								to: handleAt(f, d.to),
								ease: GLIDE,
							})),
							1,
							dimFades(f).map((x) => ({ ...x, to: x.to < 1 ? 0.35 : 1 })),
						)}
					>
						<div className="intro-taste-handle">
							<div
								className="intro-taste-pop"
								style={{ ...at(handlesAt + i * 70), position: "relative" }}
							>
								<div
									style={tl(
										"none",
										[],
										1,
										ds
											.map((d) => ({ at: release(d), dur: 120, to: 0 }))
											.slice(0, 1),
									)}
								>
									<Knob f={f} l={l0} />
								</div>
								{ds.map((d, j) => (
									<div
										// biome-ignore lint/suspicious/noArrayIndexKey: fixed script
										key={j}
										className="intro-taste-knob-on"
										style={tl(
											"none",
											[
												{ at: release(d) - 40, dur: 1, to: "scale(.7)" },
												{ at: release(d), dur: 380, to: "none" },
											],
											0,
											[
												{ at: release(d), dur: 120, to: 1 },
												...(ds[j + 1]
													? [{ at: release(ds[j + 1]), dur: 120, to: 0 }]
													: []),
											],
										)}
									>
										<Knob f={f} l={d.to} />
									</div>
								))}
							</div>
						</div>
					</div>
				)
			})}
			{/* The live pill: "Feel: lots more" while dragging. */}
			{drags.map((d, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed script
					key={i}
					className="intro-taste-livepill"
					style={tl("translateX(-50%)", [], 0, [
						{ at: d.at + d.dur * 0.45, dur: 160, to: 1 },
						{ at: release(d) + 420, dur: 220, to: 0 },
					])}
				>
					{FAMILY_WORD[d.f]}: {RING_WORD[d.to]}
				</div>
			))}
			{/* The pointer: glides to each handle, presses, drags it out, then leaves. Its tip is the element's corner. */}
			{drags.length > 0 && (
				<div
					className="intro-taste-at"
					style={tl(
						`translate(${cursorFrom.x}cqw, ${cursorFrom.y}cqw)`,
						drags.flatMap((d) => [
							{
								at: d.at - 120 - GLIDE_MS,
								dur: GLIDE_MS,
								to: handleAt(d.f, d.from, 0.6, 0.6),
								ease: GLIDE,
							},
							{
								at: d.at,
								dur: d.dur,
								to: handleAt(d.f, d.to, 0.6, 0.6),
								ease: GLIDE,
							},
						]),
						0,
						[
							{ at: drags[0].at - 120 - GLIDE_MS, dur: 200, to: 1 },
							...(cursorOut ? [{ at: cursorOut, dur: 260, to: 0 }] : []),
						],
						{ zIndex: 5 },
					)}
				>
					<div className="intro-taste-press" style={at(drags[0].at - 120)}>
						{drags[1] ? (
							<div className="intro-taste-press" style={at(drags[1].at - 120)}>
								<Cursor />
							</div>
						) : (
							<Cursor />
						)}
					</div>
				</div>
			)}
		</div>
	)
}

// ---------- posters following a ranking ----------

type Slot = { x: number; y: number }

/**
 * Posters for the titles of `states` (lists of title keys), each in its slot of the current state. A poster's centre
 * is `slot(i)` in stage cqw/cqh, width `w` cqw. The first state deals in from `dealAt`; at `changes[i]` the ranking
 * becomes `states[i + 1]`: posters that stay slide to their new place, new ones grow in place with an amber ring, and
 * the ones that drop out shrink away in place.
 */
export function Picks({
	states,
	changes,
	slot,
	w,
	dealAt = 400,
}: {
	states: string[][]
	changes: number[]
	slot: (i: number) => Slot
	w: number
	dealAt?: number
}) {
	const keys = [...new Set(states.flat())]
	const h = w * 1.5
	const place = (p: { x: number; y: number }, s = 1) =>
		`translate(${(p.x - w / 2).toFixed(2)}cqw, calc(${p.y.toFixed(2)}cqh - ${(h / 2).toFixed(2)}cqw)) scale(${s})`
	return (
		<>
			{keys.map((key) => {
				const idx = states.map((s) => s.indexOf(key))
				const moves: Move[] = []
				const fades: Fade[] = []
				const ring: Fade[] = []
				let t0: string
				if (idx[0] >= 0) {
					const p = slot(idx[0])
					const d = dealAt + idx[0] * 70
					t0 = place({ x: p.x, y: p.y + 4 }, 0.92)
					moves.push({ at: d, dur: 700, to: place(p), ease: OUT })
					fades.push({ at: d, dur: 300, to: 1 })
				} else {
					const first = idx.findIndex((x) => x >= 0)
					t0 = place(slot(idx[first]), 0.6)
				}
				changes.forEach((T, c) => {
					const a = idx[c]
					const b = idx[c + 1]
					if (b === undefined) return
					if (a >= 0 && b >= 0 && a !== b) {
						const p = slot(b)
						moves.push({ at: T + b * 30, dur: 650, to: place(p) })
					} else if (a >= 0 && b < 0) {
						const p = slot(a)
						moves.push({
							at: T,
							dur: 420,
							to: place(p, 0.55),
							ease: "cubic-bezier(.5,0,.75,0)",
						})
						fades.push({ at: T + 120, dur: 300, to: 0 })
					} else if (a < 0 && b >= 0) {
						const p = slot(b)
						const start = T + 140 + b * 40
						moves.push({ at: start - 2, dur: 1, to: place(p, 0.5) })
						moves.push({ at: start, dur: 700, to: place(p) })
						fades.push({ at: start, dur: 260, to: 1 })
						ring.push(
							{ at: start + 200, dur: 250, to: 1 },
							{ at: start + 1100, dur: 500, to: 0 },
						)
					}
				})
				return (
					<div
						key={key}
						className="intro-taste-poster"
						style={tl(t0, moves, 0, fades, {
							width: `${w}cqw`,
							height: `${h}cqw`,
						})}
					>
						<img
							src={posterUrl(key, w > 9 ? "w342" : "w185")}
							alt={titleOf(key)?.title ?? ""}
							decoding="async"
						/>
						<div className="intro-taste-new" style={tl("none", [], 0, ring)} />
					</div>
				)
			})}
		</>
	)
}

/** Lines that replace one another at given times (the first shows from `t0`). */
export function Swap({
	items,
	t0,
	className = "",
	style,
}: {
	items: { at: number; node: ReactNode }[]
	t0: number
	className?: string
	style?: CSSProperties
}) {
	return (
		<div className={className} style={{ position: "relative", ...style }}>
			{items.map((it, i) => {
				const next = items[i + 1]
				const start = i ? it.at : t0
				return (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed script
						key={i}
						style={tl(
							"translateY(1.6cqh)",
							[
								{ at: start, dur: 500, to: "none", ease: OUT },
								...(next
									? [
											{
												at: next.at - 60,
												dur: 300,
												to: "translateY(-1.6cqh)",
												ease: OUT,
											},
										]
									: []),
							],
							0,
							[
								{ at: start, dur: 300, to: 1 },
								...(next ? [{ at: next.at - 60, dur: 200, to: 0 }] : []),
							],
							i ? { position: "absolute", left: 0, right: 0, top: 0 } : {},
						)}
					>
						{it.node}
					</div>
				)
			})}
		</div>
	)
}
