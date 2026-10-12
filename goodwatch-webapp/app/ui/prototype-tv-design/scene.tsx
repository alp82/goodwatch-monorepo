// PROTOTYPE - throwaway. "What should the start page's TV look like?" Round two: the apps flow of the flow
// prototype (prototype-tv-flow, fixed) in three visual directions, in the room with the Remote, switchable via
// `?design=`, the three buttons at the top left and the keys 1, 2, 3:
//   cinema   the art does the work: the picture takes the backdrop of what has the focus
//   marquee  words and colour do the work: huge type on flat colour, a ring that glides to the focus
//   glow     light does the work: a warm, calm TV; the focus is a lamp, not a line
// The TV is larger than on the start page today. The Remote sits under it and swings toward the cursor; in a window
// too small for that it moves beside the TV. See `layoutRoom`.
//   &as=guest|member     the person (P)
//   &view=room|tv        the room with the Remote, or the TV alone (V)
//   &label=expand|...    the expand key's label (L)
//   &at=home.discover.discover-cozy   the stack of TV screens; it stays when the direction changes
//   &f=<item>            the focused item on arrival
//   &pointer=ring|cross|dot   the shape of the TV's own pointer (C)
//   &bar=first           the expand key first in the top bar instead of last (B)
//   &remote=below|beside the Remote under the TV or beside it, whatever the window's size would choose (R)
//   &pointer=cross|dot   the two pointer shapes the owner did not choose; the ring is the pointer (C)
//   &hold                freezes the expand run for screenshots: window.__tvLeave(0..1)
//   &chrome=off          hides the prototype's own controls, for screenshots of the TV alone
// Sample data and TMDB art only: nothing is read or written. Notes: docs/prototypes/tv-screen-design/README.md.
import { useSearchParams } from "@remix-run/react"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { HAND, HAND_IMAGE, REMOTE_H, REMOTE_W, ROOM } from "~/ui/living-room/room"
import type { TvAction } from "~/ui/living-room/tv-flow"
import { LABELS, type Rect, TvCtx, parseId, useTvEngine } from "~/ui/prototype-tv-flow/engine"
import { Corners } from "~/ui/prototype-tv-flow/kit"
import { HugRemote } from "~/ui/prototype-remote/RemoteVariants"
import { assetUrl } from "~/utils/asset-url"
import { BarCtx, CANVAS, DIRECTIONS, DesignTv, type DirectionKey, Follower, PHONE_CANVAS, type Skin } from "./base"
import { cinema } from "./cinema"
import { glow } from "./glow"
import { marquee } from "./marquee"
import { POINTERS, POINTER_CSS, type PointerKey, REST_TRANSFORM, TvPointer, WRIST, usePointing } from "./pointing"

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

const SKINS: Record<DirectionKey, Skin> = { cinema, marquee, glow }
const AMBER = "#fbbf24"

/**
 * How each direction dresses the expand run: the brackets' weight and reach, how far the picture steps back into
 * its frame while the expand key has the focus, and what shows around it then.
 */
const EXPAND: Record<DirectionKey, { stroke: number; arm: number; inset: number; back: number; glow?: string; radius: number }> = {
	cinema: { stroke: 3, arm: 0.22, inset: 14, back: 0.94, radius: 0 },
	marquee: { stroke: 10, arm: 0.12, inset: 10, back: 0.9, radius: 0 },
	glow: { stroke: 5, arm: 0.16, inset: 16, back: 0.95, glow: "drop-shadow(0 0 14px rgba(251,191,36,.95))", radius: 18 },
}

const BASE_CSS = `
.tvd .tvf { position: relative; display: block; text-align: left; outline: none; scroll-margin: 44px; -webkit-tap-highlight-color: transparent; }
.tvd .tvd-fade { animation: tvd-fade .42s ease-out both; }
@keyframes tvd-fade { from { opacity: 0; } }
.tvd .tvx-frame { position: absolute; inset: var(--in); }
.tvd .tvf-on .tvx-frame { animation: tvx-out .9s ease-in-out infinite alternate; }
@keyframes tvx-out { from { inset: var(--in); } to { inset: var(--out); } }
@media (prefers-reduced-motion: reduce) {
	.tvd *, .tvd .tvd-screen { animation: none !important; transition: none !important; }
	.tvd .tvf-on .tvx-frame { inset: var(--out); }
}
`

const SERVICE_NAMES: Record<string, string> = { netflix: "Netflix", prime: "Prime Video", disney: "Disney+", hulu: "Hulu" }

const clamp = (n: number) => Math.max(0, Math.min(1, n))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({ left: lerp(a.left, b.left, t), top: lerp(a.top, b.top, t), width: lerp(a.width, b.width, t), height: lerp(a.height, b.height, t) })
const inset = (r: Rect, by: number): Rect => ({ left: r.left + by, top: r.top + by, width: r.width - 2 * by, height: r.height - 2 * by })
const easeOut = (t: number) => 1 - (1 - t) ** 3
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)

/** Beside the TV the whole Remote shows at rest, in its own pixels from its top: all of it (866) and the start of the palm. */
const REMOTE_SHOWN = 880
/** Under the TV it shows down to its streaming keys (they end at 522) and the fingertips under them; its end and the hand run off the window. */
const REMOTE_SHOWN_UNDER = 548
/** Under the TV the Remote may shrink this far to keep the TV's type at 18 px; smaller, its wheel stops being a control. */
const REMOTE_MIN_UNDER = 0.46
/** How far the hand reaches past the Remote's sides, in Remote widths: the fingers on the left, the palm on the right. */
const HAND_LEFT = 0.3
const HAND_RIGHT = 0.42
/** Type of 20 canvas pixels prints at 18 once the TV shows its canvas at 0.9. */
const TV_MIN_WIDTH = CANVAS.w * 0.9

export type RemotePlace = "below" | "beside"

/**
 * The room. Two ways to seat the TV and the Remote in a window:
 * - `below` (the owner's choice): the TV centred and the Remote under it, in the hand, free to swing toward the
 *   cursor. The TV is as tall as the window leaves once the Remote shows down to its streaming keys: its top sits
 *   right under the picture, over the TV's lower edge and the sideboard, and in a shorter window the Remote gives
 *   way first (down to 0.46 of its size) so the TV keeps the width that holds its type at 18 px.
 * - `beside`: for a window too small for that (under about 920 px tall or 1140 wide): the TV on the left, as large
 *   as the window allows, and the whole Remote to its right, its end on the window's bottom edge.
 * `want` forces one; "auto" takes `below` wherever it keeps 18 px type. The photo is scaled so its TV sits exactly
 * where ours is.
 */
function layoutRoom(w: number, h: number, want: RemotePlace | "auto") {
	const aspect = ROOM.tv.w / ROOM.tv.h
	const pad = Math.max(14, Math.min(28, w * 0.0125))
	const top = Math.max(8, h * 0.012)
	// Under the TV: the Remote at the size the height suggests, or smaller if that is what 18 px type costs.
	const roomFor = (scale: number) => Math.min(h - top - 8 - REMOTE_SHOWN_UNDER * scale, ((w - 2 * pad) / aspect))
	let under = Math.max(0.5, Math.min(0.68, h / 1800))
	const needed = TV_MIN_WIDTH / aspect
	if (roomFor(under) < needed) under = Math.max(REMOTE_MIN_UNDER, (h - top - 8 - needed) / REMOTE_SHOWN_UNDER)
	const place: RemotePlace = want === "auto" ? (roomFor(under) >= needed - 0.5 ? "below" : "beside") : want
	let tv: Rect
	let remote: { left: number; top: number; scale: number }
	if (place === "below") {
		const tvH = roomFor(under)
		const tvW = tvH * aspect
		tv = { left: (w - tvW) / 2, top, width: tvW, height: tvH }
		remote = { left: w / 2 - (REMOTE_W * under) / 2, top: h - REMOTE_SHOWN_UNDER * under, scale: under }
	} else {
		const column = (scale: number) => REMOTE_W * scale * (1 + HAND_LEFT + HAND_RIGHT)
		// As large as the height shows all of it, and no larger than a Remote in a hand looks next to this TV.
		let scale = Math.min(Math.max(0.9, h / 1130), 1.15, (h - 10) / REMOTE_SHOWN)
		const room = w - 3 * pad - TV_MIN_WIDTH
		if (column(scale) > room) scale = Math.max(0.5, room / column(1))
		const tvW = Math.min(w - 3 * pad - column(scale), h * 0.92 * aspect)
		const tvH = tvW / aspect
		const left = (w - (tvW + pad + column(scale))) / 2
		tv = { left, top: Math.max(10, (h - tvH) * 0.32), width: tvW, height: tvH }
		remote = { left: left + tvW + pad + REMOTE_W * scale * HAND_LEFT, top: Math.max(6, h - REMOTE_SHOWN * scale), scale }
	}
	const s = tv.width / ROOM.tv.w
	const k = (REMOTE_W * remote.scale) / HAND.pw
	return {
		place,
		tv,
		photo: { left: tv.left - ROOM.tv.x * s, top: tv.top - ROOM.tv.y * s, width: ROOM.w * s, height: ROOM.h * s },
		remote,
		hand: { left: (REMOTE_W * remote.scale) / 2 - (HAND.x + HAND.pw / 2) * k, top: -HAND.y * k, width: HAND.w * k, height: HAND.h * k },
		/** The scene is as tall as the window: nothing to scroll to. */
		tall: 0,
	}
}

export function TvDesignScene() {
	const [params, setParams] = useSearchParams()
	const design = ((params.get("design") ?? "") in DIRECTIONS ? params.get("design") : "cinema") as DirectionKey
	const member = params.get("as") === "member"
	const tvOnly = params.get("view") === "tv"
	const labelKey = (params.get("label") ?? "") in LABELS ? (params.get("label") as string) : "expand"
	const shape = ((params.get("pointer") ?? "") in POINTERS ? params.get("pointer") : "ring") as PointerKey
	const expandFirst = params.get("bar") === "first"
	const wanted = params.get("remote")
	const want: RemotePlace | "auto" = wanted === "below" || wanted === "beside" ? wanted : "auto"
	const skin = SKINS[design]
	const look = EXPAND[design]

	const root = useRef<HTMLDivElement>(null)
	const [size, setSize] = useState<{ w: number; h: number } | null>(null)
	useIsoLayoutEffect(() => {
		const el = root.current
		if (!el) return
		const measure = () => setSize((s) => (s && s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }))
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		return () => ro.disconnect()
	}, [])
	const phone = Boolean(size && size.w < 768)
	// The flow is the flow prototype's "apps", whatever the direction: the stack of screens survives a change of direction.
	const tv = useTvEngine({ variant: "apps", member, phone, label: LABELS[labelKey], scene: root, ready: Boolean(size) })

	const set = (next: Record<string, string>) => {
		const p = new URLSearchParams(params)
		for (const [k, v] of Object.entries(next)) v === "" ? p.delete(k) : p.set(k, v)
		setParams(p, { replace: true, preventScrollReset: true })
	}
	const controls = {
		design: (to: string) => set({ design: to === "cinema" ? "" : to }),
		person: () => set({ as: member ? "" : "member" }),
		view: () => set({ view: tvOnly ? "" : "tv" }),
		label: () => {
			const keys = Object.keys(LABELS)
			const next = keys[(keys.indexOf(labelKey) + 1) % keys.length]
			set({ label: next === "expand" ? "" : next })
		},
		pointer: () => {
			const keys = Object.keys(POINTERS)
			const next = keys[(keys.indexOf(shape) + 1) % keys.length]
			set({ pointer: next === "ring" ? "" : next })
		},
		bar: () => set({ bar: expandFirst ? "" : "first" }),
		// The other place than the one showing; back to the window's own choice when that is the one asked for.
		place: () => {
			if (!size) return
			const other: RemotePlace = place === "below" ? "beside" : "below"
			set({ remote: layoutRoom(size.w, size.h, "auto").place === other ? "" : other })
		},
	}
	const latest = useRef({ controls, tv, typing: tv.top === "search" })
	latest.current = { controls, tv, typing: tv.top === "search" }
	useEffect(() => {
		// For screenshots: jump to a screen and a focus without loading the page again.
		;(window as unknown as { __tvDesign?: unknown }).__tvDesign = {
			root: (id: string) => latest.current.tv.root(id),
			push: (id: string) => latest.current.tv.push(id),
			focus: (id: string) => latest.current.tv.setFocus(id),
		}
		const onKey = (e: KeyboardEvent) => {
			if (latest.current.typing || e.metaKey || e.ctrlKey || e.altKey) return
			if ((e.target as HTMLElement).closest("input, textarea, [contenteditable]")) return
			const key = e.key.toLowerCase()
			// 1, 2 and 3 choose a direction. By position too (`code`), for layouts where the digits need Shift.
			const digit = /^(Digit|Numpad)[123]$/.test(e.code) ? e.code.slice(-1) : key
			const to = Object.keys(DIRECTIONS)[Number(digit) - 1]
			if (to) latest.current.controls.design(to)
			if (key === "p") latest.current.controls.person()
			if (key === "v") latest.current.controls.view()
			if (key === "l") latest.current.controls.label()
			if (key === "c") latest.current.controls.pointer()
			if (key === "b") latest.current.controls.bar()
			if (key === "r") latest.current.controls.place()
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [])

	const canvas = phone ? PHONE_CANVAS : CANVAS
	const L = useMemo(() => {
		if (!size) return null
		const { w, h } = size
		if (phone) {
			// The phone: the TV on top, the Remote under it at a size a thumb can hit (its keys 45 px and up). That is
			// taller than the window, so the scene scrolls: the wheel shows under the TV, the rest is a short scroll down.
			const tvH = Math.min(h * 0.68, (w * canvas.h) / canvas.w)
			const tvW = (tvH * canvas.w) / canvas.h
			const scale = Math.min(0.72, (w * 0.62) / REMOTE_W)
			const top = tvH + 12
			return { place: "phone" as const, photo: null, hand: null, tv: { left: (w - tvW) / 2, top: 0, width: tvW, height: tvH }, remote: { left: w / 2 - (REMOTE_W * scale) / 2, top, scale }, tall: top + (522 + 96) * scale }
		}
		if (tvOnly) {
			const s = Math.min((w - 80) / canvas.w, (h - 80) / canvas.h)
			return { photo: null, hand: null, tv: { left: (w - canvas.w * s) / 2, top: (h - canvas.h * s) / 2, width: canvas.w * s, height: canvas.h * s }, remote: null, tall: 0, place: "none" as const }
		}
		return layoutRoom(w, h, want)
	}, [size, phone, tvOnly, canvas, want])
	const place: RemotePlace = L?.place === "beside" ? "beside" : "below"

	// ---- The expand run: `arm` is the brackets' way to the edge of the picture, `grow` the picture's way to the window.
	const run = tv.leaving
	const arm = run ? (run.arm > 0 ? clamp(run.p / run.arm) : 1) : 0
	const grow = run ? clamp((run.p - run.arm) / (1 - run.arm)) : 0
	const landed = Boolean(run && run.p >= 1)
	const windowRect: Rect = { left: 0, top: 0, width: size?.w ?? 0, height: size?.h ?? 0 }
	const tvRect = L ? (run ? lerpRect(L.tv, windowRect, easeInOut(grow)) : L.tv) : null
	// The focused expand key already frames the whole picture, a little smaller: this is what grows.
	const framed = tv.focus === "expand" && !run && tv.top !== "menu" && tv.store.power === "on"
	const back = framed ? look.back : run ? look.back + (1 - look.back) * clamp(grow / 0.35) : 1
	const brackets = !L || !tvRect ? null : run ? (grow > 0 ? inset(tvRect, look.inset) : lerpRect(run.from, inset(L.tv, look.inset), easeOut(arm))) : framed ? inset(L.tv, look.inset) : null
	const bracketsLen = brackets ? Math.max(14, Math.min(120, Math.min(brackets.width, brackets.height) * look.arm)) : 0

	// ---- Pointing: the Remote aims at the cursor, and over the TV the TV draws its own pointer (pointing.tsx).
	const remoteEl = useRef<HTMLDivElement>(null)
	const pointerEl = useRef<HTMLDivElement>(null)
	const live = !run && tv.store.power === "on"
	// Beside the TV the Remote may only nod toward the cursor: a full turn would swing it over the picture.
	usePointing(root, remoteEl, pointerEl, L && size ? { tv: L.tv, remote: L.remote, width: size.w, height: size.h, phone, live, swing: place === "below" ? 42 : 13 } : null)

	const dispatch = (action: TvAction) => {
		switch (action.type) {
			case "step":
				return tv.step(action.by)
			case "back":
				return tv.back()
			case "home":
				return tv.home()
			case "toggle-menu":
				return tv.toggleMenu()
			case "open-search":
				return tv.openSearch()
			case "service-key":
				return tv.service(action.service)
			case "power":
				return tv.power(action.on)
		}
	}
	const remote = L?.remote && (
		<div ref={remoteEl} data-remote className="absolute will-change-transform" style={{ left: L.remote.left, top: L.remote.top, width: REMOTE_W * L.remote.scale, height: REMOTE_H * L.remote.scale, transformOrigin: `50% ${WRIST * 100}%`, transform: phone ? "none" : REST_TRANSFORM }}>
			{L.hand && (
				<picture>
					<source type="image/avif" srcSet={assetUrl(HAND_IMAGE.avif)} />
					<img src={assetUrl(HAND_IMAGE.webp)} alt="" aria-hidden className="pointer-events-none absolute max-w-none select-none" style={L.hand} draggable={false} />
				</picture>
			)}
			<div className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${L.remote.scale})` }}>
				<HugRemote
					streaming="arc"
					screen={parseId(tv.top)[0] === "search" ? { name: "search", query: null } : { name: "home" }}
					power={tv.store.power}
					menuOpen={tv.top === "menu"}
					lcd={["", ""]}
					serviceName={(key) => SERVICE_NAMES[key]}
					activeService={tv.store.service}
					dispatch={dispatch}
					onOk={tv.ok}
					onDirection={tv.move}
				/>
			</div>
		</div>
	)

	const bar = useMemo(() => ({ expandFirst }), [expandFirst])
	const s = tvRect ? Math.max(tvRect.width / canvas.w, tvRect.height / canvas.h) : 1
	const pill = "rounded-full bg-white px-3 py-1.5 shadow-xl ring-2 ring-fuchsia-500"
	return (
		<div ref={root} data-remote-place={L?.place ?? "none"} data-bar={expandFirst ? "first" : "last"} style={phone ? { scrollbarWidth: "none" } : undefined} className={`living-room fixed inset-x-0 bottom-16 top-16 z-40 bg-[#07080b] text-white lg:bottom-0 ${phone ? "overflow-y-auto overflow-x-clip overscroll-contain" : "overflow-clip"}`}>
			{/* On the phone the scene is taller than the window: this gives it its height to scroll. */}
			{L && L.tall > 0 && <div aria-hidden style={{ height: L.tall }} />}
			{/* As raw text: React would escape the quotes in the selectors, and a style element does not unescape them. */}
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: our own constant CSS */}
			<style dangerouslySetInnerHTML={{ __html: `@layer components {${BASE_CSS}${POINTER_CSS}${skin.css}}` }} />
			{L?.photo && (
				<div className="absolute" style={L.photo}>
					{/* The photo is stretched past its largest file here. A slight blur takes the stretch's grain away and reads
					    as depth of field: the eye is on the TV, the room is behind it. It is set once and never animates. */}
					<img src={assetUrl(ROOM.fallback)} srcSet={ROOM.webp} sizes="200vw" alt={ROOM.alt} width={ROOM.w} height={ROOM.h} className="absolute inset-0 h-full w-full select-none" style={{ filter: "blur(1.8px)" }} draggable={false} />
					{/* The lights are lower than on the start page today: the TV is the brightest thing in the room. */}
					<div className="absolute inset-0 bg-[#05060a] transition-opacity duration-700" style={{ opacity: tv.store.power === "on" ? 0.34 : 0.66 }} />
					{/* And they fall off toward the corners: a plain gradient around the TV, no blend mode. */}
					<div className="absolute inset-0" style={{ background: `radial-gradient(62% 70% at ${((ROOM.tv.x + ROOM.tv.w / 2) / ROOM.w) * 100}% ${((ROOM.tv.y + ROOM.tv.h / 2) / ROOM.h) * 100}%, rgba(5,6,10,0) 45%, rgba(5,6,10,.5) 100%)` }} />
				</div>
			)}
			{L && tvRect && (
				<div data-tv-screen className={`absolute overflow-hidden rounded-[4px] bg-black ${live && !phone ? "tv-nocursor" : ""}`} style={{ ...tvRect, zIndex: run ? 30 : undefined, boxShadow: L.photo && tv.store.power === "on" ? "0 0 120px 10px rgba(251,191,36,0.14), 0 0 22px 1px rgba(251,191,36,0.18)" : "none" }}>
					<div data-tv-canvas className="absolute left-0 top-0 origin-top-left" style={{ width: canvas.w, height: canvas.h, transform: `translate(${(tvRect.width - canvas.w * s) / 2}px, ${(tvRect.height - canvas.h * s) / 2}px) scale(${s})` }}>
						<BarCtx.Provider value={bar}>
						<TvCtx.Provider value={tv}>
							{tv.store.power === "off" ? (
								<div className="absolute inset-0 bg-black" aria-hidden />
							) : (
								<div className={`tvd tvd-${design} absolute inset-0 overflow-hidden`} style={{ transform: `scale(${back})`, borderRadius: back < 1 ? look.radius : 0, transition: run ? undefined : "transform .22s cubic-bezier(.2,.8,.2,1), border-radius .22s" }}>
									{design === "glow" && <Follower className="g-spot" size={phone ? 420 : 680} />}
									<DesignTv skin={skin} />
									{design === "marquee" && <Follower className="m-ring" pad={9} />}
								</div>
							)}
						</TvCtx.Provider>
						</BarCtx.Provider>
					</div>
				</div>
			)}
			{remote}

			{/* The real page, standing in: it fades in while the picture is still growing. */}
			{run && grow > 0.7 && (
				<div className="absolute inset-0 z-[35] overflow-auto bg-[#0d1016]" style={{ opacity: clamp((grow - 0.7) / 0.25), pointerEvents: landed ? undefined : "none" }}>
					<div className="mx-auto flex min-h-full max-w-5xl flex-col px-6 py-10">
						<div className="text-sm font-bold uppercase tracking-[0.2em] text-amber-300">The real page (a stand-in)</div>
						<h1 className="mt-2 text-5xl font-extrabold tracking-tight">{run.dest.name}</h1>
						<div className="mt-3 font-mono text-lg text-white/60">goodwatch.app{run.dest.href}</div>
						{run.dest.carries && <div className="mt-2 text-lg text-white/80">Comes along from the TV: {run.dest.carries}.</div>}
						<div className="mt-8 grid flex-1 grid-cols-3 gap-4 sm:grid-cols-6">
							{Array.from({ length: 12 }, (_, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: placeholders
								<div key={i} className="aspect-[2/3] rounded-xl bg-white/[0.06]" />
							))}
						</div>
						<div className="mt-8 flex flex-wrap items-center gap-4">
							<button type="button" onClick={tv.back} className="rounded-full bg-white px-6 py-3 text-lg font-bold text-black">
								← Back to the TV
							</button>
							<span className="text-white/60">Browser Back does this in the real app: the page shrinks into the TV screen you left.</span>
						</div>
					</div>
				</div>
			)}
			{!phone && <TvPointer key={shape} shape={shape} pointer={pointerEl} />}
			{brackets && (
				<div className="pointer-events-none absolute z-[36]" style={{ ...brackets, filter: look.glow, opacity: run ? 1 - clamp((grow - 0.7) / 0.25) : 1 }}>
					<Corners len={bracketsLen} stroke={look.stroke} color={AMBER} />
				</div>
			)}

			{/* Prototype controls, not part of the design. */}
			<div hidden={params.get("chrome") === "off"} className={`absolute z-50 flex gap-1.5 text-[13px] font-semibold text-black ${phone ? "bottom-6 left-2 flex-col" : "left-3 top-3 items-center"}`}>
				<div className={`flex overflow-hidden rounded-2xl bg-white shadow-xl ring-2 ring-fuchsia-500 ${phone ? "flex-col" : ""}`}>
					{(Object.keys(DIRECTIONS) as DirectionKey[]).map((key, i) => (
						<button key={key} type="button" data-design={key} aria-pressed={key === design} title={`${DIRECTIONS[key].bet} (${i + 1})`} onClick={() => controls.design(key)} className={`px-3 py-1.5 ${key === design ? "bg-fuchsia-600 text-white" : "hover:bg-fuchsia-100"}`}>
							<span className={key === design ? "opacity-70" : "opacity-45"}>{i + 1}</span> {DIRECTIONS[key].name}
						</button>
					))}
				</div>
				<button type="button" onClick={controls.person} className={pill} title="P">
					{member ? "Member" : "Guest"}
				</button>
				{!phone && (
					<button type="button" onClick={controls.view} className={pill} title="V">
						{tvOnly ? "TV only" : "In the room"}
					</button>
				)}
				<button type="button" onClick={controls.label} className={pill} title="L">
					“{LABELS[labelKey]}”
				</button>
				{!phone && !tvOnly && (
					<button type="button" data-place={place} onClick={controls.place} className={pill} title="R">
						Remote {place === "below" ? "under" : "beside"}
						{want === "auto" ? "" : " (forced)"}
					</button>
				)}
				{!phone && (
					<span className="rounded-full bg-black/80 px-3 py-1.5 font-mono text-[12px] font-normal text-white/90">
						{tv.stack.join(" › ")} · focus {tv.focus ?? "none"}
						{run ? ` · ${landed ? "on" : run.dir < 0 ? "back from" : "expanding to"} ${run.dest.href}` : ""}
					</span>
				)}
			</div>
		</div>
	)
}
