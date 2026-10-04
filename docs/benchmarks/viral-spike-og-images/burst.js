// k6: warm title pages at PAGE_RATE per second next to Open Graph image requests at OG_RATE per second, both at a
// fixed arrival rate (an open model). PAGES is a file with one page path per line (cycled). OG is a file with one
// image path per line: every request takes the next line, starting at OG_OFFSET, so no card repeats.
import exec from "k6/execution"
import http from "k6/http"
import { Counter, Trend } from "k6/metrics"
const lines = (file) => open(file).split("\n").filter(Boolean)
const pages = lines(__ENV.PAGES)
const cards = lines(__ENV.OG)
const BASE = __ENV.BASE || "http://172.31.246.20:3000"
const ogRate = Number(__ENV.OG_RATE || 0)
const offset = Number(__ENV.OG_OFFSET || 0)
const duration = `${__ENV.DURATION || 30}s`
const pageMs = new Trend("page_ms", true)
const pageTtfb = new Trend("page_ttfb_ms", true)
const ogMs = new Trend("og_ms", true)
const ogBytes = new Trend("og_bytes")
const bad = new Counter("bad_status")
const ogStatus = { 200: new Counter("og_200"), other: new Counter("og_other") }
const ogFallback = new Counter("og_fallback")
const scenarios = {
	pages: { executor: "constant-arrival-rate", exec: "page", rate: Number(__ENV.PAGE_RATE || 5), timeUnit: "1s", duration, preAllocatedVUs: 20, maxVUs: 300 },
}
if (ogRate > 0)
	scenarios.cards = { executor: "constant-arrival-rate", exec: "card", rate: ogRate, timeUnit: "1s", duration, preAllocatedVUs: 50, maxVUs: 1000 }
export const options = { scenarios, summaryTrendStats: ["avg", "med", "p(95)", "p(99)", "max", "count"] }
const browser = {
	Cookie: "gw_browser=1",
	"Accept-Encoding": "gzip, deflate, br",
	"Accept-Language": "en-US,en;q=0.9",
	"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
}
const bot = { "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)", Accept: "*/*" }
export function page() {
	const response = http.get(`${BASE}${pages[exec.scenario.iterationInTest % pages.length]}`, { headers: browser, timeout: "30s", responseType: "none" })
	pageMs.add(response.timings.duration)
	pageTtfb.add(response.timings.waiting)
	if (response.status !== 200) bad.add(1)
}
export function card() {
	const response = http.get(`${BASE}${cards[(offset + exec.scenario.iterationInTest) % cards.length]}`, { headers: bot, timeout: "60s", responseType: "binary" })
	ogMs.add(response.timings.duration)
	if (response.status === 200) {
		ogStatus[200].add(1)
		ogBytes.add(response.body.byteLength)
		// The busy answer is a generic card with a short lifetime.
		if (/max-age=\d{1,3}(,|$)/.test(response.headers["Cache-Control"] || "")) ogFallback.add(1)
	} else ogStatus.other.add(1)
}
export function handleSummary(data) {
	const pick = (name) => {
		const v = data.metrics[name]?.values
		return v ? { avg: +v.avg.toFixed(1), p50: +v.med.toFixed(1), p95: +v["p(95)"].toFixed(1), p99: +v["p(99)"].toFixed(1), max: +v.max.toFixed(0), n: v.count } : null
	}
	const count = (name) => data.metrics[name]?.values.count ?? 0
	return {
		stdout: `${JSON.stringify({ ogRate, page: pick("page_ms"), pageTtfb: pick("page_ttfb_ms"), og: pick("og_ms"), ogBytes: pick("og_bytes"), og200: count("og_200"), ogOther: count("og_other"), ogFallback: count("og_fallback"), badPages: count("bad_status"), dropped: count("dropped_iterations") })}\n`,
	}
}
