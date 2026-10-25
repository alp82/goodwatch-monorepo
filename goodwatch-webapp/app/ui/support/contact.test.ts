// contact.ts: the /support contact form's checks, the request it sends, and how refusals read.
import "../../server/title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { webcrypto } from "node:crypto"
import { test } from "node:test"

const {
	buildContactRequest,
	contactFailure,
	contactProblems,
	holdBeforeSend,
	newIdempotencyKey,
	MESSAGE_MAX,
} = await import("./contact.ts")
const { feedbackSchema } = await import("../../server/feedback/schema.ts")

const KEY = "0b8a3c1e-5d2f-4a6b-9c7d-1e2f3a4b5c6d"
const draft = {
	topic: "account" as const,
	message: "  I can't change my email.  ",
	email: " sam@example.com ",
	title: "",
}

test("a contact request carries the topic, the trimmed text, and the honeypot left empty", () => {
	const request = buildContactRequest(draft, {
		idempotencyKey: KEY,
		startedAt: 1_000,
	})
	assert.deepEqual(request, {
		kind: "contact",
		message: "Topic: My account\n\nI can't change my email.",
		email: "sam@example.com",
		idempotencyKey: KEY,
		website: "",
		startedAt: 1_000,
	})
	// The endpoint's own schema accepts it.
	assert.equal(feedbackSchema.safeParse(request).success, true)
})

test("a data question names the title; other topics drop a stale title", () => {
	const data = buildContactRequest(
		{
			...draft,
			topic: "data",
			title: " https://goodwatch.app/movie/603-the-matrix ",
		},
		{ idempotencyKey: KEY, startedAt: 1 },
	)
	assert.equal(
		data.message,
		"Topic: A title's data\nTitle: https://goodwatch.app/movie/603-the-matrix\n\nI can't change my email.",
	)
	// Data questions go as contact messages: kind data needs ids the form doesn't have.
	assert.equal(data.kind, "contact")
	assert.equal(feedbackSchema.safeParse(data).success, true)

	const bug = buildContactRequest(
		{ ...draft, topic: "bug", title: "The Matrix" },
		{ idempotencyKey: KEY, startedAt: 1 },
	)
	assert.equal(
		bug.message,
		"Topic: Something's broken\n\nI can't change my email.",
	)
})

test("metadata passes through only when given", () => {
	const metadata = { url: "/support", locale: "en-US" }
	const request = buildContactRequest(draft, {
		idempotencyKey: KEY,
		startedAt: 1,
		metadata,
	})
	assert.deepEqual(request.metadata, metadata)
	assert.equal(feedbackSchema.safeParse(request).success, true)
})

test("an empty message or a bad email stops the send", () => {
	assert.deepEqual(contactProblems(draft), [])
	assert.deepEqual(contactProblems({ ...draft, message: "   " }), ["message"])
	assert.deepEqual(
		contactProblems({ ...draft, message: "x".repeat(MESSAGE_MAX + 1) }),
		["message"],
	)
	assert.deepEqual(contactProblems({ ...draft, email: "sam@" }), ["email"])
	assert.deepEqual(contactProblems({ ...draft, message: "", email: "" }), [
		"message",
		"email",
	])
})

test("a send right after the form opened waits for the endpoint's minimum", () => {
	assert.equal(holdBeforeSend(10_000, 10_500), 1_500)
	assert.equal(holdBeforeSend(10_000, 12_000), 0)
	assert.equal(holdBeforeSend(10_000, 99_000), 0)
})

test("refusals read as busy, rejected, or worth a retry", () => {
	assert.equal(contactFailure(429), "busy")
	assert.equal(contactFailure(400), "rejected")
	assert.equal(contactFailure(413), "rejected")
	assert.equal(contactFailure(503), "retry")
	assert.equal(contactFailure(500), "retry")
	assert.equal(contactFailure(0), "retry")
})

test("idempotency keys are v4 UUIDs with or without randomUUID", () => {
	const uuid =
		/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
	assert.match(newIdempotencyKey(webcrypto), uuid)
	const fallback = newIdempotencyKey({
		getRandomValues: (array: Uint8Array) => webcrypto.getRandomValues(array),
	})
	assert.match(fallback, uuid)
	assert.equal(
		feedbackSchema.safeParse(
			buildContactRequest(draft, { idempotencyKey: fallback, startedAt: 1 }),
		).success,
		true,
	)
})
