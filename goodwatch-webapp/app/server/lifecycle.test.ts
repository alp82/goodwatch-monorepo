// The shutdown sequence and readiness, on the real `remix-serve` in a child process: lifecycle.fixture.ts stands in for
// the server build, so `remix-serve`'s own signal listeners run as they do in production.
import assert from "node:assert/strict"
import { type ChildProcess, spawn } from "node:child_process"
import { Agent, request as httpRequest } from "node:http"
import { type AddressInfo, connect, createServer } from "node:net"
import { dirname, join } from "node:path"
import { after, test } from "node:test"
import { fileURLToPath } from "node:url"
import {
	addReadinessCheck,
	isHealthPath,
	readiness,
} from "./lifecycle.server.ts"

const here = dirname(fileURLToPath(import.meta.url))
const remixServe = join(here, "../../node_modules/@remix-run/serve/dist/cli.js")

const freePort = () =>
	new Promise<number>((resolve) => {
		const probe = createServer()
		probe.listen(0, "127.0.0.1", () => {
			const { port } = probe.address() as AddressInfo
			probe.close(() => resolve(port))
		})
	})

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type Answer = { status: number; connection: string | undefined; body: string }

type Running = {
	child: ChildProcess
	port: number
	log: () => string
	get: (path: string, agent?: Agent) => Promise<Answer>
	exited: Promise<{ code: number | null; signal: string | null; at: number }>
}

const children = new Set<ChildProcess>()
after(() => {
	for (const child of children) child.kill("SIGKILL")
})

async function start(env: Record<string, string> = {}): Promise<Running> {
	const port = await freePort()
	const child = spawn(
		process.execPath,
		[remixServe, join(here, "lifecycle.fixture.ts")],
		{
			cwd: here,
			env: {
				...process.env,
				NODE_ENV: "production",
				HOST: "127.0.0.1",
				PORT: String(port),
				...env,
			},
			stdio: ["ignore", "pipe", "pipe"],
		},
	)
	children.add(child)
	let output = ""
	child.stdout?.on("data", (chunk) => {
		output += chunk
	})
	child.stderr?.on("data", (chunk) => {
		output += chunk
	})
	const exited = new Promise<Awaited<Running["exited"]>>((resolve) =>
		child.once("exit", (code, signal) => {
			children.delete(child)
			resolve({ code, signal, at: performance.now() })
		}),
	)
	const get = (path: string, agent?: Agent) =>
		new Promise<Answer>((resolve, reject) => {
			const request = httpRequest(
				{ host: "127.0.0.1", port, path, agent },
				(response) => {
					let body = ""
					response.setEncoding("utf8")
					response.on("data", (chunk) => {
						body += chunk
					})
					response.on("end", () =>
						resolve({
							status: response.statusCode ?? 0,
							connection: response.headers.connection,
							body,
						}),
					)
					response.on("error", reject)
				},
			)
			request.on("error", reject)
			request.end()
		})
	for (let waited = 0; !output.includes("[remix-serve]"); waited += 20) {
		if (waited > 10_000) throw new Error(`Server didn't start: ${output}`)
		await sleep(20)
	}
	return { child, port, log: () => output, get, exited }
}

const refused = (port: number) =>
	new Promise<boolean>((resolve) => {
		const socket = connect(port, "127.0.0.1")
		socket.once("connect", () => {
			socket.destroy()
			resolve(false)
		})
		socket.once("error", () => resolve(true))
	})

test("remix-serve alone stops listening on SIGTERM and never exits", async () => {
	const server = await start({ FIXTURE_LIFECYCLE: "off" })
	assert.equal((await server.get("/fast")).status, 200)
	server.child.kill("SIGTERM")
	const outcome = await Promise.race([server.exited, sleep(1_500)])
	assert.equal(outcome, undefined, "the process is still there")
	assert.equal(await refused(server.port), true)
	server.child.kill("SIGKILL")
	await server.exited
})

test("SIGTERM: serves through the delay as not ready, finishes the request in flight, runs the stops, exits 0", async () => {
	const server = await start({ SHUTDOWN_DELAY_MS: "400" })
	const keepAlive = new Agent({ keepAlive: true })
	const before = await server.get("/fast", keepAlive)
	assert.equal(before.status, 200)
	assert.equal(before.connection, "keep-alive")
	assert.equal((await server.get("/health/ready")).status, 200)

	// In flight when the signal arrives, and longer than the delay.
	const slow = server.get("/slow?ms=1200")
	await sleep(100)
	const signalAt = performance.now()
	server.child.kill("SIGTERM")
	await sleep(100)

	// During the delay: not ready, still serving, and no connection is kept.
	const ready = await server.get("/health/ready")
	assert.equal(ready.status, 503)
	assert.equal(JSON.parse(ready.body).status, "draining")
	assert.equal((await server.get("/health/live")).status, 200)
	const during = await server.get("/fast")
	assert.equal(during.status, 200)
	assert.equal(during.connection, "close")

	// After the delay the listener is still open, because a request is in flight.
	await sleep(500)
	assert.equal((await server.get("/fast")).status, 200)

	assert.deepEqual(await slow, {
		status: 200,
		connection: "close",
		body: "done",
	})
	const exit = await server.exited
	assert.equal(exit.code, 0)
	assert.equal(exit.signal, null)
	const took = exit.at - signalAt
	assert.ok(took >= 1_000, `waited for the request in flight (${took} ms)`)
	assert.ok(took < 2_500, `exited soon after it (${took} ms)`)
	assert.match(server.log(), /fixture: timer stopped/)
	assert.match(server.log(), /Shutdown: 1 stops ran; exit 0/)
	assert.equal(await refused(server.port), true)
	keepAlive.destroy()
})

test("an idle process exits right after the delay, and idle keep-alive connections don't hold it", async () => {
	const server = await start({ SHUTDOWN_DELAY_MS: "300" })
	const keepAlive = new Agent({ keepAlive: true })
	assert.equal((await server.get("/fast", keepAlive)).connection, "keep-alive")
	const signalAt = performance.now()
	server.child.kill("SIGTERM")
	const exit = await server.exited
	assert.equal(exit.code, 0)
	const took = exit.at - signalAt
	assert.ok(took >= 300 && took < 1_300, `took ${took} ms`)
	keepAlive.destroy()
})

test("a recent request longer than the quiet wait finishes after the listener closed", async () => {
	const server = await start({ SHUTDOWN_DELAY_MS: "0" })
	const slow = server.get("/slow?ms=3000")
	await sleep(100)
	server.child.kill("SIGTERM")
	// The quiet wait is 2 seconds. After it, new connections are refused and the request is still in flight.
	await sleep(2_300)
	assert.equal(await refused(server.port), true)
	assert.equal((await slow).body, "done")
	assert.equal((await server.exited).code, 0)
	assert.match(server.log(), /0 requests cut/)
})

test("a request that outlasts the drain time is cut, and the exit code is still 0", async () => {
	const server = await start({
		SHUTDOWN_DELAY_MS: "0",
		SHUTDOWN_DRAIN_MS: "300",
	})
	const slow = server.get("/slow?ms=20000")
	await sleep(100)
	const signalAt = performance.now()
	server.child.kill("SIGTERM")
	await assert.rejects(slow)
	const exit = await server.exited
	assert.equal(exit.code, 0)
	assert.ok(exit.at - signalAt < 3_500, `took ${exit.at - signalAt} ms`)
	assert.match(server.log(), /1 requests cut \(GET \/slow after 0 s\)/)
})

test("a long-lived request doesn't close the listener early: the process serves until it exits, then cuts it", async () => {
	const server = await start({
		SHUTDOWN_DELAY_MS: "800",
		SHUTDOWN_DRAIN_MS: "400",
	})
	const longLived = server.get("/slow?ms=20000")
	// Older than the drain time when the signal arrives.
	await sleep(500)
	const signalAt = performance.now()
	server.child.kill("SIGTERM")
	// A container that runs without listening is what a proxy answers with 502, so that state must stay short.
	let served = 0
	while (performance.now() - signalAt < 700) {
		assert.equal((await server.get("/fast")).status, 200)
		served++
		await sleep(50)
	}
	assert.ok(served >= 8, `served ${served} requests during the delay`)
	await assert.rejects(longLived)
	const exit = await server.exited
	assert.equal(exit.code, 0)
	const took = exit.at - signalAt
	assert.ok(took >= 800 && took < 1_300, `took ${took} ms`)
	const log = server.log()
	assert.match(log, /1 requests cut \(GET \/slow after 1 s\)/)
	const closedAfter = Number(log.match(/stopped listening after (\d+) ms/)?.[1])
	const exitAfter = Number(log.match(/exit 0 after (\d+) ms/)?.[1])
	assert.ok(exitAfter - closedAfter < 100, `${exitAfter - closedAfter} ms`)
})

test("the hard deadline exits with code 1 whatever is in flight", async () => {
	const server = await start({
		SHUTDOWN_DELAY_MS: "5000",
		SHUTDOWN_HARD_MS: "500",
	})
	const slow = server.get("/slow?ms=20000")
	slow.catch(() => {})
	await sleep(100)
	const signalAt = performance.now()
	server.child.kill("SIGTERM")
	const exit = await server.exited
	assert.equal(exit.code, 1)
	assert.ok(exit.at - signalAt < 1_500, `took ${exit.at - signalAt} ms`)
	assert.match(server.log(), /Shutdown: forced exit/)
})

test("SIGINT skips the delay, and a process that never got a request exits at once", async () => {
	const server = await start({ SHUTDOWN_DELAY_MS: "5000" })
	assert.equal((await server.get("/fast")).status, 200)
	let signalAt = performance.now()
	server.child.kill("SIGINT")
	let exit = await server.exited
	assert.equal(exit.code, 0)
	assert.ok(exit.at - signalAt < 1_000, `took ${exit.at - signalAt} ms`)

	const untouched = await start({ SHUTDOWN_DELAY_MS: "5000" })
	signalAt = performance.now()
	untouched.child.kill("SIGTERM")
	exit = await untouched.exited
	assert.equal(exit.code, 0)
	assert.ok(exit.at - signalAt < 1_000, `took ${exit.at - signalAt} ms`)
})

test("readiness answers 503 until its checks pass, and the health endpoints never reach the app", async () => {
	const server = await start({ FIXTURE_READY_AFTER_MS: "700" })
	const starting = await server.get("/health/ready")
	assert.equal(starting.status, 503)
	assert.deepEqual(JSON.parse(starting.body), {
		status: "starting",
		waitingFor: ["fixture"],
	})
	assert.equal((await server.get("/health/live")).status, 200)
	// The app serves whether or not it is ready.
	assert.equal((await server.get("/fast")).status, 200)
	await sleep(800)
	const ready = await server.get("/health/ready?probe=1")
	assert.equal(ready.status, 200)
	assert.equal(JSON.parse(ready.body).status, "ready")
	// morgan logs what reaches Express.
	assert.match(server.log(), /GET \/fast 200/)
	assert.doesNotMatch(server.log(), /GET \/health/)
	server.child.kill("SIGKILL")
	await server.exited
})

test("readiness stops waiting for its checks after READY_MAX_WAIT_MS", () => {
	addReadinessCheck("never", () => false)
	addReadinessCheck("throws", () => {
		throw new Error("no")
	})
	assert.deepEqual(readiness(1_000), {
		ready: false,
		status: "starting",
		waitingFor: ["never", "throws"],
	})
	assert.equal(readiness(29_999).ready, false)
	assert.deepEqual(readiness(30_000), {
		ready: true,
		status: "ready",
		waitingFor: ["never", "throws"],
	})
})

test("only the two health paths are health paths", () => {
	for (const url of ["/health/ready", "/health/live", "/health/ready?x=1"])
		assert.equal(isHealthPath(url), true)
	for (const url of ["/", "/health", "/health/", "/health/ready/x", undefined])
		assert.equal(isHealthPath(url), false)
})
