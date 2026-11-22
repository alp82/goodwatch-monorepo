// A title page is in the browser before the app's script is. A tap on a control in that time reaches no handler: the
// measurements for issue #420 show that every lost tap came before React listened to the document, and that a tap
// after that moment is handled by React itself, which hydrates what was tapped first.
//
// So a tiny inline script in the document (ui/details/Details.tsx) remembers a tap on a control that is marked with
// `data-replay-tap`, and the control does it once it is mounted (useReplayedTap.ts): with a click on the same
// element, so the press goes through the control's own handler like any other. While a tap waits, the browser entry
// hydrates the page in one go, so the tap is done in the task that starts the app.
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
	/** A route may identify a button by its visible action and state. */
	keyFor?: (el: TapElement) => string | null
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
	/** The script's window click listener. Explore uses the bubble phase to honor an already handled press. */
	on: (event: unknown) => void
}

/** Browse's ordinary buttons need JavaScript; links, forms and native disclosures already work before hydration. */
export const EXPLORE_BUTTON_GROUP = "explore-button"
const BUTTON_SELECTOR =
	'main button[type="button"]:not(:disabled,[aria-disabled="true"],[popovertarget],[commandfor],[data-replay-tap])'

/**
 * The title-page recorder uses explicit marks. Explore uses the same one-tap handoff for a plain button in its
 * main content. At replay its element, label, toggle state and current query must still describe the same action.
 */
function recorder(explore: boolean) {
	const selector = explore ? BUTTON_SELECTOR : `[${REPLAY_TAP_ATTRIBUTE}]`
	const capture = explore ? "false" : "true"
	const keyFor = [
		`keyFor:function(el){if(!el.matches(${JSON.stringify(selector)})||el.closest("a,summary,[inert],[aria-disabled=true]"))return null;`,
		'var label=el.getAttribute("aria-label")||el.textContent||el.getAttribute("title");if(!label)return null;',
		`return "${EXPLORE_BUTTON_GROUP}:"+JSON.stringify([w.location.search,label,el.getAttribute("aria-pressed"),el.getAttribute("aria-expanded")])},`,
	].join("")
	return [
		`(function(w){if(w.${REPLAY_TAP_KEY})return;`,
		`var M="${REPLAY_TAP_ATTRIBUTE}",P="${REPLAY_PENDING_ATTRIBUTE}",`,
		`T=w.${REPLAY_TAP_KEY}={path:w.location.pathname,taps:{},live:false,`,
		explore ? keyFor : "",
		"drop:function(g){var t=T.taps[g];if(t){delete T.taps[g];clearTimeout(t.timer);t.el.removeAttribute(P)}",
		`T.live&&!Object.keys(T.taps).length&&w.removeEventListener("click",T.on,${capture})},`,
		`on:function(e){var el=e.isTrusted&&${explore ? "!e.defaultPrevented&&" : ""}e.target&&e.target.closest&&e.target.closest(${JSON.stringify(selector)});if(!el)return;`,
		explore ? "var k=T.keyFor(el);if(!k)return;" : "var k=el.getAttribute(M);",
		`var g=k.split(":")[0],t=T.taps[g],again=t&&t.el===el&&${explore ? '(el.hasAttribute("aria-pressed")||el.hasAttribute("aria-expanded"))' : 'el.hasAttribute("aria-pressed")'};`,
		"T.drop(g);if(T.live||again)return;",
		'el.setAttribute(P,"");',
		"T.taps[g]={key:k,el:el,time:Date.now(),timer:setTimeout(function(){T.drop(g)},1e4)}}};",
		`w.addEventListener("click",T.on,${capture})})(window)`,
	].join("")
}

export const REPLAY_TAP_SCRIPT = recorder(false)
export const EXPLORE_BUTTON_SCRIPT = recorder(true)

/** The script's record, or null on a page without the script. */
export function readTapStore(win: unknown): TapStore | null {
	const store = (win as Record<string, unknown> | null)?.[REPLAY_TAP_KEY] as TapStore | undefined
	return store && typeof store.drop === "function" && store.taps ? store : null
}

/**
 * Ends the recording. Call it in the task that makes React listen to the document (entry.client.tsx), so that no tap
 * falls between the two. The listener stays until the waiting taps are done or forgotten. In that time it only
 * forgets the tap of a group whose control is tapped again.
 *
 * Answers whether a tap waits. A visitor is waiting for the page then, so the caller hydrates it in one go.
 */
export function stopRecordingTaps(win: unknown): boolean {
	const store = readTapStore(win)
	if (!store) return false
	store.live = true
	// No group has this name: the call only lets the listener go when no tap waits.
	store.drop("")
	return Object.keys(store.taps).length > 0
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
export function claimTap(win: unknown, group: string, context: ClaimContext): TapElement | null {
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
		(store.keyFor ? store.keyFor(tap.el) : tap.el.getAttribute(REPLAY_TAP_ATTRIBUTE)) === tap.key &&
		(context.near ? context.near(tap.el) : true)
	return valid ? tap.el : null
}
