// A title page is in the browser before the app's script is. A tap on a control in that time reaches no handler: the
// measurements for issue #420 show that every lost tap came before React listened to the document, and that a tap
// after that moment is handled by React itself, which hydrates what was tapped first.
//
// So a tiny inline script in the document (ui/details/Details.tsx) remembers a tap on a control that is marked with
// `data-replay-tap`, and the control does it once it is mounted (useReplayedTap.ts): with a click on the same
// element, so the press goes through the control's own handler like any other.
//
// A mark is `group` or `group:detail`, such as `want:off`, `offer:rent`, or `float:ep-1-1`:
// - The group names the control. One tap per group waits: a later tap in the group replaces the earlier one.
// - The whole mark is what the tap meant. A control whose mark is another one by the time it is ready, such as
//   Want to See that turned out to be on, doesn't get the tap.
//
// The rules, each with its reason:
// - A tap waits for 10 seconds. The slowest start of the app in the tap test is about 5 seconds, and something that
//   happens later than that is no longer the answer to the tap.
// - A second tap on a waiting toggle (a button with `aria-pressed`) takes the first one back. The mark on the
//   control goes away with it, so what is marked is what will happen.
// - Once React listens, the script records nothing. A tap on a marked control then goes to React, and a tap that
//   still waits for that control's group is forgotten, so nothing happens twice.
// - A tap is done once. It is forgotten when the control is no longer in the document, when the page is another
//   one, and when the control is more than a screen away from what the visitor is looking at.

/** The global the inline script writes to. */
export const REPLAY_TAP_KEY = "__gwTaps"

/** How long a tap waits for its control. The same number is written out in the script. */
export const REPLAY_TAP_EXPIRY_MS = 10_000

/** The attribute that names a control's tap. */
export const REPLAY_TAP_ATTRIBUTE = "data-replay-tap"

/** On a control whose tap waits. The style sheet shows it (main.css). React never renders it. */
export const REPLAY_PENDING_ATTRIBUTE = "data-replay-pending"

/** What the rules need of an element. */
export interface TapElement {
	isConnected: boolean
	getAttribute: (name: string) => string | null
	removeAttribute: (name: string) => void
	click: () => void
}

export interface PendingTap {
	/** The control's mark when it was tapped. */
	key: string
	el: TapElement
	/** Milliseconds since the epoch. */
	time: number
	timer: unknown
}

export interface TapStore {
	/** The path of the document that the taps belong to. */
	path: string
	/** The waiting taps by group. */
	taps: Record<string, PendingTap>
	/** True once React listens to the document. */
	live: boolean
	/**
	 * Forgets the group's tap and takes the mark off its control. Once React listens and no tap waits, it also takes
	 * the script's listener off the window.
	 */
	drop: (group: string) => void
	/** The script's click listener, on the window in the capture phase. */
	on: (event: unknown) => void
}

/**
 * The inline script. A plain string, so the server HTML and the hydrated document hold the same text, in syntax that
 * every browser the site supports can parse. It never stops an event and never prevents a default.
 */
export const REPLAY_TAP_SCRIPT = [
	`(function(w){if(w.${REPLAY_TAP_KEY})return;`,
	`var M="${REPLAY_TAP_ATTRIBUTE}",P="${REPLAY_PENDING_ATTRIBUTE}",`,
	`T=w.${REPLAY_TAP_KEY}={path:w.location.pathname,taps:{},live:false,`,
	"drop:function(g){var t=T.taps[g];if(t){delete T.taps[g];clearTimeout(t.timer);t.el.removeAttribute(P)}",
	'T.live&&!Object.keys(T.taps).length&&w.removeEventListener("click",T.on,true)},',
	'on:function(e){var el=e.isTrusted&&e.target&&e.target.closest&&e.target.closest("["+M+"]");if(!el)return;',
	'var k=el.getAttribute(M),g=k.split(":")[0],t=T.taps[g],again=t&&t.el===el&&el.hasAttribute("aria-pressed");',
	"T.drop(g);if(T.live||again)return;",
	'el.setAttribute(P,"");',
	"T.taps[g]={key:k,el:el,time:Date.now(),timer:setTimeout(function(){T.drop(g)},1e4)}}};",
	'w.addEventListener("click",T.on,true)})(window)',
].join("")

/** The script's record, or null on a page without the script. */
export function readTapStore(win: unknown): TapStore | null {
	const store = (win as Record<string, unknown> | null)?.[REPLAY_TAP_KEY] as
		| TapStore
		| undefined
	return store && typeof store.drop === "function" && store.taps ? store : null
}

/**
 * Ends the recording. Call it in the task that makes React listen to the document (entry.client.tsx), so that no tap
 * falls between the two. The listener stays until the waiting taps are done or forgotten. In that time it only
 * forgets the tap of a group whose control is tapped again.
 */
export function stopRecordingTaps(win: unknown): void {
	const store = readTapStore(win)
	if (!store) return
	store.live = true
	// No group has this name: the call only lets the listener go when no tap waits.
	store.drop("")
}

export interface ClaimContext {
	/** Milliseconds since the epoch. */
	now: number
	/** The path of the page that asks. */
	path: string
	/** Whether this control is the asking one. Another control of the same group leaves the tap alone. */
	accept?: (el: TapElement) => boolean
	/** Whether the visitor still has the control near the screen. */
	near?: (el: TapElement) => boolean
}

/**
 * The control that a waiting tap of the group is for, or null. The tap is taken out either way, except when the
 * asking control isn't the tapped one: a tap is done once at most.
 */
export function claimTap(
	win: unknown,
	group: string,
	context: ClaimContext,
): TapElement | null {
	const store = readTapStore(win)
	const tap = store?.taps[group]
	if (!store || !tap) return null
	if (context.accept && !context.accept(tap.el)) return null
	store.drop(group)
	const valid =
		store.live &&
		store.path === context.path &&
		context.now - tap.time <= REPLAY_TAP_EXPIRY_MS &&
		tap.el.isConnected &&
		tap.el.getAttribute(REPLAY_TAP_ATTRIBUTE) === tap.key &&
		(context.near ? context.near(tap.el) : true)
	return valid ? tap.el : null
}
