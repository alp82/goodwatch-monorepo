// Runs callbacks at the first sign that a person uses the page: a pointer move or press, a key, a scroll. For code
// that is needed only after an interaction (a menu, a sheet) and should be there by the first click, without being part
// of the first view: a visitor who only reads the page, or a crawler, never requests it.

const EVENTS = ["pointermove", "pointerdown", "touchstart", "keydown", "wheel", "scroll"] as const
const OPTIONS = { capture: true, passive: true } as const

let happened = false
let listening = false
const waiting = new Set<() => void>()

function onEvent() {
	happened = true
	for (const event of EVENTS) window.removeEventListener(event, onEvent, OPTIONS)
	const callbacks = [...waiting]
	waiting.clear()
	for (const callback of callbacks) callback()
}

/** Calls `callback` once, at the first interaction with the page, or at once when there has been one. Browser only. */
export function onFirstInteraction(callback: () => void): void {
	if (happened) {
		callback()
		return
	}
	waiting.add(callback)
	if (listening) return
	listening = true
	for (const event of EVENTS) window.addEventListener(event, onEvent, OPTIONS)
}
