// k6: page requests at RATE per second for DURATION seconds, at a fixed arrival rate (an open model).
// - PATHS: a file with one "weight client path" per line (client is browser or bot). Requests pick a line by weight.
// - COOKIES: plain (only gw_browser), analytics (the same analytics cookies on every request), or unique (analytics
//   cookies with a different visitor id on every request, as real visitors have).
// - TRACK=1: every browser request gets its own utm_* and fbclid parameters.
// - LONGTAIL and LONGTAIL_RATE: a file with one path per line, walked in order next to the pages (a crawler on the
//   long tail). Each path is requested LONGTAIL_REPEAT times in a row (default 1: nothing repeats).
// - LANGS: Accept-Language values separated by "|". Requests rotate through them.
// Reports the full-response time of every group, and the share of responses per GW-Page-Cache value.
import exec from "k6/execution"
import http from "k6/http"
import { Counter, Trend } from "k6/metrics"
const lines = (file) => open(file).split("\n").filter(Boolean)
const entries = lines(__ENV.PATHS).map((line) => {
	const [weight, client, path] = line.split(" ")
	return { weight: Number(weight), client, path }
})
const total = entries.reduce((sum, entry) => sum + entry.weight, 0)
const longtail = __ENV.LONGTAIL ? lines(__ENV.LONGTAIL) : []
const BASE = __ENV.BASE || "http://172.31.247.20:3000"
const duration = `${__ENV.DURATION || 30}s`
const cookies = __ENV.COOKIES || "plain"
const track = __ENV.TRACK === "1"
const langs = (__ENV.LANGS || "en-US,en;q=0.9").split("|")
const pageMs = new Trend("page_ms", true)
const pageTtfb = new Trend("page_ttfb_ms", true)
const ogMs = new Trend("og_ms", true)
const tailMs = new Trend("tail_ms", true)
const bad = new Counter("bad_status")
const states = new Counter("page_cache_state")
const scenarios = {
	pages: {
		executor: "constant-arrival-rate",
		exec: "page",
		rate: Number(__ENV.RATE || 5),
		timeUnit: "1s",
		duration,
		preAllocatedVUs: Number(__ENV.VUS || 100),
		maxVUs: Number(__ENV.MAX_VUS || 2000),
	},
}
if (longtail.length && Number(__ENV.LONGTAIL_RATE || 0) > 0)
	scenarios.tail = {
		executor: "constant-arrival-rate",
		exec: "tail",
		rate: Number(__ENV.LONGTAIL_RATE),
		timeUnit: "1s",
		duration,
		preAllocatedVUs: 20,
		maxVUs: 400,
	}
export const options = {
	scenarios,
	discardResponseBodies: true,
	summaryTrendStats: ["avg", "med", "p(95)", "p(99)", "max", "count"],
}
const BROWSER_UA =
	"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36"
const BOT_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"
const analytics = (id) =>
	`gw_browser=1; _ga=GA1.1.${id}.1759500000; _ga_ABCDEF1234=GS2.1.s${id}$o1$g1$t1759500100$j60$l0$h0; ph_phc_benchbenchbenchbenchbenchbenchbenchbenchbe_posthog=%7B%22distinct_id%22%3A%22v${id}%22%7D`
function pick(n) {
	let at = (n * 7919) % total
	for (const entry of entries) {
		if (at < entry.weight) return entry
		at -= entry.weight
	}
	return entries[0]
}
export function page() {
	const n = __ITER * 1000 + __VU
	const entry = pick(__ITER * 131 + __VU * 17)
	const bot = entry.client === "bot"
	let path = entry.path
	if (track && !bot && !path.endsWith(".png"))
		path += `${path.includes("?") ? "&" : "?"}utm_source=bench&utm_medium=social&utm_campaign=c${n}&fbclid=IwAR${n}`
	const headers = bot
		? { "User-Agent": BOT_UA, "Accept-Encoding": "gzip, deflate" }
		: {
				"User-Agent": BROWSER_UA,
				"Accept-Encoding": __ENV.ENCODING || "gzip, deflate, br",
				"Accept-Language": langs[n % langs.length],
				Cookie: cookies === "plain" ? "gw_browser=1" : analytics(cookies === "unique" ? n : 1),
			}
	const response = http.get(`${BASE}${path}`, { headers, timeout: "30s" })
	if (path.includes(".png")) ogMs.add(response.timings.duration)
	else {
		pageMs.add(response.timings.duration)
		pageTtfb.add(response.timings.waiting)
		states.add(1, { state: response.headers["Gw-Page-Cache"] || "none" })
	}
	if (response.status !== 200) bad.add(1)
}
export function tail() {
	const repeat = Number(__ENV.LONGTAIL_REPEAT || 1)
	const path = longtail[Math.floor(exec.scenario.iterationInTest / repeat) % longtail.length]
	const response = http.get(`${BASE}${path}`, {
		headers: { "User-Agent": BROWSER_UA, "Accept-Encoding": "gzip, deflate, br", Cookie: "gw_browser=1" },
		timeout: "30s",
	})
	tailMs.add(response.timings.duration)
	if (response.status !== 200 && response.status !== 404 && response.status !== 301) bad.add(1)
}
export function handleSummary(data) {
	const pick = (name) => {
		const v = data.metrics[name]?.values
		return v
			? { avg: +v.avg.toFixed(1), p50: +v.med.toFixed(1), p95: +v["p(95)"].toFixed(1), p99: +v["p(99)"].toFixed(1), max: +v.max.toFixed(0), n: v.count }
			: null
	}
	return {
		stdout: `${JSON.stringify({
			rate: Number(__ENV.RATE || 5),
			page: pick("page_ms"),
			ttfb: pick("page_ttfb_ms"),
			og: pick("og_ms"),
			tail: pick("tail_ms"),
			bad: data.metrics.bad_status?.values.count ?? 0,
			dropped: data.metrics.dropped_iterations?.values.count ?? 0,
			receivedMB: +((data.metrics.data_received?.values.count ?? 0) / 1e6).toFixed(1),
		})}\n`,
	}
}
