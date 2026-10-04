// coldstart.mjs: what a deploy looks like for one hot URL. Run it against an instance that has just become ready and
// has served no page: it sends RATE requests per second for SECONDS and reports how many of them the app rendered, how
// many waited for a render, when the first one was answered from the store, and how long the slowest ones took.
//
//   node coldstart.mjs <base-url> <path> <rate> <seconds>
import http from "node:http"

const [base, path, rateArg, secondsArg] = process.argv.slice(2)
const rate = Number(rateArg)
const seconds = Number(secondsArg)
const agent = new http.Agent({ keepAlive: true, maxSockets: 2000 })
const headers = {
	"User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
	"Accept-Encoding": "gzip, deflate, br",
	"Accept-Language": "en-US,en;q=0.9",
	Cookie: "gw_browser=1",
}
const results = []
const started = performance.now()
const send = () =>
	new Promise((resolve) => {
		const sent = performance.now() - started
		http
			.get(`${base}${path}`, { agent, headers }, (response) => {
				response.resume()
				response.on("end", () => {
					results.push({ sent, ms: performance.now() - started - sent, status: response.statusCode, state: response.headers["gw-page-cache"] ?? "none" })
					resolve()
				})
			})
			.on("error", () => {
				results.push({ sent, ms: performance.now() - started - sent, status: 0, state: "error" })
				resolve()
			})
	})
const pending = []
const total = rate * seconds
for (let i = 0; i < total; i++) {
	const due = (i / rate) * 1000
	const wait = due - (performance.now() - started)
	if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
	pending.push(send())
}
await Promise.all(pending)
agent.destroy()
const by = (state) => results.filter((result) => result.state === state)
const quantile = (list, q) => (list.length ? +list.map((r) => r.ms).sort((a, b) => a - b)[Math.min(list.length - 1, Math.floor(list.length * q))].toFixed(1) : null)
const firstHit = by("hit").sort((a, b) => a.sent + a.ms - (b.sent + b.ms))[0]
const firstSecond = results.filter((result) => result.sent < 1000)
console.log(
	JSON.stringify({
		rate,
		seconds,
		requests: results.length,
		bad: results.filter((result) => result.status !== 200).length,
		states: Object.fromEntries(["miss", "hit", "stale", "bypass", "none", "error"].map((state) => [state, by(state).length]).filter(([, n]) => n)),
		firstHitAnsweredAtMs: firstHit ? +(firstHit.sent + firstHit.ms).toFixed(0) : null,
		missMs: { p50: quantile(by("miss"), 0.5), max: quantile(by("miss"), 1) },
		firstSecondMs: { p50: quantile(firstSecond, 0.5), p95: quantile(firstSecond, 0.95), max: quantile(firstSecond, 1) },
		afterFirstSecondMs: { p50: quantile(results.filter((r) => r.sent >= 1000), 0.5), p95: quantile(results.filter((r) => r.sent >= 1000), 0.95), max: quantile(results.filter((r) => r.sent >= 1000), 1) },
	}),
)
