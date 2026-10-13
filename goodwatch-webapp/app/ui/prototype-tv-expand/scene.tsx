// PROTOTYPE - throwaway. "How should the TV hand over to a real page, and how does the person get back?"
// The approved Cinema TV in its room (prototype-tv-design, imported and not changed), on a mini Discover results
// screen or a title screen. Its Expand key opens the REAL page (/discover?moods=funny, /movie/546554-knives-out)
// through one of nine transitions; the browser's Back, Escape and a Back to TV control on the real page come back
// into the same TV screen with the same focus.
//   &t=today|grow|frame|morph|camera|live|wipe|lean|leanlite   the transition (the keys 1 to 9). Without it:
//                        leanlite, the owner's choice ("9 is better"). The others are for comparison only
//   &back=bar|key|esc    the way back that the real page shows (B, also on the real page). Without it: bar
//   &button=set|screen|plain   how the TV button is drawn (T, also on the real page)
//   &dock=left|between   where the TV button stands in the phone's dock (L, also on the real page)
//   &slow=1              the page's data takes 1.5 s longer (W)
//   &calm=1              reduced motion, whatever the system says (R)
//   &at=home.discover.discover-funny   the TV's screens, as in the design prototype (D switches results and title)
//   &chrome=off          hides the prototype's own controls, for screenshots
// This file is the room and the lead-in that happens in it; trip.ts is the transition and the way back, host.tsx
// their CSS and the controls on the real page. Notes: docs/prototypes/tv-expand-transitions/README.md.
import { useNavigate, useSearchParams } from "@remix-run/react"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { HAND, HAND_IMAGE, REMOTE_H, REMOTE_W, ROOM } from "~/ui/living-room/room"
import type { TvAction } from "~/ui/living-room/tv-flow"
import { useLeaveThroughTv, useReturnIntoTv } from "~/ui/living-room/tv-transition"
import { HugRemote } from "~/ui/prototype-remote/RemoteVariants"
import { BarCtx, CANVAS, DesignTv } from "~/ui/prototype-tv-design/base"
import { cinema } from "~/ui/prototype-tv-design/cinema"
import { PhoneRemote } from "~/ui/prototype-tv-design/phone-remote"
import { PhoneRoom, layoutPhoneRoom } from "~/ui/prototype-tv-design/phone-room"
import { POINTER_CSS, REST_TRANSFORM, TvPointer, WRIST, usePointing } from "~/ui/prototype-tv-design/pointing"
import { DEST, type Dest, titleOf } from "~/ui/prototype-tv-flow/data"
import { type Rect, type Tv, TvCtx, parseId, useTvEngine } from "~/ui/prototype-tv-flow/engine"
import { Corners } from "~/ui/prototype-tv-flow/kit"
import { assetUrl } from "~/utils/asset-url"
import {
	AMBER,
	ARM_MS,
	BACKS,
	BUTTONS,
	type BackKey,
	type ButtonKey,
	CHOSEN,
	DOCKS,
	type DockKey,
	FRAME,
	GROW_MS,
	SLOW_MS,
	TRANSITIONS,
	type TransitionKey,
	type Trip,
	beginLeave,
	canTransition,
	cancelLeave,
	idx,
	liveDrop,
	liveGo,
	livePreload,
	liveShowing,
	measureTv,
	next,
	readTrip,
	reducedMotion,
	sleep,
	clearReturning,
	isReturning,
	transitionRunning,
	writeTrip,
} from "./trip"

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

const SCENE_CSS = `
.tvd .tvf { position: relative; display: block; text-align: left; outline: none; scroll-margin: 44px; -webkit-tap-highlight-color: transparent; }
.tvd .tvd-fade { animation: tvd-fade .42s ease-out both; }
@keyframes tvd-fade { from { opacity: 0; } }
.tvd .tvx-frame { position: absolute; inset: var(--in); }
.tvd .tvf-on .tvx-frame { animation: tvx-out .9s ease-in-out infinite alternate; }
@keyframes tvx-out { from { inset: var(--in); } to { inset: var(--out); } }
/* Waiting for the page's data: the frame breathes, and after a moment a line says what is coming. */
.tvx-waiting { animation: tvx-breathe .7s ease-in-out .3s infinite alternate; }
@keyframes tvx-breathe { to { opacity: .35; } }
.tvx-wait-line { animation: tvd-fade .2s linear .35s both; }
@media (prefers-reduced-motion: reduce) {
	.tvd *, .tvd .tvd-screen, .tvx-waiting { animation: none !important; transition: none !important; }
	.tvd .tvf-on .tvx-frame { inset: var(--out); }
}
`

const SERVICE_NAMES: Record<string, string> = { netflix: "Netflix", prime: "Prime Video", disney: "Disney+", hulu: "Hulu" }
const TITLE = "title-knives-out"

const clamp = (n: number) => Math.max(0, Math.min(1, n))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({ left: lerp(a.left, b.left, t), top: lerp(a.top, b.top, t), width: lerp(a.width, b.width, t), height: lerp(a.height, b.height, t) })
const inset = (r: Rect, by: number): Rect => ({ left: r.left + by, top: r.top + by, width: r.width - 2 * by, height: r.height - 2 * by })
const easeOut = (t: number) => 1 - (1 - t) ** 3
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)

// ---- The room, as in prototype-tv-design/scene.tsx (copied: that file is being worked on in another thread).
const REMOTE_SHOWN = 880
const REMOTE_SHOWN_UNDER = 548
const REMOTE_OVER_TV = 18
const REMOTE_MIN_UNDER = 0.46
const HAND_LEFT = 0.3
const HAND_RIGHT = 0.42
const TV_MIN_WIDTH = CANVAS.w * 0.9

function layoutRoom(w: number, h: number) {
	const aspect = ROOM.tv.w / ROOM.tv.h
	const pad = Math.max(14, Math.min(28, w * 0.0125))
	const leaves = (scale: number) => Math.min(h - Math.max(8, h * 0.012) - 8 - REMOTE_SHOWN_UNDER * scale, (w - 2 * pad) / aspect)
	const needed = TV_MIN_WIDTH / aspect
	let tvUnder = leaves(Math.max(0.5, Math.min(0.68, h / 1800)))
	if (tvUnder < needed) tvUnder = Math.min(needed, leaves(REMOTE_MIN_UNDER))
	const place = tvUnder >= needed - 0.5 ? "below" : "beside"
	let tv: Rect
	let remote: { left: number; top: number; scale: number }
	if (place === "below") {
		const top = Math.max(6, h * 0.008)
		const tvW = tvUnder * aspect
		const scale = Math.max(REMOTE_MIN_UNDER, Math.min(0.8, (h - top - tvUnder + REMOTE_OVER_TV) / REMOTE_SHOWN_UNDER))
		tv = { left: (w - tvW) / 2, top, width: tvW, height: tvUnder }
		remote = { left: w / 2 - (REMOTE_W * scale) / 2, top: h - REMOTE_SHOWN_UNDER * scale, scale }
	} else {
		const column = (scale: number) => REMOTE_W * scale * (1 + HAND_LEFT + HAND_RIGHT)
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
	}
}

/**
 * The lead-in that happens in the room before the page takes over. `arm`: the brackets' way from the key to the
 * picture's edge. `grow` (the transition "New" only): the picture's way to the window. Then the run waits for the
 * page. Backwards it undoes both, quicker.
 */
type Run = {
	dest: Dest
	/** The Expand key's box, relative to the scene. */
	from: Rect
	arm: number
	grow: number
	grows: boolean
	dir: 1 | -1
	/** The key had the focus when it was pressed: cancelled, the frame stays at the picture's edge. */
	keep: boolean
	/** No sign of waiting: today's transition shows none. */
	silent?: boolean
}

export function TvExpandScene() {
	const [params, setParams] = useSearchParams()
	const navigate = useNavigate()
	const leaveToday = useLeaveThroughTv()
	useReturnIntoTv()
	const t = (TRANSITIONS.find((x) => x.key === params.get("t"))?.key ?? CHOSEN) as TransitionKey
	const button = (BUTTONS.find((x) => x.key === params.get("button"))?.key ?? "set") as ButtonKey
	const dockAt = (DOCKS.find((x) => x.key === params.get("dock"))?.key ?? "left") as DockKey
	const back = (BACKS.find((x) => x.key === params.get("back"))?.key ?? "bar") as BackKey
	// 6 and 8 load the real page inside the TV.
	const inTv = t === "live" || t === "lean"
	const slow = params.get("slow") === "1"
	const calmAsked = params.get("calm") === "1"
	const [panel, setPanel] = useState(false)

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
	const engine = useTvEngine({ variant: "apps", member: false, phone, label: "Expand", scene: root, ready: Boolean(size) })

	// The phone: nothing scrolls behind the scene. A layout effect, so the page that follows is never drawn fixed.
	useIsoLayoutEffect(() => {
		if (!phone) return
		const html = document.documentElement
		const was = [html.style.cssText, document.body.style.cssText]
		html.style.cssText += ";overflow:hidden;overscroll-behavior:none;scrollbar-gutter:auto"
		document.body.style.cssText += ";position:fixed;inset:0;overflow:hidden"
		return () => {
			html.style.cssText = was[0]
			document.body.style.cssText = was[1]
		}
	}, [phone])

	// ---- Coming back: Back has popped to this entry. For "New" the picture is still as large as the window.
	const [arrival] = useState<Trip | null>(() => (typeof window !== "undefined" && isReturning() ? readTrip() : null))
	useEffect(clearReturning, [])
	const [run, setRun] = useState<Run | null>(() =>
		arrival && arrival.t === "grow" && !arrival.calm ? { dest: { name: arrival.dest.name, href: arrival.dest.href }, from: { left: 0, top: 0, width: 0, height: 0 }, arm: 1, grow: 1, grows: true, dir: 1, keep: true, silent: true } : null,
	)
	useEffect(() => {
		if (!arrival || arrival.t !== "grow" || arrival.calm) return
		// Once the page has faded out over the grown picture, the picture shrinks into the TV.
		let timer: ReturnType<typeof setTimeout>
		const check = () => {
			if (transitionRunning()) timer = setTimeout(check, 30)
			else setRun((r) => (r ? { ...r, dir: -1 } : r))
		}
		timer = setTimeout(check, 60)
		return () => clearTimeout(timer)
	}, [arrival])

	// The same focus as on leaving. The address carries it for the first Back; after Forward and Back again only the
	// trip still knows it. And the cursor rests wherever the person left it on the real page, often over a tile:
	// until it really moves, it does not take the focus away.
	const resting = useRef<{ x: number; y: number } | "unknown" | null>(arrival ? "unknown" : null)
	useIsoLayoutEffect(() => {
		if (arrival) engine.setFocus(arrival.focus)
		if (!arrival) return
		const onMove = (e: PointerEvent) => {
			if (resting.current === "unknown") resting.current = { x: e.clientX, y: e.clientY }
			else if (resting.current && Math.hypot(e.clientX - resting.current.x, e.clientY - resting.current.y) > 8) resting.current = null
		}
		window.addEventListener("pointermove", onMove, true)
		return () => window.removeEventListener("pointermove", onMove, true)
	}, [])
	const pointFocus = (id: string) => {
		if (!resting.current) engine.setFocus(id)
	}

	const lead = useRef<() => void>(() => {})
	const moving = run ? `${run.dir}` : null
	useEffect(() => {
		if (!moving) return
		let last = performance.now()
		let raf = 0
		const tick = (now: number) => {
			const dt = now - last
			last = now
			setRun((r) => {
				if (!r) return r
				if (r.dir > 0) {
					if (r.arm < 1) {
						const arm = Math.min(1, r.arm + dt / ARM_MS)
						if (arm >= 1 && !r.grows) lead.current()
						return { ...r, arm }
					}
					if (r.grows && r.grow < 1) {
						const grow = Math.min(1, r.grow + dt / GROW_MS)
						if (grow >= 1) lead.current()
						return { ...r, grow }
					}
					return r
				}
				// Coming back, or cancelling, is quicker than leaving.
				if (r.grow > 0) return { ...r, grow: Math.max(0, r.grow - (dt * 2.5) / GROW_MS) }
				if (r.keep || r.arm <= 0) return null
				return { ...r, arm: Math.max(0, r.arm - (dt * 2.5) / ARM_MS) }
			})
			raf = requestAnimationFrame(tick)
		}
		raf = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(raf)
	}, [moving])

	const top = engine.top
	const [kind, arg] = parseId(top)
	// Where this screen's Expand key leads, for the Live page's head start. Other screens start loading on the press.
	const here: Dest | null = kind === "discover" && arg ? DEST.discover(arg === "any" ? null : arg) : kind === "title" ? DEST.title(titleOf(arg)) : null
	const framed = engine.focus === "expand" && !run && top !== "menu" && engine.store.power === "on"

	// ---- Leaving through the Expand key.
	const latest = useRef({ t, back, button, dockAt, slow, calmAsked, run, engine, size })
	latest.current = { t, back, button, dockAt, slow, calmAsked, run, engine, size }
	const leave: Tv["leave"] = (dest, from, how) => {
		const now = latest.current
		const scene = root.current
		const el = scene?.querySelector<HTMLElement>(`[data-tv-layer] [data-tv-item="${from}"]`)
		const box = measureTv()
		if (!scene || !el || !box || now.run || liveShowing()) return
		const b = el.getBoundingClientRect()
		const r = scene.getBoundingClientRect()
		// The TV's history entry keeps the focus, so Back lands on the item the person left from.
		const url = new URL(window.location.href)
		url.searchParams.set("f", now.engine.focus ?? from)
		window.history.replaceState(window.history.state, "", url)
		const calm = now.calmAsked || reducedMotion() || !canTransition()
		writeTrip({
			t: now.t,
			back: now.back,
			button: now.button,
			dock: now.dockAt,
			slow: now.slow,
			calm,
			tvIdx: idx(),
			tvUrl: url.pathname + url.search,
			box,
			key: { left: b.left, top: b.top, width: b.width, height: b.height },
			dest: { name: dest.name, href: dest.href },
			focus: now.engine.focus ?? from,
			// The picture's backdrop is the screen's first image; a small file of it is enough for the button.
			art: scene.querySelector<HTMLImageElement>("[data-tv-screen] [data-tv-layer] img")?.src.replace(/\/t\/p\/w\d+\//, "/t/p/w300/") ?? null,
			screen: dest.carries ? `${dest.name} › ${dest.carries}` : dest.name,
		})
		const slowly = now.slow ? sleep(SLOW_MS) : null
		const keep = Boolean(how?.framed)
		const base: Run = { dest, from: { left: b.left - r.left, top: b.top - r.top, width: b.width, height: b.height }, arm: keep ? 1 : 0, grow: 0, grows: false, dir: 1, keep }
		if (now.t === "today") {
			// Exactly what the start page does now: mark the TV's box and navigate. Nothing shows while the data loads.
			beginLeave(slowly)
			setRun({ ...base, arm: 1, silent: true })
			leaveToday(dest.href)
			return
		}
		if (calm) {
			// Reduced motion: the frame stands at the picture's edge at once, the page replaces the room without motion.
			beginLeave(slowly)
			setRun({ ...base, arm: 1 })
			navigate(dest.href, { viewTransition: canTransition() })
			return
		}
		if (now.t === "live" || now.t === "lean") {
			livePreload(dest.href, now.slow)
			setRun({ ...base, arm: 1 })
			liveGo(
				box,
				() => {
					beginLeave(null)
					navigate(dest.href, { viewTransition: true })
				},
				now.t === "lean" ? scene.querySelector<HTMLElement>("[data-tvx-room]") : null,
			)
			return
		}
		const led = new Promise<void>((resolve) => {
			lead.current = resolve
		})
		beginLeave(Promise.all([led, slowly]))
		setRun({ ...base, grows: now.t === "grow" })
		if (keep && now.t !== "grow") lead.current()
		navigate(dest.href, { viewTransition: true })
	}
	/** Escape or Back while the page has not come yet: the navigation is dropped and the lead-in runs backwards. */
	const cancel = () => {
		const r = latest.current.run
		if (!r || r.dir < 0) return false
		// The page is already on its way in: Back will bring the person back from it.
		if (transitionRunning() || liveShowing()) return true
		cancelLeave()
		liveDrop()
		writeTrip(null)
		navigate(window.location.pathname + window.location.search, { replace: true, preventScrollReset: true })
		setRun(r.silent ? null : { ...r, dir: -1 })
		return true
	}
	const tv: Tv = {
		...engine,
		// A tile under the resting cursor (see `resting`) does not take the focus by being hovered.
		setFocus: (id, by) => {
			if (by !== "pointer" || !resting.current) engine.setFocus(id, by)
		},
		leave,
		back: () => {
			if (!cancel()) engine.back()
		},
	}

	// The Live page starts loading in the TV while the Expand key has the focus.
	const hereHref = here?.href
	useEffect(() => {
		if (!inTv || !framed || !hereHref || calmAsked) return
		const timer = setTimeout(() => livePreload(hereHref, slow), 250)
		return () => clearTimeout(timer)
	}, [inTv, framed, hereHref, slow, calmAsked])
	useEffect(() => {
		if (!inTv) liveDrop()
	}, [inTv])
	useEffect(() => () => void (liveShowing() || liveDrop()), [])

	// ---- The prototype's controls.
	const set = (next: Record<string, string>) => {
		const p = new URLSearchParams(params)
		for (const [k, v] of Object.entries(next)) v === "" ? p.delete(k) : p.set(k, v)
		setParams(p, { replace: true, preventScrollReset: true })
	}
	const controls = {
		transition: (key: string) => set({ t: key === CHOSEN ? "" : key }),
		back: () => set({ back: next(BACKS, back).replace(/^bar$/, "") }),
		button: () => set({ button: next(BUTTONS, button).replace(/^set$/, "") }),
		dock: () => set({ dock: next(DOCKS, dockAt).replace(/^left$/, "") }),
		slow: () => set({ slow: slow ? "" : "1" }),
		calm: () => set({ calm: calmAsked ? "" : "1" }),
		screen: () => {
			if (kind === "title") engine.back()
			else if (top === "discover-funny") engine.push(TITLE)
			setTimeout(() => latestKeys.current.engine.setFocus("expand"), 80)
		},
	}
	const latestKeys = useRef({ controls, cancel, engine, run })
	latestKeys.current = { controls, cancel, engine, run }
	useEffect(() => {
		// For the clips: the state, and the lead-in's progress.
		;(window as unknown as { __tvx?: unknown }).__tvx = {
			state: () => {
				const k = latestKeys.current
				return { stack: k.engine.stack.join("."), focus: k.engine.focus, run: k.run && { arm: k.run.arm, grow: k.run.grow, dir: k.run.dir } }
			},
		}
		// In the capture phase, before the TV's own keys: while a lead-in runs, Escape and Backspace cancel it and
		// no other key reaches the TV.
		const onKey = (e: KeyboardEvent) => {
			if (e.metaKey || e.ctrlKey || e.altKey) return
			if ((e.target as HTMLElement).closest("input, textarea, [contenteditable]")) return
			const k = latestKeys.current
			if (k.run) {
				if (e.key === "Escape" || e.key === "Backspace") k.cancel()
				e.stopImmediatePropagation()
				e.preventDefault()
				return
			}
			if (k.engine.top === "search") return
			const key = e.key.toLowerCase()
			// The digits by position too (`code`), for layouts where they need Shift.
			const digit = /^(Digit|Numpad)[1-9]$/.test(e.code) ? e.code.slice(-1) : key
			const to = TRANSITIONS[Number(digit) - 1]
			if (to) k.controls.transition(to.key)
			else if (key === "b") k.controls.back()
			else if (key === "t") k.controls.button()
			else if (key === "l") k.controls.dock()
			else if (key === "w") k.controls.slow()
			else if (key === "r") k.controls.calm()
			else if (key === "d") k.controls.screen()
			else return
			e.stopImmediatePropagation()
			e.preventDefault()
		}
		window.addEventListener("keydown", onKey, true)
		return () => window.removeEventListener("keydown", onKey, true)
	}, [])

	// ---- Layout.
	const PL = useMemo(() => (size && phone ? layoutPhoneRoom(size.w, size.h, "auto") : null), [size, phone])
	const L = useMemo(() => {
		if (!size) return null
		if (PL) return { place: "phone" as const, photo: null, hand: null, tv: PL.tv, remote: null, canvas: PL.canvas }
		return { ...layoutRoom(size.w, size.h), canvas: CANVAS }
	}, [size, PL])
	const canvas = L?.canvas ?? CANVAS

	const grow = run ? run.grow : 0
	const windowRect: Rect = { left: 0, top: 0, width: size?.w ?? 0, height: size?.h ?? 0 }
	const tvRect = L ? (grow > 0 ? lerpRect(L.tv, windowRect, easeInOut(grow)) : L.tv) : null
	const stepBack = framed ? FRAME.back : run ? FRAME.back + (1 - FRAME.back) * clamp(grow / 0.35) : 1
	const brackets = !L || !tvRect ? null : run ? (grow > 0 || run.arm >= 1 ? inset(tvRect, FRAME.inset) : lerpRect(run.from, inset(L.tv, FRAME.inset), easeOut(run.arm))) : framed ? inset(L.tv, FRAME.inset) : null
	const bracketsLen = brackets ? Math.max(14, Math.min(120, Math.min(brackets.width, brackets.height) * FRAME.arm)) : 0
	const waiting = Boolean(run && !run.silent && run.dir > 0 && run.arm >= 1 && (!run.grows || run.grow >= 1))
	// The Camera leans in while it waits: the zoom has begun before the page is there.
	const creep = Boolean(run && run.dir > 0 && (t === "camera" || t === "leanlite") && !calmAsked)

	const remoteEl = useRef<HTMLDivElement>(null)
	const pointerEl = useRef<HTMLDivElement>(null)
	const live = !run && engine.store.power === "on"
	usePointing(root, remoteEl, pointerEl, L && size ? { tv: L.tv, remote: L.remote, width: size.w, height: size.h, phone, live, swing: L.place === "below" ? 42 : 13, rig: PL?.rig, focus: pointFocus } : null)

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
		<div ref={remoteEl} data-remote className="absolute will-change-transform" style={{ left: L.remote.left, top: L.remote.top, width: REMOTE_W * L.remote.scale, height: REMOTE_H * L.remote.scale, transformOrigin: `50% ${WRIST * 100}%`, transform: REST_TRANSFORM }}>
			{L.hand && (
				<picture>
					<source type="image/avif" srcSet={assetUrl(HAND_IMAGE.avif)} />
					<img src={assetUrl(HAND_IMAGE.webp)} alt="" aria-hidden className="pointer-events-none absolute max-w-none select-none" style={L.hand} draggable={false} />
				</picture>
			)}
			<div className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${L.remote.scale})` }}>
				<HugRemote
					streaming="arc"
					screen={parseId(top)[0] === "search" ? { name: "search", query: null } : { name: "home" }}
					power={engine.store.power}
					menuOpen={top === "menu"}
					lcd={["", ""]}
					serviceName={(key) => SERVICE_NAMES[key]}
					activeService={engine.store.service}
					dispatch={dispatch}
					onOk={tv.ok}
					onDirection={tv.move}
				/>
			</div>
		</div>
	)

	const bar = useMemo(() => ({ expand: "bottom" as const }), [])
	const s = tvRect ? Math.max(tvRect.width / canvas.w, tvRect.height / canvas.h) : 1
	const pill = "rounded-full bg-white px-3 py-1.5 shadow-xl ring-2 ring-fuchsia-500"
	const chosen = TRANSITIONS.find((x) => x.key === t) ?? TRANSITIONS[0]
	const tvCenter = L ? `${L.tv.left + L.tv.width / 2}px ${L.tv.top + L.tv.height / 2}px` : "50% 50%"
	return (
		<div ref={root} data-bar="bottom" className={`living-room ${phone ? "select-none [-webkit-touch-callout:none]" : ""} fixed inset-x-0 bottom-16 top-16 z-40 overflow-clip bg-[#07080b] text-white lg:bottom-0`}>
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: our own constant CSS */}
			<style dangerouslySetInnerHTML={{ __html: `@layer components {${SCENE_CSS}${POINTER_CSS}${cinema.css}}` }} />
			<div data-tvx-room className="absolute inset-0" style={{ transformOrigin: tvCenter, transform: creep ? "scale(1.05)" : "none", transition: creep ? "transform 2.6s cubic-bezier(.15,.6,.3,1)" : "transform .3s ease-out" }}>
				{L?.photo && (
					<div className="absolute" style={L.photo}>
						<img src={assetUrl(ROOM.fallback)} srcSet={ROOM.webp} sizes="200vw" alt={ROOM.alt} width={ROOM.w} height={ROOM.h} className="absolute inset-0 h-full w-full select-none" style={{ filter: "blur(1.8px)" }} draggable={false} />
						<div className="absolute inset-0 bg-[#05060a] transition-opacity duration-700" style={{ opacity: engine.store.power === "on" ? 0.34 : 0.66 }} />
						<div className="absolute inset-0" style={{ background: `radial-gradient(62% 70% at ${((ROOM.tv.x + ROOM.tv.w / 2) / ROOM.w) * 100}% ${((ROOM.tv.y + ROOM.tv.h / 2) / ROOM.h) * 100}%, rgba(5,6,10,0) 45%, rgba(5,6,10,.5) 100%)` }} />
					</div>
				)}
				{PL && <PhoneRoom L={PL} on={engine.store.power === "on"} />}
				{L && tvRect && (
					<div data-tv-screen className={`absolute touch-none select-none overflow-hidden bg-black [-webkit-touch-callout:none] ${phone ? "rounded-[3px]" : "rounded-[4px]"} ${live ? "tv-nocursor" : ""}`} style={{ ...tvRect, zIndex: grow > 0 ? 30 : undefined, boxShadow: L.photo && engine.store.power === "on" ? "0 0 120px 10px rgba(251,191,36,0.14), 0 0 22px 1px rgba(251,191,36,0.18)" : "none" }}>
						<div data-tv-canvas className="absolute left-0 top-0 origin-top-left" style={{ width: canvas.w, height: canvas.h, transform: `translate(${(tvRect.width - canvas.w * s) / 2}px, ${(tvRect.height - canvas.h * s) / 2}px) scale(${s})` }}>
							<BarCtx.Provider value={bar}>
								<TvCtx.Provider value={tv}>
									{engine.store.power === "off" ? (
										<div className="absolute inset-0 bg-black" aria-hidden />
									) : (
										<div className={`tvd tvd-cinema ${canvas.h < 400 ? "tvd-short" : ""} absolute inset-0 overflow-hidden`} style={{ transform: `scale(${stepBack})`, transition: run ? undefined : "transform .22s cubic-bezier(.2,.8,.2,1)" }}>
											<DesignTv skin={cinema} />
										</div>
									)}
								</TvCtx.Provider>
							</BarCtx.Provider>
						</div>
					</div>
				)}
				{remote}
				{PL && (
					<div ref={remoteEl} data-remote-rig className="absolute left-0 top-0 will-change-transform" style={{ transformOrigin: `${PL.rig.x}px ${PL.rig.y}px` }}>
						{PL.hand && (
							<picture>
								<source type="image/avif" srcSet={assetUrl(HAND_IMAGE.avif)} />
								<img src={assetUrl(HAND_IMAGE.webp)} alt="" aria-hidden className="pointer-events-none absolute max-w-none select-none" style={PL.hand} draggable={false} />
							</picture>
						)}
						<PhoneRemote tv={tv} form={PL.form} at={PL.remote} bottom={PL.h} />
					</div>
				)}
				<TvPointer shape="ring" pointer={pointerEl} small={phone} />
				{brackets && (
					<div className={`tvx-own-brackets pointer-events-none absolute z-[36] ${waiting && !calmAsked ? "tvx-waiting" : ""}`} style={brackets}>
						<Corners len={bracketsLen} stroke={FRAME.stroke} color={AMBER} />
					</div>
				)}
				{/* What the person reads while the page's data is on its way, and how to call it off. */}
				{waiting && run && size && (
					<div className="tvx-wait-line pointer-events-none absolute z-[37] whitespace-nowrap rounded-full bg-black/75 px-3 py-1.5 text-[13px] font-semibold text-amber-300" style={{ right: Math.max(8, size.w - run.from.left - run.from.width), bottom: Math.max(8, size.h - run.from.top + 8) }}>
						Opening {run.dest.name} · {phone ? "Back cancels" : "Esc cancels"}
					</div>
				)}
			</div>

			{/* Prototype controls, not part of the design. On the phone they are folded behind one small key. */}
			{phone && PL && params.get("chrome") !== "off" && (
				<button type="button" data-controls aria-expanded={panel} aria-label="Prototype controls" onClick={() => setPanel(!panel)} className="absolute z-50 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-white text-[15px] font-bold leading-none text-fuchsia-700 shadow-xl ring-2 ring-fuchsia-500" style={{ left: 3, top: PL.seam + 1 }}>
					{panel ? "×" : "⋯"}
				</button>
			)}
			<div hidden={params.get("chrome") === "off" || (phone && !panel)} className={`absolute z-50 flex flex-wrap items-center gap-1.5 font-semibold text-black ${phone ? "inset-x-0 justify-center bg-black/80 px-2 py-2 text-[12px] [&_button]:!py-[5px]" : "left-3 right-3 top-3 text-[13px]"}`} style={phone && PL ? { top: PL.seam + 30 } : undefined}>
				{/* Only the chosen transition is offered. The others are still behind the keys 1 to 9, to compare. */}
				<button type="button" data-transition={t} onClick={() => controls.transition(CHOSEN)} className={`${pill} ${t === CHOSEN ? "!bg-fuchsia-600 text-white" : ""}`} title={t === CHOSEN ? "The chosen transition" : "Back to the chosen transition"}>
					{t === CHOSEN ? "Lean in" : `${TRANSITIONS.findIndex((x) => x.key === t) + 1} ${chosen.name}, for comparison`}
				</button>
				<button type="button" data-back={back} onClick={controls.back} className={pill} title="The way back that the real page shows (B)">
					Back: {BACKS.find((x) => x.key === back)?.name.toLowerCase()}
				</button>
				<button type="button" data-button={button} onClick={controls.button} className={pill} title="How the TV button is drawn (T)">
					TV button: {BUTTONS.find((x) => x.key === button)?.name.toLowerCase()}
				</button>
				{phone && (
					<button type="button" data-dock={dockAt} onClick={controls.dock} className={pill} title="Where the TV button stands in the dock (L)">
						{dockAt === "left" ? "Dock: left part" : "Dock: beside Search"}
					</button>
				)}
				<button type="button" aria-pressed={slow} onClick={controls.slow} className={`${pill} ${slow ? "!bg-fuchsia-600 text-white" : ""}`} title="The page's data takes 1.5 s longer (W)">
					Slow page
				</button>
				<button type="button" aria-pressed={calmAsked} onClick={controls.calm} className={`${pill} ${calmAsked ? "!bg-fuchsia-600 text-white" : ""}`} title="Reduced motion (R)">
					Reduced motion
				</button>
				<button type="button" onClick={controls.screen} className={pill} title="The other TV screen (D)">
					{kind === "title" ? "Title screen" : "Results screen"}
				</button>
				{!phone && (
					<span className="rounded-full bg-black/80 px-3 py-1.5 font-mono text-[12px] font-normal text-white/90">
						{engine.stack.join(" › ")} · focus {engine.focus ?? "none"}
						{run ? ` · ${run.dir < 0 ? "back" : waiting ? "waiting for" : "leaving for"} ${run.dest.href}` : here ? ` · Expand opens ${here.href}` : ""}
					</span>
				)}
				<div className={`w-full ${phone ? "text-center" : ""}`}>
					<span className="inline-block max-w-[980px] rounded-2xl bg-black/80 px-3 py-1.5 text-[12px] font-normal leading-snug text-white/90">
						<b className="text-fuchsia-300">{t === CHOSEN ? "Lean in" : chosen.name}.</b> {t === CHOSEN ? "The room zooms into the TV until the screen is the window, the page already on the screen, and the brackets ride the picture's edge out and fold into the way back. Chosen by the owner; the keys 1 to 8 show the others." : chosen.bet}
					</span>
				</div>
			</div>
		</div>
	)
}
