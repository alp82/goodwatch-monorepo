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
		headers: { [marker]: variant, ...requestHeaders },
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
