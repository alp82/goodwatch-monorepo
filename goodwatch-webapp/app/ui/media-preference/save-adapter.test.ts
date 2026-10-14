import assert from "node:assert/strict"
import { test } from "node:test"
import {
	PreferenceConflict,
	endpointSaver,
	serverPreference,
} from "./save-adapter.ts"

type Call = {
	body: { pair: unknown; sequence: number; expectedVersion: string | null }
	answer: (r: Response) => void
}

function fakeFetch() {
	const calls: Call[] = []
	globalThis.fetch = ((_: string, init: RequestInit) =>
		new Promise<Response>((answer) => {
			calls.push({ body: JSON.parse(String(init.body)), answer })
		})) as typeof fetch
	return calls
}
const ok = (body: unknown) =>
	new Response(JSON.stringify(body), { status: 200 })
const tick = () => new Promise((r) => setTimeout(r, 0))

test("saves go one at a time, each with the next sequence", async () => {
	const calls = fakeFetch()
	const saver = endpointSaver("/save")
	const first = saver.save(
		{ country: "JP", language: "ja" },
		{ expectedVersion: null },
	)
	const second = saver.save(
		{ country: "DE", language: "browser" },
		{ expectedVersion: null },
	)
	await tick()
	assert.equal(calls.length, 1, "the second waits for the first")
	assert.deepEqual(calls[0].body, {
		pair: { country: "JP", language: "ja" },
		sequence: 1,
		expectedVersion: null,
	})
	calls[0].answer(
		ok({
			pair: { country: "JP", language: "ja" },
			version: "v1",
			sequence: 1,
			destination: "device",
		}),
	)
	assert.deepEqual(await first, {
		pair: { country: "JP", language: "ja" },
		version: "v1",
		destination: "device",
	})
	await tick()
	assert.equal(calls.length, 2)
	assert.equal(calls[1].body.sequence, 2)
	calls[1].answer(
		ok({
			pair: { country: "DE", language: "browser" },
			version: "v2",
			sequence: 2,
			destination: "account",
		}),
	)
	assert.equal((await second).version, "v2")
})

test("a failed save fails, and the next one still goes", async () => {
	const calls = fakeFetch()
	const saver = endpointSaver("/save")
	const failed = saver.save(
		{ country: "JP", language: "ja" },
		{ expectedVersion: null },
	)
	await tick()
	calls[0].answer(new Response("{}", { status: 503 }))
	await assert.rejects(failed)
	const next = saver.save(
		{ country: "JP", language: "ja" },
		{ expectedVersion: null },
	)
	await tick()
	calls[1].answer(
		ok({ pair: { country: "JP", language: "ja" }, version: "v3", sequence: 2 }),
	)
	assert.equal((await next).version, "v3")
})

test("an answer for another sequence, or without a pair, is not a save", async () => {
	const calls = fakeFetch()
	const saver = endpointSaver("/save")
	const stale = saver.save(
		{ country: "JP", language: "ja" },
		{ expectedVersion: null },
	)
	await tick()
	calls[0].answer(
		ok({ pair: { country: "JP", language: "ja" }, version: "v1", sequence: 0 }),
	)
	await assert.rejects(stale)
	// Today's settings action answers null to a body it does not know.
	const old = saver.save(
		{ country: "JP", language: "ja" },
		{ expectedVersion: null },
	)
	await tick()
	calls[1].answer(ok(null))
	await assert.rejects(old)
})

test("the root's saved record and effective context are read defensively", () => {
	assert.deepEqual(serverPreference(undefined), { record: null, context: null })
	assert.deepEqual(
		serverPreference({
			locale: { language: "en", country: "US" },
			mediaPreferences: null,
		}),
		{
			record: null,
			context: null,
		},
	)
	const context = {
		country: "DE",
		language: "de",
		languageSetting: "browser",
		languageProvenance: "browser",
	}
	const read = serverPreference({
		locale: context,
		mediaPreferences: {
			country: "DE",
			language: "fr",
			version: "v9",
			schemaVersion: 1,
		},
	})
	assert.deepEqual(read.record, {
		country: "DE",
		language: "fr",
		version: "v9",
	})
	assert.equal(read.context, context)
})

test("a 409 with the record saved meanwhile is a conflict carrying that record", async () => {
	const calls = fakeFetch()
	const saver = endpointSaver("/save")
	const refused = saver.save(
		{ country: "JP", language: "ja" },
		{ expectedVersion: "v1" },
	)
	await tick()
	assert.equal(calls[0].body.expectedVersion, "v1")
	calls[0].answer(
		new Response(
			JSON.stringify({
				error: "conflict",
				current: { country: "FR", language: "fr", version: "v7" },
			}),
			{
				status: 409,
			},
		),
	)
	const error = await refused.catch((e) => e)
	assert.ok(error instanceof PreferenceConflict)
	assert.deepEqual(error.current, {
		country: "FR",
		language: "fr",
		version: "v7",
	})
	// A 409 without a record is a plain failure.
	const plain = saver.save(
		{ country: "JP", language: "ja" },
		{ expectedVersion: "v7" },
	)
	await tick()
	calls[1].answer(new Response("{}", { status: 409 }))
	const second = await plain.catch((e) => e)
	assert.ok(!(second instanceof PreferenceConflict))
})
