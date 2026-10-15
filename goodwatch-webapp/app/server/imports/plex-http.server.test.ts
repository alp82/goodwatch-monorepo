import assert from "node:assert/strict"
import { test } from "node:test"
import { createPlexHttp } from "./plex-http.server.ts"

test("Plex requests cannot reach GoodWatch private networks through literals or DNS", async () => {
	for (const address of [
		"127.0.0.1",
		"10.0.0.1",
		"172.16.0.1",
		"192.168.1.1",
		"169.254.169.254",
		"100.64.0.1",
		"0.0.0.0",
		"::1",
		"::ffff:127.0.0.1",
		"fc00::1",
		"fe80::1",
	]) {
		const http = createPlexHttp({
			resolve: async () => [{ address, family: address.includes(":") ? 6 : 4 }],
		})
		await assert.rejects(
			http("https://member.plex.direct:32400/identity"),
			/public HTTPS/,
		)
		await assert.rejects(
			http(
				`https://${address.includes(":") ? `[${address}]` : address}/identity`,
			),
			/public HTTPS/,
		)
	}
})

test("Plex rejects unsafe URL forms and mixed public/private DNS answers", async () => {
	const http = createPlexHttp({
		resolve: async () => [
			{ address: "8.8.8.8", family: 4 },
			{ address: "10.1.2.3", family: 4 },
		],
	})
	for (const url of [
		"http://public.example/",
		"file:///etc/passwd",
		"https://user:password@public.example/",
		"https://public.example/#secret",
		"https://2130706433/",
		"https://0x7f000001/",
		"https://public.example/",
	])
		await assert.rejects(http(url), /public HTTPS/)
})

test("Plex pins DNS for the actual socket and refuses redirects without forwarding credentials", async (t) => {
	const https = await import("node:https")
	const { syncBuiltinESMExports } = await import("node:module")
	const { EventEmitter } = await import("node:events")
	const { IncomingMessage } = await import("node:http")
	const { Socket } = await import("node:net")
	let lookups = 0
	let requests = 0
	const resolve = async () => [
		{ address: ++lookups === 1 ? "8.8.8.8" : "127.0.0.1", family: 4 },
	]
	const mock = t.mock.method(
		https.default,
		"request",
		(
			url: URL,
			options: import("node:https").RequestOptions,
			listener: (response: import("node:http").IncomingMessage) => void,
		) => {
			requests++
			assert.equal(url.hostname, "member.example")
			assert.equal(options.agent, false)
			assert.equal(options.rejectUnauthorized, undefined)
			assert.ok(options.lookup)
			options.lookup("member.example", {}, (error, address) => {
				assert.equal(error, null)
				assert.equal(address, "8.8.8.8")
			})
			return Object.assign(new EventEmitter(), {
				end() {
					const response = new IncomingMessage(new Socket())
					response.statusCode = 302
					response.headers = { location: "https://127.0.0.1/steal" }
					queueMicrotask(() => listener(response))
				},
			})
		},
	)
	syncBuiltinESMExports()
	t.after(() => {
		mock.mock.restore()
		syncBuiltinESMExports()
	})
	const http = createPlexHttp({ resolve })
	await assert.rejects(
		http("https://member.example/history", {
			headers: { "X-Plex-Token": "secret" },
		}),
		/Plex could not be read/,
	)
	assert.equal(requests, 1)
	assert.equal(lookups, 1)
	// A subsequent request revalidates DNS, so a rebound address cannot reach the socket.
	await assert.rejects(http("https://member.example/history"), /public HTTPS/)
	assert.equal(requests, 1)
})
