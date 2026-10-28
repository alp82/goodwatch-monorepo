// PROTOTYPE (start page lab, round 6): what stage j and k share: h's shell (shadow pool, lifted field, night above the
// room) with Discover chips, the flow with an empty state before any choice (and a dice for a random mood), a minimum
// gap above the module, and the room's slots kept empty wherever the search block, the chips or the module sit.
// Round 7: a much larger gap between the mood row and the module, and the scene placed from the measured gap so the
// scene's focus (the dog and its seat) always sits in it, below the chips and above the module.
// Round 11: the room is graded to the mood on show (jk-grade), and the empty state is a fan of posters (jk-module).
// Round 12: the lab's "Search bar" (`?searchbar=`, sections/searchbar) swaps the field and presets for a bar with a
// button; "Mood lighting" (`?light=`) gets the scene's placement here for its effects (sections/light).
// Round 13: half the gap (only the dog band must fit), capped at 300 px on large screens, zooming out past that.
// Round 15: the H1 says "by mood" only; stages l and m pass their own picker in place of the chips (jl-picker).
import { type CSSProperties, type ReactNode, type RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { ScenePlace } from "../../scene/SceneStage"
import { sceneImage, type SceneMeta, type ScenePair } from "../../scene/types"
import type { LightGeo } from "../light/effects"
import { JK_REVEAL, SEARCH_BARS, useSearchbarKey } from "../searchbar/bars"
import { type Rect, useLab } from "../../lab/types"
import { type StageFlow, useStageFlow } from "./ab-shared"
import { EfgField, NIGHT } from "./efg-shared"
import { vocabOf } from "./hi-vocab"
import { JkMoodRow, JkMorePopover, JkPresets } from "./jk-chips"
import { JkGrade } from "./jk-grade"

const POOL = [
	"radial-gradient(ellipse 34% 30% at 50% 42%, rgb(2 4 10 / .55), rgb(2 4 10 / 0) 100%)",
	"radial-gradient(ellipse 50% 46% at 50% 45%, rgb(2 4 10 / .82) 0%, rgb(2 4 10 / .66) 40%, rgb(2 4 10 / .34) 68%, rgb(2 4 10 / .1) 88%, rgb(2 4 10 / 0) 100%)",
].join(", ")

const FIELD_SHADOW =
	"0 1px 0 rgb(255 255 255 / .06) inset, 0 2px 4px rgb(0 0 0 / .45), 0 10px 22px rgb(0 0 0 / .45), 0 28px 56px rgb(0 0 0 / .55), 0 60px 120px rgb(0 0 0 / .55)"

// h's toggle-card and field rules (hi-shared keeps its copy private), then j and k's own sizes.
const CSS = `@keyframes ab-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.ab-in{animation:ab-in .35s cubic-bezier(.2,.8,.2,1) both}
.efg-glow{opacity:0;transition:opacity .25s ease-out}
.efg-field:focus-within .efg-glow{opacity:1}
.hi-lift{position:relative;transition:transform .25s cubic-bezier(.2,.8,.2,1),opacity .2s ease-out}
@media (hover:hover){.hi-tog:not(.hi-off):hover .hi-lift{transform:translateY(-3px)}}
.hi-tog:not(.hi-off):active .hi-lift{transform:scale(.96)}
.hi-on .hi-lift,.hi-on:hover .hi-lift{transform:translateY(-6px)}
.hi-off .hi-lift{opacity:.4}
.hi-ring{position:absolute;inset:-4px;border-radius:12px;border:3px solid #fbbf24;box-shadow:0 0 18px rgb(251 191 36/.5);opacity:0;transform:scale(1.06);transition:opacity .18s ease-out,transform .25s cubic-bezier(.2,1.4,.4,1);pointer-events:none;z-index:32}
.hi-on .hi-ring{opacity:1;transform:none}
.hi-badge{position:absolute;right:-7px;top:-7px;z-index:33;display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;background:#fbbf24;color:#111827;box-shadow:0 3px 10px rgb(0 0 0/.5);opacity:0;transform:scale(.4);transition:opacity .15s ease-out,transform .3s cubic-bezier(.2,1.5,.4,1);pointer-events:none}
.hi-on .hi-badge{opacity:1;transform:none}
.hi-tap{position:absolute;inset:0;z-index:30;border-radius:8px;cursor:pointer;outline:none}
.hi-tap:focus-visible{box-shadow:0 0 0 2px #fbbf24}
.hi-info{transition:opacity .15s ease-out}
@media (hover:hover){.hi-info{opacity:0}.hi-tog:hover .hi-info,.hi-info:focus-visible{opacity:1}}
.jk-layer{position:absolute;inset:0;transition:opacity .3s ease-out,transform .3s ease-out}
@keyframes jk-drop{from{opacity:0;transform:translateY(-40%) scale(1.3)}}
.jk-drop{animation:jk-drop .4s cubic-bezier(.2,1.3,.4,1) both}
/* Once one title is loved, the others dim a little (still tappable); at three they dim further and lock. */
.jk-dim .hi-lift{opacity:.55}
@media (hover:hover){.jk-dim:hover .hi-lift{opacity:.9}}
.jk-dim:focus-within .hi-lift{opacity:.9}
/* Round 11 empty state: the fan posters, each placed from its own size (translate %), then tilted. */
.jk-fan{position:absolute;left:50%;top:0;transform:translate(calc(-50% + var(--fx)),var(--fy)) rotate(var(--fr));transform-origin:50% 100%}
@keyframes jk-fan-in{from{opacity:0}}
.jk-fan-in{animation:jk-fan-in .7s ease-out both}
@keyframes jk-roll{0%{transform:rotate(0) scale(1)}40%{transform:rotate(200deg) scale(.82)}100%{transform:rotate(360deg) scale(1)}}
.jk-roll{animation:jk-roll .5s cubic-bezier(.3,.7,.3,1)}
@keyframes jk-fade{from{opacity:0}}
.jk-fade{animation:jk-fade .45s ease-out both}
/* For you: the sizes of the featured title and the small posters beside it. */
.jk-also{width:44px}.jk-fy-t{font-size:18px;line-height:24px}
@media (min-width:640px){.jk-also{width:84px}.jk-fy-t{font-size:22px;line-height:28px}}
@media (min-width:1024px){.jk-also{width:110px}.jk-fy-t{font-size:28px;line-height:34px}}
@media (min-width:1024px) and (max-height:820px){.jk-also{width:98px}.jk-fy-t{font-size:24px;line-height:30px}}
@media (prefers-reduced-motion:reduce){.jk-drop,.ab-in,.jk-fan-in,.jk-roll,.jk-fade{animation:none}}
.jk-top{padding-top:12px}
@media (min-width:640px){.jk-top{padding-top:44px}}
@media (min-width:1024px){.jk-top{padding-top:clamp(20px,3vh,48px)}}
@media (min-width:1024px) and (max-height:820px){.jk-top{padding-top:20px}.jk-h1{font-size:40px!important}.jk-field-gap{margin-top:18px!important}.jk-gap{margin-top:12px!important}}`

export type JkView = "empty" | "loading" | "results" | "foryou"

/** The stage flow plus the empty state: nothing is shown until the guest picks a mood, a prompt, rolls the dice or searches. */
export function useJkFlow(key: string) {
	const f = useStageFlow(key)
	const showForYou = f.done && f.picks.length > 0
	const view: JkView = showForYou ? "foryou" : f.loading ? "loading" : f.source.kind === "popular" ? "empty" : "results"
	/** The module's title: the selection step until three are loved, then the recommendations. */
	const heading = view === "foryou" ? "For you" : "Tap three you loved"
	/** What's on show in the selection step: a mood or vocabulary choice (with its color), or the search. */
	const shown = ((): { text: string; dot?: string } | null => {
		if (f.source.kind === "popular") return null
		// Round 15: stage l/m's picks by name, with the first word's color.
		if (f.source.kind === "mix") return { text: f.source.name, dot: vocabOf(f.source)?.color }
		const v = vocabOf(f.source)
		if (v) return { text: v.label, dot: v.color }
		return { text: f.label }
	})()
	const surprise = useCallback(() => {
		const moods = f.data.guest.moods
		const now = f.source.kind === "mood" ? f.source.key : null
		const pool = moods.filter((m) => m.key !== now)
		const m = pool[Math.floor(Math.random() * pool.length)]
		if (m) f.mood(m.key)
	}, [f])
	return { ...f, view, heading, shown, surprise }
}

export type JkFlow = ReturnType<typeof useJkFlow>

/** Registers an element whose on-screen box the room's slots must stay out of. */
export type Reg = (id: string) => (el: HTMLElement | null) => void

const overlaps = (a: Rect, b: Rect, pad: number) =>
	a.left < b.left + b.width + pad && b.left - pad < a.left + a.width && a.top < b.top + b.height + pad && b.top - pad < a.top + a.height

/** The boxes of the registered elements, in the room box's px, kept fresh on resize. */
function useObstacles() {
	const roomBox = useRef<HTMLDivElement>(null)
	const els = useRef(new Map<string, HTMLElement>())
	const refs = useRef(new Map<string, (el: HTMLElement | null) => void>())
	const [rects, setRects] = useState<Rect[]>([])
	const measure = useCallback(() => {
		const box = roomBox.current?.getBoundingClientRect()
		if (!box) return
		const next: Rect[] = []
		for (const el of els.current.values()) {
			const r = el.getBoundingClientRect()
			if (!r.width || !r.height) continue
			// Clipped to the viewport's width: a scrolling row is only in the way where it shows.
			const left = Math.max(r.left, 0)
			const right = Math.min(r.right, window.innerWidth)
			next.push({ left: Math.round(left - box.left), top: Math.round(r.top - box.top), width: Math.round(right - left), height: Math.round(r.height) })
		}
		setRects((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
	}, [])
	const reg: Reg = useCallback(
		(id) => {
			let cb = refs.current.get(id)
			if (!cb) {
				cb = (el) => {
					if (el) els.current.set(id, el)
					else els.current.delete(id)
				}
				refs.current.set(id, cb)
			}
			return cb
		},
		[],
	)
	useEffect(() => {
		measure()
		const ro = new ResizeObserver(() => measure())
		if (roomBox.current) ro.observe(roomBox.current)
		for (const el of els.current.values()) ro.observe(el)
		const t = setTimeout(measure, 400)
		window.addEventListener("resize", measure)
		return () => {
			ro.disconnect()
			clearTimeout(t)
			window.removeEventListener("resize", measure)
		}
	}, [measure])
	const hideSlot = useCallback((r: Rect) => rects.some((o) => overlaps(r, o, 8)), [rects])
	return { roomBox, reg, hideSlot }
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

/** The phone version of a scene takes over when the viewport is taller than this (as SceneStage's 0.8). */
const PORTRAIT_MQ = "(max-aspect-ratio: 4/5)"

/**
 * The gap between the mood row and the module, per breakpoint: at least `min`, and always tall enough for the scene's
 * dog band (DOG_BAND of the focus, from its top) at full width plus `above` (air under the chips) and `below` (air
 * over the module). Round 13: half of round 7's minimum and air (the owner: "reduce the min gap to half"), so the
 * seat's lower half runs under the module; from 1024 px the gap never needs more than GAP_CAP (the room zooms out
 * to keep the dog in it instead of filling the screen), and on `card` stages it never grows past GAP_CAP either.
 */
const GAP = [
	{ from: 0, min: 64, above: 8, below: 6 },
	{ from: 640, min: 80, above: 10, below: 7 },
	{ from: 1024, min: 100, above: 12, below: 8 },
] as const

/** The part of the focus box (from its top) the gap must show: the cushions and the dog, not the seat's base. */
const DOG_BAND = 0.5

/** The gap's ceiling on large screens and on card stages (px). */
const GAP_CAP = 300

const gapAt = (vw: number) => [...GAP].reverse().find((g) => vw >= g.from) ?? GAP[0]

/** The box (x, y, w, h) to keep in the gap: the scene's focus, or the band between the calm top and the rug. */
const focusOf = (meta: SceneMeta): [number, number, number, number] => meta.focus ?? [0, 0.45, 1, 0.2]

/** The gap's minimum height as CSS: the dog band's height at full width (the scene is never narrower than the stage). */
function gapCss(pair: ScenePair) {
	const rule = (meta: SceneMeta, g: (typeof GAP)[number]) => {
		const need = `max(${g.min}px,calc(${(DOG_BAND * focusOf(meta)[3] * meta.height) / meta.width} * 100cqw + ${g.above + g.below}px))`
		return `.jk-gapbox{min-height:${g.from >= 1024 ? `min(${GAP_CAP}px,${need})` : need}}`
	}
	const at = (g: (typeof GAP)[number], extra = "") => {
		const q = [g.from ? `(min-width:${g.from}px)` : "", extra].filter(Boolean).join(" and ")
		return q ? `@media ${q}` : ""
	}
	const out: string[] = [`.jk-gapcap{max-height:${GAP_CAP}px}`]
	for (const g of GAP) {
		const m = at(g)
		out.push(m ? `${m}{${rule(pair.landscape, g)}}` : rule(pair.landscape, g))
	}
	if (pair.portrait) for (const g of GAP) out.push(`${at(g, PORTRAIT_MQ)}{${rule(pair.portrait, g)}}`)
	return out.join("\n")
}

/** Where the mood row ends and the module starts, in the stage's px. */
type GapBox = { top: number; bottom: number; vw: number; vh: number; roomTop: number }

/**
 * The scene's scale and offset for the gap: full width, its dog band centered in the gap below the chips' air (zoomed
 * out, never in, when the gap can't hold it: past GAP_CAP on very wide screens), plus where the night above, below
 * and (zoomed out) beside it fades.
 */
function placeFor(meta: SceneMeta, w: number, g: GapBox) {
	const [fx, fy, fw, fh0] = focusOf(meta)
	const fh = fh0 * DOG_BAND
	const air = gapAt(g.vw)
	const room = Math.max(40, g.bottom - g.top - air.above - air.below)
	// Within 1.5% of full width (the CSS minimum's rounding), stay full width and let the focus use a few px of air.
	const fit = room / (fh * meta.height)
	const scale = fit * meta.width >= w * 0.985 ? w / meta.width : fit
	const sw = meta.width * scale
	const sh = meta.height * scale
	const focusH = fh * sh
	const focusTop = g.top + air.above + (room - focusH) / 2
	const dy = focusTop - fy * sh
	// Full width: no horizontal crop. Zoomed out: the focus as close to the middle as the image's edges allow.
	const dx = sw >= w ? 0 : Math.min(w - sw, Math.max(0, w / 2 - (fx + fw / 2) * sw))
	const bottom = dy + sh
	// The night: solid down to the calm top's start, then a fade that ends before the focus.
	const n1 = Math.max(dy, Math.min(g.roomTop + 0.18 * g.vh, focusTop - 8))
	const n0 = Math.max(dy, Math.min(g.roomTop, n1 - 60))
	// The image's lower edge fades into the night when the stage runs past it (the rug under the module).
	const b1 = bottom
	const b0 = Math.max(focusTop + focusH + 4, bottom - 160)
	// Zoomed out, the image is narrower than the stage: its left and right edges fade into the night.
	const side = sw < w - 1
	const e = Math.min(160, sw * 0.12)
	return { scale, dx, dy, n0, n1, b0, b1, x0: side ? dx : -1, x1: side ? dx + e : -1, x2: side ? dx + sw - e : w + 1, x3: side ? dx + sw : w + 1 }
}

/** Measures the gap (the mood row's bottom, the spacer's bottom) and gives the room's placement and the scene to use. */
function useGapPlacement(pair: ScenePair) {
	const section = useRef<HTMLElement>(null)
	const spacer = useRef<HTMLDivElement>(null)
	const [box, setBox] = useState<GapBox | null>(null)
	const [portrait, setPortrait] = useState(false)
	useIsoLayoutEffect(() => {
		const sec = section.current
		const sp = spacer.current
		if (!sec || !sp) return
		const measure = () => {
			const s = sec.getBoundingClientRect()
			const moods = sec.querySelector("[data-jk-moods]")?.getBoundingClientRect()
			const sr = sp.getBoundingClientRect()
			const next: GapBox = {
				top: Math.round((moods?.bottom ?? sr.top) - s.top),
				bottom: Math.round(sr.bottom - s.top),
				vw: window.innerWidth,
				vh: window.innerHeight,
				roomTop: Number.parseFloat(getComputedStyle(sec).getPropertyValue("--room-top")) || 0,
			}
			setBox((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
			setPortrait(window.matchMedia(PORTRAIT_MQ).matches)
		}
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(sec)
		ro.observe(sp)
		const moods = sec.querySelector("[data-jk-moods]")
		if (moods) ro.observe(moods)
		window.addEventListener("resize", measure)
		return () => {
			ro.disconnect()
			window.removeEventListener("resize", measure)
		}
	}, [])
	const meta = portrait && pair.portrait ? pair.portrait : pair.landscape
	// The room gets the chosen version only, so it can't pick the other one by its own box's proportions.
	const scene = useMemo<ScenePair>(() => ({ ...pair, landscape: meta, portrait: null }), [pair, meta])
	const place = useCallback<ScenePlace>((size, m) => (box ? placeFor(m, size.w, box) : null), [box])
	const vars = useMemo(() => {
		const w = section.current?.clientWidth
		if (!box || !w) return undefined
		const p = placeFor(meta, w, box)
		const px = (v: number) => `${Math.round(v)}px`
		return {
			"--jk-n0": px(p.n0),
			"--jk-n1": px(p.n1),
			"--jk-b0": px(p.b0),
			"--jk-b1": px(p.b1),
			"--jk-x0": px(p.x0),
			"--jk-x1": px(p.x1),
			"--jk-x2": px(p.x2),
			"--jk-x3": px(p.x3),
		} as CSSProperties
	}, [box, meta])
	// Round 12: where the image sits, and the band the letterbox leaves open (around the focus, inside the gap).
	const geo = useMemo<LightGeo | null>(() => {
		const sec = section.current
		if (!box || !sec) return null
		const w = sec.clientWidth
		const p = placeFor(meta, w, box)
		const sw = meta.width * p.scale
		const sh = meta.height * p.scale
		const [, fy, , fh] = focusOf(meta)
		const f0 = p.dy + fy * sh
		const f1 = f0 + fh * sh
		// The bars crop to the focus: a little air above it, and the lower fifth of it (the seat's base, under the dog).
		return {
			src: sceneImage(meta.id, "webp"),
			img: { left: Math.round(p.dx), top: Math.round(p.dy), width: Math.round(sw), height: Math.round(sh) },
			slots: meta.slots.map((sl) => sl.quad as [number, number][]),
			w,
			h: sec.clientHeight,
			band: {
				top: Math.round(Math.max(box.top + 2, f0 - 0.08 * (f1 - f0))),
				bottom: Math.round(Math.min(box.bottom - 2, f0 + 0.8 * (f1 - f0))),
			},
			focus: focusOf(meta),
		}
	}, [box, meta])
	const css = useMemo(() => gapCss(pair), [pair])
	return { section, spacer, scene, place, vars, css, geo }
}

/**
 * The stage: the room under the night, the search block on top, and the results module given by the variant.
 * `card` keeps the module in the page's column above the lab bar's space; `band` lets it run the full width to the
 * bottom edge (the module keeps the lab bar's space itself). `over` draws over the room, under the content.
 */
export function JkStage({
	k,
	placement,
	over,
	module,
	picker,
}: {
	k: string
	placement: "card" | "band"
	over?: (f: JkFlow) => ReactNode
	module: (f: JkFlow, reg: Reg) => ReactNode
	/** Round 15: replaces the mood chips and More moods (stage l/m). It must mark its row `data-jk-moods` for the gap. */
	picker?: (f: JkFlow, reg: Reg) => ReactNode
}) {
	const { Room, scene: labScene } = useLab()
	const f = useJkFlow(k)
	const { roomBox, reg, hideSlot } = useObstacles()
	const gap = useGapPlacement(labScene)
	const [more, setMore] = useState(false)
	const close = useCallback(() => setMore(false), [])
	return (
		<section
			ref={gap.section}
			aria-label="Find something to watch"
			className="relative isolate overflow-hidden [container-type:inline-size] [--room-top:110px] sm:[--room-top:140px] lg:[--room-top:200px]"
			style={{ background: NIGHT, ...gap.vars }}
		>
			<style>{CSS}</style>
			<style>{gap.css}</style>
			{/* The room spans the stage; its image is placed from the measured gap (useGapPlacement). */}
			<div ref={roomBox} className="absolute inset-0">
				<Room noTv scene={gap.scene} place={gap.place} hideSlot={hideSlot} style={{ position: "absolute", inset: 0 }} />
			</div>
			{/* Round 11: the room takes on the mood of what's on show (jk-grade). */}
			<JkGrade f={f} geo={gap.geo} />
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0"
				style={{
					background: `linear-gradient(to bottom, ${NIGHT} 0, ${NIGHT} var(--jk-n0, var(--room-top)), rgb(5 10 22 / 0) var(--jk-n1, calc(var(--room-top) + 18vh))), linear-gradient(to bottom, rgb(5 10 22 / 0) var(--jk-b0, 200%), ${NIGHT} var(--jk-b1, 200%)), linear-gradient(to right, ${NIGHT} var(--jk-x0, -1px), rgb(5 10 22 / 0) var(--jk-x1, -1px), rgb(5 10 22 / 0) var(--jk-x2, 200%), ${NIGHT} var(--jk-x3, 200%)), linear-gradient(to bottom, rgb(3 7 18 / 0) 60%, rgb(3 7 18 / .4) 80%, rgb(3 7 18 / .9) 100%)`,
				}}
			/>
			{over?.(f)}
			<div className="pointer-events-none relative z-10 flex min-h-[calc(100svh-4rem)] w-full flex-col">
				<div className="mx-auto w-full max-w-[1360px] px-4 sm:px-6">
					<JkTop
						f={f}
						reg={reg}
						onMore={() => setMore((o) => !o)}
						moreOpen={more}
						moreSlot={<JkMorePopover f={f} open={more} onClose={close} />}
						picker={picker ? picker(f, reg) : undefined}
					/>
				</div>
				{/* Round 7: a window between the mood row and the module, tall enough for the scene's dog (gapCss), even if
				    the module then starts below the fold. Round 13: half as tall, and on card stages it grows to GAP_CAP at
				    most; the rest of a tall screen goes under the card. */}
				<div ref={gap.spacer} className={`jk-gapbox flex-1 ${placement === "card" ? "jk-gapcap" : ""}`} />
				{placement === "card" ? (
					<>
						<div className="mx-auto w-full max-w-[1360px] px-4 pb-16 sm:px-6 sm:pb-[72px]">{module(f, reg)}</div>
						<div aria-hidden className="[flex:0.001_1_0px]" />
					</>
				) : (
					module(f, reg)
				)}
			</div>
		</section>
	)
}

/** H1, the lifted field, the example searches and the mood row, each registered so no room poster sits behind it. */
function JkTop({
	f,
	reg,
	onMore,
	moreOpen,
	moreSlot,
	picker,
}: { f: StageFlow; reg: Reg; onMore: () => void; moreOpen: boolean; moreSlot: ReactNode; picker?: ReactNode }) {
	// Round 12: b, c, d are bars with a button and the presets inside; "a" is round 11's field and presets row.
	const Bar = SEARCH_BARS[useSearchbarKey()]
	return (
		// Round 15: z-40 (was 20), so a picker panel that runs over the module stays above the module's own layers.
		<div className="jk-top relative isolate z-40">
			<div
				aria-hidden
				className="pointer-events-none absolute left-1/2 -top-24 -z-10 h-[calc(100%+260px)] w-[230%] -translate-x-1/2 sm:w-[min(1700px,170%)]"
				style={{ background: POOL }}
			/>
			<h1
				ref={reg("h1")}
				className="jk-h1 pointer-events-auto mx-auto w-fit text-center text-[26px] font-extrabold leading-8 tracking-tight text-white [text-shadow:0_2px_4px_rgb(0_0_0/.6),0_8px_40px_rgb(0_0_0/.85)] sm:text-5xl sm:leading-[1.1] lg:text-[52px]"
			>
				Find something to watch by mood
			</h1>
			{Bar ? (
				<div ref={reg("field")} className="jk-field-gap mx-auto mt-4 max-w-[880px] sm:mt-8">
					<Bar f={f} />
				</div>
			) : (
				<>
					<div ref={reg("field")} className="jk-field-gap mx-auto mt-4 max-w-[880px] sm:mt-8">
						<EfgField
							f={f}
							body="h-[62px] rounded-2xl bg-gray-900 ring-1 ring-white/12 sm:h-[84px] sm:rounded-[22px] lg:h-[88px]"
							decor={<span aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl sm:rounded-[22px]" style={{ boxShadow: FIELD_SHADOW }} />}
							glow="rounded-2xl ring-2 ring-amber-400/80 shadow-[0_0_0_6px_rgb(251_191_36/.12),0_0_70px_10px_rgb(251_191_36/.28)] sm:rounded-[22px]"
						/>
					</div>
					<div ref={reg("presets")} className="jk-gap mx-auto mt-3 w-fit max-w-full sm:mt-5">
						<JkPresets f={f} />
					</div>
				</>
			)}
			{picker ? (
				<div className="jk-gap relative mt-2.5 sm:mt-4">{picker}</div>
			) : (
				<div className="jk-gap relative mt-2.5 sm:mt-4">
					<div ref={reg("moods")} data-jk-moods="" className="mx-auto w-fit max-w-full">
						<JkMoodRow f={f} onMore={onMore} moreOpen={moreOpen} />
					</div>
					{moreSlot}
				</div>
			)}
		</div>
	)
}

/**
 * When the guest asks for something and the module sits below the fold, bring it into view. Never on first paint or
 * a restore: only on a change after the guest acted.
 */
export function useJkBringIntoView(f: JkFlow) {
	const box = useRef<HTMLDivElement>(null)
	const sig = `${f.view}:${f.source.kind}:${"q" in f.source ? f.source.q : "key" in f.source ? f.source.key : "ids" in f.source ? f.source.ids.join() : ""}`
	const prev = useRef<string | null>(null)
	const acted = useRef(false)
	useEffect(() => {
		const on = () => {
			acted.current = true
		}
		window.addEventListener("pointerdown", on, true)
		window.addEventListener("keydown", on, true)
		return () => {
			window.removeEventListener("pointerdown", on, true)
			window.removeEventListener("keydown", on, true)
		}
	}, [])
	useEffect(() => {
		const was = prev.current
		prev.current = sig
		if (was === null || was === sig || !acted.current) return
		// Round 12: a search that fires while the guest is still typing in the bar doesn't scroll the field away;
		// Enter or the button (which blur the field) does, and sends JK_REVEAL when the text was already searched.
		if (document.activeElement?.matches("[data-jk-bar-input]")) return
		// Round 15: picks made in stage l/m's open picker panel wait for Done (which sends JK_REVEAL).
		if (document.querySelector("[data-jk-picker-open]")) return
		reveal(box.current)
	}, [sig])
	useEffect(() => {
		const on = () => reveal(box.current)
		window.addEventListener(JK_REVEAL, on)
		return () => window.removeEventListener(JK_REVEAL, on)
	}, [])
	return box
}

/** Scrolls the module into view when it ends below the fold (above the lab bar). */
function reveal(el: HTMLElement | null) {
	if (!el) return
	const r = el.getBoundingClientRect()
	const room = window.innerHeight - 64 // the lab bar
	if (r.bottom > room + 2) window.scrollBy({ top: Math.min(r.top - 80, r.bottom - room), behavior: "smooth" })
}

/** Whether the module shows a reading line ("Read as …") for what's on show. */
export const showsReading = (f: JkFlow) =>
	f.view === "results" && !!f.answer && (f.source.kind === "typed" || (f.source.kind === "prompt" && !vocabOf(f.source)))

/** The window event the intro film fires at its end to send the guest here. */
export const TRY_TAP_THREE = "start-lab:try-tap-three"

/**
 * The intro's hand-off: on `start-lab:try-tap-three`, scroll the module to the middle of the screen, pulse its amber
 * ring (opacity and transform only), and, if nothing is chosen yet, focus the dice (or the first mood chip). `card` is
 * the module's box, `pulse` the ring element over it.
 */
export function useJkHandOff(f: JkFlow, card: RefObject<HTMLElement | null>, pulse: RefObject<HTMLElement | null>) {
	const fresh = f.view === "empty" && f.loved.length === 0
	const freshRef = useRef(fresh)
	freshRef.current = fresh
	useEffect(() => {
		let t: ReturnType<typeof setTimeout> | undefined
		const on = () => {
			const el = card.current
			if (!el) return
			const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
			// Window scroll only: scrollIntoView would also scroll the overflow-hidden stage and shift its contents.
			const r = el.getBoundingClientRect()
			const room = window.innerHeight - 64 // the lab bar
			const top = Math.max(0, window.scrollY + r.top - Math.max(16, (room - r.height) / 2))
			window.scrollTo({ top, behavior: reduce ? "auto" : "smooth" })
			if (freshRef.current) {
				const target =
					el.querySelector<HTMLElement>("[data-jk-dice]:not([disabled])") ??
					document.querySelector<HTMLElement>("[data-jk-moods] button[aria-pressed]")
				target?.focus({ preventScroll: true })
			}
			clearTimeout(t)
			// After the smooth scroll has mostly settled.
			t = setTimeout(
				() => {
					const ring = pulse.current
					if (!ring || reduce) return
					ring.getAnimations().forEach((a) => a.cancel())
					ring.animate(
						[
							{ opacity: 0, transform: "scale(1.035)" },
							{ opacity: 1, transform: "scale(1)", offset: 0.22 },
							{ opacity: 0.35, transform: "scale(1)", offset: 0.5 },
							{ opacity: 1, transform: "scale(1)", offset: 0.7 },
							{ opacity: 0, transform: "scale(1.01)" },
						],
						{ duration: 1500, easing: "ease-out" },
					)
				},
				reduce ? 0 : 420,
			)
		}
		window.addEventListener(TRY_TAP_THREE, on)
		return () => {
			window.removeEventListener(TRY_TAP_THREE, on)
			clearTimeout(t)
		}
	}, [card, pulse])
}
