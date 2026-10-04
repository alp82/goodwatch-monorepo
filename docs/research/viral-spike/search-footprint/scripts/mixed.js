// k6 script for the search footprint measurement: page requests at a fixed rate, with search requests next to them.
// Open model (constant arrival rate), like goodwatch-benchmark/k6/load.js. Each scenario has its own tag.
//   PAGE_WARM_RATE, PAGE_MISS_RATE: page requests per second (0 turns a scenario off)
//   SEARCH_RATE: searches per second; SEARCH_KIND: ranked | palette | discover
//   DURATION: seconds; TARGET_URL; SEARCH_TARGET_URL; MISS_OFFSET: where in the title list this run starts
import http from "k6/http"
import exec from "k6/execution"
import { Counter, Trend } from "k6/metrics"

const target = __ENV.TARGET_URL
// Searches go to SEARCH_TARGET_URL when it is set (a separate search process), else to the page process.
const searchTarget = __ENV.SEARCH_TARGET_URL || target
const duration = `${__ENV.DURATION || 60}s`
const rate = (name) => Number(__ENV[name] || 0)
const queries = JSON.parse(open("/work/queries.json"))
const titles = JSON.parse(open("/work/titles.json"))
const warmPath = __ENV.WARM_PATH || "/movie/603-the-matrix"
const missOffset = Number(__ENV.MISS_OFFSET || 0)
const searchKind = __ENV.SEARCH_KIND || "ranked"
const headers = {
	Cookie: "gw_browser=1",
	"Accept-Language": "en-US,en;q=0.9",
	"User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
}
const searchOutcome = { ranked: new Counter("search_ranked"), basic: new Counter("search_basic"), error: new Counter("search_error") }
const searchServerMs = new Trend("search_server_elapsed_ms")

const scenario = (name, perSecond, fn) =>
	perSecond > 0
		? { [name]: { executor: "constant-arrival-rate", rate: Math.round(perSecond * 10), timeUnit: "10s", duration, preAllocatedVUs: Math.max(20, Math.ceil(perSecond * 20)), maxVUs: Math.max(100, Math.ceil(perSecond * 60)), exec: fn, tags: { kind: name } } }
		: {}
export const options = {
	scenarios: {
		...scenario("page_warm", rate("PAGE_WARM_RATE"), "pageWarm"),
		...scenario("page_miss", rate("PAGE_MISS_RATE"), "pageMiss"),
		...scenario("search", rate("SEARCH_RATE"), "search"),
	},
	summaryTrendStats: ["count", "avg", "med", "p(90)", "p(95)", "p(99)", "max"],
	thresholds: Object.fromEntries(["page_warm", "page_miss", "search"].flatMap((k) => [[`http_req_duration{kind:${k}}`, ["max>=0"]], [`http_req_waiting{kind:${k}}`, ["max>=0"]], [`http_req_failed{kind:${k}}`, ["rate>=0"]], [`dropped_iterations{kind:${k}}`, ["count>=0"]]])),
	discardResponseBodies: false,
	noConnectionReuse: false,
}

export function pageWarm() {
	http.get(`${target}${warmPath}`, { headers, timeout: "30s" })
}
export function pageMiss() {
	const i = (missOffset + exec.scenario.iterationInTest) % titles.length
	http.get(`${target}${titles[i]}`, { headers, timeout: "30s" })
}
export function search() {
	const q = queries[exec.scenario.iterationInTest % queries.length]
	if (searchKind === "palette") {
		http.get(`${searchTarget}/api/command-palette?q=${encodeURIComponent(q.slice(0, 2 + (exec.scenario.iterationInTest % 8)))}`, { headers, timeout: "30s" })
		return
	}
	const body = JSON.stringify({ q, filters: {}, allTitles: false, ...(searchKind === "discover" ? { discover: true } : {}) })
	const res = http.post(`${searchTarget}/api/combined-search`, body, { headers: { ...headers, "Content-Type": "application/json" }, timeout: "30s" })
	const batch = String(res.body || "").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l) } catch { return {} } }).find((m) => m.kind === "batch")
	if (!batch) return searchOutcome.error.add(1)
	searchServerMs.add(batch.batch.elapsedMs)
	if (batch.batch.errors.includes("Showing basic search results.")) searchOutcome.basic.add(1)
	else searchOutcome.ranked.add(1)
}
