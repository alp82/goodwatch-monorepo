// PROTOTYPE (README taste loop, 2026-10-26): the For you fingerprint, looping. The print sits on the left with its five
// section handles, the top six For you picks on the right. The pointer goes around the print clockwise, one section
// every 3 s: Craft lots more, Feel less, Humor lots more, World less, Story lots more (the section before eases back to
// usual as the next one is dragged), then drags Story back to usual, so the loop ends on the default picks it starts
// with. Posters that stay in the top six slide to their new place; the others crossfade in place.
// Every element runs one infinite CSS animation per property (transform or opacity only), so the loop is seamless and
// `?pause=<ms>` / document.getAnimations() can freeze any frame. Data: taste.json next to this file (real rankings).
import type { CSSProperties, ReactNode } from "react"
import { FAMILY_ORDER, type FamilyId } from "~/domain/for-you-page/contract"
import {
	FAMILY_WORD,
	LEVELS,
	type Level,
	RING,
	RING_WORD,
} from "~/domain/for-you-page/shape"
import intro from "~/ui/living-room/intro/scenes/taste/taste.json"
import "~/ui/living-room/intro/scenes/taste/taste.css"
import { build } from "~/ui/profile/taste/Whorl"
import { FAMILY_COLOR } from "~/ui/profile/taste/model"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import data from "./taste.json"

// ---------- timing ----------

/** One section change every STEP ms: five sections, then back to the default. */
const STEP = 3000
export const TASTE_LOOP_MS = STEP * 6
const GLIDE = "cubic-bezier(.65,0,.35,1)"
const OUT = "cubic-bezier(.16,1,.3,1)"
const SPRING = "cubic-bezier(.3,1.3,.5,1)"
const SLIDE = "cubic-bezier(.45,0,.2,1)"

// Within a step (ms from its start): the pointer glides to the handle, presses, drags, lets go; the picks follow.
const T_GLIDE = 80
const GLIDE_MS = 650
const T_DRAG = 800
const DRAG_MS = 700
const T_DROP = T_DRAG + DRAG_MS
const T_PICKS = T_DROP + 60

// ---------- looping tracks ----------

type Move = { at: number; dur: number; to: string | number; ease?: string }

/** Collects one @keyframes per track; render its `css` once in a <style>. */
function makeLoop() {
	const css: string[] = []
	let n = 0
	const pct = (t: number) => `${((t / TASTE_LOOP_MS) * 100).toFixed(4)}%`
	/** A track that starts at v0 and runs `moves`; it must end at v0 again, so the loop has no seam. */
	const track = (prop: "transform" | "opacity" | "z-index", v0: string | number, moves: Move[]) => {
		const ms = [...moves].sort((a, b) => a.at - b.at)
		let v = v0
		const rows: string[] = [`0%{${prop}:${v0}}`]
		for (const m of ms) {
			rows.push(`${pct(m.at)}{${prop}:${v};animation-timing-function:${m.ease ?? "linear"}}`)
			rows.push(`${pct(m.at + Math.max(1, m.dur))}{${prop}:${m.to}}`)
			v = m.to
		}
		rows.push(`100%{${prop}:${v}}`)
		if (String(v) !== String(v0)) console.warn("taste loop: track does not close", prop, v0, v)
		const name = `rt-${++n}`
		css.push(`@keyframes ${name}{${rows.join("")}}`)
		return `${name} calc(${TASTE_LOOP_MS}ms * var(--k)) linear infinite`
	}
	/** Style for an element with a transform track and an opacity track. */
	const el = (
		t0: string,
		moves: Move[] = [],
		o0 = 1,
		fades: Move[] = [],
		extra: CSSProperties = {},
		layers: Move[] = [],
	): CSSProperties => {
		const anims: string[] = []
		if (moves.length) anims.push(track("transform", t0, moves))
		if (fades.length) anims.push(track("opacity", o0, fades))
		// Stacking only (no motion): which poster is on top while posters cross.
		if (layers.length) anims.push(track("z-index", 1, layers))
		return { transform: t0, opacity: o0, animation: anims.join(", ") || undefined, ...extra }
	}
	return { css, el }
}
type Loop = ReturnType<typeof makeLoop>

// ---------- the script ----------

type Drag = { f: FamilyId; from: Level; to: Level; at: number; byPointer: boolean }
const STEPS = data.steps.map((s) => ({ ...s, family: s.family as FamilyId, level: s.level as Level }))

const SCRIPT = (() => {
	const drags: Drag[] = []
	STEPS.forEach((s, i) => {
		const at = i * STEP + T_DRAG
		drags.push({ f: s.family, from: 0, to: s.level, at, byPointer: true })
		const prev = STEPS[i - 1]
		if (prev) drags.push({ f: prev.family, from: prev.level, to: 0, at, byPointer: false })
	})
	const last = STEPS[STEPS.length - 1]
	drags.push({ f: last.family, from: last.level, to: 0, at: STEPS.length * STEP + T_DRAG, byPointer: true })
	const pointer = drags.filter((d) => d.byPointer)
	const states = [
		data.states.flat,
		...STEPS.map((s) => data.states[s.state as keyof typeof data.states]),
		data.states.flat,
	]
	return { drags, pointer, states }
})()

// ---------- the print's geometry (HandlePrint's, as in the intro's kit) ----------

const BOX = 272
const VIEW = `${-BOX} ${-BOX} ${BOX * 2} ${BOX * 2}`
const u = (n: number) => `${((n / (BOX * 2)) * 100).toFixed(2)}cqw`
const ATTRS = intro.attributes.map((a) => ({ ...a, family: a.family as FamilyId }))

const GEO = (() => {
	const g = build(ATTRS, 18, true)
	const rs = g.markers.map((m) => Math.hypot(m.x / 0.86, m.y))
	const ring = rs.reduce((s, r) => s + r, 0) / (rs.length || 1) + 8
	const anchors = {} as Record<FamilyId, { x: number; y: number }>
	for (const f of FAMILY_ORDER) {
		const ms = g.markers.filter((m) => m.a.family === f)
		const th = Math.atan2(
			ms.reduce((s, m) => s + m.y, 0),
			ms.reduce((s, m) => s + m.x / 0.86, 0),
		)
		anchors[f] = {
			x: Math.round(0.86 * ring * Math.cos(th) * 10) / 10,
			y: Math.round(ring * Math.sin(th) * 10) / 10,
		}
	}
	const paths = Object.fromEntries(
		FAMILY_ORDER.map((f) => [
			f,
			g.turns.flatMap((t) => t.paths.filter((p) => p.family === f)).map((p) => ({ d: p.d, o: p.opacity })),
		]),
	) as Record<FamilyId, { d: string; o: number }[]>
	return { g, ring, anchors, paths }
})()

const handleAt = (f: FamilyId, l: Level, dx = 0, dy = 0) => {
	const a = GEO.anchors[f]
	const s = RING[l]
	return `translate(calc(${u(a.x * s)} + ${dx}cqw), calc(${u(a.y * s)} + ${dy}cqw))`
}
const scaleOf = (l: Level) => `scale(${RING[l]})`

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
			{l !== 0 && <span style={{ marginLeft: "1cqw" }}>{l === -1 ? "−" : l === 1 ? "+" : "++"}</span>}
		</span>
	)
}

// While a section is dragged, the sections nobody touches dim (the page's data-drag rule) and the rings show.
const touched = (f: FamilyId, stepAt: number) =>
	SCRIPT.drags.some((d) => d.f === f && d.at === stepAt)
const dragStarts = [...new Set(SCRIPT.drags.map((d) => d.at))]
const dimFades = (f: FamilyId, to: number): Move[] =>
	dragStarts.flatMap((at) =>
		touched(f, at)
			? []
			: [
					{ at: at - 160, dur: 220, to },
					{ at: at + DRAG_MS + 80, dur: 320, to: 1 },
				],
	)

function Print({ loop, style }: { loop: Loop; style: CSSProperties }) {
	const { el } = loop
	const showFades = (at: number): Move[] => [
		{ at: at - 180, dur: 220, to: 1 },
		{ at: at + DRAG_MS + 80, dur: 320, to: 0 },
	]
	// The pointer's path: to each handle, drag it, then ease off the knob a little.
	// The pointer's resting place after a drag: just below the knob, or right of it for Feel (Humor sits below Feel).
	const off = (f: FamilyId, l: Level) => (f === "feel" ? handleAt(f, l, 12, -3) : handleAt(f, l, 0.6, 7.5))
	const last = SCRIPT.pointer[SCRIPT.pointer.length - 1]
	const cursorMoves: Move[] = SCRIPT.pointer.flatMap((d) => [
		{ at: d.at - T_DRAG + T_GLIDE, dur: GLIDE_MS, to: handleAt(d.f, d.from, 0.6, 0.6), ease: GLIDE },
		{ at: d.at, dur: DRAG_MS, to: handleAt(d.f, d.to, 0.6, 0.6), ease: GLIDE },
		{ at: d.at + DRAG_MS + 120, dur: 700, to: off(d.f, d.to), ease: OUT },
	])
	return (
		<div className="intro-taste-print" style={style}>
			{/* The rings: less / usual / more / lots more, shown while dragging. */}
			<div className="intro-taste-fill" style={el("none", [], 0, SCRIPT.pointer.flatMap((d) => showFades(d.at)))}>
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
			{/* The four stops on the dragged section's ray. */}
			{SCRIPT.pointer.map((d) => (
				<div key={d.at} className="intro-taste-fill" style={el("none", [], 0, showFades(d.at))}>
					<svg viewBox={VIEW} aria-hidden="true">
						{LEVELS.map((l) => (
							<circle
								key={l}
								cx={GEO.anchors[d.f].x * RING[l]}
								cy={GEO.anchors[d.f].y * RING[l]}
								r={6}
								fill="#030712"
								stroke={FAMILY_COLOR[d.f]}
								strokeWidth={2.5}
							/>
						))}
					</svg>
				</div>
			))}
			{/* The print, one layer per section; a stretch is the layer's scale. */}
			{FAMILY_ORDER.map((f) => {
				const ds = SCRIPT.drags.filter((d) => d.f === f)
				return (
					<div key={f} className="intro-taste-fam" style={el("none", [], 1, dimFades(f, 0.4))}>
						<div
							className="intro-taste-fill"
							style={el(
								scaleOf(0),
								ds.map((d) => ({ at: d.at, dur: DRAG_MS, to: scaleOf(d.to), ease: GLIDE })),
							)}
						>
							<svg viewBox={VIEW} aria-hidden="true">
								{GEO.paths[f].map((p, j) => (
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
								{GEO.g.markers
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
						</div>
					</div>
				)
			})}
			{/* The handles: one knob per level the section visits, swapped when a drag lets go. */}
			{FAMILY_ORDER.map((f) => {
				const ds = SCRIPT.drags.filter((d) => d.f === f)
				const levels = [...new Set<Level>([0, ...ds.map((d) => d.to)])]
				return (
					<div
						key={f}
						className="intro-taste-at"
						style={el(
							handleAt(f, 0),
							ds.map((d) => ({ at: d.at, dur: DRAG_MS, to: handleAt(f, d.to), ease: GLIDE })),
							1,
							dimFades(f, 0.35),
						)}
					>
						<div className="intro-taste-handle">
							<div style={{ position: "relative" }}>
								{levels.map((l, j) => {
									const swaps = ds.filter((d) => d.to === l || d.from === l)
									const fades: Move[] = swaps.map((d) =>
										d.to === l
											? { at: d.at + DRAG_MS - 20, dur: 160, to: 1 }
											: { at: d.at + DRAG_MS - 20, dur: 120, to: 0 },
									)
									const pops: Move[] = ds
										.filter((d) => d.to === l)
										.flatMap((d) => [
											{ at: d.at + DRAG_MS - 40, dur: 1, to: "scale(.82)" },
											{ at: d.at + DRAG_MS - 20, dur: 420, to: "none", ease: SPRING },
										])
									return (
										<div
											key={l}
											className={j ? "intro-taste-knob-on" : undefined}
											style={el("none", pops, l === 0 ? 1 : 0, fades)}
										>
											<Knob f={f} l={l} />
										</div>
									)
								})}
							</div>
						</div>
					</div>
				)
			})}
			{/* The live pill: "Craft: lots more" while dragging. */}
			{SCRIPT.pointer.map((d) => (
				<div
					key={d.at}
					className="intro-taste-livepill"
					style={el("translateX(-50%)", [], 0, [
						{ at: d.at + DRAG_MS * 0.4, dur: 180, to: 1 },
						{ at: d.at + DRAG_MS + 520, dur: 260, to: 0 },
					])}
				>
					{FAMILY_WORD[d.f]}: {RING_WORD[d.to]}
				</div>
			))}
			{/* The pointer. It rests off the last knob and glides from there, so the loop closes. Its tip is the corner. */}
			<div className="intro-taste-at" style={el(off(last.f, last.to), cursorMoves, 1, [], { zIndex: 5 })}>
				<div
					style={el(
						"none",
						SCRIPT.pointer.flatMap((d) => [
							{ at: d.at - 110, dur: 100, to: "scale(.84)", ease: "ease-out" },
							{ at: d.at + DRAG_MS, dur: 180, to: "none", ease: "ease-out" },
						]),
						1,
						[],
						{ transformOrigin: "0 0" },
					)}
				>
					<Cursor />
				</div>
			</div>
		</div>
	)
}

// ---------- the picks ----------

// The stage is 1440 x 770; places in px, turned into cqw / cqh.
const PX_W = 1440
const PX_H = 770
const POSTER = { w: 170, gap: 29, left: 800 }
const POSTER_H = POSTER.w * 1.5
const GRID_TOP = (PX_H - 2 * POSTER_H - POSTER.gap) / 2
const W_CQW = (POSTER.w / PX_W) * 100
const place = (slot: number, s = 1) => {
	const x = POSTER.left + (slot % 3) * (POSTER.w + POSTER.gap)
	const y = GRID_TOP + Math.floor(slot / 3) * (POSTER_H + POSTER.gap)
	return `translate(${((x / PX_W) * 100).toFixed(3)}cqw, ${((y / PX_H) * 100).toFixed(3)}cqh) scale(${s})`
}
const titles = data.titles as Record<string, { title: string; year: number; poster: string }>

function Picks({ loop }: { loop: Loop }) {
	const { states } = SCRIPT
	const keys = [...new Set(states.flat())]
	const nodes: ReactNode[] = []
	for (const key of keys) {
		const idx = states.map((s) => s.indexOf(key))
		const moves: Move[] = []
		const fades: Move[] = []
		const layers: Move[] = []
		let z = 1
		const layer = (at: number, to: number) => {
			if (to !== z) layers.push({ at, dur: 1, to })
			z = to
		}
		let pos = idx[0] >= 0 ? place(idx[0]) : ""
		for (let c = 0; c + 1 < states.length; c++) {
			const T = c * STEP + T_PICKS
			const a = idx[c]
			const b = idx[c + 1]
			if (a >= 0 && b >= 0 && a !== b) {
				// Stays in the top six: slides to its new place.
				pos = place(b)
				layer(T - 5, 3)
				moves.push({ at: T + b * 45, dur: 800, to: pos, ease: SLIDE })
			} else if (a >= 0 && b < 0) {
				// Leaves: fades out in place, settling back a touch.
				layer(T - 5, 1)
				pos = place(a, 0.97)
				moves.push({ at: T + a * 45, dur: 600, to: pos, ease: "ease-in" })
				fades.push({ at: T + a * 45, dur: 520, to: 0, ease: "ease-in" })
			} else if (a < 0 && b >= 0) {
				// Arrives: crossfades in over the one leaving its place.
				const start = T + b * 45
				layer(T - 5, 2)
				moves.push({ at: start - 2, dur: 1, to: place(b, 1.03) })
				pos = place(b)
				moves.push({ at: start, dur: 700, to: pos, ease: OUT })
				fades.push({ at: start, dur: 420, to: 1, ease: "ease-out" })
			}
		}
		// A title missing from the default picks starts where its last exit left it (it is invisible until it arrives).
		const t0 = idx[0] >= 0 ? place(idx[0]) : pos
		layer(TASTE_LOOP_MS - 1, 1)
		const t = titles[key]
		nodes.push(
			<div
				key={key}
				className="intro-taste-poster"
				style={loop.el(t0, moves, idx[0] >= 0 ? 1 : 0, fades, {
					width: `${W_CQW.toFixed(3)}cqw`,
					height: `${(W_CQW * 1.5).toFixed(3)}cqw`,
				}, layers)}
			>
				<img src={tmdbImageUrl(t.poster, "w342")} alt={t.title} decoding="async" />
			</div>,
		)
	}
	return <>{nodes}</>
}

// ---------- the scene ----------

const PRINT_PX = 632
const PRINT_LEFT = 100

export function TasteLoop() {
	const loop = makeLoop()
	// Called as functions, not elements, so their tracks are collected before the <style> below is written.
	const print = Print({
		loop,
		style: {
				left: `${((PRINT_LEFT / PX_W) * 100).toFixed(3)}cqw`,
				top: `${(((PX_H - PRINT_PX) / 2 / PX_H) * 100).toFixed(3)}cqh`,
				width: `${((PRINT_PX / PX_H) * 100).toFixed(3)}cqh`,
			height: `${((PRINT_PX / PX_H) * 100).toFixed(3)}cqh`,
		},
	})
	const picks = Picks({ loop })
	return (
		<div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
			{print}
			{picks}
			<style>{loop.css.join("\n")}</style>
		</div>
	)
}
