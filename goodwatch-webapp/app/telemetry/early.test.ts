import assert from "node:assert/strict"
import { test } from "node:test"

const {
	EARLY_TELEMETRY_KEY,
	EARLY_TELEMETRY_SCRIPT,
	MAX_EARLY_ERRORS,
	drainEarlyErrors,
	landingPageviewProperties,
	readEarlyTelemetry,
	toEarlyErrorReport,
} = await import("./early.ts")
type EarlyErrorReport = import("./early.ts").EarlyErrorReport

// Runs the inline script against a stand-in window, the way the browser runs it in the document head.
function runInlineScript(
	href = "https://goodwatch.app/movie/603?utm_source=x",
) {
	const listeners = new Map<string, Set<(event: unknown) => void>>()
	const win = {
		location: { href },
		addEventListener(type: string, listener: (event: unknown) => void) {
			if (!listeners.has(type)) listeners.set(type, new Set())
			listeners.get(type)?.add(listener)
		},
		removeEventListener(type: string, listener: (event: unknown) => void) {
			listeners.get(type)?.delete(listener)
		},
	}
	const doc = { referrer: "https://news.example/thread" }
	new Function("window", "document", EARLY_TELEMETRY_SCRIPT)(win, doc)
	const dispatch = (event: { type: string }) => {
		for (const listener of [...(listeners.get(event.type) ?? [])])
			listener(event)
	}
	const listenerCount = () =>
		[...listeners.values()].reduce((sum, set) => sum + set.size, 0)
	return {
		win: { ...win, document: doc },
		rawWin: win,
		dispatch,
		listenerCount,
	}
}

test("the inline script records the landing URL and referrer at load time", () => {
	const { rawWin } = runInlineScript()
	const early = readEarlyTelemetry(rawWin)
	assert.equal(
		early.landing.href,
		"https://goodwatch.app/movie/603?utm_source=x",
	)
	assert.equal(early.landing.referrer, "https://news.example/thread")
	assert.ok(Math.abs(early.landing.time - Date.now()) < 5000)
	// A later navigation inside the app doesn't change the record.
	rawWin.location.href = "https://goodwatch.app/discover"
	assert.equal(
		readEarlyTelemetry(rawWin).landing.href,
		"https://goodwatch.app/movie/603?utm_source=x",
	)
})

test("the inline script queues error and unhandledrejection events", () => {
	const { rawWin, dispatch } = runInlineScript()
	const error = new Error("boom")
	const reason = new Error("rejected")
	dispatch({ type: "error", error, message: "boom" } as never)
	dispatch({ type: "unhandledrejection", reason } as never)
	const early = readEarlyTelemetry(rawWin)
	assert.equal(early.errors.length, 2)
	assert.equal(early.errors[0].event.error, error)
	assert.equal(early.errors[1].event.reason, reason)
	assert.equal(typeof early.errors[0].time, "number")
})

test("the inline script keeps a bounded number of events", () => {
	const { rawWin, dispatch } = runInlineScript()
	for (let i = 0; i < MAX_EARLY_ERRORS + 15; i++)
		dispatch({ type: "error", message: `e${i}` } as never)
	assert.equal(readEarlyTelemetry(rawWin).errors.length, MAX_EARLY_ERRORS)
})

test("draining stops the queue, removes its listeners and reports oldest first", () => {
	const { rawWin, dispatch, listenerCount } = runInlineScript()
	const first = new Error("first")
	const second = new Error("second")
	dispatch({ type: "error", error: first } as never)
	dispatch({ type: "unhandledrejection", reason: second } as never)
	const early = readEarlyTelemetry(rawWin)
	const reports: EarlyErrorReport[] = []
	const count = drainEarlyErrors(early, (report) => reports.push(report))
	assert.equal(count, 2)
	assert.deepEqual(
		reports.map((report) => [report.exception, report.mechanism]),
		[
			[first, "onerror"],
			[second, "onunhandledrejection"],
		],
	)
	assert.equal(listenerCount(), 0)
	// The error tracker's own handlers take over: a later error isn't queued, and a second drain reports nothing.
	dispatch({ type: "error", error: new Error("late") } as never)
	assert.equal(early.errors.length, 0)
	assert.equal(
		drainEarlyErrors(early, () => assert.fail("nothing left")),
		0,
	)
})

test("a failing report doesn't stop the rest", () => {
	const { rawWin, dispatch } = runInlineScript()
	dispatch({ type: "error", error: new Error("a") } as never)
	dispatch({ type: "error", error: new Error("b") } as never)
	let calls = 0
	drainEarlyErrors(readEarlyTelemetry(rawWin), () => {
		calls++
		throw new Error("reporter broke")
	})
	assert.equal(calls, 2)
})

test("an error without an error object is reported by message and source", () => {
	const report = toEarlyErrorReport({
		time: 1_700_000_000_500,
		event: {
			type: "error",
			error: null,
			message: "Script error.",
			filename: "https://cdn.example/x.js",
			lineno: 3,
			colno: 9,
		},
	})
	assert.equal(report.exception, "Script error.")
	assert.equal(report.timestamp, 1_700_000_000.5)
	assert.deepEqual(report.source, {
		filename: "https://cdn.example/x.js",
		lineno: 3,
		colno: 9,
	})
})

test("a page without the inline script gets the current URL and an empty queue", () => {
	const early = readEarlyTelemetry({
		location: { href: "https://goodwatch.app/" },
		document: { referrer: "" },
	})
	assert.equal(early.landing.href, "https://goodwatch.app/")
	assert.deepEqual(early.errors, [])
	assert.equal(EARLY_TELEMETRY_KEY, "__gwEarly")
})

test("the landing page view needs no correction while the address is the landing URL", () => {
	const landing = {
		href: "https://goodwatch.app/movie/603",
		referrer: "",
		time: 1,
	}
	assert.deepEqual(landingPageviewProperties(landing, landing.href), {})
})

test("after a navigation inside the app, the landing page view carries the landing URL and campaign values", () => {
	const landing = {
		href: "https://goodwatch.app/movie/603-the-matrix?utm_source=hn&utm_campaign=launch&gclid=abc&other=1",
		referrer: "https://news.example/",
		time: 1,
	}
	assert.deepEqual(
		landingPageviewProperties(landing, "https://goodwatch.app/discover"),
		{
			$current_url: landing.href,
			$host: "goodwatch.app",
			$pathname: "/movie/603-the-matrix",
			utm_source: "hn",
			utm_campaign: "launch",
			gclid: "abc",
		},
	)
})
