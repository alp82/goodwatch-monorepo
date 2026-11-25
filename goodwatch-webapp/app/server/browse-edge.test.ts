import assert from "node:assert/strict"
import test from "node:test"
import { BROWSE_EDGE_HEADER as marker, BROWSE_EDGE_PATH as path } from "../utils/browse-edge.ts"
import {
	applyBrowseEdgePolicy,
	browseGeneration,
	canonicalBrowseTarget,
} from "./browse-edge.server.ts"
import { applyCachePolicy } from "./cache-identity.server.ts"

const commit = "a".repeat(40)
const generation = browseGeneration(commit, "https://static.goodwatch.app")!
const variant = generation + ".US.en"
const target = path + "?__gw_sad=" + variant

test("internal target normalization requires matching authenticated variant and exact URL", () => {
	assert.equal(canonicalBrowseTarget(target, variant, true), true)
	assert.equal(canonicalBrowseTarget(target, variant, false), false)
	for (const url of [target + "&extra=1", target + "x", path, "/" + target])
		assert.equal(canonicalBrowseTarget(url, variant, true), false)
	assert.equal(canonicalBrowseTarget(target, "spoofed", true), false)
	assert.equal(browseGeneration("unknown", ""), null)
	assert.equal(browseGeneration(commit, "https://unreviewed.example"), null)
	assert.notEqual(generation, browseGeneration(commit, ""))
})

function policy({
	requestHeaders = {},
	responseHeaders = {},
	status = 200,
	version = generation,
}: {
	requestHeaders?: Record<string, string>
	responseHeaders?: Record<string, string>
	status?: number
	version?: string
} = {}) {
	const request = new Request("https://goodwatch.app" + path, {
		headers: {
			[marker]: variant,
			accept: "text/html",
			"user-agent": "Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36",
			...requestHeaders,
		},
	})
	const headers = new Headers({
		"Cache-Control": "public, s-maxage=1800, stale-while-revalidate=7200",
	})
	for (const [name, value] of Object.entries(responseHeaders)) headers.set(name, value)
	const route = headers.get("cache-control")
	const vary = headers.get("vary")
	const decision = applyCachePolicy(request, status, headers)
	applyBrowseEdgePolicy(request, headers, decision, route, vary, version)
	return headers
}

test("only a completed canonical public result earns limited Cloudflare freshness; browser retains private policy", () => {
	const approved = policy()
	assert.equal(approved.get(marker), variant)
	assert.equal(
		approved.get("cloudflare-cdn-cache-control"),
		"public, max-age=60, stale-while-revalidate=120",
	)
	assert.equal(approved.get("cache-control"), "private, max-age=0")
	assert.equal(approved.get("vary"), "Accept-Encoding")
	const shorter = policy({ responseHeaders: { "cache-control": "public, s-maxage=5" } })
	assert.equal(
		shorter.get("cloudflare-cdn-cache-control"),
		"public, max-age=5, stale-while-revalidate=0",
	)
	const denied: Parameters<typeof policy>[0][] = [
		{ status: 500 },
		{ requestHeaders: { range: "bytes=0-8" } },
		{ requestHeaders: { "if-none-match": "*" } },
		{ requestHeaders: { "cache-control": "no-cache" } },
		{ requestHeaders: { "user-agent": "Googlebot" } },
		{ requestHeaders: { accept: "application/json" } },
		{ version: generation.replace("static", "origin") },
		{ responseHeaders: { "set-cookie": "a=b" } },
		{ responseHeaders: { vary: "X-Device" } },
		{ responseHeaders: { "cache-control": "private, no-store" } },
		{ requestHeaders: { authorization: "Bearer x" } },
		{ requestHeaders: { cookie: "gw.session_token=z" } },
		{ requestHeaders: { cookie: "future_cookie=z" } },
		{ requestHeaders: { "accept-language": "nl-NL" } },
	]
	for (const options of denied) {
		const rejected = policy(options)
		assert.equal(rejected.get(marker), "private")
		assert.equal(rejected.get("cloudflare-cdn-cache-control"), "no-store")
	}
})

test("public zone traffic cannot activate a fill by naming the known variant", async () => {
	const { createServer } = await import("node:http")
	const { createHmac } = await import("node:crypto")
	const { startEdgeClientAddress } = await import("./edge-client-address.server.ts")
	const fixtureKey = "test-sad-show-secret".repeat(3)
	const previous = process.env.EDGE_ORIGIN_KEYS
	process.env.EDGE_ORIGIN_KEYS = fixtureKey
	startEdgeClientAddress()
	if (previous === undefined) delete process.env.EDGE_ORIGIN_KEYS
	else process.env.EDGE_ORIGIN_KEYS = previous
	const proof = createHmac("sha256", fixtureKey)
		.update("goodwatch:edge:public-browse-fill:v1")
		.digest("hex")
	const server = createServer((request, response) =>
		response.end(
			JSON.stringify({
				url: request.url,
				marker: request.headers[marker],
				proofLeaked: Boolean(
					request.headers["gw-browse-proof"] ||
					request.headersDistinct["gw-browse-proof"] ||
					request.rawHeaders.some(
						(part) => part === proof || part.toLowerCase() === "gw-browse-proof",
					),
				),
			}),
		),
	)
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
	try {
		const address = server.address()
		assert.ok(address && typeof address !== "string")
		for (const [peer, sentProof, approved] of [
			["172.70.1.2", undefined, false],
			["172.70.1.2", "0".repeat(64), false],
			["10.0.0.1", proof, false],
			["172.70.1.2", proof, true],
		] as const) {
			const headers = new Headers({
				"x-real-ip": peer,
				"gw-edge-key": fixtureKey,
				"cf-connecting-ip": "203.0.113.7",
				[marker]: variant,
			})
			if (sentProof) headers.set("gw-browse-proof", sentProof)
			const response = await fetch(`http://127.0.0.1:${address.port}${target}`, { headers })
			assert.deepEqual(
				await response.json(),
				approved
					? { url: path, marker: variant, proofLeaked: false }
					: { url: target, proofLeaked: false },
			)
		}
	} finally {
		await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())))
	}
})
