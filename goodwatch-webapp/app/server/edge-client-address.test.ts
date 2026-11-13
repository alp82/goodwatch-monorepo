// The visitor's address behind Cloudflare: which requests count as coming through GoodWatch's zone, what is rewritten,
// and that a real server's request listeners see the rewritten headers.
import assert from "node:assert/strict"
import type { IncomingHttpHeaders } from "node:http"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { test } from "node:test"
import {
	EDGE_KEY_HEADER,
	edgeKeys,
	isCloudflareAddress,
	restoreClientAddress,
	sanitizeRequest,
	startEdgeClientAddress,
} from "./edge-client-address.server.ts"

const EDGE_V4 = "172.70.1.2"
const EDGE_V6 = "2a06:98c0:3600::103"
const VISITOR = "203.0.113.7"
const KEY = "k".repeat(40)
const OLD_KEY = "o".repeat(40)
const KEYS = edgeKeys(`${KEY}, ${OLD_KEY}`)

const fromZone = (extra: IncomingHttpHeaders = {}): IncomingHttpHeaders => ({
	"x-real-ip": EDGE_V4,
	"x-forwarded-for": EDGE_V4,
	"cf-connecting-ip": VISITOR,
	[EDGE_KEY_HEADER]: KEY,
	...extra,
})

test("Cloudflare's ranges, IPv4, IPv6 and the mapped form", () => {
	assert.equal(isCloudflareAddress(EDGE_V4), true)
	assert.equal(isCloudflareAddress(`::ffff:${EDGE_V4}`), true)
	assert.equal(isCloudflareAddress(EDGE_V6), true)
	assert.equal(isCloudflareAddress("2606:4700:10::ac43:1"), true)
	assert.equal(isCloudflareAddress(VISITOR), false)
	assert.equal(isCloudflareAddress("10.0.0.21"), false)
	assert.equal(isCloudflareAddress("not an address"), false)
	assert.equal(isCloudflareAddress(""), false)
})

test("keys shorter than 32 characters are ignored", () => {
	assert.equal(edgeKeys(undefined).length, 0)
	assert.equal(edgeKeys("").length, 0)
	assert.equal(edgeKeys("short").length, 0)
	assert.equal(edgeKeys(`short,${KEY}`).length, 1)
	assert.equal(KEYS.length, 2)
})

test("through the zone, the headers name the visitor and the key is removed", () => {
	const headers = fromZone({ "true-client-ip": "198.51.100.1" })
	assert.equal(restoreClientAddress(headers, KEYS), "cloudflare")
	assert.equal(headers["x-real-ip"], VISITOR)
	assert.equal(headers["x-forwarded-for"], VISITOR)
	assert.equal(headers["cf-connecting-ip"], VISITOR)
	assert.equal(headers["true-client-ip"], undefined)
	assert.equal(headers[EDGE_KEY_HEADER], undefined)
})

test("the second key works during a rotation", () => {
	const headers = fromZone({ [EDGE_KEY_HEADER]: OLD_KEY })
	assert.equal(restoreClientAddress(headers, KEYS), "cloudflare")
	assert.equal(headers["x-real-ip"], VISITOR)
})

test("an IPv6 visitor through an IPv6 edge keeps the canonical address", () => {
	const headers = fromZone({
		"x-real-ip": EDGE_V6,
		"cf-connecting-ip": "2001:DB8:0:0::1",
	})
	assert.equal(restoreClientAddress(headers, KEYS), "cloudflare")
	assert.equal(headers["x-real-ip"], "2001:db8::1")
})

test("from Cloudflare's ranges without the zone's key (another account's Worker), nothing is restored", () => {
	for (const key of [
		undefined,
		"",
		"wrong".repeat(10),
		`${KEY}x`,
		`${KEY}, ${KEY}`,
	]) {
		const headers = fromZone()
		if (key === undefined) Reflect.deleteProperty(headers, EDGE_KEY_HEADER)
		else headers[EDGE_KEY_HEADER] = key
		assert.equal(restoreClientAddress(headers, KEYS), "unkeyed")
		assert.equal(headers["x-real-ip"], EDGE_V4)
		assert.equal(headers["x-forwarded-for"], EDGE_V4)
		assert.equal(headers["cf-connecting-ip"], undefined)
		assert.equal(headers[EDGE_KEY_HEADER], undefined)
	}
})

test("without configured keys, nothing is restored", () => {
	const headers = fromZone()
	assert.equal(restoreClientAddress(headers, []), "unkeyed")
	assert.equal(headers["x-real-ip"], EDGE_V4)
	assert.equal(headers["cf-connecting-ip"], undefined)
})

test("a direct client can't name its own address, even with the right key", () => {
	const headers = fromZone({
		"x-real-ip": VISITOR,
		"x-forwarded-for": VISITOR,
		"cf-connecting-ip": "198.51.100.9",
		"true-client-ip": "198.51.100.10",
	})
	assert.equal(restoreClientAddress(headers, KEYS), "direct")
	assert.equal(headers["x-real-ip"], VISITOR)
	assert.equal(headers["x-forwarded-for"], VISITOR)
	assert.equal(headers["cf-connecting-ip"], undefined)
	assert.equal(headers["true-client-ip"], undefined)
	assert.equal(headers[EDGE_KEY_HEADER], undefined)
})

test("through the zone without a usable CF-Connecting-IP, the headers stay as they are", () => {
	for (const value of [undefined, "", "garbage", `${VISITOR}, 198.51.100.2`]) {
		const headers = fromZone()
		if (value === undefined) Reflect.deleteProperty(headers, "cf-connecting-ip")
		else headers["cf-connecting-ip"] = value
		assert.equal(restoreClientAddress(headers, KEYS), "invalid")
		assert.equal(headers["x-real-ip"], EDGE_V4)
		assert.equal(headers["cf-connecting-ip"], undefined)
	}
})

test("without a single connecting address, nothing is trusted", () => {
	for (const real of [undefined, `${EDGE_V4}, ${VISITOR}`]) {
		const headers = fromZone()
		if (real === undefined) Reflect.deleteProperty(headers, "x-real-ip")
		else headers["x-real-ip"] = real
		assert.equal(restoreClientAddress(headers, KEYS), "unknown")
		assert.equal(headers["cf-connecting-ip"], undefined)
		assert.equal(headers[EDGE_KEY_HEADER], undefined)
	}
})

test("the key leaves the raw headers too, also with the rewriting switched off", () => {
	const raw = () => [
		"Host",
		"goodwatch.app",
		"X-Real-Ip",
		EDGE_V4,
		"CF-Connecting-IP",
		VISITOR,
		"GW-Edge-Key",
		KEY,
		"gw-edge-key",
		"second",
	]
	const request = (headers: IncomingHttpHeaders) => {
		const rawHeaders = raw()
		const distinct: Record<string, string[]> = {}
		for (let i = 0; i < rawHeaders.length; i += 2) {
			const name = rawHeaders[i].toLowerCase()
			distinct[name] = [...(distinct[name] ?? []), rawHeaders[i + 1]]
		}
		return { headers, rawHeaders, headersDistinct: distinct }
	}
	const through = request(fromZone())
	assert.equal(sanitizeRequest(through, KEYS, true), "cloudflare")
	assert.deepEqual(through.rawHeaders, [
		"Host",
		"goodwatch.app",
		"X-Real-Ip",
		EDGE_V4,
		"CF-Connecting-IP",
		VISITOR,
	])
	assert.equal(through.headers[EDGE_KEY_HEADER], undefined)
	assert.equal(through.headersDistinct[EDGE_KEY_HEADER], undefined)

	const unkeyed = request(fromZone({ [EDGE_KEY_HEADER]: "wrong" }))
	assert.equal(sanitizeRequest(unkeyed, KEYS, true), "unkeyed")
	assert.deepEqual(unkeyed.rawHeaders, [
		"Host",
		"goodwatch.app",
		"X-Real-Ip",
		EDGE_V4,
	])

	const off = request(fromZone())
	assert.equal(sanitizeRequest(off, KEYS, false), null)
	assert.equal(off.headers[EDGE_KEY_HEADER], undefined)
	assert.equal(off.headersDistinct[EDGE_KEY_HEADER], undefined)
	assert.deepEqual(off.headersDistinct["cf-connecting-ip"], [VISITOR])
	assert.equal(off.headers["x-real-ip"], EDGE_V4)
	assert.deepEqual(off.rawHeaders, [
		"Host",
		"goodwatch.app",
		"X-Real-Ip",
		EDGE_V4,
		"CF-Connecting-IP",
		VISITOR,
	])
})

test("a real server's request listener sees the rewritten headers", async () => {
	const before = process.env.EDGE_ORIGIN_KEYS
	process.env.EDGE_ORIGIN_KEYS = KEY
	startEdgeClientAddress()
	if (before === undefined)
		Reflect.deleteProperty(process.env, "EDGE_ORIGIN_KEYS")
	else process.env.EDGE_ORIGIN_KEYS = before
	const server = createServer((request, response) => {
		response.end(
			JSON.stringify({
				real: request.headers["x-real-ip"],
				forwarded: request.headers["x-forwarded-for"],
				cf: request.headers["cf-connecting-ip"] ?? null,
				key: request.headers[EDGE_KEY_HEADER] ?? null,
				distinct: request.headersDistinct[EDGE_KEY_HEADER] ?? null,
				raw: request.rawHeaders.some(
					(name) => name.toLowerCase() === EDGE_KEY_HEADER,
				),
			}),
		)
	})
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
	try {
		const { port } = server.address() as AddressInfo
		const ask = async (headers: Record<string, string>) =>
			(await fetch(`http://127.0.0.1:${port}/`, { headers })).json()
		assert.deepEqual(
			await ask({
				"X-Real-Ip": EDGE_V4,
				"X-Forwarded-For": EDGE_V4,
				"CF-Connecting-IP": VISITOR,
				"GW-Edge-Key": KEY,
			}),
			{
				real: VISITOR,
				forwarded: VISITOR,
				cf: VISITOR,
				key: null,
				distinct: null,
				raw: false,
			},
		)
		assert.deepEqual(
			await ask({
				"X-Real-Ip": EDGE_V4,
				"X-Forwarded-For": EDGE_V4,
				"CF-Connecting-IP": VISITOR,
			}),
			{
				real: EDGE_V4,
				forwarded: EDGE_V4,
				cf: null,
				key: null,
				distinct: null,
				raw: false,
			},
		)
	} finally {
		await new Promise((resolve) => server.close(resolve))
	}
})
