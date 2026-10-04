import "react"
import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import type { OgResult } from "./store.server.ts"
const { createOgImageLoader } = await import("./og-image-route.server.ts")
const { imageEtag } = await import("./store.server.ts")
const image = Buffer.from("jpeg")
const etag = imageEtag(image)
const ok: OgResult = { status: "ok", image, renderedAt: 1000, etag }
const cache =
	"public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
const request = (path: string, headers = {}) => ({
	request: new Request(`https://example.test/og/${path}`, { headers }),
})
test("JPEG and legacy PNG bytes, home mapping, and exact headers", async () => {
	const paths: string[] = []
	const loader = createOgImageLoader({
		getOgImage: async (p) => {
			paths.push(p)
			return ok
		},
		getFallbackCard: () => null,
	})
	for (const file of [
		"index.jpg",
		"index.png",
		"movie/603.jpg",
		"movie/603.png",
	]) {
		const response = await loader(request(file))
		assert.equal(response.status, 200)
		assert.deepEqual(Buffer.from(await response.arrayBuffer()), image)
		assert.deepEqual(Object.fromEntries(response.headers), {
			"content-type": "image/jpeg",
			"content-length": "4",
			"cache-control": cache,
			etag,
			"last-modified": new Date(1000).toUTCString(),
		})
	}
	assert.deepEqual(paths, ["/", "/", "/movie/603", "/movie/603"])
	const response = await loader(request("index.jpg", { "If-None-Match": etag }))
	assert.equal(response.status, 304)
	assert.equal(await response.text(), "")
	assert.deepEqual(Object.fromEntries(response.headers), {
		"cache-control": cache,
		etag,
	})
})
test("missing and unknown extensions never cache", async () => {
	const loader = createOgImageLoader({
		getOgImage: async () => ({ status: "missing" }),
		getFallbackCard: () => null,
	})
	for (const file of ["missing.jpg", "index.webp"]) {
		const response = await loader(request(file))
		assert.equal(response.status, 404)
		assert.deepEqual(Object.fromEntries(response.headers), {
			"content-type": "text/plain",
			"cache-control": "no-store",
		})
	}
})
test("busy and failed use short fallback or retryable text", async () => {
	for (const status of ["busy", "failed"] as const)
		for (const fallback of [null, image]) {
			const loader = createOgImageLoader({
				getOgImage: async () => ({ status }),
				getFallbackCard: () => fallback,
			})
			const response = await loader(request("index.jpg"))
			assert.equal(response.status, fallback ? 200 : 503)
			assert.deepEqual(
				Object.fromEntries(response.headers),
				fallback
					? {
							"content-type": "image/jpeg",
							"content-length": "4",
							"cache-control": "public, max-age=60",
							"x-og-card": "fallback",
						}
					: {
							"content-type": "text/plain",
							"cache-control": "no-store",
							"retry-after": "2",
						},
			)
		}
})
