// k6: an open-model load of page requests at RATE per second for DURATION seconds.
// PATHS is a file with one "route path" pair per line; requests cycle through it.
import http from "k6/http"
import { Trend, Counter } from "k6/metrics"
const lines = open(__ENV.PATHS).split("\n").filter(Boolean).map((line) => line.split(" "))
const BASE = __ENV.BASE || "http://172.31.251.20:3000"
const full = new Trend("full_ms", true)
const ttfb = new Trend("ttfb_ms", true)
const bad = new Counter("bad_status")
export const options = {
	scenarios: {
		pages: {
			executor: "constant-arrival-rate",
			rate: Number(__ENV.RATE || 2),
			timeUnit: "1s",
			duration: `${__ENV.DURATION || 60}s`,
			preAllocatedVUs: 50,
			maxVUs: 400,
		},
	},
	summaryTrendStats: ["avg", "med", "p(95)", "p(99)", "max", "count"],
}
export default function () {
	const [route, path] = lines[__ITER % lines.length]
	const response = http.get(`${BASE}${path}`, {
		headers: {
			Cookie: "gw_browser=1",
			"Accept-Encoding": "gzip, deflate, br",
			"Accept-Language": "en-US,en;q=0.9",
			"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
		},
		timeout: "30s",
		tags: { route },
	})
	full.add(response.timings.duration, { route })
	ttfb.add(response.timings.waiting, { route })
	if (response.status !== 200) bad.add(1, { route })
}
export function handleSummary(data) {
	const pick = (name) => {
		const v = data.metrics[name]?.values
		return v ? `avg ${v.avg.toFixed(0)} p50 ${v.med.toFixed(0)} p95 ${v["p(95)"].toFixed(0)} p99 ${v["p(99)"].toFixed(0)} max ${v.max.toFixed(0)} n ${v.count}` : "none"
	}
	const bad = data.metrics.bad_status?.values.count ?? 0
	const dropped = data.metrics.dropped_iterations?.values.count ?? 0
	return { stdout: `full_ms: ${pick("full_ms")}\nttfb_ms: ${pick("ttfb_ms")}\nbad_status ${bad} dropped ${dropped}\n` }
}
