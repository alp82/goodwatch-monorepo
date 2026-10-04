// k6: title pages at PAGE_RATE per second next to static requests at STATIC_RATE per second, both at a fixed arrival
// rate (an open model). STATIC is a file with one static path per line, PAGES one page path per line.
import http from "k6/http"
import { Counter, Trend } from "k6/metrics"
const lines = (file) => open(file).split("\n").filter(Boolean)
const pages = lines(__ENV.PAGES)
const statics = lines(__ENV.STATIC)
const BASE = __ENV.BASE || "http://172.31.249.20:3000"
const staticRate = Number(__ENV.STATIC_RATE || 0)
const duration = `${__ENV.DURATION || 30}s`
const pageMs = new Trend("page_ms", true)
const pageTtfb = new Trend("page_ttfb_ms", true)
const staticMs = new Trend("static_ms", true)
const bad = new Counter("bad_status")
const staticBytes = new Counter("static_bytes")
const scenarios = {
	pages: {
		executor: "constant-arrival-rate",
		exec: "page",
		rate: Number(__ENV.PAGE_RATE || 5),
		timeUnit: "1s",
		duration,
		preAllocatedVUs: 20,
		maxVUs: 200,
	},
}
if (staticRate > 0)
	scenarios.statics = {
		executor: "constant-arrival-rate",
		exec: "asset",
		rate: staticRate,
		timeUnit: "1s",
		duration,
		preAllocatedVUs: 50,
		maxVUs: 1000,
	}
export const options = {
	scenarios,
	discardResponseBodies: true,
	summaryTrendStats: ["avg", "med", "p(95)", "p(99)", "max", "count"],
}
const headers = {
	Cookie: "gw_browser=1",
	"Accept-Encoding": __ENV.ENCODING || "gzip, deflate, br",
	"Accept-Language": "en-US,en;q=0.9",
	"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
}
export function page() {
	const response = http.get(`${BASE}${pages[__ITER % pages.length]}`, { headers, timeout: "30s", tags: { kind: "page" } })
	pageMs.add(response.timings.duration)
	pageTtfb.add(response.timings.waiting)
	if (response.status !== 200) bad.add(1, { kind: "page" })
}
export function asset() {
	const response = http.get(`${BASE}${statics[(__ITER * 7 + __VU) % statics.length]}`, { headers, timeout: "30s", tags: { kind: "static" } })
	staticMs.add(response.timings.duration)
	if (response.status !== 200) bad.add(1, { kind: "static" })
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
			staticRate,
			page: pick("page_ms"),
			pageTtfb: pick("page_ttfb_ms"),
			static: pick("static_ms"),
			bad: data.metrics.bad_status?.values.count ?? 0,
			dropped: data.metrics.dropped_iterations?.values.count ?? 0,
			receivedMB: +((data.metrics.data_received?.values.count ?? 0) / 1e6).toFixed(1),
		})}\n`,
	}
}
