// Leaving the living room through its TV (#232): the View Transitions API grows the TV screen into the window
// while the URL changes to the real page, and browser Back shrinks the page into the same TV screen again. The
// router replays the transition on Back because the forward navigation asked for one. With reduced motion, or
// without View Transitions, both ways are plain navigation.
//
// The animations live in `main.css` (`html[data-tv-transition]`), not in the living room's stylesheet, because
// the living room's stylesheet is gone by the time the page it opens animates in. Only `clip-path` on the
// transition's snapshots animates, once, so the rendering budget from #190 holds. Nothing here depends on the
// living room's path, so it keeps working when the room moves to `/` (#234).
import { useNavigate, useNavigationType } from "@remix-run/react"
import { useCallback, useEffect } from "react"

/** Marks the TV's screen in either scene, so its box can be measured. */
export const TV_SCREEN_ATTR = "data-tv-screen"

const LEFT_KEY = "living-room:left-through-tv"
const MAX_WAIT_MS = 10_000

type Direction = "out" | "in"

function canAnimate() {
	return (
		typeof document !== "undefined" &&
		typeof document.startViewTransition === "function" &&
		!window.matchMedia("(prefers-reduced-motion: reduce)").matches
	)
}

function tvInset(): string | null {
	const tv = document.querySelector(`[${TV_SCREEN_ATTR}]`)
	if (!tv) return null
	const b = tv.getBoundingClientRect()
	if (b.width === 0 || b.height === 0) return null
	const W = document.documentElement.clientWidth
	const H = window.innerHeight
	const px = (n: number) => `${Math.max(0, Math.round(n))}px`
	return `inset(${px(b.top)} ${px(W - b.right)} ${px(H - b.bottom)} ${px(b.left)} round 3px)`
}

let clearTimer: ReturnType<typeof setTimeout> | undefined
let clearListener: ((e: AnimationEvent) => void) | undefined

/** Points the transition's CSS at the TV's box until its animation ends. */
function mark(direction: Direction, inset: string) {
	const html = document.documentElement
	const clear = () => {
		clearTimeout(clearTimer)
		if (clearListener) html.removeEventListener("animationend", clearListener)
		clearListener = undefined
		delete html.dataset.tvTransition
		html.style.removeProperty("--tv-inset")
	}
	clear()
	html.style.setProperty("--tv-inset", inset)
	html.dataset.tvTransition = direction
	clearListener = (e) => {
		if (e.animationName.startsWith("living-room-tv-")) clear()
	}
	html.addEventListener("animationend", clearListener)
	// The transition waits for the page's data, so this only catches a transition that never ran.
	clearTimer = setTimeout(clear, MAX_WAIT_MS)
}

type Left = { inset: string; w: number; h: number }

/** Keeps the TV's box from leaving, so Back shrinks into exactly that box while the window keeps its size. */
function remember(left: Left | null) {
	try {
		if (left) sessionStorage.setItem(LEFT_KEY, JSON.stringify(left))
		else sessionStorage.removeItem(LEFT_KEY)
	} catch {
		// Without storage, Back still works; it just doesn't shrink into the TV.
	}
}

function leftThroughTv(): Left | null {
	try {
		const raw = sessionStorage.getItem(LEFT_KEY)
		return raw ? (JSON.parse(raw) as Left) : null
	} catch {
		return null
	}
}

/** Navigates out of the living room, growing the TV into the window when motion is allowed. */
export function useLeaveThroughTv() {
	const navigate = useNavigate()
	return useCallback(
		(href: string) => {
			const inset = canAnimate() ? tvInset() : null
			if (!inset) {
				remember(null)
				navigate(href)
				return
			}
			mark("out", inset)
			remember({ inset, w: window.innerWidth, h: window.innerHeight })
			navigate(href, { viewTransition: true })
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
		const left = navigationType === "POP" ? leftThroughTv() : null
		remember(null)
		if (!left || !canAnimate()) return
		const sameWindow =
			left.w === window.innerWidth && left.h === window.innerHeight
		const inset = sameWindow ? left.inset : tvInset()
		if (inset) mark("in", inset)
	}, [])
}
