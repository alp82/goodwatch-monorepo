// prof-preload.mjs: a control port for a CPU profile of the main thread. Load with NODE_OPTIONS="--import /work/prof-preload.mjs".
// GET :9465/start?interval=100 starts the V8 sampling profiler, GET :9465/stop?name=x writes /out/x.cpuprofile.
import { writeFileSync } from "node:fs"
import { createServer } from "node:http"
import { Session } from "node:inspector"
import { isMainThread } from "node:worker_threads"

if (isMainThread && process.argv[1]?.includes("remix-serve")) {
	const session = new Session()
	session.connect()
	const post = (method, params) =>
		new Promise((resolve, reject) => session.post(method, params, (error, result) => (error ? reject(error) : resolve(result))))
	const server = createServer(async (request, response) => {
		const url = new URL(request.url, "http://x")
		if (url.pathname === "/start") {
			await post("Profiler.enable")
			await post("Profiler.setSamplingInterval", { interval: Number(url.searchParams.get("interval")) || 100 })
			await post("Profiler.start")
		} else if (url.pathname === "/stop") {
			const { profile } = await post("Profiler.stop")
			writeFileSync(`/out/${url.searchParams.get("name") || "profile"}.cpuprofile`, JSON.stringify(profile))
		}
		response.end("ok\n")
	})
	server.on("error", () => {})
	server.listen(9465, "0.0.0.0")
	server.unref()
}
