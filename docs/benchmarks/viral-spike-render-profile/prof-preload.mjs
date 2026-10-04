// Measurement preload for the render profile ("Profile the server render of title pages and cut its main-thread time").
// Loaded with `node --import /work/prof-preload.mjs`. It is not part of the app.
//
// What it does:
// - Follows every request to the public server with AsyncLocalStorage and writes one JSON line per request to
//   $GW_PROF_OUT/requests.jsonl: marks with wall time and main-thread CPU time, write counts, and bytes.
// - Exposes `globalThis.__gw.mark(name)` and `globalThis.__gw.add(name, value)` for the measurement patch in the app.
// - Records every garbage collection and every event-loop stall above GW_PROF_STALL_MS (default 50) with a timestamp.
// - Serves a control port (GW_PROF_PORT, default 9465): /start, /stop?name=x (CPU profile), /stats, /reset, /flush.
//
// Known limit: NODE_OPTIONS also loads this file in the query encoder's worker thread, where the control port is
// already taken, so the encoder fails to start. The runs of this ticket never search, and the search index still loads.
// To measure searches, start the control server only when `isMainThread` is true.
import { AsyncLocalStorage } from "node:async_hooks"
import { subscribe } from "node:diagnostics_channel"
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import { Session } from "node:inspector"
import { PerformanceObserver, monitorEventLoopDelay, performance } from "node:perf_hooks"

const OUT = process.env.GW_PROF_OUT || "/out"
const STALL_MS = Number(process.env.GW_PROF_STALL_MS) || 50
const PORT = Number(process.env.GW_PROF_PORT) || 9465
mkdirSync(OUT, { recursive: true })

const als = new AsyncLocalStorage()
const cpuMs = () => {
	const usage = process.threadCpuUsage()
	return (usage.user + usage.system) / 1000
}
const lines = []
const flush = () => {
	if (!lines.length) return
	appendFileSync(`${OUT}/requests.jsonl`, lines.splice(0).join(""))
}

let ignoredServer
const current = { inFlight: 0 }
// The record of the request whose synchronous code ran last, for stall attribution.
let lastActive = null

globalThis.__gw = {
	mark(name) {
		const record = als.getStore()
		if (!record) return
		lastActive = record
		record.marks.push([name, +(performance.now() - record.t0).toFixed(2), +(cpuMs() - record.cpu0).toFixed(2)])
	},
	add(name, value) {
		const record = als.getStore()
		if (!record) return
		record.sums[name] = +((record.sums[name] ?? 0) + value).toFixed(3)
	},
	time(name, fn) {
		const start = performance.now()
		try {
			return fn()
		} finally {
			globalThis.__gw.add(name, performance.now() - start)
		}
	},
}

subscribe("http.server.request.start", ({ request, response, server }) => {
	if (server === ignoredServer) return
	current.inFlight++
	const record = {
		url: request.url,
		ua: (request.headers["user-agent"] ?? "").slice(0, 24),
		at: Date.now(),
		t0: performance.now(),
		cpu0: cpuMs(),
		inFlightAtStart: current.inFlight,
		marks: [],
		sums: {},
		writes: 0,
		bytes: 0,
	}
	als.enterWith(record)
	lastActive = record
	// This wrapper is the innermost one: the compression middleware wraps write and end later, so these are the
	// compressed bytes as they go to the socket.
	const { write, end, writeHead } = response
	const count = (chunk) => {
		if (!chunk || typeof chunk === "function") return
		if (record.writes === 0) record.marks.push(["first_socket_write", +(performance.now() - record.t0).toFixed(2), +(cpuMs() - record.cpu0).toFixed(2)])
		record.writes++
		record.bytes += typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.length
	}
	response.writeHead = function (...args) {
		if (!record.headers) record.headers = +(performance.now() - record.t0).toFixed(2)
		return Reflect.apply(writeHead, this, args)
	}
	response.write = function (chunk, ...rest) {
		count(chunk)
		return Reflect.apply(write, this, [chunk, ...rest])
	}
	response.end = function (chunk, ...rest) {
		count(chunk)
		return Reflect.apply(end, this, [chunk, ...rest])
	}
	response.once("close", () => {
		current.inFlight--
		record.status = response.statusCode
		record.encoding = String(response.getHeader("content-encoding") ?? "")
		record.total = +(performance.now() - record.t0).toFixed(2)
		record.cpu = +(cpuMs() - record.cpu0).toFixed(2)
		const { t0, cpu0, ...rest } = record
		lines.push(`${JSON.stringify(rest)}\n`)
	})
})

// Garbage collections on the main thread: each pause with its kind.
const GC_KINDS = { 1: "scavenge", 2: "minor_mark_sweep", 4: "mark_sweep", 8: "incremental", 16: "weak_callbacks" }
const gc = { count: {}, ms: {}, long: [] }
new PerformanceObserver((list) => {
	for (const entry of list.getEntries()) {
		const kind = GC_KINDS[entry.detail?.kind] ?? String(entry.detail?.kind)
		gc.count[kind] = (gc.count[kind] ?? 0) + 1
		gc.ms[kind] = +((gc.ms[kind] ?? 0) + entry.duration).toFixed(2)
		if (entry.duration >= 10)
			gc.long.push({ at: Date.now(), startMs: +entry.startTime.toFixed(1), kind, ms: +entry.duration.toFixed(1) })
	}
}).observe({ entryTypes: ["gc"] })

// Event-loop stalls: a 5 ms timer that reports how late it fired, with the request that ran last.
const stalls = []
let expected = performance.now() + 5
setInterval(() => {
	const now = performance.now()
	const late = now - expected
	if (late >= STALL_MS)
		stalls.push({
			at: Date.now(),
			endMs: +now.toFixed(1),
			ms: +late.toFixed(1),
			lastUrl: lastActive?.url,
			lastMark: lastActive?.marks.at(-1)?.[0],
			inFlight: current.inFlight,
		})
	expected = now + 5
}, 5).unref()
const loopDelay = monitorEventLoopDelay({ resolution: 10 })
loopDelay.enable()

let elu0 = performance.eventLoopUtilization()
let stats0 = { at: performance.now(), cpu: cpuMs(), process: process.cpuUsage() }

const session = new Session()
session.connect()
const post = (method, params) =>
	new Promise((resolve, reject) => session.post(method, params, (error, result) => (error ? reject(error) : resolve(result))))

const control = createServer(async (request, response) => {
	const url = new URL(request.url, "http://x")
	const reply = (body) => {
		response.writeHead(200, { "Content-Type": "application/json" })
		response.end(`${JSON.stringify(body)}\n`)
	}
	try {
		if (url.pathname === "/start") {
			await post("Profiler.enable")
			await post("Profiler.setSamplingInterval", { interval: Number(url.searchParams.get("interval")) || 200 })
			await post("Profiler.start")
			return reply({ started: true })
		}
		if (url.pathname === "/stop") {
			const { profile } = await post("Profiler.stop")
			const name = (url.searchParams.get("name") || "profile").replace(/[^\w.-]/g, "_")
			// Wall-clock anchor for the profile's own clock, so stalls can be matched to samples.
			profile.gwAnchor = { dateNow: Date.now(), performanceNow: performance.now() }
			writeFileSync(`${OUT}/${name}.cpuprofile`, JSON.stringify(profile))
			return reply({ written: `${name}.cpuprofile`, nodes: profile.nodes.length, samples: profile.samples.length })
		}
		if (url.pathname === "/stats" || url.pathname === "/reset") {
			flush()
			const elu = performance.eventLoopUtilization(elu0)
			const now = { at: performance.now(), cpu: cpuMs(), process: process.cpuUsage() }
			const memory = process.memoryUsage()
			const body = {
				windowMs: +(now.at - stats0.at).toFixed(0),
				mainThreadCpuMs: +(now.cpu - stats0.cpu).toFixed(1),
				processCpuMs: +((now.process.user + now.process.system - stats0.process.user - stats0.process.system) / 1000).toFixed(1),
				eventLoopUtilization: +elu.utilization.toFixed(4),
				loopDelayMs: {
					p50: +(loopDelay.percentile(50) / 1e6).toFixed(1),
					p99: +(loopDelay.percentile(99) / 1e6).toFixed(1),
					max: +(loopDelay.max / 1e6).toFixed(1),
				},
				gc: { count: { ...gc.count }, ms: { ...gc.ms }, long: gc.long.slice() },
				stalls: stalls.slice(),
				rssMb: Math.round(memory.rss / 1048576),
				heapUsedMb: Math.round(memory.heapUsed / 1048576),
				heapTotalMb: Math.round(memory.heapTotal / 1048576),
				inFlight: current.inFlight,
			}
			if (url.pathname === "/reset") {
				elu0 = performance.eventLoopUtilization()
				stats0 = now
				loopDelay.reset()
				gc.count = {}
				gc.ms = {}
				gc.long.length = 0
				stalls.length = 0
			}
			return reply(body)
		}
		if (url.pathname === "/flush") {
			flush()
			return reply({ flushed: true })
		}
		response.writeHead(404).end()
	} catch (error) {
		response.writeHead(500).end(String(error))
	}
})
ignoredServer = control
control.listen(PORT, "0.0.0.0")
control.unref()
setInterval(flush, 2000).unref()
