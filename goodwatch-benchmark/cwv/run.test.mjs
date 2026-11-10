import assert from "node:assert/strict"
import { test } from "node:test"
import { IMAGE, LIMITED_NETWORK, SCENARIOS, createRequestGuard, homePageFailures, consoleRuntimeFailure, parseOptions, requestBlockReason, scenarioCpuSlowdown, summarizeAction } from "./run.mjs"

test("an explicit origin is mandatory; six scenarios and three sequential repetitions use the pinned image", () => {
	assert.throws(() => parseOptions([]), /explicit --base-url/)
	const options = parseOptions(["--base-url", "https://127.0.0.1:3344", "--variant", "baseline"])
	assert.equal(options.baseUrl, "https://127.0.0.1:3344")
	assert.equal(options.runs, 3)
	assert.equal(options.mobileCpu, 6)
	assert.deepEqual(options.scenarios, SCENARIOS)
	assert.equal(options.variant, "baseline")
	assert.equal(IMAGE, "gw-bench-lighthouse:13.5.0-6dd25f05")
	assert.equal(LIMITED_NETWORK.downloadThroughput, 209715.2)
	assert.equal(LIMITED_NETWORK.latency, 150)
})

test("scenario subsets and trace options work; invalid origins, counts and unsupported scenarios fail closed", () => {
	const options = parseOptions(["--base-url", "http://localhost:3304/", "--runs", "1", "--scenarios", "mobile-fresh-early", "--trace"])
	assert.equal(options.runs, 1)
	assert.deepEqual(options.scenarios, ["mobile-fresh-early"])
	assert.equal(options.trace, true)
	for (const origin of ["file:///tmp/home.html", "https://example.com/?q=secret", "https://example.com/page", "https://user:pass@example.com"])
		assert.throws(() => parseOptions(["--base-url", origin]))
	for (const value of ["0", "NaN", "1.2", "21"])
		assert.throws(() => parseOptions(["--base-url", "http://localhost", "--runs", value]))
	for (const value of ["missing", "mobile-fresh-early,mobile-fresh-early"])
		assert.throws(() => parseOptions(["--base-url", "http://localhost", "--scenarios", value]))
})

test("every non-read method is blocked for every host and resource, without a fixture exception", () => {
	for (const host of ["http://localhost:3344", "https://goodwatch.app", "https://a.goodwatch.app"])
		for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS", "CONNECT"])
			for (const route of ["/", "/api/discover/interpret", "/api/living-room/picks?view=pool", "/static/a.js"])
				assert.equal(requestBlockReason(method, host + route, "fetch"), "write-method")
	assert.equal(requestBlockReason("GET", "http://localhost:3344/"), null)
	assert.equal(requestBlockReason("HEAD", "https://goodwatch.app/assets/start.avif"), null)
	assert.equal(requestBlockReason("GET", "https://image.tmdb.org/t/p/w185/poster.jpg", "image"), null)
})

test("GET telemetry and known mutating reads are blocked while the real extension scripts may load", () => {
	for (const address of ["https://a.goodwatch.app/i/v0/e/", "https://any.example/e/?data=private", "https://o.ingest.de.sentry.io/api/envelope", "https://goodwatch.app/api/og-image-warm", "https://goodwatch.app/api/update-mark"])
		assert.ok(requestBlockReason("GET", address, "fetch"), address)
	assert.equal(requestBlockReason("GET", "https://a.goodwatch.app/static/web-vitals.js", "script"), null)
	assert.equal(requestBlockReason("GET", "http://localhost:3344/api/auth/get-session", "fetch"), null)
})

test("per-action timing includes its own entries and separately requires trusted event evidence", () => {
	const action = { name: "search-type", start: 100, end: 300, success: true }
	const result = summarizeAction(action, [{ start: 99, duration: 400 }, { start: 100, duration: 48 }, { start: 200, duration: 208 }, { start: 301, duration: 500 }], [{ action: "search-type" }, { action: "search-focus" }])
	assert.equal(result.events.length, 2)
	assert.equal(result.maxEventDurationMs, 208)
	assert.equal(result.trustedInputCount, 1)
	const fast = summarizeAction(action, [], [{ action: "search-type" }])
	assert.equal(fast.maxEventDurationMs, 0)
	assert.equal(fast.eventTimingFloorMs, 16)
	assert.equal(fast.trustedInputCount, 1)
})


test("the request seam distinguishes its own guard aborts, explicit search cancellations and failed assets", async () => {
	const result = { blocked: [], requests: [], expectedCancellations: [], errors: [], activeAction: null }
	const guard = createRequestGuard(result)
	const request = (method, type, error = "net::ERR_FAILED") => ({ method: () => method, resourceType: () => type, url: () => "http://localhost:3344/api/discover/interpret", failure: () => ({ errorText: error }), abort: async () => {}, continue: async () => {} })
	const write = request("POST", "fetch")
	guard.request(write)
	guard.failed(write)
	assert.equal(result.blocked.length, 1)
	assert.deepEqual(result.errors, [], "an intentional guard abort is not a page failure")
	result.activeAction = "search-clear"
	const cancelled = request("GET", "fetch", "net::ERR_ABORTED")
	guard.request(cancelled)
	guard.failed(cancelled)
	assert.equal(result.expectedCancellations.length, 1)
	assert.deepEqual(result.errors, [])
	const asset = request("GET", "script", "net::ERR_ABORTED")
	guard.request(asset)
	guard.failed(asset)
	assert.equal(result.errors.length, 1, "aborted required assets still fail")
	result.activeAction = null
	guard.failed(request("GET", "fetch", "net::ERR_ABORTED"))
	assert.equal(result.errors.length, 2, "unexplained fetch aborts still fail")
})


test("HTTP200 with an earlier room LCP still fails when client rendering replaced the homepage with an ErrorBoundary", () => {
	const result = { status: 200, lcp: { time: 1500, target: "room" }, finalPage: { pathname: "/", heading: "Something went wrong", hasStartStage: false, hasSearchInput: false, errorDocumentTitle: true } }
	assert.ok(result.status === 200 && result.lcp.time < 2500, "the old loading-only criteria would pass")
	assert.equal(homePageFailures(result.finalPage).length, 3)
	assert.deepEqual(homePageFailures({ pathname: "/", heading: "Find something to watch", hasStartStage: true, hasSearchInput: true, errorDocumentTitle: false }), [])
	assert.ok(homePageFailures({ pathname: "/discover", heading: "Find something to watch", hasStartStage: true, hasSearchInput: true }).length > 0)
	assert.ok(homePageFailures(null).length > 0)
})

test("console runtime exceptions and component-boundary errors fail independently of hydration warnings", () => {
	for (const text of ["TypeError: Cannot read properties of undefined (reading 'map')", "ReferenceError: source is not defined", "The above error occurred in the <Route> component", "Minified React error #418", "Warning: hydration failed"])
		assert.equal(consoleRuntimeFailure("error", text), true, text)
	assert.equal(consoleRuntimeFailure("error", "Failed to load resource: net::ERR_FAILED"), false, "deliberately blocked resource failures use the request seam")
	assert.equal(consoleRuntimeFailure("error", "TypeError: Failed to fetch"), true, "a generic fetch error alone cannot prove the guard deliberately blocked its request")
	assert.equal(consoleRuntimeFailure("warn", "a harmless warning"), false)
})


test("fractional mobile CPU calibration is explicit and records the actual rate; desktop stays at 1x", () => {
	const options = parseOptions(["--base-url", "http://localhost:3344", "--mobile-cpu", "1.8"])
	assert.equal(options.mobileCpu, 1.8)
	for (const scenario of SCENARIOS)
		assert.equal(scenarioCpuSlowdown(scenario, options), scenario.startsWith("mobile-") ? 1.8 : 1)
	assert.equal(scenarioCpuSlowdown("mobile-fresh-early", {}), 6)
	for (const value of ["1", "20"])
		assert.equal(parseOptions(["--base-url", "http://localhost", "--mobile-cpu", value]).mobileCpu, Number(value))
	for (const value of ["0", "0.5", "20.1", "-1", "NaN", "Infinity"])
		assert.throws(() => parseOptions(["--base-url", "http://localhost", "--mobile-cpu", value]), /--mobile-cpu/)
})
