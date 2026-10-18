import assert from "node:assert/strict"
import { test } from "node:test"
import "node-crate"
import "../title-filter/test-alias.ts"
const { imageResponse, IMAGE_SQL } = await import("./image.server.ts")

test("stored preview serves JPEG bytes with daily caching", async () => {
	const response = await imageResponse("a".repeat(64), async () => [{ data: Buffer.from("jpeg").toString("base64") }])
	assert.equal(response.status, 200)
	assert.equal(await response.text(), "jpeg")
	assert.equal(response.headers.get("Content-Type"), "image/jpeg")
	assert.match(response.headers.get("Cache-Control")!, /max-age=86400/)
})

test("missing and invalid previews are uncached 404s", async () => {
	assert.equal((await imageResponse("a".repeat(64), async () => [])).status, 404)
	const response = await imageResponse("invalid", async () => { throw Error("must not query") })
	assert.equal(response.status, 404)
	assert.equal(response.headers.get("Cache-Control"), "no-store")
	assert.match(IMAGE_SQL, /p.deleted_at IS NULL/)
	assert.match(IMAGE_SQL, /INTERVAL '30 days'/)
	assert.match(IMAGE_SQL, /i.post_id = \?/)
})
