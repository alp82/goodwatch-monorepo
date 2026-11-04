// Going from a title page into one of its sub-pages (Fingerprint, Tropes, At a glance) and back. The sub-page keeps
// the title page's frame (SubPageFrame.tsx): the bar and the rail hold still while the main column changes, so going
// in reads as moving into one part of the same page. One View Transition does it, which the router starts on the way
// in and replays on Back (transition-css.ts); html[data-sub-transition] says the direction. Only transform and
// opacity animate, and with reduced motion nothing does.
// Back restores the title page as it was left: the UI state kept per history entry (useKeptState) and the scroll,
// anchored on the link that was clicked (its id and its distance from the window's top), not on a raw scrollY,
// because sections below the fold lay out late.
import { useLocation, useNavigationType } from "@remix-run/react"
import { type Dispatch, type SetStateAction, useEffect, useState } from "react"
import { useHydrated } from "~/utils/hydrated"
import { TRANSITION_CSS } from "./transition-css"

export const reducedMotion = () =>
	typeof window !== "undefined" &&
	window.matchMedia("(prefers-reduced-motion: reduce)").matches

/** Whether the transition runs: View Transitions are there and motion is welcome. */
export const canAnimate = () =>
	typeof document !== "undefined" &&
	typeof document.startViewTransition === "function" &&
	!reducedMotion()

// ---- History entries ---------------------------------------------------------------------------------------------

/** The router's key of this history entry. */
export const entryKey = () =>
	(window.history.state as { key?: string } | null)?.key ?? "default"
/** The router's count of this tab's history entries. */
export const entryIdx = () =>
	(window.history.state as { idx?: number } | null)?.idx ?? 0

// ---- UI state kept per history entry -----------------------------------------------------------------------------

const KEPT = "title-kept:"

function readKept<T>(key: string, name: string): T | null {
	try {
		const raw = sessionStorage.getItem(`${KEPT}${key}:${name}`)
		return raw ? (JSON.parse(raw) as T) : null
	} catch {
		return null
	}
}

function writeKept(key: string, name: string, value: unknown) {
	try {
		sessionStorage.setItem(`${KEPT}${key}:${name}`, JSON.stringify(value))
	} catch {}
}

/**
 * useState that the history entry keeps: Back (or Forward) to this entry starts from what it held when it was left.
 * A fresh visit, a reload and the server's HTML start from `initial`.
 */
export function useKeptState<T>(
	name: string,
	initial: T,
): [T, Dispatch<SetStateAction<T>>] {
	const { key } = useLocation()
	const type = useNavigationType()
	const hydrated = useHydrated()
	const [value, setValue] = useState<T>(
		() =>
			(hydrated && type === "POP" ? readKept<T>(key, name) : null) ?? initial,
	)
	useEffect(() => writeKept(key, name, value), [key, name, value])
	return [value, setValue]
}

// ---- The trip: what the title page was when the sub-page opened ------------------------------------------------

export interface Trip {
	/** The title page's history entry. */
	fromKey: string
	fromIdx: number
	/** The title page's address (path and search). */
	from: string
	/** The sub-page's path. */
	to: string
	/** The element the place is kept by: its id and its distance from the window's top. */
	anchorId: string
	anchorTop: number
	scrollY: number
}

const TRIP = "sub-page-trip"

export function readTrip(): Trip | null {
	try {
		const raw = sessionStorage.getItem(TRIP)
		return raw ? (JSON.parse(raw) as Trip) : null
	} catch {
		return null
	}
}

function writeTrip(trip: Trip) {
	try {
		sessionStorage.setItem(TRIP, JSON.stringify(trip))
	} catch {}
}

/** Remembers the title page as it is, for the way back. */
export function startTrip(to: string, anchor: HTMLElement): Trip {
	const trip: Trip = {
		fromKey: entryKey(),
		fromIdx: entryIdx(),
		from: window.location.pathname + window.location.search,
		to: new URL(to, window.location.href).pathname,
		anchorId: anchor.id,
		anchorTop: anchor.getBoundingClientRect().top,
		scrollY: window.scrollY,
	}
	writeTrip(trip)
	return trip
}

// ---- Scroll restore by anchor --------------------------------------------------------------------------------

let restoreRun = 0
const STOPS = ["wheel", "touchstart", "keydown", "pointerdown"]

/**
 * Puts the anchor back at its distance from the window's top, now and for the next second and a half (sections that
 * lay out late, data that arrives from the cache), until the person scrolls themselves.
 */
export function restoreAnchor(
	anchorId: string,
	top: number,
	fallbackY: number,
) {
	const run = ++restoreRun
	const apply = () => {
		if (run !== restoreRun) return
		const el = anchorId ? document.getElementById(anchorId) : null
		if (!el) {
			if (Math.abs(window.scrollY - fallbackY) > 0.5)
				window.scrollTo({ top: fallbackY, behavior: "instant" })
			return
		}
		const d = el.getBoundingClientRect().top - top
		if (Math.abs(d) > 0.5)
			window.scrollTo({ top: window.scrollY + d, behavior: "instant" })
	}
	const stop = () => {
		restoreRun++
		for (const t of STOPS) window.removeEventListener(t, stop, true)
	}
	for (const t of STOPS) window.addEventListener(t, stop, true)
	apply()
	queueMicrotask(apply)
	let frames = 0
	const tick = () => {
		if (run !== restoreRun) return
		apply()
		if (++frames < 90) requestAnimationFrame(tick)
		else stop()
	}
	requestAnimationFrame(tick)
}

/** Lets a running restore go (find lands somewhere else on the page). */
export function stopRestore() {
	restoreRun++
}

// ---- A sub-page's rail goes to one section of the title page ----------------------------------------------------

const JUMP = "sub-page-jump"

/** Asks the title page at `path` to land on the section `id` (not where it was left) when it comes up next. */
export function writeJump(path: string, id: string) {
	try {
		sessionStorage.setItem(JUMP, JSON.stringify({ path, id }))
	} catch {}
}

/** The section the title page at `path` should land on, once (it is forgotten as it is read). */
export function takeJump(path: string): string | null {
	try {
		const raw = sessionStorage.getItem(JUMP)
		if (!raw) return null
		sessionStorage.removeItem(JUMP)
		const j = JSON.parse(raw) as { path: string; id: string }
		return j.path === path ? j.id : null
	} catch {
		return null
	}
}

// ---- Marking the transition ------------------------------------------------------------------------------------

export function ensureTransitionCss() {
	if (
		typeof document === "undefined" ||
		document.getElementById("sub-page-transition-css")
	)
		return
	const style = document.createElement("style")
	style.id = "sub-page-transition-css"
	style.textContent = TRANSITION_CSS
	document.head.appendChild(style)
}

const transitionRuns = () =>
	document
		.getAnimations()
		.some((a) =>
			((a.effect as KeyframeEffect | null)?.pseudoElement ?? "").startsWith(
				"::view-transition",
			),
		)

let watchFrame: number | undefined

export function unmarkTransition() {
	if (watchFrame !== undefined) cancelAnimationFrame(watchFrame)
	watchFrame = undefined
	delete document.documentElement.dataset.subTransition
}

/** Points the transition's CSS at the way in or out, until it has run. */
export function markTransition(dir: "in" | "out") {
	ensureTransitionCss()
	unmarkTransition()
	document.documentElement.dataset.subTransition = dir
	// The router starts the transition once the next page's data is there; the mark goes once it has run.
	const started = performance.now()
	let seen = false
	const tick = () => {
		const runs = transitionRuns()
		if (runs) seen = true
		if ((seen && !runs) || performance.now() - started > 10_000)
			return unmarkTransition()
		watchFrame = requestAnimationFrame(tick)
	}
	watchFrame = requestAnimationFrame(tick)
}
