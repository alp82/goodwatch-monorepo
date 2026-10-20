// Leaving the living room through its TV (#232), and coming back into it.
//
// Out: the room zooms into the TV until its picture is the window, with the next page already in the picture, and
// four amber brackets ride from the picture's edge to the window's, where they fold into the TV button (the way
// back, TvWayBack.tsx). In: the same backwards, into the same TV screen. The owner chose this motion from nine
// built against the real pages (branch `prototype/tv-expand-transitions`, "9 Lean in, light").
//
// It is one View Transition. The router starts it when the next page's data is there and replays it on Back
// because the forward navigation asked for one. Until it starts, the brackets stand at the picture's edge and
// breathe, and Escape calls the page off. With reduced motion, or without View Transitions, both ways are plain
// navigation; the way back is remembered all the same.
//
// The animations live in `main.css` (`html[data-tv-transition]`), not in the living room's stylesheet, because
// the living room's stylesheet is gone by the time the page it opens animates in. This file only hands them the
// TV's box as custom properties. Only `transform`, `clip-path` and `opacity` animate, on the transition's
// snapshots and on the four brackets, once, so the rendering budget from #190 holds. Nothing here depends on the
// living room's path.
import { useLocation, useNavigate, useNavigationType } from "@remix-run/react"
import { useCallback, useEffect } from "react"
import { warmTvWayBack } from "./TvWayBackHost"
import { TRIP_KEY, TV_BACK_ATTR, TV_BRACKET_ATTR, TV_PROPERTIES, type TvBox, type TvTrip, parseTrip, tvProperties } from "./tv-way-back"

/** Marks the TV's screen in either scene, so its box can be measured. */
export const TV_SCREEN_ATTR = "data-tv-screen"

const MAX_WAIT_MS = 10_000

type Direction = "out" | "in"

function canAnimate() {
	return (
		typeof document !== "undefined" &&
		typeof document.startViewTransition === "function" &&
		!window.matchMedia("(prefers-reduced-motion: reduce)").matches
	)
}

/** The router's count of this tab's history entries. */
export const historyIdx = () => (window.history.state as { idx?: number } | null)?.idx ?? 0

function tvBox(): TvBox | null {
	const tv = document.querySelector(`[${TV_SCREEN_ATTR}]`)
	if (!tv) return null
	const b = tv.getBoundingClientRect()
	if (b.width === 0 || b.height === 0) return null
	return { left: b.left, top: b.top, width: b.width, height: b.height }
}

export function readTrip(): TvTrip | null {
	try {
		return parseTrip(sessionStorage.getItem(TRIP_KEY))
	} catch {
		return null
	}
}

export function writeTrip(trip: TvTrip | null) {
	try {
		if (trip) sessionStorage.setItem(TRIP_KEY, JSON.stringify(trip))
		else sessionStorage.removeItem(TRIP_KEY)
	} catch {
		// Without storage, leaving and Back still work; only the TV button and the way into the TV are lost.
	}
}

// ---- The brackets: four elements of their own in the document, so the transition moves each and stretches none.
// `main.css` places them: at the picture's edge while the room is in the document, at the window's edge once it
// is not. On the way back the TV button's code puts them there (TvWayBack.tsx), so they are found in the document
// and not kept in here.

const brackets = () => Array.from(document.querySelectorAll<HTMLElement>(`[${TV_BRACKET_ATTR}]`))
let bracketTimer: ReturnType<typeof setTimeout> | undefined

function showBrackets() {
	removeBrackets()
	for (const corner of [0, 1, 2, 3]) {
		const el = document.createElement("div")
		el.setAttribute(TV_BRACKET_ATTR, String(corner))
		el.setAttribute("aria-hidden", "true")
		// Each travels on its own in the transition.
		el.style.viewTransitionName = `living-room-tv-bracket-${corner}`
		document.body.appendChild(el)
	}
}

function removeBrackets() {
	clearTimeout(bracketTimer)
	for (const el of brackets()) el.remove()
}

/** On the page the brackets fold into the TV button, or fade where there is none. */
function foldBrackets() {
	const els = brackets()
	if (!els.length) return
	const target = Array.from(document.querySelectorAll(`[${TV_BACK_ATTR}]`))
		.map((el) => el.getBoundingClientRect())
		.find((b) => b.width > 0 && b.height > 0)
	// They stand where the stylesheet put them, by their own edges. From here on they are placed by hand.
	for (const el of els) {
		const b = el.getBoundingClientRect()
		el.style.viewTransitionName = ""
		Object.assign(el.style, { left: `${b.left}px`, top: `${b.top}px`, right: "auto", bottom: "auto", width: `${b.width}px`, height: `${b.height}px` })
	}
	void document.body.offsetWidth
	const arm = 9
	els.forEach((el, corner) => {
		el.style.transition = `left .45s, top .45s, width .45s, height .45s, opacity .3s linear ${target ? ".3s" : "0s"}`
		el.style.transitionTimingFunction = "cubic-bezier(0.65, 0, 0.35, 1)"
		if (target) {
			el.style.width = el.style.height = `${arm}px`
			el.style.left = `${corner % 2 === 0 ? target.left - 3 : target.right + 3 - arm}px`
			el.style.top = `${corner < 2 ? target.top - 3 : target.bottom + 3 - arm}px`
		}
		el.style.opacity = "0"
	})
	bracketTimer = setTimeout(() => {
		for (const el of els) el.remove()
	}, 700)
}

// ---- The mark: points the transition's CSS at the TV's box until its animation ends.

let clearTimer: ReturnType<typeof setTimeout> | undefined
let finishFrame: number | undefined
let endListener: ((e: AnimationEvent) => void) | undefined
let cancelListener: ((e: KeyboardEvent) => void) | undefined

function unmark() {
	const html = document.documentElement
	clearTimeout(clearTimer)
	if (finishFrame !== undefined) cancelAnimationFrame(finishFrame)
	finishFrame = undefined
	if (endListener) html.removeEventListener("animationend", endListener)
	if (cancelListener) window.removeEventListener("keydown", cancelListener, true)
	endListener = undefined
	cancelListener = undefined
	delete html.dataset.tvTransition
	for (const name of TV_PROPERTIES) html.style.removeProperty(name)
}

/** The transition has ended, or never ran. */
function finish(direction: Direction | null) {
	// The brackets first: they are measured where they stand, and the mark's properties give them their size.
	if (direction === "out") foldBrackets()
	else removeBrackets()
	unmark()
}

function finishAfterSnapshots(direction: Direction) {
	finishFrame = requestAnimationFrame(() => {
		// animationend precedes the browser releasing the snapshots. Removing the mark while they still
		// exist restores the UA's default crossfade and flashes the old room at its original size.
		if (transitionRuns()) finishAfterSnapshots(direction)
		else finish(direction)
	})
}

function mark(direction: Direction, box: TvBox) {
	const html = document.documentElement
	unmark()
	for (const [name, value] of Object.entries(tvProperties(box, { w: html.clientWidth, h: window.innerHeight }))) html.style.setProperty(name, value)
	html.dataset.tvTransition = direction
	// The room's animation is the one that runs the transition's whole length, both ways.
	endListener = (e) => {
		if (e.animationName === `living-room-tv-room-${direction}`) finishAfterSnapshots(direction)
	}
	html.addEventListener("animationend", endListener)
	// The transition waits for the page's data, so this only catches a transition that never ran.
	clearTimer = setTimeout(() => finish(null), MAX_WAIT_MS)
}

const transitionRuns = () => document.getAnimations().some((a) => ((a.effect as KeyframeEffect | null)?.pseudoElement ?? "").startsWith("::view-transition"))

/**
 * Navigates out of the living room: the room zooms into the TV when motion is allowed. `state` goes into the
 * new history entry's state: what the page should know about this arrival and a shared link must not carry.
 */
export function useLeaveThroughTv() {
	const navigate = useNavigate()
	// The room is still there and its address changed while a page was on its way: a key of the TV took the
	// page's place (Back, Home, another screen), so the way out is off, as after Escape.
	const { key } = useLocation()
	useEffect(() => {
		if (!cancelListener) return
		finish(null)
		writeTrip(null)
	}, [key])
	return useCallback(
		(href: string, state?: unknown) => {
			// A second press while the page is on its way changes nothing: the first is being answered.
			if (cancelListener) return
			const box = canAnimate() ? tvBox() : null
			writeTrip({
				idx: historyIdx(),
				to: new URL(href, window.location.href).pathname,
				box,
				w: window.innerWidth,
				h: window.innerHeight,
				// What the TV shows, for the TV button's picture: the file is in the browser's cache already.
				art: document.querySelector<HTMLImageElement>(`[${TV_SCREEN_ATTR}] img`)?.currentSrc || null,
				out: true,
			})
			warmTvWayBack()
			if (!box) {
				navigate(href, { state })
				return
			}
			mark("out", box)
			showBrackets()
			// While the page is on its way, Escape calls it off: the room has not gone anywhere yet.
			cancelListener = (e) => {
				if (e.key !== "Escape" || !document.querySelector(`[${TV_SCREEN_ATTR}]`)) return
				e.preventDefault()
				e.stopImmediatePropagation()
				finish(null)
				writeTrip(null)
				// The entry keeps what it held (the TV counts its own history there): only the page on its way goes.
				const state = (window.history.state as { usr?: unknown } | null)?.usr
				navigate(window.location.pathname + window.location.search + window.location.hash, { replace: true, preventScrollReset: true, state })
			}
			window.addEventListener("keydown", cancelListener, true)
			navigate(href, { viewTransition: true, state })
		},
		[navigate],
	)
}

/**
 * Back after leaving through the TV: points the replayed transition at the TV's box, so the page shrinks into
 * the same TV screen. It runs on mount, before the router lets the transition animate. The box from leaving is
 * exact while the window keeps its size; after a resize, the TV is measured where the scene just placed it.
 */
export function useReturnIntoTv() {
	const navigationType = useNavigationType()
	useEffect(() => {
		const trip = readTrip()
		// `out`: the person was on a page the TV opened. A page reached another way does not shrink into the TV.
		const back = Boolean(trip?.out && navigationType === "POP" && trip.idx === historyIdx())
		if (trip?.out) writeTrip({ ...trip, out: false })
		const sameWindow = trip?.w === window.innerWidth && trip?.h === window.innerHeight
		const box = back && trip?.box && canAnimate() ? (sameWindow ? trip.box : tvBox()) : null
		if (!box) {
			// The TV button's code may have put the brackets up for a way in that does not happen. Unless one is
			// running already: in development React runs this effect twice.
			if (!endListener) finish(null)
			return
		}
		// The TV button's code has marked the way in already, on `popstate`, so that the brackets were in the
		// page's picture. From here the mark is this file's: it is cleared when the animation ends.
		mark("in", box)
		// The router replays the transition only if it remembers the way out (it forgets with the tab's storage).
		// Without one, the marks and the brackets go now.
		const timer = setTimeout(() => {
			if (!transitionRuns()) finish("in")
		}, 300)
		return () => clearTimeout(timer)
	}, [])
}
