// percall.mjs: main-thread CPU per static request, by file and by client encoding.
// Sends requests one at a time over one keep-alive connection, as the proxy does, and reads the server process's CPU
// time from the host's /proc before and after each batch (mounted at /hostproc).
//
//   node percall.mjs <base-url> <server-pid> <count> <path>[,label] ...
//
// For each path it runs: the first request after start ("first"), then <count> requests with Brotli, with gzip, with
// no encoding, and with If-None-Match. Output: one JSON line per case.
import { readFileSync, readdirSync } from "node:fs"
import http from "node:http"

const [base, pid, countArg, ...targets] = process.argv.slice(2)
const count = Number(countArg)
const agent = new http.Agent({ keepAlive: true, maxSockets: 1 })
const TICK_MS = 10 // CLK_TCK is 100 on Linux

const cpuOf = (path) => {
	const stat = readFileSync(path, "utf8")
	const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ")
	return (Number(fields[11]) + Number(fields[12])) * TICK_MS
}
// Main thread: the task whose id is the process id. Other threads: the libuv pool (file reads, compression) and V8.
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

const BROWSER = {
	"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
	Cookie: "gw_browser=1",
}

async function batch(label, path, extra, n) {
	const headers = { ...BROWSER, ...extra }
	const before = cpu()
	let last
	let wall = 0
	for (let i = 0; i < n; i++) {
		last = await get(path, headers)
		wall += last.ms
	}
	const after = cpu()
	console.log(
		JSON.stringify({
			label,
			case: extra.case,
			n,
			status: last.status,
			encoding: last.headers["content-encoding"] ?? "",
			bytes: last.bytes,
			contentLength: last.headers["content-length"] ?? "",
			cacheControl: last.headers["cache-control"] ?? "",
			mainMs: +((after.main - before.main) / n).toFixed(3),
			otherMs: +((after.other - before.other) / n).toFixed(3),
			wallMs: +(wall / n).toFixed(3),
		}),
	)
	return last
}

for (const target of targets) {
	const [path, label = path] = target.split(",")
	const first = await get(path, { ...BROWSER, "Accept-Encoding": "gzip, deflate, br, zstd" })
	console.log(JSON.stringify({ label, case: "first", status: first.status, bytes: first.bytes, wallMs: +first.ms.toFixed(2) }))
	await batch(label, path, { "Accept-Encoding": "gzip, deflate, br, zstd", case: "br" }, count)
	await batch(label, path, { "Accept-Encoding": "gzip, deflate", case: "gzip" }, count)
	await batch(label, path, { "Accept-Encoding": "identity", case: "identity" }, Math.ceil(count / 4))
	const etag = first.headers.etag
	if (etag)
		await batch(label, path, { "Accept-Encoding": "gzip, deflate, br, zstd", "If-None-Match": etag, case: "304" }, count)
}
agent.destroy()
