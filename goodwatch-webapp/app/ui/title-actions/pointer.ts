// Whether the person's pointer can't hover (a phone or tablet). The server and the first client render answer no, so
// server HTML never depends on it; the real answer arrives once the browser is idle after hydration, as a transition,
// so it never interrupts a part of the page that is still hydrating. The CSS variants `can-hover` and `touch` in
// tailwind.css ask the same media query.
import { startTransition, useEffect, useState } from "react"

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
		startTransition(() => {
			for (const listener of listeners) listener()
		})
	}
	if ("requestIdleCallback" in window) window.requestIdleCallback(read, { timeout: 2000 })
	else setTimeout(read, 200)
	media.addEventListener("change", read)
}

export function useTouchPointer() {
	const [value, setValue] = useState(false)
	useEffect(() => {
		const listener = () => setValue(touch)
		listeners.add(listener)
		start()
		// For a card that mounts after the answer arrived.
		if (touch) startTransition(listener)
		return () => {
			listeners.delete(listener)
		}
	}, [])
	return value
}
