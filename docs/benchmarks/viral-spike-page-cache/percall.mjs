// percall.mjs: main-thread CPU and wall time per page request, by how the page cache answers it.
// Sends requests one at a time over one keep-alive connection, as the proxy does, and reads the server process's CPU
// time from the host's /proc before and after each batch (mounted at /hostproc). CLK_TCK is 100, so a batch of 200
// requests resolves 0.05 ms per request.
//
//   node percall.mjs <base-url> <server-pid> <count> <path>[,label] ...
//
// Cases per path:
// - render: <count> requests that the app renders, each with a different unknown query parameter (?pc=<n>), so that
//   no URL repeats and the cache never admits one. The loaders ignore the parameter. On a build without the cache this
//   is the plain render cost; on a build with it, the render cost plus the cache's bookkeeping.
// - hit: the same URL <count> times after two requests that fill the cache (Brotli), then with gzip, with no encoding,
//   with If-None-Match, and with analytics cookies and tracking parameters.
// - stale: with STALE=1 (the app runs with PAGE_CACHE_MAX_FRESH_SECONDS=1): one request every 1.5 seconds, so that each
//   one is answered stale and starts a background render. The CPU per request then includes that render.
import { readFileSync, readdirSync } from "node:fs"
import http from "node:http"

const [base, pid, countArg, ...targets] = process.argv.slice(2)
const count = Number(countArg)
const agent = new http.Agent({ keepAlive: true, maxSockets: 1 })
const TICK_MS = 10
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const cpuOf = (path) => {
	const stat = readFileSync(path, "utf8")
	const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ")
	return (Number(fields[11]) + Number(fields[12])) * TICK_MS
}
const cpu = () => {
	const main = cpuOf(`/hostproc/${pid}/task/${pid}/stat`)
	let all = 0
	for (const tid of readdirSync(`/hostproc/${pid}/task`)) {
		try {
			all += cpuOf(`/hostproc/${pid}/task/${tid}/stat`)
		} catch {}
	}
	return { main, other: all - main }
}

const get = (path, headers) =>
	new Promise((resolve, reject) => {
		const started = performance.now()
		const request = http.get(`${base}${path}`, { agent, headers }, (response) => {
			let bytes = 0
			response.on("data", (chunk) => {
				bytes += chunk.length
			})
			response.on("end", () =>
				resolve({ status: response.statusCode, headers: response.headers, bytes, ms: performance.now() - started }),
			)
		})
		request.on("error", reject)
	})

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
const BROWSER = { "User-Agent": UA, Cookie: "gw_browser=1", "Accept-Language": "en-US,en;q=0.9", "Accept-Encoding": "gzip, deflate, br, zstd" }
const ANALYTICS =
	"gw_browser=1; _ga=GA1.1.1234567890.1759500000; _ga_ABCDEF1234=GS2.1.s1759500000$o1$g1$t1759500100$j60$l0$h0; ph_phc_benchbenchbenchbenchbenchbenchbenchbenchbe_posthog=%7B%22distinct_id%22%3A%22bench%22%7D"

async function batch(label, kind, n, pathOf, extra = {}, gapMs = 0) {
	const headers = { ...BROWSER, ...extra }
	const seen = {}
	const walls = []
	let last
	const before = cpu()
	for (let i = 0; i < n; i++) {
		if (gapMs) await sleep(gapMs)
		last = await get(pathOf(i), headers)
		walls.push(last.ms)
		const state = last.headers["gw-page-cache"] ?? "none"
		seen[state] = (seen[state] ?? 0) + 1
	}
	const after = cpu()
	walls.sort((a, b) => a - b)
	console.log(
		JSON.stringify({
			label,
			case: kind,
			n,
			status: last.status,
			pageCache: seen,
			encoding: last.headers["content-encoding"] ?? "",
			bytes: last.bytes,
			cacheControl: last.headers["cache-control"] ?? "",
			vary: last.headers.vary ?? "",
			mainMs: +((after.main - before.main) / n).toFixed(2),
			otherMs: +((after.other - before.other) / n).toFixed(2),
			wallP50: +walls[Math.floor(n / 2)].toFixed(2),
			wallP95: +walls[Math.floor(n * 0.95)].toFixed(2),
		}),
	)
	return last
}

const withParam = (path, param) => `${path}${path.includes("?") ? "&" : "?"}${param}`
for (const target of targets) {
	const [path, label = path] = target.split(",")
	// Warm the data caches and the JIT for this page.
	for (let i = 0; i < 30; i++) await get(withParam(path, `warm=${i}`), BROWSER)
	await batch(label, "render", count, (i) => withParam(path, `pc=${Date.now()}-${i}`))
	if (process.env.STALE === "1") {
		await get(path, BROWSER)
		await get(path, BROWSER)
		await batch(label, "stale", Math.min(count, 40), () => path, {}, 1500)
		continue
	}
	await get(path, BROWSER)
	const filled = await get(path, BROWSER)
	await batch(label, "hit br", count, () => path)
	await batch(label, "hit gzip", count, () => path, { "Accept-Encoding": "gzip, deflate" })
	await batch(label, "hit identity", Math.ceil(count / 4), () => path, { "Accept-Encoding": "identity" })
	const etag = (await get(path, BROWSER)).headers.etag ?? filled.headers.etag
	if (etag) await batch(label, "hit 304", count, () => path, { "If-None-Match": etag })
	await batch(label, "hit analytics cookies", count, () => path, { Cookie: ANALYTICS })
	await batch(label, "hit tracking parameters", count, (i) => withParam(path, `utm_source=bench&utm_campaign=c${i}&fbclid=IwAR${i}x${Date.now()}`))
}
agent.destroy()
