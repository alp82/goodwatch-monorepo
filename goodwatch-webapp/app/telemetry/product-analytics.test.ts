import assert from "node:assert/strict"
import { test } from "node:test"
import { productProperties, discoveryProperties } from "./product-events.ts"
import {
	analyticsAction,
	captureProductEvent,
	eventUuid,
	flushProductEvents,
	productEnvelope,
	withProductContext,
} from "./product-analytics.server.ts"

test("event properties exclude raw search, reviews, credentials and unexpected nested objects", () => {
	assert.deepEqual(
		productProperties({
			score: 9,
			has_review: true,
			query: "private",
			review: "private",
			email: "private",
			token: "secret",
			result_count: Number.POSITIVE_INFINITY,
		}),
		{ score: 9, has_review: true },
	)
	assert.deepEqual(productProperties({ moods: ["cozy", "funny"] }).moods, [
		"cozy",
		"funny",
	])
})
test("discovery context retains useful filters without free text", () => {
	const value = discoveryProperties(
		new URLSearchParams(
			"q=private+query&services=mine&moods=funny,scary&sort=match&type=movie",
		),
	)
	assert.equal(value.has_query, true)
	assert.equal(value.on_my_services, true)
	assert.deepEqual(value.moods, ["funny", "scary"])
	assert.equal(JSON.stringify(value).includes("private"), false)
})
test("concurrent contexts stay separate and authenticated writer identity wins", async () => {
	const results = await Promise.all(
		["a", "b"].map((source) =>
			withProductContext({ source, origin: "import" }, async () => {
				await new Promise((resolve) =>
					setTimeout(resolve, source === "a" ? 5 : 0),
				)
				return productEnvelope(`member-${source}`, "rating saved", {
					score: 8,
				})
			}),
		),
	)
	for (const [i, source] of ["a", "b"].entries()) {
		assert.equal(results[i].properties.source, source)
		assert.equal(results[i].properties.user_id, `member-${source}`)
		assert.equal(results[i].properties.origin, "import")
	}
})
test("request context ignores untrusted identity headers and strips search text", async () => {
	const wrapped = analyticsAction(async ({ request }: { request: Request }) =>
		productEnvelope("authenticated", "rating saved", { score: 7 }),
	)
	const result = await wrapped({
		request: new Request("https://goodwatch.app/api/update-scores", {
			headers: {
				referer: "https://goodwatch.app/discover?q=private&sort=match",
				"X-POSTHOG-DISTINCT-ID": "forged",
				"X-POSTHOG-SESSION-ID": "session-123",
			},
		}),
	})
	assert.equal(result.properties.distinct_id, "authenticated")
	assert.equal(result.properties.source, "discover")
	assert.equal(result.properties.$session_id, "session-123")
	assert.equal(JSON.stringify(result).includes("private"), false)
})
test("durable receipt UUIDs are deterministic and distinct per action", () => {
	assert.equal(eventUuid("watch:1"), eventUuid("watch:1"))
	assert.notEqual(eventUuid("watch:1"), eventUuid("watch:2"))
	assert.match(
		eventUuid("watch:1"),
		/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/,
	)
})
test("transport retries the same batch and isolates ingestion failure from product writes", async () => {
	const env = { ...process.env }
	const original = globalThis.fetch
	process.env.NODE_ENV = "production"
	process.env.POSTHOG_API_KEY = "test"
	process.env.POSTHOG_DISABLED = "false"
	const bodies: string[] = []
	globalThis.fetch = async (_input, init) => {
		bodies.push(String(init?.body))
		if (bodies.length === 1) throw new Error("network")
		return new Response("{}")
	}
	try {
		captureProductEvent("member", "rating saved", { score: 10 })
		await flushProductEvents()
		assert.equal(bodies.length, 2)
		assert.equal(bodies[0], bodies[1])
		const event = JSON.parse(bodies[0]).batch[0]
		assert.equal(event.properties.user_id, "member")
		globalThis.fetch = async () => {
			throw new Error("down")
		}
		assert.doesNotThrow(() => captureProductEvent("member", "rating cleared"))
		await assert.doesNotReject(flushProductEvents())
	} finally {
		globalThis.fetch = original
		process.env = env
	}
})
