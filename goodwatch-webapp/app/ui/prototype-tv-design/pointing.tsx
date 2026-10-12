// PROTOTYPE - throwaway. Pointing the Remote at the screen. Two things follow the mouse:
// - the Remote in the hand aims at the cursor wherever it is in the window: it turns about the wrist (rotateZ),
//   leans toward or away from the screen (rotateX), rolls a little (rotateY) and shifts a few pixels;
// - while the cursor is over the TV picture, the TV draws its own pointer there, in place of the system cursor.
// Both ease toward the cursor with a short lag, as a hand does. Over the Remote itself the Remote settles at rest,
// so its keys are where they were and can be hit.
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
export function TvPointer({ shape, pointer }: { shape: PointerKey; pointer: RefObject<HTMLDivElement> }) {
	return (
		<div ref={pointer} data-tv-pointer data-shape={shape} data-shown="false" data-over="false" className={`tvp tvp-${shape}`} aria-hidden>
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
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

/**
 * Where the Remote turns: the wrist, a little under the window's bottom edge, 62% down the Remote's box. A pivot
 * further down would swing the keys out of the window at the angles the corners need.
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
}

/**
 * Makes `remote` aim at the cursor and `pointer` follow it over the TV. `geometry` is read on every event, so it
 * may change with every render. Touch has no cursor: the Remote turns a little toward a tap and comes back.
 */
export function usePointing(scene: RefObject<HTMLElement | null>, remote: RefObject<HTMLElement | null>, pointer: RefObject<HTMLElement | null>, geometry: Pointing | null) {
	const geo = useRef(geometry)
	geo.current = geometry
	useEffect(() => {
		const root = scene.current
		if (!root) return
		const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
		const cursor = { x: 0, y: 0, here: false, tap: false }
		const aim: Aim = { ...REST }
		const at = { x: 0, y: 0, placed: false }
		let item: HTMLElement | null = null
		let shown = false
		let raf = 0
		let idle: ReturnType<typeof setTimeout> | undefined
		let tapTimer: ReturnType<typeof setTimeout> | undefined

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
			const box = remoteBox(g)
			if (still || !g.live || !g.remote || !box || !cursor.here || (!cursor.tap && inside(box, 12))) return REST
			const arm = REMOTE_H * g.remote.scale * WRIST
			const pivot = { x: box.left + box.width / 2, y: g.remote.top + arm }
			const dx = cursor.x - pivot.x
			const up = Math.max(40, pivot.y - cursor.y)
			// -1 at the window's far edge on the left of the wrist, 1 at the far edge on its right.
			const side = clamp(dx / Math.max(pivot.x, g.width - pivot.x), -1, 1)
			const reach = clamp(Math.hypot(dx, up) / (g.height * 1.05), 0, 1)
			// A phone's Remote, and a tap, only hint at the direction.
			const part = g.phone ? 0.15 : cursor.tap ? 0.4 : 1
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
				// A turned Remote sinks; the hand lifts it by about as much, so its keys stay in the window.
				ty: (0.75 - reach) * 22 * part - (1 - Math.cos((rz * Math.PI) / 180)) * arm * 0.9,
			}
		}

		const frame = () => {
			raf = 0
			const g = geo.current
			if (!g) return
			let moving = false
			const want = target(g)
			for (const k of Object.keys(aim) as (keyof Aim)[]) {
				const gap = want[k] - aim[k]
				aim[k] = still || Math.abs(gap) < 0.02 ? want[k] : aim[k] + gap * 0.16
				if (aim[k] !== want[k]) moving = true
			}
			if (remote.current) remote.current.style.transform = g.phone && !cursor.tap && aim.rz === 0 ? "none" : aimTransform(g.phone ? { ...aim, rx: 0 } : aim)
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
					at.x += gx * 0.34
					at.y += gy * 0.34
					moving = true
				}
				pointer.current.style.transform = `translate3d(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px, 0)`
			}
			if (moving) raf = requestAnimationFrame(frame)
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
		const onDown = (e: PointerEvent) => {
			const g = geo.current
			if (!g) return
			if (e.pointerType === "mouse") {
				// A key of the Remote: the pointer steps aside, as it does for the keyboard.
				if ((e.target as HTMLElement).closest?.("[data-remote]")) return show(false)
				set(pointer.current, "press", true)
				setTimeout(() => set(pointer.current, "press", false), 140)
				return
			}
			// Touch: no cursor to follow. The Remote turns a little toward the tap, then comes back.
			if (!root.contains(e.target as Node) || (e.target as HTMLElement).closest?.("[data-remote]")) return
			const r = root.getBoundingClientRect()
			Object.assign(cursor, { x: e.clientX - r.left, y: e.clientY - r.top, here: true, tap: true })
			clearTimeout(tapTimer)
			tapTimer = setTimeout(rest, 650)
			kick()
		}
		const onKey = (e: KeyboardEvent) => {
			if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key !== "Shift") show(false)
		}
		// On the window, not on the scene: the Remote also follows the cursor over the site's header and dock.
		window.addEventListener("pointermove", onMove)
		window.addEventListener("pointerdown", onDown)
		document.documentElement.addEventListener("mouseleave", rest)
		window.addEventListener("blur", rest)
		window.addEventListener("keydown", onKey)
		return () => {
			window.removeEventListener("pointermove", onMove)
			window.removeEventListener("pointerdown", onDown)
			document.documentElement.removeEventListener("mouseleave", rest)
			window.removeEventListener("blur", rest)
			window.removeEventListener("keydown", onKey)
			cancelAnimationFrame(raf)
			clearTimeout(idle)
			clearTimeout(tapTimer)
		}
	}, [scene, remote, pointer])
}
