// Whether the person's pointer can't hover (a phone or tablet). The server and the first client render answer no, so
// server HTML never depends on it; the real answer arrives once the browser is idle after hydration. The CSS variants
// `can-hover` and `touch` in tailwind.css ask the same media query.
import { useSyncExternalStore } from "react"

const QUERY = "(hover: hover) and (pointer: fine)"

let touch = false
let started = false
const listeners = new Set<() => void>()

function start() {
	if (started) return
	started = true
	const media = window.matchMedia(QUERY)
	const read = () => {
		if (touch === !media.matches) return
		touch = !media.matches
		for (const listener of listeners) listener()
	}
	if ("requestIdleCallback" in window) window.requestIdleCallback(read, { timeout: 2000 })
	else setTimeout(read, 200)
	media.addEventListener("change", read)
}

function subscribe(listener: () => void) {
	listeners.add(listener)
	start()
	return () => {
		listeners.delete(listener)
	}
}

export const useTouchPointer = () =>
	useSyncExternalStore(
		subscribe,
		() => touch,
		() => false,
	)
