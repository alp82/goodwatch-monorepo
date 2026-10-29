// Whether a guest's start page plays its opening (the boot, then the header sliding down): once per browser session,
// decided before the first paint, so the page cache keeps one HTML for every guest and a returning visitor never sees
// a frame of it.
//
// The opening is CSS from the first paint (opening.css). The gate is a hidden checkbox, first in the stage's HTML, and
// the inline script right after it (GATE_SCRIPT): on the session's first load the script notes the visit and leaves
// the box unticked (the opening plays); on later loads it ticks the box, and every opening rule is keyed on an
// unticked box, so the assembled page shows at once. A checkbox's checked state is a property, not an attribute, so
// hydration sees nothing new (an attribute on <html> made React warn). Storage that throws plays the opening.
//
// The script also makes a tap or a key anywhere skip to the hand-off, before any of the app's scripts run: it moves
// the opening's CSS animations forward to the hand-off's start (never back), and lets the event through to the page.
//
// A client-side visit (a link to / from another page) never plays it: the visitor has seen the site already, and the
// header is on screen. The stage ticks the box before that first paint (`skipOnClientMount`).

/** The gate checkbox's id: opening.css keys every rule on it. */
export const BOOT_GATE_ID = "start-boot-gate"

/** The session's mark: set on the first start page load of a browser session. */
export const BOOT_SEEN_KEY = "gw-start-boot-seen"

/** When the hand-off starts, from the first paint (ms): opening.css's delays, and the skip's target. */
export const HANDOFF_MS = 1400
export const HANDOFF_REDUCED_MS = 600

/** The opening's keyframes (opening.css) and the boot's own (living-room/intro/boot.css), which a skip moves on. */
export const OPENING_ANIMATION = /^(start-open-|boot-)/

/** What the gate decided, on the checkbox (an expando): the stage's client code reads it. */
export const GATE_MARK = "__startBoot"

export type BootDecision = "play" | "skip"

type SessionStore = Pick<Storage, "getItem" | "setItem">

/** The gate's decision for a page load, from the session's storage; notes the visit when it plays. */
export function bootDecision(storage: () => SessionStore | null): BootDecision {
	try {
		const store = storage()
		if (!store) return "play"
		if (store.getItem(BOOT_SEEN_KEY)) return "skip"
		store.setItem(BOOT_SEEN_KEY, "1")
		return "play"
	} catch {
		return "play"
	}
}

/**
 * The inline script, plain ES5, right after the gate checkbox in the server's HTML. It is `bootDecision`, then the
 * skip listener (boot-gate.test.ts runs both against the same cases).
 */
export const GATE_SCRIPT = `(function(){var d=document,me=d.currentScript,box=me&&me.previousElementSibling,v="play";try{var s=sessionStorage;if(s.getItem(${JSON.stringify(BOOT_SEEN_KEY)}))v="skip";else s.setItem(${JSON.stringify(BOOT_SEEN_KEY)},"1")}catch(e){}if(!box)return;box.checked=v==="skip";box.${GATE_MARK}=v;if(v==="skip"||!d.getAnimations)return;var w=window,at=w.matchMedia&&w.matchMedia("(prefers-reduced-motion: reduce)").matches?${HANDOFF_REDUCED_MS}:${HANDOFF_MS},re=${OPENING_ANIMATION.toString()};function off(){w.removeEventListener("pointerdown",skip,true);w.removeEventListener("keydown",skip,true)}function skip(){off();d.getAnimations().forEach(function(a){var t=a.currentTime;if(re.test(a.animationName||"")&&t!==null&&t<at)a.currentTime=at})}w.addEventListener("pointerdown",skip,true);w.addEventListener("keydown",skip,true);setTimeout(off,at+1000)})()`

type GateBox = HTMLInputElement & { [GATE_MARK]?: BootDecision }

/**
 * On a client-side mount (no inline script ran for this box), before the first paint: no opening, and the session
 * counts as seen. A box the script already decided is left alone.
 */
export function skipOnClientMount(
	box: HTMLInputElement | null,
	storage: () => SessionStore | null,
) {
	const gate = box as GateBox | null
	if (!gate || gate[GATE_MARK]) return
	bootDecision(storage)
	gate.checked = true
	gate[GATE_MARK] = "skip"
}

/** The browser's session storage, or null where reading it throws. */
export function sessionStore(): SessionStore | null {
	try {
		return window.sessionStorage
	} catch {
		return null
	}
}
