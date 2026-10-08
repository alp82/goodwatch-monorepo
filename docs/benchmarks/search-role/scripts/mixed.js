// k6 script for the search role benchmark: the page mix of the search footprint measurement, with searches and
// command palette lookups next to it. Open model (constant arrival rate). Each scenario has its own tag.
//   PAGE_WARM_RATE, PAGE_MISS_RATE: page requests per second (0 turns a scenario off)
//   SEARCH_RATE: ranked searches per second, PALETTE_RATE: palette lookups per second
//   DURATION: seconds. TARGET_URL: the page role. SEARCH_TARGET_URL: where searches and palette lookups go
//   (the search role in variant 1, the page role in variant 2).
//   MISS_OFFSET: where in the title list this run starts. LOG_EACH=1: one log line per search and palette request.
import http from "k6/http"
import exec from "k6/execution"
import { Counter, Trend } from "k6/metrics"

const target = __ENV.TARGET_URL
const searchTarget = __ENV.SEARCH_TARGET_URL || target
const seconds = Number(__ENV.DURATION || 60)
const duration = `${seconds}s`
const rate = (name) => Number(__ENV[name] || 0)
const queries = JSON.parse(open("/work/queries.json"))
const titles = JSON.parse(open("/work/titles.json"))
const warmPath = __ENV.WARM_PATH || "/movie/603-the-matrix"
const missOffset = Number(__ENV.MISS_OFFSET || 0)
const logEach = __ENV.LOG_EACH === "1"
const deadlineMs = 1500
const headers = {
	Cookie: "gw_browser=1",
	"Accept-Language": "en-US,en;q=0.9",
	"User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
}
// How a search ended: ranked (and whether the whole response took at most 1,500 ms), basic results, the busy
// answer (503 with Retry-After), or anything else.
const outcome = {
	ranked: new Counter("search_ranked"),
	rankedInDeadline: new Counter("search_ranked_in_deadline"),
	basic: new Counter("search_basic"),
	busy: new Counter("search_busy"),
	error: new Counter("search_error"),
}
const rankedMs = new Trend("search_ranked_ms")
const serverMs = new Trend("search_server_elapsed_ms")
const palette = { ok: new Counter("palette_ok"), empty: new Counter("palette_empty"), error: new Counter("palette_error") }

const kinds = ["page_warm", "page_miss", "search", "palette"]
const scenario = (name, perSecond, fn) =>
	perSecond > 0
		? { [name]: { executor: "constant-arrival-rate", rate: Math.round(perSecond * 10), timeUnit: "10s", duration, preAllocatedVUs: Math.max(20, Math.ceil(perSecond * 20)), maxVUs: Math.max(100, Math.ceil(perSecond * 60)), exec: fn, tags: { kind: name } } }
		: {}
export const options = {
	scenarios: {
		...scenario("page_warm", rate("PAGE_WARM_RATE"), "pageWarm"),
		...scenario("page_miss", rate("PAGE_MISS_RATE"), "pageMiss"),
		...scenario("search", rate("SEARCH_RATE"), "search"),
		...scenario("palette", rate("PALETTE_RATE"), "paletteLookup"),
	},
	summaryTrendStats: ["count", "avg", "med", "p(90)", "p(95)", "p(99)", "max"],
	thresholds: Object.fromEntries(kinds.flatMap((k) => [[`http_req_duration{kind:${k}}`, ["max>=0"]], [`http_req_failed{kind:${k}}`, ["rate>=0"]], [`dropped_iterations{kind:${k}}`, ["count>=0"]]])),
	discardResponseBodies: false,
	noConnectionReuse: false,
}

const note = (kind, res, result) => {
	if (logEach) console.log(JSON.stringify({ each: 1, t: Date.now(), kind, status: res.status, ms: Math.round(res.timings.duration), result, error: res.error || undefined }))
}

export function pageWarm() {
	const res = http.get(`${target}${warmPath}`, { headers, timeout: "30s", responseType: "none" })
	note("page_warm", res, res.status === 200 ? "ok" : "failed")
}
export function pageMiss() {
	const i = (missOffset + exec.scenario.iterationInTest) % titles.length
	const res = http.get(`${target}${titles[i]}`, { headers, timeout: "30s", responseType: "none" })
	note("page_miss", res, res.status === 200 ? "ok" : "failed")
}
export function search() {
	const q = queries[exec.scenario.iterationInTest % queries.length]
	// The live Discover page sends discover: true, which asks for up to 100 rows.
	const body = JSON.stringify({ q, filters: {}, allTitles: false, discover: true })
	const res = http.post(`${searchTarget}/api/combined-search`, body, { headers: { ...headers, "Content-Type": "application/json" }, timeout: "30s" })
	const text = String(res.body || "")
	let result = "error"
	if (res.status === 503 && res.headers["Retry-After"]) result = "busy"
	else if (res.status === 200 && text.includes('{"kind":"batch"')) {
		// String checks instead of JSON.parse: the response is about 100 KB, and k6 shares the host's 4 cores.
		result = text.includes('"errors":["Showing basic search results.') ? "basic" : "ranked"
		const elapsed = /"elapsedMs":(\d+)/.exec(text)
		if (elapsed) serverMs.add(Number(elapsed[1]))
	}
	if (result === "ranked") {
		outcome.ranked.add(1)
		rankedMs.add(res.timings.duration)
		if (res.timings.duration <= deadlineMs) outcome.rankedInDeadline.add(1)
	} else outcome[result].add(1)
	note("search", res, result)
}
export function paletteLookup() {
	const i = exec.scenario.iterationInTest
	const q = queries[i % queries.length]
	const res = http.get(`${searchTarget}/api/command-palette?q=${encodeURIComponent(q.slice(0, 2 + (i % 8)))}`, { headers, timeout: "30s" })
	let result = "error"
	if (res.status === 200) result = String(res.body || "").includes('"tmdbId"') ? "ok" : "empty"
	palette[result].add(1)
	note("palette", res, result)
}
