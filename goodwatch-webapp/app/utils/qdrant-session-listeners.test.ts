// The Qdrant gRPC client keeps one HTTP/2 session for all calls. Unpatched, its transport (@bufbuild/connect-node
// 0.10.1) adds an "error" listener to that session for every call and never removes it: the listeners and what they
// hold grow by one per call for as long as the session lives, and Node warns about a possible leak at the eleventh.
// patches/@bufbuild+connect-node+0.10.1.patch takes the listener out. These tests run real calls against a local
// HTTP/2 server that answers like Qdrant, with an empty result.
import assert from "node:assert/strict"
import http2 from "node:http2"
import { syncBuiltinESMExports } from "node:module"
import type { AddressInfo, Socket } from "node:net"
import { after, test } from "node:test"
import { gzipSync } from "node:zlib"

// An empty gRPC message, compressed as Qdrant compresses its responses: flag 1, the length, then the gzip of nothing.
// It decodes to a response without points. Decompression matters here: while the client inflates the message, the
// stream closes, and Node then no longer names the stream's session.
const body = gzipSync(Buffer.alloc(0))
const header = Buffer.alloc(5)
header.writeUInt8(1, 0)
header.writeUInt32BE(body.length, 1)
const EMPTY_GRPC_MESSAGE = Buffer.concat([header, body])

// What the server does with the next calls.
let mode: "answer" | "not found" | "break the connection" = "answer"
const sockets = new Set<Socket>()

const server = http2.createServer()
server.on("connection", (socket: Socket) => {
	sockets.add(socket)
	socket.on("close", () => sockets.delete(socket))
})
server.on("stream", (stream) => {
	// The client reports the broken frame back, which fails the server's stream too.
	stream.on("error", () => {})
	stream.resume()
	stream.on("end", () => {
		if (mode === "break the connection") {
			// A frame that claims 16 MB, which is more than a client accepts: the client's session fails.
			for (const socket of sockets)
				socket.write(Buffer.from([0xff, 0xff, 0xff, 0, 0, 0, 0, 0, 1]))
			return
		}
		if (mode === "not found") {
			// How a gRPC server reports an error: headers only, and the client never reads a body to its end.
			stream.respond(
				{
					":status": 200,
					"content-type": "application/grpc",
					"grpc-status": "5",
					"grpc-message": "not found",
				},
				{ endStream: true },
			)
			return
		}
		stream.respond(
			{
				":status": 200,
				"content-type": "application/grpc",
				"grpc-encoding": "gzip",
			},
			{ waitForTrailers: true },
		)
		stream.on("wantTrailers", () => stream.sendTrailers({ "grpc-status": "0" }))
		stream.end(EMPTY_GRPC_MESSAGE)
	})
})
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
process.env.QDRANT_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

// Record every HTTP/2 session the process opens. The transport imports http2 as an ES module, so the replaced
// function has to be synced into the module's exports.
const sessions: http2.ClientHttp2Session[] = []
const connect = http2.connect
http2.connect = ((...args: Parameters<typeof connect>) => {
	const session = connect(...args)
	sessions.push(session)
	return session
}) as typeof connect
syncBuiltinESMExports()

const warnings: Error[] = []
process.on("warning", (warning) => warnings.push(warning))

const { scroll } = await import("./qdrant.ts")

after(() => {
	for (const session of sessions) session.destroy()
	server.close()
})

const call = () => scroll({ collectionName: "any", limit: 1 })
const maxListenersWarnings = async () => {
	// Warnings are emitted on a later tick.
	await new Promise((resolve) => setImmediate(resolve))
	return warnings.filter(
		(warning) => warning.name === "MaxListenersExceededWarning",
	)
}
/** The session's own listener, plus one per call that left one behind. */
const errorListeners = () => sessions.at(-1)?.listenerCount("error")

// The failing calls log their errors, as they do in production.
test("calls leave no listener behind on the HTTP/2 session", async () => {
	assert.deepEqual(await call(), [])
	for (let i = 0; i < 25; i++) await call()

	assert.equal(sessions.length, 1, "all calls share one session")
	assert.equal(errorListeners(), 1)
	assert.deepEqual(await maxListenersWarnings(), [])
})

test("calls that Qdrant answers with an error leave no listener behind", async () => {
	mode = "not found"
	for (let i = 0; i < 25; i++) await assert.rejects(call(), /not found/)
	mode = "answer"

	assert.equal(sessions.length, 1)
	assert.equal(errorListeners(), 1)
	assert.deepEqual(await maxListenersWarnings(), [])
})

test("more parallel calls than Node's listener limit cause no warning", async () => {
	const results = await Promise.all(Array.from({ length: 30 }, call))

	assert.equal(results.length, 30)
	assert.equal(sessions.length, 1)
	assert.deepEqual(await maxListenersWarnings(), [])
})

test("a call fails at once when the connection breaks, and the next call gets a new session", async () => {
	mode = "break the connection"
	const started = performance.now()
	await assert.rejects(call())
	mode = "answer"

	// Far below the client's timeout of 10 s: the error of the session reached the call.
	assert.ok(performance.now() - started < 2000)
	// The transport opens a new session once it has seen the old one close.
	if (!sessions[0].closed)
		await new Promise((resolve) => sessions[0].once("close", resolve))
	assert.deepEqual(await call(), [])
	assert.equal(sessions.length, 2)
	assert.equal(errorListeners(), 1)
})
