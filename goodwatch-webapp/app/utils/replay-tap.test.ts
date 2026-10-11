import assert from "node:assert/strict"
import { test } from "node:test"

const {
	REPLAY_PENDING_ATTRIBUTE,
	REPLAY_TAP_ATTRIBUTE,
	REPLAY_TAP_EXPIRY_MS,
	REPLAY_TAP_KEY,
	REPLAY_TAP_SCRIPT,
	claimTap,
	readTapStore,
	stopRecordingTaps,
} = await import("./replay-tap.ts")

// A stand-in for a marked control: its attributes, whether it is in the document, and how often it was clicked.
function control(mark: string, attributes: Record<string, string> = {}) {
	const held = new Map(
		Object.entries({ [REPLAY_TAP_ATTRIBUTE]: mark, ...attributes }),
	)
	const el = {
		isConnected: true,
		clicks: 0,
		hasAttribute: (name: string) => held.has(name),
		getAttribute: (name: string) => held.get(name) ?? null,
		setAttribute: (name: string, value: string) => void held.set(name, value),
		removeAttribute: (name: string) => void held.delete(name),
		click() {
			el.clicks += 1
		},
		// The control itself is what `closest` finds from anywhere inside it.
		closest: (selector: string) =>
			selector === `[${REPLAY_TAP_ATTRIBUTE}]` ? el : null,
	}
	return el
}
type Control = ReturnType<typeof control>

// Runs the inline script against a stand-in window, the way the browser runs it while it parses the document.
function runInlineScript(path = "/movie/603-the-matrix") {
	const listeners = new Set<(event: unknown) => void>()
	const timers = new Map<number, () => void>()
	let nextTimer = 1
	let clock = 1_000_000
	const win = {
		location: { pathname: path },
		addEventListener(
			type: string,
			listener: (event: unknown) => void,
			capture?: boolean,
		) {
			assert.equal(type, "click")
			assert.equal(capture, true)
			listeners.add(listener)
		},
		removeEventListener(_type: string, listener: (event: unknown) => void) {
			listeners.delete(listener)
		},
	}
	const run = () =>
		new Function(
			"window",
			"setTimeout",
			"clearTimeout",
			"Date",
			REPLAY_TAP_SCRIPT,
		)(
			win,
			(callback: () => void, ms: number) => {
				assert.equal(ms, REPLAY_TAP_EXPIRY_MS)
				timers.set(nextTimer, callback)
				return nextTimer++
			},
			(id: number) => void timers.delete(id),
			{ now: () => clock },
		)
	run()
	return {
		win,
		run,
		tap(el: Control | null, trusted = true) {
			let stopped = false
			const event = {
				isTrusted: trusted,
				target: el ?? { closest: () => null },
				stopPropagation: () => {
					stopped = true
				},
				preventDefault: () => {
					stopped = true
				},
			}
			for (const listener of [...listeners]) listener(event)
			assert.equal(stopped, false, "the script never stops an event")
		},
		advance(ms: number) {
			clock += ms
		},
		// The browser's timers: every one that is still set fires.
		expire() {
			for (const [id, callback] of [...timers]) {
				timers.delete(id)
				callback()
			}
		},
		listening: () => listeners.size,
		timers: () => timers.size,
		claim: (group: string, more: Record<string, unknown> = {}) =>
			claimTap(win, group, { now: clock, path, ...more }),
	}
}

const pending = (el: Control) => el.hasAttribute(REPLAY_PENDING_ATTRIBUTE)

test("a tap on a marked control waits, shows on the control, and is done once", () => {
	const page = runInlineScript()
	const rent = control("offer:rent")
	page.tap(rent)
	assert.equal(pending(rent), true)
	assert.equal(readTapStore(page.win)?.taps.offer.key, "offer:rent")

	stopRecordingTaps(page.win)
	assert.equal(page.listening(), 1, "the listener stays while a tap waits")
	assert.equal(page.claim("offer"), rent)
	assert.equal(pending(rent), false)
	assert.equal(page.timers(), 0)
	assert.equal(page.listening(), 0)
	assert.equal(page.claim("offer"), null, "the same tap is not done twice")
})

test("a tap elsewhere, and a click that script made, are not recorded", () => {
	const page = runInlineScript()
	const rent = control("offer:rent")
	page.tap(null)
	page.tap(rent, false)
	assert.deepEqual(readTapStore(page.win)?.taps, {})
	assert.equal(pending(rent), false)
})

test("the last tap of a group replaces the earlier one, and other groups keep theirs", () => {
	const page = runInlineScript()
	const rent = control("offer:rent")
	const buy = control("offer:buy")
	const want = control("want:off", { "aria-pressed": "false" })
	page.tap(rent)
	page.tap(want)
	page.tap(buy)
	assert.equal(pending(rent), false)
	assert.equal(pending(buy), true)
	assert.equal(pending(want), true)
	stopRecordingTaps(page.win)
	assert.equal(page.claim("offer"), buy)
	assert.equal(page.listening(), 1, "Want to See still waits")
	assert.equal(page.claim("want"), want)
	assert.equal(page.listening(), 0)
})

test("a second tap on a waiting toggle takes the first one back, a third one waits again", () => {
	const page = runInlineScript()
	const want = control("want:off", { "aria-pressed": "false" })
	page.tap(want)
	page.tap(want)
	assert.equal(pending(want), false)
	assert.deepEqual(readTapStore(page.win)?.taps, {})
	page.tap(want)
	assert.equal(pending(want), true)
	stopRecordingTaps(page.win)
	assert.equal(page.claim("want"), want)
})

test("a second tap on a waiting control that is no toggle still waits as one tap", () => {
	const page = runInlineScript()
	const next = control("row:next")
	page.tap(next)
	page.tap(next)
	assert.equal(pending(next), true)
	stopRecordingTaps(page.win)
	assert.equal(page.claim("row"), next)
	assert.equal(page.claim("row"), null)
})

test("a tap is forgotten after ten seconds, by the timer and by the claim", () => {
	const page = runInlineScript()
	const rent = control("offer:rent")
	page.tap(rent)
	page.advance(REPLAY_TAP_EXPIRY_MS + 1)
	page.expire()
	assert.equal(pending(rent), false)
	assert.deepEqual(readTapStore(page.win)?.taps, {})

	// A busy main thread can run the claim before the timer.
	const late = runInlineScript()
	const buy = control("offer:buy")
	late.tap(buy)
	stopRecordingTaps(late.win)
	late.advance(REPLAY_TAP_EXPIRY_MS + 1)
	assert.equal(late.claim("offer"), null)
	assert.equal(pending(buy), false)

	const inTime = runInlineScript()
	const stream = control("offer:flatrate")
	inTime.tap(stream)
	stopRecordingTaps(inTime.win)
	inTime.advance(REPLAY_TAP_EXPIRY_MS)
	assert.equal(inTime.claim("offer"), stream)
})

test("once React listens, a tap is not recorded and forgets the waiting tap of its group", () => {
	const page = runInlineScript()
	const want = control("want:off", { "aria-pressed": "false" })
	const rent = control("offer:rent")
	page.tap(want)
	page.tap(rent)
	stopRecordingTaps(page.win)
	// React handles this one.
	page.tap(want)
	assert.equal(pending(want), false)
	assert.equal(page.claim("want"), null)
	assert.equal(page.claim("offer"), rent, "another group's tap still waits")
	assert.equal(page.listening(), 0)

	const fresh = control("offer:buy")
	page.tap(fresh)
	assert.equal(pending(fresh), false)
})

test("the listener goes when React listens and no tap waits, or when the last waiting tap is forgotten", () => {
	const page = runInlineScript()
	stopRecordingTaps(page.win)
	assert.equal(page.listening(), 0)

	// A control that never mounts: its tap runs out.
	const waiting = runInlineScript()
	waiting.tap(control("offer:rent"))
	stopRecordingTaps(waiting.win)
	assert.equal(waiting.listening(), 1)
	waiting.expire()
	assert.equal(waiting.listening(), 0)
})

test("a tap whose control changed its meaning, left the document, or is far away is forgotten", () => {
	const changed = runInlineScript()
	const want = control("want:off", { "aria-pressed": "false" })
	changed.tap(want)
	stopRecordingTaps(changed.win)
	// The visitor's own data arrived: the title is on the Wishlist already.
	want.setAttribute(REPLAY_TAP_ATTRIBUTE, "want:on")
	assert.equal(changed.claim("want"), null)
	assert.equal(pending(want), false)

	const gone = runInlineScript()
	const cell = control("float:ep-1-1")
	gone.tap(cell)
	stopRecordingTaps(gone.win)
	cell.isConnected = false
	assert.equal(gone.claim("float"), null)

	const far = runInlineScript()
	const pillar = control("pillar:Energy")
	far.tap(pillar)
	stopRecordingTaps(far.win)
	assert.equal(far.claim("pillar", { near: () => false }), null)
	assert.equal(
		far.claim("pillar", { near: () => true }),
		null,
		"it was taken out",
	)
})

test("a tap from another page, or from before React listens, is not done", () => {
	const page = runInlineScript("/movie/603-the-matrix")
	const rent = control("offer:rent")
	page.tap(rent)
	stopRecordingTaps(page.win)
	assert.equal(
		page.claim("offer", { path: "/movie/604-the-matrix-reloaded" }),
		null,
	)
	assert.equal(pending(rent), false)

	const early = runInlineScript()
	const buy = control("offer:buy")
	early.tap(buy)
	assert.equal(early.claim("offer"), null)
})

test("a control that isn't the tapped one leaves the tap for its owner", () => {
	const page = runInlineScript()
	const castNext = control("row:next")
	page.tap(castNext)
	stopRecordingTaps(page.win)
	assert.equal(page.claim("row", { accept: () => false }), null)
	assert.equal(pending(castNext), true)
	assert.equal(
		page.claim("row", { accept: (el: unknown) => el === castNext }),
		castNext,
	)
})

test("the script runs once per document, and a page without it has nothing to do", () => {
	const page = runInlineScript()
	const store = readTapStore(page.win)
	page.run()
	assert.equal(readTapStore(page.win), store)
	assert.equal(page.listening(), 1)

	assert.equal(readTapStore({}), null)
	assert.equal(claimTap({}, "offer", { now: 0, path: "/" }), null)
	stopRecordingTaps({})
})

test("the script is small, names its global, and can't end a script tag", () => {
	assert.ok(REPLAY_TAP_SCRIPT.includes(REPLAY_TAP_KEY))
	assert.ok(
		REPLAY_TAP_SCRIPT.length < 900,
		`${REPLAY_TAP_SCRIPT.length} characters`,
	)
	assert.equal(REPLAY_TAP_SCRIPT.includes("<"), false)
})
