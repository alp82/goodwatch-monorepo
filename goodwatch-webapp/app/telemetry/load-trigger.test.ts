import assert from "node:assert/strict"
import { test } from "node:test"

const { INTERACTION_EVENTS, isPageActivity, whenPageIsInteractive } =
	await import("./load-trigger.ts")
type LoadTriggerEnv = import("./load-trigger.ts").LoadTriggerEnv

// A browser stand-in with a clock the test moves by hand.
function fakeBrowser({ loaded = true, hidden = false, observer = true } = {}) {
	let now = 0
	let nextHandle = 1
	const timers = new Map<number, { at: number; callback: () => void }>()
	const listeners = new Map<string, Set<() => void>>()
	const activityListeners = new Set<() => void>()
	const env: LoadTriggerEnv = {
		isLoaded: () => loaded,
		isHidden: () => hidden,
		addEventListener: (type, listener) => {
			if (!listeners.has(type)) listeners.set(type, new Set())
			listeners.get(type)?.add(listener)
		},
		removeEventListener: (type, listener) => {
			listeners.get(type)?.delete(listener)
		},
		setTimeout: (callback, ms) => {
			const handle = nextHandle++
			timers.set(handle, { at: now + ms, callback })
			return handle
		},
		clearTimeout: (handle) => {
			timers.delete(handle as number)
		},
	}
	if (observer)
		env.observeActivity = (onActivity) => {
			activityListeners.add(onActivity)
			return () => activityListeners.delete(onActivity)
		}
	return {
		env,
		dispatch(type: string) {
			if (type === "load") loaded = true
			for (const listener of [...(listeners.get(type) ?? [])]) listener()
		},
		hide() {
			hidden = true
			for (const listener of [...(listeners.get("visibilitychange") ?? [])])
				listener()
		},
		/** A long task ended or a request finished. */
		activity() {
			for (const listener of [...activityListeners]) listener()
		},
		advance(ms: number) {
			const end = now + ms
			for (;;) {
				const due = [...timers]
					.filter(([, timer]) => timer.at <= end)
					.sort((a, b) => a[1].at - b[1].at)[0]
				if (!due) break
				now = due[1].at
				timers.delete(due[0])
				due[1].callback()
			}
			now = end
		},
		leftovers: () =>
			[...listeners.values()].reduce((sum, set) => sum + set.size, 0) +
			timers.size +
			activityListeners.size,
	}
}

const options = { quietMs: 3000, maxWaitMs: 10_000 }

function arm(browser: ReturnType<typeof fakeBrowser>) {
	const reasons: string[] = []
	const cancel = whenPageIsInteractive(
		(reason) => reasons.push(reason),
		browser.env,
		options,
	)
	return { reasons, cancel }
}

test("a loaded page runs the tools after the quiet time", () => {
	const browser = fakeBrowser()
	const { reasons } = arm(browser)
	browser.advance(2999)
	assert.deepEqual(reasons, [])
	browser.advance(1)
	assert.deepEqual(reasons, ["quiet"])
	assert.equal(browser.leftovers(), 0)
})

test("the quiet time starts at the load event, not before", () => {
	const browser = fakeBrowser({ loaded: false })
	const { reasons } = arm(browser)
	browser.advance(60_000)
	assert.deepEqual(reasons, [])
	browser.dispatch("load")
	browser.advance(2999)
	assert.deepEqual(reasons, [])
	browser.advance(1)
	assert.deepEqual(reasons, ["quiet"])
})

test("a long task or a finished request restarts the quiet time", () => {
	const browser = fakeBrowser()
	const { reasons } = arm(browser)
	browser.advance(2500)
	browser.activity()
	browser.advance(2999)
	assert.deepEqual(reasons, [])
	browser.advance(1)
	assert.deepEqual(reasons, ["quiet"])
})

test("a page that never gets quiet runs the tools at the longest wait", () => {
	const browser = fakeBrowser()
	const { reasons } = arm(browser)
	for (let elapsed = 0; elapsed < 9000; elapsed += 1000) {
		browser.advance(1000)
		browser.activity()
	}
	assert.deepEqual(reasons, [])
	browser.advance(1000)
	assert.deepEqual(reasons, ["timeout"])
	assert.equal(browser.leftovers(), 0)
})

test("a browser that can't observe activity runs the tools one quiet time after the load event", () => {
	const browser = fakeBrowser({ observer: false })
	const { reasons } = arm(browser)
	browser.advance(3000)
	assert.deepEqual(reasons, ["quiet"])
})

for (const type of INTERACTION_EVENTS) {
	test(`${type} runs the tools at once, even before the load event`, () => {
		const browser = fakeBrowser({ loaded: false })
		const { reasons } = arm(browser)
		browser.dispatch(type)
		assert.deepEqual(reasons, ["interaction"])
	})
}

// The rule for tools whose start-up work is too heavy to share a moment with the visitor's gesture.
const waiting = {
	...options,
	afterInteraction: { quietMs: 1000, maxWaitMs: 5000 },
}

function armWaiting(browser: ReturnType<typeof fakeBrowser>) {
	const reasons: string[] = []
	const cancel = whenPageIsInteractive(
		(reason) => reasons.push(reason),
		browser.env,
		waiting,
	)
	return { reasons, cancel }
}

for (const type of INTERACTION_EVENTS) {
	test(`with a wait after interactions, ${type} runs the tools one quiet time later, even before the load event`, () => {
		const browser = fakeBrowser({ loaded: false })
		const { reasons } = armWaiting(browser)
		browser.dispatch(type)
		assert.deepEqual(reasons, [])
		browser.advance(999)
		assert.deepEqual(reasons, [])
		browser.advance(1)
		assert.deepEqual(reasons, ["interaction"])
		assert.equal(browser.leftovers(), 0)
	})
}

test("a further interaction restarts the quiet time after an interaction", () => {
	const browser = fakeBrowser()
	const { reasons } = armWaiting(browser)
	browser.dispatch("scroll")
	browser.advance(900)
	browser.dispatch("pointerdown")
	browser.advance(999)
	assert.deepEqual(reasons, [])
	browser.advance(1)
	assert.deepEqual(reasons, ["interaction"])
})

test("the work an interaction starts restarts the quiet time after it", () => {
	const browser = fakeBrowser()
	const { reasons } = armWaiting(browser)
	browser.dispatch("pointerdown")
	browser.advance(900)
	browser.activity()
	browser.advance(999)
	assert.deepEqual(reasons, [])
	browser.advance(1)
	assert.deepEqual(reasons, ["interaction"])
})

test("activity counts after an interaction that came before the load event", () => {
	const browser = fakeBrowser({ loaded: false })
	const { reasons } = armWaiting(browser)
	browser.dispatch("pointerdown")
	browser.advance(900)
	browser.activity()
	browser.advance(999)
	assert.deepEqual(reasons, [])
	browser.advance(1)
	assert.deepEqual(reasons, ["interaction"])
	assert.equal(browser.leftovers(), 0)
})

test("a visitor who never pauses gets the tools at the longest wait after the first interaction", () => {
	const browser = fakeBrowser()
	const { reasons } = armWaiting(browser)
	browser.advance(2000)
	for (let elapsed = 0; elapsed < 4500; elapsed += 500) {
		browser.dispatch("scroll")
		browser.advance(500)
	}
	assert.deepEqual(reasons, [])
	browser.dispatch("scroll")
	browser.advance(500)
	assert.deepEqual(reasons, ["interaction"])
	assert.equal(browser.leftovers(), 0)
})

test("an interaction ends the wait for a quiet page: the tools don't run in the middle of it", () => {
	const browser = fakeBrowser()
	const { reasons } = armWaiting(browser)
	browser.advance(2900)
	browser.dispatch("pointerdown")
	browser.advance(999)
	assert.deepEqual(reasons, [])
	browser.advance(1)
	assert.deepEqual(reasons, ["interaction"])
	browser.advance(60_000)
	assert.deepEqual(reasons, ["interaction"])
})

test("the load event doesn't restart the wait after an interaction", () => {
	const browser = fakeBrowser({ loaded: false })
	const { reasons } = armWaiting(browser)
	browser.dispatch("pointerdown")
	browser.advance(500)
	browser.dispatch("load")
	browser.advance(500)
	assert.deepEqual(reasons, ["interaction"])
	browser.advance(60_000)
	assert.deepEqual(reasons, ["interaction"])
	assert.equal(browser.leftovers(), 0)
})

test("a page that becomes hidden during the wait after an interaction runs the tools at once", () => {
	const browser = fakeBrowser()
	const { reasons } = armWaiting(browser)
	browser.dispatch("pointerdown")
	browser.advance(100)
	browser.hide()
	assert.deepEqual(reasons, ["hidden"])
	assert.equal(browser.leftovers(), 0)
})

test("a trigger cancelled during the wait after an interaction never runs", () => {
	const browser = fakeBrowser()
	const { reasons, cancel } = armWaiting(browser)
	browser.dispatch("pointerdown")
	cancel()
	browser.advance(60_000)
	assert.deepEqual(reasons, [])
	assert.equal(browser.leftovers(), 0)
})

test("a page that becomes hidden runs the tools at once", () => {
	const browser = fakeBrowser({ loaded: false })
	const { reasons } = arm(browser)
	browser.dispatch("visibilitychange")
	assert.deepEqual(reasons, [])
	browser.hide()
	assert.deepEqual(reasons, ["hidden"])
	assert.equal(browser.leftovers(), 0)
})

test("a page that is hidden from the start runs the tools at once", () => {
	const browser = fakeBrowser({ loaded: false, hidden: true })
	const { reasons } = arm(browser)
	assert.deepEqual(reasons, ["hidden"])
	assert.equal(browser.leftovers(), 0)
})

test("the tools run once, and the trigger leaves nothing behind", () => {
	const browser = fakeBrowser()
	const { reasons } = arm(browser)
	browser.dispatch("pointerdown")
	browser.dispatch("keydown")
	browser.dispatch("load")
	browser.hide()
	browser.activity()
	browser.advance(60_000)
	assert.deepEqual(reasons, ["interaction"])
	assert.equal(browser.leftovers(), 0)
})

test("a cancelled trigger never runs", () => {
	const browser = fakeBrowser({ loaded: false })
	const { reasons, cancel } = arm(browser)
	cancel()
	browser.dispatch("load")
	browser.dispatch("pointerdown")
	browser.advance(60_000)
	assert.deepEqual(reasons, [])
	assert.equal(browser.leftovers(), 0)
})

test("long tasks, paints and finished requests are page activity, beacons are not", () => {
	assert.equal(isPageActivity({ entryType: "longtask" }), true)
	assert.equal(isPageActivity({ entryType: "paint" }), true)
	assert.equal(isPageActivity({ entryType: "largest-contentful-paint" }), true)
	assert.equal(
		isPageActivity({ entryType: "resource", initiatorType: "script" }),
		true,
	)
	assert.equal(
		isPageActivity({ entryType: "resource", initiatorType: "fetch" }),
		true,
	)
	assert.equal(
		isPageActivity({ entryType: "resource", initiatorType: "beacon" }),
		false,
	)
})
