import assert from "node:assert/strict"
import { test } from "node:test"
import { setTimeout as delay } from "node:timers/promises"
import { BackendTimeoutError } from "../utils/backend-timeout.ts"
import { optionalTitlePart, titleDetailsWithin } from "./title-page-budget.ts"

test("a stalled optional read returns an incomplete result within the page budget", async (t) => {
	t.mock.method(console, "warn", () => {})
	const start = performance.now()
	const result = await optionalTitlePart(
		"episode grid",
		() => new Promise<never>(() => {}),
		25,
	)
	assert.deepEqual(result, { complete: false, value: null })
	assert.ok(performance.now() - start < 500)
})

test("the budget includes localization after the initial read, and late work cannot change the result", async (t) => {
	t.mock.method(console, "warn", () => {})
	let finish!: (value: string) => void
	let warmed = false
	const localized = new Promise<string>((resolve) => {
		finish = resolve
	})
	const result = await optionalTitlePart(
		"genre row",
		async () => {
			await delay(1) // Cards arrived; localization is still waiting.
			const value = await localized
			warmed = true
			return value
		},
		25,
	)
	assert.deepEqual(result, { complete: false, value: null })
	finish("localized cards")
	await delay(1)
	assert.equal(warmed, true)
	assert.deepEqual(result, { complete: false, value: null })
})

test("late rejection is handled; optional failures do not fail the page", async (t) => {
	t.mock.method(console, "warn", () => {})
	let fail!: (reason: Error) => void
	const work = new Promise<never>((_, reject) => {
		fail = reject
	})
	assert.equal(
		(await optionalTitlePart("episode grid", () => work, 10)).complete,
		false,
	)
	fail(new Error("source unavailable"))
	await delay(1)
	assert.deepEqual(
		await optionalTitlePart(
			"genre row",
			async () => {
				throw new Error("unavailable")
			},
			25,
		),
		{ complete: false, value: null },
	)
})

test("a legitimate absent grid and successful data remain complete", async () => {
	assert.deepEqual(
		await optionalTitlePart("episode grid", async () => null, 100),
		{ complete: true, value: null },
	)
	assert.deepEqual(
		await optionalTitlePart("genre row", async () => [1, 2], 100),
		{ complete: true, value: [1, 2] },
	)
})

test("essential title timeouts answer temporary 503 with no-store, never a cached 404", async () => {
	for (const work of [
		() => new Promise<never>(() => {}),
		async () => {
			throw new BackendTimeoutError("CrateDB", 5)
		},
	]) {
		await assert.rejects(titleDetailsWithin(work(), 20), (error) => {
			assert.ok(error instanceof Response)
			assert.equal(error.status, 503)
			assert.equal(error.headers.get("Cache-Control"), "private, no-store")
			assert.equal(error.headers.get("Retry-After"), "5")
			return true
		})
	}
})

test("essential reads preserve a real 404, other failures and successful data", async () => {
	const missing = new Response("Not Found", { status: 404 })
	const refused = new Error("statement refused")
	for (const error of [missing, refused])
		await assert.rejects(
			titleDetailsWithin(Promise.reject(error), 100),
			(actual) => actual === error,
		)
	assert.deepEqual(
		await titleDetailsWithin(Promise.resolve({ title: "A title" }), 100),
		{ title: "A title" },
	)
})
