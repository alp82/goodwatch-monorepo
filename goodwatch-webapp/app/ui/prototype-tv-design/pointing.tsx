// PROTOTYPE - throwaway. Pointing the Remote at the screen. Two things follow the mouse:
// - the Remote in the hand aims at the cursor wherever it is in the window: it turns about the wrist (rotateZ),
//   leans toward or away from the screen (rotateX), rolls a little (rotateY) and shifts a few pixels;
// - while the cursor is over the TV picture, the TV draws its own pointer there, in place of the system cursor.
// Both ease toward the cursor with a short lag, as a hand does. Over the Remote itself the Remote settles at rest,
// so its keys are where they were and can be hit.
//
// A finger points too. A press on the picture shows the pointer where it landed, the Remote aims there, and the
// item under it takes the focus; letting go is OK on it, however long the press was held, and both go back to
// rest. Once the finger drags, the pointer steps out a little above it, so the finger does not hide it; the
// Remote follows, the items it passes take the focus, and letting go is OK on the one it is over (over none,
// nothing). The phone's Remote has its own, smaller way of aiming (`rig`): it must stay in its place under the TV.
//
// Cheap on purpose: one pointermove listener writes the cursor into a ref, one requestAnimationFrame loop eases
// two transforms and stops when both have arrived. Nothing here sets React state on a mouse move; the pointer's
// few states (shown, over an item, over the expand key) are attributes set when they change. Only `transform` and
// `opacity` animate.
import { type RefObject, useEffect, useRef } from "react"
import { REMOTE_H, REMOTE_TILT_DEG, REMOTE_W } from "~/ui/living-room/room"
import type { Rect } from "~/ui/prototype-tv-flow/engine"

/** The pointer shapes the owner can choose from. */
export const POINTERS = { ring: "Ring", cross: "Crosshair", dot: "Dot" } as const
export type PointerKey = keyof typeof POINTERS

/** How long the pointer stays after the last movement. */
const IDLE_MS = 3200

export const POINTER_CSS = `
.tvp { position: absolute; left: 0; top: 0; z-index: 34; pointer-events: none; opacity: 0; transition: opacity .28s ease-out; will-change: transform; --ink: #fff; --edge: rgba(0,0,0,.6); }
.tvp[data-shown="true"] { opacity: 1; }
.tvp[data-out="true"] { --ink: #fbbf24; }
.tvp i { position: absolute; display: block; transition: transform .16s cubic-bezier(.2,.8,.2,1), opacity .16s, background-color .16s, border-color .16s; }
.tvp .tvp-shape { transition: transform .16s cubic-bezier(.2,.8,.2,1); }
.tvp[data-press="true"] .tvp-shape { transform: scale(.82); }
/* The phone's pointer is a fifth smaller: its TV is. */
.tvp-small .tvp-shape { transform: scale(.8); }
.tvp-small[data-press="true"] .tvp-shape { transform: scale(.64); }
@media (prefers-reduced-motion: reduce) { .tvp, .tvp i, .tvp .tvp-shape { transition: none; } }
/* Ring: a circle with a centre dot. Over an item the circle closes around the dot. */
.tvp-ring .a { left: -27px; top: -27px; width: 54px; height: 54px; border-radius: 50%; border: 4px solid var(--ink); box-shadow: 0 0 0 2px var(--edge), inset 0 0 0 2px var(--edge); }
.tvp-ring .b { left: -5px; top: -5px; width: 10px; height: 10px; border-radius: 50%; background: var(--ink); box-shadow: 0 0 0 2px var(--edge); }
.tvp-ring[data-over="true"] .a { transform: scale(.58); }
.tvp-ring[data-over="true"] .b { transform: scale(1.5); }
/* Crosshair: four ticks around a gap. Over an item the ticks close in and the cross turns. */
.tvp-cross i { left: -3px; top: -11px; width: 6px; height: 22px; border-radius: 3px; background: var(--ink); box-shadow: 0 0 0 2px var(--edge); }
.tvp-cross .a { transform: translateY(-27px); }
.tvp-cross .b { transform: rotate(90deg) translateY(-27px); }
.tvp-cross .c { transform: rotate(180deg) translateY(-27px); }
.tvp-cross .d { transform: rotate(270deg) translateY(-27px); }
.tvp-cross[data-over="true"] .a { transform: rotate(45deg) translateY(-15px); }
.tvp-cross[data-over="true"] .b { transform: rotate(135deg) translateY(-15px); }
.tvp-cross[data-over="true"] .c { transform: rotate(225deg) translateY(-15px); }
.tvp-cross[data-over="true"] .d { transform: rotate(315deg) translateY(-15px); }
/* Dot: a lit puck. Over an item it opens into a ring. */
.tvp-dot .a { left: -17px; top: -17px; width: 34px; height: 34px; border-radius: 50%; background: var(--ink); border: 5px solid var(--ink); box-shadow: 0 0 0 2px var(--edge), 0 0 34px 10px rgba(255,255,255,.4); }
.tvp-dot[data-over="true"] .a { background: transparent; transform: scale(1.5); }
.tv-nocursor, .tv-nocursor * { cursor: none !important; }
`

/** The TV's own pointer. The loop in `usePointing` moves it; its shape reacts through attributes. */
export function TvPointer({ shape, pointer, small }: { shape: PointerKey; pointer: RefObject<HTMLDivElement>; small?: boolean }) {
	return (
		<div ref={pointer} data-tv-pointer data-shape={shape} data-shown="false" data-over="false" className={`tvp tvp-${shape} ${small ? "tvp-small" : ""}`} aria-hidden>
			<div className="tvp-shape">
				<i className="a" />
				{shape !== "dot" && <i className="b" />}
				{shape === "cross" && (
					<>
						<i className="c" />
						<i className="d" />
					</>
				)}
			</div>
		</div>
	)
}

type Aim = { rz: number; rx: number; ry: number; tx: number; ty: number }
const REST: Aim = { rz: 0, rx: REMOTE_TILT_DEG, ry: 0, tx: 0, ty: 0 }
/** The phone's Remote rests flat: its keys are exactly where they are drawn. */
const FLAT: Aim = { rz: 0, rx: 0, ry: 0, tx: 0, ty: 0 }
/** A press that moves further than this is a drag. Until then it points under the finger, however long it is held. */
const DRAG = 10
/** Dragged, the pointer stands this far above the finger. It goes there in `LIFT_MS`, so the target does not jump. */
const LIFT = 46
const LIFT_MS = 220

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

/**
 * Where the Remote turns: the wrist, 62% down the Remote's box. That is just under the streaming keys, which
 * therefore hardly move when the Remote swings: they stay in the window and where a click expects them.
 */
export const WRIST = 0.62
/** The Remote's transform for an aim, about the wrist. */
export const aimTransform = (a: Aim) => `translate3d(${a.tx.toFixed(1)}px, ${a.ty.toFixed(1)}px, 0) perspective(1400px) rotateZ(${a.rz.toFixed(2)}deg) rotateX(${a.rx.toFixed(2)}deg) rotateY(${a.ry.toFixed(2)}deg)`
export const REST_TRANSFORM = aimTransform(REST)

export type Pointing = {
	/** The TV picture at rest, relative to the scene. */
	tv: Rect
	/** The Remote's box at rest, or null where there is none (the TV alone). */
	remote: { left: number; top: number; scale: number } | null
	width: number
	height: number
	phone: boolean
	/** False while the picture is growing into a page or the set is off: no pointer, the Remote at rest. */
	live: boolean
	/** How far the Remote may turn about the wrist, in degrees: 42 reaches the corners, less keeps it off the TV beside it. */
	swing: number
	/**
	 * The phone's Remote, which aims in its own way: the point it turns about (in the scene), from there up to its
	 * top (`arm`) and half its width, the gap between its top and the TV (`clear`), how far it may turn, lean back
	 * and slide, and what part of the angle to the target it turns by.
	 */
	rig?: { x: number; y: number; arm: number; half: number; clear: number; swing: number; lean: number; slide: number; turn: number }
	/** Gives an item the focus: a finger has no hover to do it. */
	focus: (id: string) => void
}

/**
 * Makes `remote` aim at the cursor, or at the finger on the picture, and `pointer` follow it over the TV.
 * `geometry` is read on every event, so it may change with every render.
 */
export function usePointing(scene: RefObject<HTMLElement | null>, remote: RefObject<HTMLElement | null>, pointer: RefObject<HTMLElement | null>, geometry: Pointing | null) {
	const geo = useRef(geometry)
	geo.current = geometry
	useEffect(() => {
		const root = scene.current
		if (!root) return
		const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
		const cursor = { x: 0, y: 0, here: false, tap: false }
		const aim: Aim = { ...(geo.current?.rig ? FLAT : REST) }
		let rigged = Boolean(geo.current?.rig)
		const at = { x: 0, y: 0, placed: false }
		let item: HTMLElement | null = null
		let shown = false
		let raf = 0
		let drawn = 0
		let idle: ReturnType<typeof setTimeout> | undefined
		let tapTimer: ReturnType<typeof setTimeout> | undefined
		// The finger on the picture: where it went down, where it is, and since when it drags (0: it has not moved).
		let touch: { id: number; x: number; y: number; fx: number; fy: number; hold: boolean; since: number } | null = null
		let lastType = "mouse"
		// After a touch that was acted on here, the browser's own click for it is still to come, and is dropped.
		let owed = false
		let ours = false

		const inside = (r: Rect, pad = 0) => cursor.x >= r.left - pad && cursor.x <= r.left + r.width + pad && cursor.y >= r.top - pad && cursor.y <= r.top + r.height + pad
		const remoteBox = (g: Pointing): Rect | null => (g.remote ? { left: g.remote.left, top: g.remote.top, width: REMOTE_W * g.remote.scale, height: g.height - g.remote.top } : null)
		const set = (el: HTMLElement | null, name: string, value: boolean) => {
			if (el && el.dataset[name] !== String(value)) el.dataset[name] = String(value)
		}
		const show = (on: boolean) => {
			shown = on
			set(pointer.current, "shown", on)
		}

		/** Where the Remote should be for the cursor: aimed at it, or at rest. */
		const target = (g: Pointing): Aim => {
			if (g.rig) {
				// The phone's Remote: it turns by a part of the angle to the target, leans back further for a far one and
				// slides a little toward its side. Turned, its leading corner rises; where that would reach the TV, the
				// hand lowers it by as much.
				// It aims only at the picture: a cursor over its own keys must find them where they are.
				if (still || !g.live || !cursor.here || !inside(g.tv, 24)) return FLAT
				const dx = cursor.x - g.rig.x
				const up = Math.max(40, g.rig.y - cursor.y)
				const side = clamp(dx / (g.width / 2), -1, 1)
				const rz = clamp(((Math.atan2(dx, up) * 180) / Math.PI) * g.rig.turn, -g.rig.swing, g.rig.swing)
				const rad = (Math.abs(rz) * Math.PI) / 180
				const rise = g.rig.half * Math.sin(rad) - g.rig.arm * (1 - Math.cos(rad))
				return { rz, rx: g.rig.lean * (0.45 + 0.55 * clamp(up / g.rig.y, 0, 1)), ry: side * g.rig.lean * 0.9, tx: side * g.rig.slide, ty: Math.max(0, rise - g.rig.clear) }
			}
			const box = remoteBox(g)
			if (still || !g.live || !g.remote || !box || !cursor.here || (!cursor.tap && inside(box, 12))) return REST
			const pivot = { x: box.left + box.width / 2, y: g.remote.top + REMOTE_H * g.remote.scale * WRIST }
			const dx = cursor.x - pivot.x
			const up = Math.max(40, pivot.y - cursor.y)
			// -1 at the window's far edge on the left of the wrist, 1 at the far edge on its right.
			const side = clamp(dx / Math.max(pivot.x, g.width - pivot.x), -1, 1)
			const reach = clamp(Math.hypot(dx, up) / (g.height * 1.05), 0, 1)
			const part = 1
			// With room to swing, the Remote turns by the angle to the cursor (42 degrees reaches the top corners of a
			// 16:9 window; further, it would lie on its side). Held to a nod, it turns by a part of that angle and
			// rolls more instead.
			const nod = g.swing < 30
			const rz = clamp(((Math.atan2(dx, up) * 180) / Math.PI) * (nod ? 0.3 : 1), -g.swing, g.swing) * part
			return {
				rz,
				rx: REMOTE_TILT_DEG + clamp((reach - 0.75) * 40, -14, 14) * part,
				ry: side * (nod ? 26 : 16) * part,
				tx: side * (nod ? 10 : 44) * part,
				// Turned, the streaming key on the far side dips by about a third of the Remote's width: the hand lifts
				// the Remote by that much, so the row stays in the window under the TV.
				ty: Math.min(0, (0.75 - reach) * 22 * part) - Math.abs(Math.sin((rz * Math.PI) / 180)) * REMOTE_W * 0.34 * g.remote.scale,
			}
		}

		const frame = () => {
			raf = 0
			const g = geo.current
			if (!g) return
			// The lag is in time, not in frames: a device that draws few frames arrives as soon as a fast one.
			const now = performance.now()
			const dt = Math.min(64, drawn ? now - drawn : 16.7)
			drawn = now
			const hand = 1 - Math.exp(-dt / 96)
			const glide = 1 - Math.exp(-dt / 40)
			let moving = false
			// The pointer is still stepping out from under a finger that began to drag: it is placed again each frame.
			if (touch?.hold && now - touch.since < LIFT_MS + 40) {
				follow()
				moving = true
			}
			// The Remote changed (a phone turned into a window, or back): start from its own rest.
			if (rigged !== Boolean(g.rig)) {
				rigged = Boolean(g.rig)
				Object.assign(aim, rigged ? FLAT : REST)
			}
			const want = target(g)
			for (const k of Object.keys(aim) as (keyof Aim)[]) {
				const gap = want[k] - aim[k]
				aim[k] = still || Math.abs(gap) < 0.05 ? want[k] : aim[k] + gap * hand
				if (aim[k] !== want[k]) moving = true
			}
			// At rest the phone's Remote has no transform at all: its keys are hit where they are drawn.
			if (remote.current) remote.current.style.transform = g.rig && !moving && want === FLAT ? "none" : aimTransform(aim)
			if (pointer.current && shown) {
				// Over an item the pointer leans a little toward its middle: it feels held, and stays where the click lands.
				let { x, y } = cursor
				if (item?.isConnected) {
					const b = item.getBoundingClientRect()
					const r = root.getBoundingClientRect()
					x += (b.left + b.width / 2 - r.left - x) * 0.14
					y += (b.top + b.height / 2 - r.top - y) * 0.14
				}
				const [gx, gy] = [x - at.x, y - at.y]
				if (still || !at.placed || Math.hypot(gx, gy) < 0.3) Object.assign(at, { x, y, placed: true })
				else {
					at.x += gx * glide
					at.y += gy * glide
					moving = true
				}
				pointer.current.style.transform = `translate3d(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px, 0)`
			}
			if (moving) raf = requestAnimationFrame(frame)
			else drawn = 0
		}
		const kick = () => {
			if (!raf) raf = requestAnimationFrame(frame)
		}
		const rest = () => {
			cursor.here = false
			cursor.tap = false
			item = null
			show(false)
			kick()
		}

		const onMove = (e: PointerEvent) => {
			const g = geo.current
			if (!g || e.pointerType !== "mouse") return
			const r = root.getBoundingClientRect()
			Object.assign(cursor, { x: e.clientX - r.left, y: e.clientY - r.top, here: true, tap: false })
			const overTv = g.live && inside(g.tv)
			const over = overTv ? ((e.target as HTMLElement).closest?.<HTMLElement>("[data-tv-item]") ?? null) : null
			if (over !== item) {
				item = over
				set(pointer.current, "over", Boolean(over))
				set(pointer.current, "out", over?.dataset.tvItem === "expand")
			}
			if (overTv && !shown) at.placed = false
			show(overTv)
			clearTimeout(idle)
			if (overTv) idle = setTimeout(() => show(false), IDLE_MS)
			kick()
		}
		/** The item of the picture at a point of the scene, if any. */
		const itemAt = (x: number, y: number) => {
			const r = root.getBoundingClientRect()
			const el = document.elementFromPoint(x + r.left, y + r.top)
			return el && root.querySelector("[data-tv-screen]")?.contains(el) ? el.closest<HTMLElement>("[data-tv-item]") : null
		}
		/** The pointer is over `next` now: it shows it, and the item takes the focus. */
		const pointAt = (next: HTMLElement | null) => {
			if (next === item) return
			item = next
			set(pointer.current, "over", Boolean(next))
			set(pointer.current, "out", next?.dataset.tvItem === "expand")
			if (next?.dataset.tvItem) geo.current?.focus(next.dataset.tvItem)
		}
		/** How far above the finger the pointer is by now: nothing until the finger drags, then eased up to `LIFT`. */
		const lifted = () => {
			if (!touch?.hold) return 0
			const t = still ? 1 : clamp((performance.now() - touch.since) / LIFT_MS, 0, 1)
			return LIFT * (1 - (1 - t) ** 3)
		}
		/** The finger drags: the pointer is above it, follows it, and what it is over has the focus. */
		const follow = () => {
			const g = geo.current
			if (!g || !touch) return
			const { tv } = g
			// Never off the picture. A finger that left the picture points at nothing.
			const on = touch.fx >= tv.left - 24 && touch.fx <= tv.left + tv.width + 24 && touch.fy >= tv.top - 24 && touch.fy <= tv.top + tv.height + LIFT + 24
			Object.assign(cursor, { x: clamp(touch.fx, tv.left + 4, tv.left + tv.width - 4), y: clamp(touch.fy - lifted(), tv.top + 4, tv.top + tv.height - 4), here: on })
			show(on)
			pointAt(on ? itemAt(cursor.x, cursor.y) : null)
		}
		const hold = () => {
			if (!touch || touch.hold) return
			touch.hold = true
			touch.since = performance.now()
			set(pointer.current, "hold", true)
			set(pointer.current, "press", false)
			follow()
			kick()
		}
		const onDown = (e: PointerEvent) => {
			const g = geo.current
			lastType = e.pointerType
			// A new press: the click of the one before has come by now, or never will (a drag has none).
			owed = false
			if (!g) return
			if (e.pointerType === "mouse") {
				// A key of the Remote: the pointer steps aside, as it does for the keyboard.
				if ((e.target as HTMLElement).closest?.("[data-remote]")) return show(false)
				set(pointer.current, "press", true)
				setTimeout(() => set(pointer.current, "press", false), 140)
				return
			}
			// A finger. On the Remote's keys and in the room it does what it always did; on the picture it points.
			if (touch || !g.live || !root.querySelector("[data-tv-screen]")?.contains(e.target as Node)) return
			const r = root.getBoundingClientRect()
			const [x, y] = [e.clientX - r.left, e.clientY - r.top]
			touch = { id: e.pointerId, x, y, fx: x, fy: y, hold: false, since: 0 }
			Object.assign(cursor, { x, y, here: true, tap: true })
			at.placed = false
			clearTimeout(tapTimer)
			clearTimeout(idle)
			item = null
			pointAt(itemAt(x, y))
			set(pointer.current, "over", Boolean(item))
			set(pointer.current, "hold", false)
			set(pointer.current, "press", true)
			show(true)
			kick()
		}
		const onTouchMove = (e: PointerEvent) => {
			if (!touch || e.pointerId !== touch.id) return
			const r = root.getBoundingClientRect()
			touch.fx = e.clientX - r.left
			touch.fy = e.clientY - r.top
			// A press that moves is a drag from here on. One that stays put keeps pointing where it landed.
			if (!touch.hold && Math.hypot(touch.fx - touch.x, touch.fy - touch.y) > DRAG) hold()
			else if (touch.hold) {
				follow()
				kick()
			}
		}
		const onUp = (e: PointerEvent) => {
			if (!touch || e.pointerId !== touch.id) return
			const held = touch.hold
			touch = null
			// Letting go is OK on the item the pointer is over. The browser's own click, if one follows, is dropped.
			const target = shown && item?.isConnected ? item : null
			owed = true
			set(pointer.current, "hold", false)
			set(pointer.current, "press", Boolean(target))
			if (target) {
				setTimeout(() => set(pointer.current, "press", false), 160)
				ours = true
				target.click()
				ours = false
			}
			clearTimeout(tapTimer)
			tapTimer = setTimeout(rest, target ? 620 : held ? 160 : 520)
		}
		const onCancel = (e: PointerEvent) => {
			if (!touch || e.pointerId !== touch.id) return
			touch = null
			set(pointer.current, "hold", false)
			set(pointer.current, "press", false)
			rest()
		}
		/** The browser's click after a touch on the picture: the touch was already acted on. */
		const onClick = (e: MouseEvent) => {
			// Not by the clock: a slow device brings that click late, onto whatever the screen shows by then.
			if (ours || !owed || !e.isTrusted) return
			owed = false
			e.stopPropagation()
			e.preventDefault()
		}
		/** No menu and no callout under a finger that is held. */
		const onMenu = (e: Event) => {
			if (lastType !== "mouse") e.preventDefault()
		}
		const onKey = (e: KeyboardEvent) => {
			if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key !== "Shift") show(false)
		}
		// On the window, not on the scene: the Remote also follows the cursor over the site's header and dock.
		window.addEventListener("pointermove", onMove)
		window.addEventListener("pointerdown", onDown)
		window.addEventListener("pointermove", onTouchMove)
		window.addEventListener("pointerup", onUp)
		window.addEventListener("pointercancel", onCancel)
		root.addEventListener("click", onClick, true)
		root.addEventListener("contextmenu", onMenu)
		document.documentElement.addEventListener("mouseleave", rest)
		window.addEventListener("blur", rest)
		window.addEventListener("keydown", onKey)
		return () => {
			window.removeEventListener("pointermove", onMove)
			window.removeEventListener("pointerdown", onDown)
			window.removeEventListener("pointermove", onTouchMove)
			window.removeEventListener("pointerup", onUp)
			window.removeEventListener("pointercancel", onCancel)
			root.removeEventListener("click", onClick, true)
			root.removeEventListener("contextmenu", onMenu)
			document.documentElement.removeEventListener("mouseleave", rest)
			window.removeEventListener("blur", rest)
			window.removeEventListener("keydown", onKey)
			cancelAnimationFrame(raf)
			clearTimeout(idle)
			clearTimeout(tapTimer)
		}
	}, [scene, remote, pointer])
}
