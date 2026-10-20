import assert from "node:assert/strict"
import { test } from "node:test"
import { personProperties } from "./person-properties.ts"
import {
	analyticsAction,
	captureProductEvent,
	eventUuid,
	flushProductEvents,
	identifyProductUser,
	productEnvelope,
	withProductContext,
} from "./product-analytics.server.ts"
import { discoveryProperties, productProperties } from "./product-events.ts"

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

test("account profiles normalize both auth shapes without leaking other account data", () => {
	assert.deepEqual(
		personProperties({
			id: "native",
			email: "member@example.com",
			name: "Member",
			image: "https://example.com/avatar",
			createdAt: new Date("2026-01-02"),
			emailVerified: false,
		}),
		{
			user_id: "native",
			email: "member@example.com",
			name: "Member",
			$avatar: "https://example.com/avatar",
			account_created_at: "2026-01-02T00:00:00.000Z",
			email_verified: false,
		},
	)
	const profile = personProperties({
		id: "legacy",
		email: "member@example.com",
		created_at: "",
		user_metadata: {
			full_name: "Member",
			avatar_url: "https://example.com/avatar",
			password: "secret",
			arbitrary: "private",
		},
		app_metadata: { provider: "google", token: "secret" },
	})
	assert.equal(profile.name, "Member")
	assert.equal(profile.auth_provider, "google")
	assert.equal(profile.account_created_at, undefined)
	assert.equal(JSON.stringify(profile).includes("secret"), false)
	assert.equal(JSON.stringify(profile).includes("private"), false)
	assert.equal(personProperties({ id: "id", email: "" }).email, undefined)
})
test("server profile fields can only be attached to the matching authenticated account", () => {
	const user = { id: "a", email: "a@example.com" }
	assert.deepEqual(
		productEnvelope("a", "rating saved", {}, { user }).properties.$set,
		{ user_id: "a", email: "a@example.com" },
	)
	assert.equal(
		productEnvelope("b", "rating saved", {}, { user }).properties.$set,
		undefined,
	)
})
test("profile refreshes are bounded and changes update the same account without inventing activity", async () => {
	const env = { ...process.env }
	const original = globalThis.fetch
	const batches: {
		batch: { event: string; properties: Record<string, unknown> }[]
	}[] = []
	process.env.NODE_ENV = "production"
	process.env.POSTHOG_API_KEY = "test"
	process.env.POSTHOG_DISABLED = "false"
	globalThis.fetch = async (_input, init) => {
		batches.push(JSON.parse(String(init?.body)))
		return new Response("{}")
	}
	try {
		identifyProductUser({ id: "profile-test", email: "old@example.com" })
		identifyProductUser({ id: "profile-test", email: "old@example.com" })
		identifyProductUser({ id: "profile-test", email: "new@example.com" })
		await flushProductEvents()
		assert.equal(batches[0].batch.length, 2)
		assert.deepEqual(
			batches[0].batch.map((event) => event.event),
			["$set", "$set"],
		)
		assert.deepEqual(batches[0].batch[1].properties.$set, {
			user_id: "profile-test",
			email: "new@example.com",
		})
	} finally {
		globalThis.fetch = original
		process.env = env
	}
})
