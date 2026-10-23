// Pointing the Remote at the TV. Two things follow the mouse:
// - the Remote in the hand aims at the cursor while it is over the TV's picture, and rests elsewhere (pointing-aim.ts says how);
// - while the cursor is over the TV's picture, the TV draws its own pointer there, the ring, in place of the
//   system cursor (TvPointer.tsx, living-room.css).
// The Remote eases toward the cursor with a short lag, as a hand does; the ring is drawn right where the cursor is,
// with no lag. Over the Remote itself the Remote settles at rest, so its keys are where they were and can be hit.
//
// A finger points too. A press on the picture shows the ring where it landed, the Remote aims there, and the item
// under it takes the focus; letting go is OK on it, however long the press was held, and both go back to rest.
// Once the finger drags, the ring steps out a little above it, so the finger does not hide it; the Remote
// follows, the items it passes take the focus, and letting go is OK on the one it is over (over none, nothing).
//
// The TV's machine sees two things of all this: `focus` (the scene's `focus`) and `choose` (the item's own click).
//
// This file is a chunk of its own, asked for at the first interaction (TvPointer.tsx): it costs the first view
// nothing. Rendering budget (#190): one pointermove listener writes the cursor into a variable, one
// requestAnimationFrame loop eases the Remote's transform, places the ring, and stops when the Remote has arrived. Nothing here sets React state
// on a move; the ring's few states (shown, over an item, over the Expand key, pressed) are attributes written
// when they change. Only `transform` and `opacity` animate. With reduced motion the Remote does not move.
import { TV_SCREEN_ATTR } from "../tv-transition"
import {
	type Aim,
	type AimScene,
	DRAG,
	FLAT,
	LIFT,
	REST,
	type Spot,
	aimFor,
	aimTransform,
	inside,
	liftAt,
	ringFor,
} from "./pointing-aim"
import { TV_ITEM_ATTR } from "./tv-dom"

/** How long the ring stays after the mouse last moved. */
const IDLE_MS = 3200
/** How long the ring and the Remote stay out after a finger let go: on an item, after a drag over none, after a tap on none. */
const AFTER = { chosen: 620, dragged: 160, tapped: 520 }
/** The hand's lag, as a time constant in milliseconds. The ring has none: members felt it drag. */
const HAND_MS = 96

/** The scene as pointing reads it, on every event: it may change with every render. */
export type PointingScene = AimScene & {
	/** Gives an item the focus: a finger has no hover to do it. */
	focus: (item: string) => void
}

type Current<T> = { readonly current: T | null }

export type PointingElements = {
	/** The room: the scene's pixels are measured from its corner. */
	root: Current<HTMLElement>
	/** What turns: the desktop Remote with its hand, or the phone's Remote with its. */
	remote: Current<HTMLElement>
	/** The ring. */
	pointer: Current<HTMLElement>
}

export type Pointing = {
	/** The scene changed (the TV went off, the room went away, the window was resized): look again. */
	refresh: () => void
	stop: () => void
}

const ITEM = `[${TV_ITEM_ATTR}]`
const SCREEN = `[${TV_SCREEN_ATTR}]`

/**
 * Makes the Remote aim at the cursor, or at the finger on the picture, and the ring follow it over the TV, until
 * `stop`. `scene` is read on every event.
 */
export function startPointing(
	els: PointingElements,
	scene: () => PointingScene | null,
): Pointing {
	const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
	const still = () => motion.matches
	const cursor: Spot = { x: 0, y: 0, here: false, tap: false }
	const aim: Aim = { ...(scene()?.rig ? FLAT : REST) }
	let rigged = Boolean(scene()?.rig)
	let item: HTMLElement | null = null
	let shown = false
	let raf = 0
	let drawn = 0
	let idle: ReturnType<typeof setTimeout> | undefined
	let after: ReturnType<typeof setTimeout> | undefined
	let pressed: ReturnType<typeof setTimeout> | undefined
	// The finger on the picture: where it went down, where it is, and since when it drags.
	let touch: {
		id: number
		x: number
		y: number
		fx: number
		fy: number
		drags: boolean
		since: number
		/** How far above the finger the ring was last placed. */
		lift: number
	} | null = null
	let lastType = "mouse"
	// After a touch that was acted on here, the browser's own click for it is still to come, and is dropped.
	let owed = false
	let ours = false
	/** The item the last touch chose, for the mouse events the browser sends after it. */
	let chosen: HTMLElement | null = null

	const set = (name: string, value: boolean) => {
		const el = els.pointer.current
		if (el && el.dataset[name] !== String(value))
			el.dataset[name] = String(value)
	}
	const show = (on: boolean) => {
		shown = on
		set("shown", on)
	}
	/**
	 * The item a finger is pressing, marked while the finger is down on it (`data-touch-press`): the browser gives a
	 * finger on the picture no :active, as this code takes the touch. The white G shows its press by it.
	 */
	let pressing: HTMLElement | null = null
	const pressItem = (el: HTMLElement | null) => {
		if (pressing === el) return
		pressing?.removeAttribute("data-touch-press")
		pressing = el
		el?.setAttribute("data-touch-press", "")
	}
	const press = (ms: number) => {
		set("press", true)
		clearTimeout(pressed)
		pressed = setTimeout(() => set("press", false), ms)
	}
	const picture = () => els.root.current?.querySelector(SCREEN) ?? null
	// The room's content origin: the layout's coordinates are the stage's, which scrolls with the room when its
	// content is taller than it (TvRoom.tsx).
	const origin = () => {
		const el = els.root.current
		if (!el) return { left: 0, top: 0 }
		const r = el.getBoundingClientRect()
		return { left: r.left - el.scrollLeft, top: r.top - el.scrollTop }
	}

	const frame = () => {
		raf = 0
		const g = scene()
		if (!g) return
		// The lag is in time, not in frames: a device that draws few frames arrives as soon as a fast one.
		const now = performance.now()
		const dt = Math.min(64, drawn ? now - drawn : 16.7)
		drawn = now
		const hand = 1 - Math.exp(-dt / HAND_MS)
		let moving = false
		// The ring is still stepping out from under a finger that began to drag: it is placed again each frame,
		// until it has been placed all the way up. Not by the clock: a frame that comes late still finishes the step.
		if (touch?.drags && touch.lift < LIFT) {
			follow()
			if (touch.lift < LIFT) moving = true
		}
		// The Remote changed (a phone turned, a window became a phone's): start from its own rest.
		if (rigged !== Boolean(g.rig)) {
			rigged = Boolean(g.rig)
			Object.assign(aim, rigged ? FLAT : REST)
		}
		const want = aimFor(g, cursor, still())
		for (const k of Object.keys(aim) as (keyof Aim)[]) {
			const gap = want[k] - aim[k]
			aim[k] = still() || Math.abs(gap) < 0.05 ? want[k] : aim[k] + gap * hand
			if (aim[k] !== want[k]) moving = true
		}
		// Flat, the phone's Remote has no transform at all: its keys are hit where they are drawn.
		const remote = els.remote.current
		const flat = g.rig && !aim.rz && !aim.rx && !aim.ry && !aim.tx && !aim.ty
		if (remote) remote.style.transform = flat ? "none" : aimTransform(aim)
		const pointer = els.pointer.current
		// The ring is exactly where the cursor is, at once.
		if (pointer && shown)
			pointer.style.transform = `translate3d(${cursor.x.toFixed(1)}px, ${cursor.y.toFixed(1)}px, 0)`
		if (moving) raf = requestAnimationFrame(frame)
		else drawn = 0
	}
	const kick = () => {
		if (!raf) raf = requestAnimationFrame(frame)
	}
	/** Nothing points any more: the ring goes and the Remote returns to rest. */
	const rest = () => {
		cursor.here = false
		cursor.tap = false
		item = null
		pressItem(null)
		clearTimeout(idle)
		show(false)
		kick()
	}

	/** The ring is over `next` now: it shows it. Pointed at by a finger, the item takes the focus. */
	const over = (next: HTMLElement | null, focus: boolean) => {
		if (next === item) return
		item = next
		const id = next?.getAttribute(TV_ITEM_ATTR)
		set("over", Boolean(next))
		set("out", id === "expand")
		if (focus && id) scene()?.focus(id)
	}
	/** The item of the picture at a point of the scene, if any. */
	const itemAt = (x: number, y: number) => {
		const r = origin()
		const el = document.elementFromPoint(x + r.left, y + r.top)
		return el && picture()?.contains(el) ? el.closest<HTMLElement>(ITEM) : null
	}

	// ---- The mouse.
	/** Where the mouse last was in the window, for a scroll that moves the room under a mouse that stays put. */
	const mouse = { x: 0, y: 0, known: false }
	const onMove = (e: PointerEvent) => {
		if (e.pointerType !== "mouse") return
		Object.assign(mouse, { x: e.clientX, y: e.clientY, known: true })
		place(e.target instanceof Element ? e.target : null)
	}
	/** The ring and the Remote go to the mouse's point of the room, over `target`. */
	const place = (target: Element | null) => {
		const g = scene()
		if (!g) return
		const r = origin()
		Object.assign(cursor, {
			x: mouse.x - r.left,
			y: mouse.y - r.top,
			here: true,
			tap: false,
		})
		// Over the picture, and not over something of the page that lies on top of the room.
		const onTv =
			g.live &&
			inside(cursor, g.tv) &&
			Boolean(target && els.root.current?.contains(target))
		// The item under the cursor takes the focus by itself (`Item`, kit.tsx): the ring only shows it.
		over(onTv ? (target?.closest<HTMLElement>(ITEM) ?? null) : null, false)
		show(onTv)
		clearTimeout(idle)
		if (onTv) idle = setTimeout(() => show(false), IDLE_MS)
		kick()
	}

	/**
	 * The room or the page scrolled: what is under a mouse that didn't move changed. The ring is placed again from the
	 * mouse's point, or rests if that is off the picture now. A finger's touch is cancelled by the browser's scroll.
	 * Not for the screens' own boxes: the focus scrolls those, and a key has just put the ring away.
	 */
	const onScroll = (e: Event) => {
		if (e.target !== document && e.target !== els.root.current) return
		if (!mouse.known || !cursor.here || cursor.tap || touch) return
		place(document.elementFromPoint(mouse.x, mouse.y))
	}

	// ---- A finger.
	/** The finger drags: the ring is above it, follows it, and what it is over has the focus. */
	const follow = () => {
		const g = scene()
		if (!g || !touch) return
		touch.lift = touch.drags
			? liftAt(performance.now() - touch.since, still())
			: 0
		const ring = ringFor({ x: touch.fx, y: touch.fy }, g.tv, touch.lift)
		Object.assign(cursor, { x: ring.x, y: ring.y, here: ring.on })
		show(ring.on)
		over(ring.on ? itemAt(ring.x, ring.y) : null, true)
	}
	const onDown = (e: PointerEvent) => {
		const g = scene()
		lastType = e.pointerType
		// A new press: the click of the one before has come by now, or never will (a drag has none).
		owed = false
		if (!g) return
		const target = e.target instanceof Element ? e.target : null
		// A key of the Remote: the ring steps aside, as it does for the keyboard, and the Remote stays still.
		if (target?.closest("[data-remote]")) return touch ? undefined : rest()
		if (e.pointerType === "mouse") return press(140)
		// A finger. In the room it does what it always did; on the picture it points.
		if (touch || !g.live || !target || !picture()?.contains(target)) return
		const r = origin()
		const [x, y] = [e.clientX - r.left, e.clientY - r.top]
		touch = {
			id: e.pointerId,
			x,
			y,
			fx: x,
			fy: y,
			drags: false,
			since: 0,
			lift: 0,
		}
		Object.assign(cursor, { x, y, here: true, tap: true })
		clearTimeout(after)
		clearTimeout(idle)
		clearTimeout(pressed)
		item = null
		set("over", false)
		set("out", false)
		over(itemAt(x, y), true)
		pressItem(item)
		set("hold", false)
		set("press", true)
		show(true)
		kick()
	}
	const onTouchMove = (e: PointerEvent) => {
		if (!touch || e.pointerId !== touch.id) return
		const r = origin()
		touch.fx = e.clientX - r.left
		touch.fy = e.clientY - r.top
		// A press that moves is a drag from here on. One that stays put keeps pointing where it landed.
		if (!touch.drags) {
			if (Math.hypot(touch.fx - touch.x, touch.fy - touch.y) <= DRAG) return
			touch.drags = true
			pressItem(null)
			touch.since = performance.now()
			set("hold", true)
			set("press", false)
		}
		follow()
		kick()
	}
	const onUp = (e: PointerEvent) => {
		if (!touch || e.pointerId !== touch.id) return
		const dragged = touch.drags
		touch = null
		pressItem(null)
		// Letting go is OK on the item the ring is over. The browser's own click, if one follows, would be a second
		// OK, or after a drag an OK on what is under the finger: it is dropped. After a plain tap on no item it is
		// let through: it is a press beside the menu, which closes it.
		const target = shown && item?.isConnected ? item : null
		owed = Boolean(target) || dragged
		chosen = target
		set("hold", false)
		if (target) {
			press(160)
			ours = true
			target.click()
			ours = false
		} else set("press", false)
		clearTimeout(after)
		after = setTimeout(
			rest,
			target ? AFTER.chosen : dragged ? AFTER.dragged : AFTER.tapped,
		)
	}
	const onCancel = (e: PointerEvent) => {
		if (!touch || e.pointerId !== touch.id) return
		touch = null
		pressItem(null)
		set("hold", false)
		set("press", false)
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
	/**
	 * The browser's mouse press after a touch on the picture gives the browser's focus to what is under the finger.
	 * When the touch changed the screen, that is another screen's key by then, or none: it must not take the focus,
	 * least of all from the search screen's line, which a phone's keyboard hangs on.
	 */
	const onMouseDown = (e: MouseEvent) => {
		if (ours || !owed || !e.isTrusted) return
		const target = e.target instanceof Node ? e.target : null
		if (chosen?.isConnected && target && chosen.contains(target)) return
		e.preventDefault()
	}
	/** No menu and no callout under a finger that is held. */
	const onMenu = (e: Event) => {
		if (lastType !== "mouse") e.preventDefault()
	}
	const onKey = (e: KeyboardEvent) => {
		// A click that follows a key is the key's own.
		owed = false
		if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key !== "Shift") show(false)
	}

	const refresh = () => {
		const g = scene()
		const root = els.root.current
		// The system cursor is hidden over the picture only while the TV draws its own (living-room.css).
		if (root) root.dataset.pointing = g?.live ? "live" : "idle"
		if (!g?.live) {
			touch = null
			pressItem(null)
			set("hold", false)
			set("press", false)
			clearTimeout(after)
			item = null
			show(false)
		}
		kick()
	}

	const root = els.root.current
	// On the window, not on the room: the cursor leaving the room (for the site's header or dock) rests the Remote.
	window.addEventListener("pointermove", onMove)
	// Every scroll, the room's and the page's: a scroll event doesn't bubble, so it is caught on its way down.
	document.addEventListener("scroll", onScroll, {
		capture: true,
		passive: true,
	})
	window.addEventListener("pointerdown", onDown)
	window.addEventListener("pointermove", onTouchMove)
	window.addEventListener("pointerup", onUp)
	window.addEventListener("pointercancel", onCancel)
	root?.addEventListener("click", onClick, true)
	root?.addEventListener("mousedown", onMouseDown, true)
	root?.addEventListener("contextmenu", onMenu)
	document.documentElement.addEventListener("mouseleave", rest)
	window.addEventListener("blur", rest)
	window.addEventListener("keydown", onKey)
	refresh()

	return {
		refresh,
		stop() {
			// A finger still down loses its release with the listeners: its item lets go of the press now.
			pressItem(null)
			window.removeEventListener("pointermove", onMove)
			document.removeEventListener("scroll", onScroll, { capture: true })
			window.removeEventListener("pointerdown", onDown)
			window.removeEventListener("pointermove", onTouchMove)
			window.removeEventListener("pointerup", onUp)
			window.removeEventListener("pointercancel", onCancel)
			root?.removeEventListener("click", onClick, true)
			root?.removeEventListener("mousedown", onMouseDown, true)
			root?.removeEventListener("contextmenu", onMenu)
			document.documentElement.removeEventListener("mouseleave", rest)
			window.removeEventListener("blur", rest)
			window.removeEventListener("keydown", onKey)
			cancelAnimationFrame(raf)
			clearTimeout(idle)
			clearTimeout(after)
			clearTimeout(pressed)
			if (root) delete root.dataset.pointing
		},
	}
}
