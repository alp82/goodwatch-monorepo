// The process's start and end, as the proxy and the container runtime see them: whether it is ready for requests, and
// a shutdown that finishes what it has accepted and then exits.
//
// Readiness (GET /health/ready) answers 200 once every registered check passes: the title snapshot's first check
// (Discover needs it) and the search index's first load (it blocks the event loop for about 2 seconds, which a new
// process should get behind it before it takes requests). After READY_MAX_WAIT_MS it answers 200 without them: a
// process that can't reach Redis or Crate still serves most pages, and a container that never turns healthy is taken
// out of the proxy. The query encoder isn't waited for: it loads in a worker thread, and searches get basic results
// until it's there. Readiness answers 503 from the moment a shutdown begins. Liveness
// (GET /health/live) answers 200 whenever the event loop turns. Both are answered here, before Express: they aren't
// logged, compressed, or counted as page requests.
//
// Shutdown on SIGTERM, in this order:
// 1. Readiness turns 503 and every response says `Connection: close`, so the proxy keeps no idle connection to this
//    process. The process keeps serving for SHUTDOWN_DELAY_MS (8 seconds): a proxy that checks readiness every 5
//    seconds stops sending requests in that time, and one that doesn't loses nothing by it.
// 2. It waits for a moment without a request in flight (at most QUIET_WAIT_MS), then stops listening, which also
//    closes idle connections. Requests still in flight get SHUTDOWN_DRAIN_MS to finish before their connections are
//    cut.
// 3. The registered stops run (timers, the metrics listener, Redis, the query encoder, the share card renderers).
// 4. The process exits with code 0. A timer set at the signal exits with code 1 after SHUTDOWN_HARD_MS, whatever
//    state the steps are in. Coolify stops a container with `docker stop --time=30`, so the default leaves 5 seconds
//    before Docker's SIGKILL.
// SIGINT (Ctrl+C) skips the delay of step 1. A second signal exits at once.
//
// `remix-serve` owns the HTTP server and answers both signals with `server.close()`, which stops listening at once
// and never exits. This file finds the server through Node's request event, as the browser gate does, registers its
// signal listener first (the server build is imported before `remix-serve` registers its own), and makes
// `server.close()` do nothing from then on, so that the listener stays open through steps 1 and 2. A process that
// never got a request has nothing to drain and goes straight to step 3.
import { subscribe } from "node:diagnostics_channel"
import {
	Server as HttpServer,
	type IncomingMessage,
	type Server,
	type ServerResponse,
} from "node:http"

export const READY_PATH = "/health/ready"
export const LIVE_PATH = "/health/live"

// How long a moment without requests is waited for before the listener closes anyway.
const QUIET_WAIT_MS = 2_000
// How long the registered stops may take together.
const STOPS_MS = 1_000

type Phase = "running" | "draining" | "closing" | "stopping"

const key = Symbol.for("goodwatch.lifecycle")
const shared = globalThis as typeof globalThis & {
	[key]?: {
		started: boolean
		phase: Phase
		servers: Set<Server>
		internal: WeakSet<Server>
		inFlight: number
		responses: Set<ServerResponse>
		whenQuiet: Array<() => void>
		stops: Map<string, () => unknown>
		checks: Map<string, () => boolean>
	}
}
shared[key] ??= {
	started: false,
	phase: "running",
	servers: new Set(),
	internal: new WeakSet(),
	inFlight: 0,
	responses: new Set(),
	whenQuiet: [],
	stops: new Map(),
	checks: new Map(),
}
const state = shared[key]

const setting = (name: string, fallback: number) => {
	const value = Number(process.env[name])
	return process.env[name] && Number.isFinite(value) && value >= 0
		? value
		: fallback
}

/** Registers what must stop before the process exits: a timer, a listener, a client. A name registers once. */
export function onShutdown(name: string, stop: () => unknown): void {
	state.stops.set(name, stop)
}

/** Registers a condition that readiness waits for. A name registers once. */
export function addReadinessCheck(name: string, check: () => boolean): void {
	state.checks.set(name, check)
}

/** Keeps a server that isn't the public one (the metrics listener) out of the request count and the shutdown. */
export function ignoreInLifecycle(server: Server): void {
	state.internal.add(server)
	state.servers.delete(server)
}

/** Whether a shutdown has begun. Background loops use it to stop rescheduling themselves. */
export const isShuttingDown = () => state.phase !== "running"

/** What the readiness endpoint reports. */
export function readiness(uptimeMs = process.uptime() * 1000): {
	ready: boolean
	status: "ready" | "starting" | "draining"
	waitingFor: string[]
} {
	if (state.phase !== "running")
		return { ready: false, status: "draining", waitingFor: [] }
	const waitingFor: string[] = []
	for (const [name, check] of state.checks) {
		let passed = false
		try {
			passed = check()
		} catch {
			// Counts as not passed.
		}
		if (!passed) waitingFor.push(name)
	}
	const ready =
		!waitingFor.length || uptimeMs >= setting("READY_MAX_WAIT_MS", 30_000)
	return { ready, status: ready ? "ready" : "starting", waitingFor }
}

/** Whether a request target is one of the health endpoints. The metrics leave them out. */
export function isHealthPath(url: string | undefined): boolean {
	if (!url?.startsWith("/health/")) return false
	const at = url.indexOf("?")
	const pathname = at < 0 ? url : url.slice(0, at)
	return pathname === READY_PATH || pathname === LIVE_PATH
}

function answerHealth(request: IncomingMessage, response: ServerResponse) {
	const at = (request.url as string).indexOf("?")
	const pathname = at < 0 ? request.url : (request.url as string).slice(0, at)
	const report =
		pathname === LIVE_PATH
			? { ready: true, status: "live", waitingFor: [] }
			: readiness()
	const body = JSON.stringify({
		status: report.status,
		waitingFor: report.waitingFor,
	})
	response.writeHead(report.ready ? 200 : 503, {
		"Content-Type": "application/json; charset=utf-8",
		"Content-Length": String(Buffer.byteLength(body)),
		"Cache-Control": "private, no-store",
		"X-Robots-Tag": "noindex",
	})
	response.end(request.method === "HEAD" ? undefined : body)
}

// Answers the health endpoints before the listeners that were there. Same technique as the browser gate.
function putHealthFirst(server: Server): void {
	const listeners = server.listeners("request")
	server.removeAllListeners("request")
	server.on("request", (request: IncomingMessage, response: ServerResponse) => {
		if (
			(request.method === "GET" || request.method === "HEAD") &&
			isHealthPath(request.url)
		)
			return answerHealth(request, response)
		for (const listener of listeners)
			Reflect.apply(listener, server, [request, response])
	})
}

function requestEnded(this: ServerResponse) {
	state.responses.delete(this)
	state.inFlight--
	// A connection that was kept alive is idle now. Nothing more will come over it once the listener is closed.
	if (state.phase === "closing")
		setImmediate(() => {
			for (const server of state.servers) server.closeIdleConnections()
		})
	if (state.inFlight > 0) return
	for (const resolve of state.whenQuiet.splice(0)) resolve()
}

const sleep = (ms: number) =>
	new Promise<false>((resolve) => setTimeout(() => resolve(false), ms))

// True when no request is in flight, now or within the time given.
function quiet(withinMs: number): Promise<boolean> {
	if (state.inFlight <= 0) return Promise.resolve(true)
	return Promise.race([
		new Promise<true>((resolve) => state.whenQuiet.push(() => resolve(true))),
		sleep(withinMs),
	])
}

// The real close: `close` on the server itself does nothing once a shutdown has begun.
const closed = (server: Server) =>
	new Promise<true>((resolve) =>
		HttpServer.prototype.close.call(server, () => resolve(true)),
	)

async function shutDown(signal: NodeJS.Signals): Promise<void> {
	if (state.phase !== "running") {
		console.error(`Shutdown: second signal (${signal}), exiting now`)
		process.exit(1)
	}
	state.phase = "draining"
	const startedAt = performance.now()
	const elapsed = () => Math.round(performance.now() - startedAt)
	const hardMs = setting("SHUTDOWN_HARD_MS", 25_000)
	setTimeout(() => {
		console.error(
			`Shutdown: forced exit after ${elapsed()} ms in step "${state.phase}" with ${state.inFlight} requests in flight`,
		)
		process.exit(1)
	}, hardMs)
	// `remix-serve`'s own signal listener runs after this one and calls close().
	for (const server of state.servers) server.close = () => server
	for (const response of state.responses)
		if (!response.headersSent) response.setHeader("Connection", "close")
	const delayMs =
		signal === "SIGTERM" && state.servers.size
			? setting("SHUTDOWN_DELAY_MS", 8_000)
			: 0
	console.info(
		`Shutdown: ${signal} received with ${state.inFlight} requests in flight; serving for ${delayMs} ms more, not ready`,
	)
	try {
		if (delayMs) await sleep(delayMs)
		await quiet(QUIET_WAIT_MS)
		state.phase = "closing"
		const inFlightAtClose = state.inFlight
		const servers = [...state.servers]
		const allClosed = Promise.all(servers.map(closed))
		const drained = await Promise.race([
			allClosed,
			sleep(setting("SHUTDOWN_DRAIN_MS", 10_000)),
		])
		const cut = drained ? 0 : state.inFlight
		if (!drained) for (const server of servers) server.closeAllConnections()
		console.info(
			`Shutdown: stopped listening after ${elapsed()} ms with ${inFlightAtClose} requests in flight, ${cut} cut`,
		)
		state.phase = "stopping"
		const failed: string[] = []
		const stops = [...state.stops].map(async ([name, stop]) => {
			try {
				await stop()
			} catch {
				failed.push(name)
			}
		})
		const stopped = await Promise.race([
			Promise.all(stops).then(() => true),
			sleep(STOPS_MS),
		])
		console.info(
			`Shutdown: ${state.stops.size} stops ${stopped ? "ran" : "timed out"}${failed.length ? ` (failed: ${failed.join(", ")})` : ""}; exit 0 after ${elapsed()} ms`,
		)
	} catch (error) {
		console.error("Shutdown: failed, exiting anyway:", error)
	}
	process.exit(0)
}

/**
 * Starts readiness and the shutdown sequence, once per process. Call it while the server build loads, before
 * `remix-serve` registers its own signal listeners.
 */
export function startLifecycle(): void {
	if (state.started) return
	state.started = true
	subscribe("http.server.request.start", (message) => {
		const { server, response } = message as {
			server: Server
			response: ServerResponse
		}
		if (state.internal.has(server)) return
		if (!state.servers.has(server)) {
			state.servers.add(server)
			putHealthFirst(server)
			// A request that arrives after the signal on a server not seen before: close() must stay harmless here too.
			if (state.phase === "draining") server.close = () => server
		}
		state.inFlight++
		state.responses.add(response)
		response.once("close", requestEnded)
		if (state.phase !== "running" && !response.headersSent)
			response.setHeader("Connection", "close")
	})
	// The dev server handles its own signals, and Ctrl+C there should stop it at once.
	if (process.env.NODE_ENV !== "production") return
	for (const signal of ["SIGTERM", "SIGINT"] as const)
		process.on(signal, () => void shutDown(signal))
}
