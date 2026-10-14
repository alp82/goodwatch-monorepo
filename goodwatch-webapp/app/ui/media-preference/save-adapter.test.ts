import assert from "node:assert/strict"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"

const { PreferenceConflict, endpointSaver } = await import("./save-adapter.ts")

type Body = {
	clientId: string
	pair: { country: string; language: string }
	sequence: number
	expectedVersion: string | null
}
type Call = { body: Body; answer: (r: Response) => void }

function fakeFetch() {
	const calls: Call[] = []
	globalThis.fetch = ((_: string, init: RequestInit) =>
		new Promise<Response>((answer) => {
			calls.push({ body: JSON.parse(String(init.body)), answer })
		})) as typeof fetch
	return calls
}
const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status })
const saved = (b: Body, version: string) =>
	json({
		pair: b.pair,
		version,
		sequence: b.sequence,
		destination: "device",
		effectiveContext: {},
	})
const tick = () => new Promise((r) => setTimeout(r, 0))
const none = { expectedVersion: null }

test("saves go one at a time, with one client id and the next sequence", async () => {
	const calls = fakeFetch()
	const saver = endpointSaver("/save")
	const first = saver.save({ country: "JP", language: "ja" }, none)
	const second = saver.save(
		{ country: "DE", language: "browser" },
		{ expectedVersion: "v1" },
	)
	await tick()
	assert.equal(calls.length, 1, "the second waits for the first")
	assert.match(calls[0].body.clientId, /^[\w-]{8,80}$/)
	assert.deepEqual(
		{ ...calls[0].body, clientId: "x" },
		{
			clientId: "x",
			pair: { country: "JP", language: "ja" },
			sequence: 1,
			expectedVersion: null,
		},
	)
	calls[0].answer(saved(calls[0].body, "v1"))
	assert.equal((await first).version, "v1")
	await tick()
	assert.equal(calls[1].body.clientId, calls[0].body.clientId)
	assert.equal(calls[1].body.sequence, 2)
	assert.equal(calls[1].body.expectedVersion, "v1")
	calls[1].answer(saved(calls[1].body, "v2"))
	assert.equal((await second).version, "v2")
})

test("another saver (another page load) has its own client id and sequence", async () => {
	const calls = fakeFetch()
	void endpointSaver("/save").save({ country: "JP", language: "ja" }, none)
	void endpointSaver("/save").save({ country: "JP", language: "ja" }, none)
	await tick()
	assert.notEqual(calls[0].body.clientId, calls[1].body.clientId)
	assert.equal(calls[1].body.sequence, 1)
})

test("a failed save fails, and the next one still goes", async () => {
	const calls = fakeFetch()
	const saver = endpointSaver("/save")
	const failed = saver.save({ country: "JP", language: "ja" }, none)
	await tick()
	calls[0].answer(json({ error: "Could not confirm save" }, 503))
	await assert.rejects(failed)
	const next = saver.save({ country: "JP", language: "ja" }, none)
	await tick()
	calls[1].answer(saved(calls[1].body, "v3"))
	assert.equal((await next).version, "v3")
})

test("an answer for another sequence, or without a pair, is not a save", async () => {
	const calls = fakeFetch()
	const saver = endpointSaver("/save")
	const stale = saver.save({ country: "JP", language: "ja" }, none)
	await tick()
	calls[0].answer(
		json({
			pair: { country: "JP", language: "ja" },
			version: "v1",
			sequence: 0,
		}),
	)
	await assert.rejects(stale)
	const empty = saver.save({ country: "JP", language: "ja" }, none)
	await tick()
	calls[1].answer(json(null))
	await assert.rejects(empty)
})

test("a 409 for this save is a conflict carrying the record on file, or null", async () => {
	const calls = fakeFetch()
	const saver = endpointSaver("/save")
	const refused = saver.save(
		{ country: "JP", language: "ja" },
		{ expectedVersion: "v1" },
	)
	await tick()
	const current = {
		pair: { country: "FR", language: "fr" },
		version: "v7",
		sequence: 4,
	}
	calls[0].answer(json({ error: "conflict", sequence: 1, current }, 409))
	const error = await refused.catch((e) => e)
	assert.ok(error instanceof PreferenceConflict)
	assert.deepEqual(error.current, current)

	const gone = saver.save(
		{ country: "JP", language: "ja" },
		{ expectedVersion: "v7" },
	)
	await tick()
	calls[1].answer(json({ error: "conflict", sequence: 2, current: null }, 409))
	const second = await gone.catch((e) => e)
	assert.ok(second instanceof PreferenceConflict)
	assert.equal(second.current, null)

	// A 409 answering another sequence is stale: a plain failure, nothing adopted.
	const stale = saver.save(
		{ country: "JP", language: "ja" },
		{ expectedVersion: "v7" },
	)
	await tick()
	calls[2].answer(json({ error: "conflict", sequence: 1, current }, 409))
	const third = await stale.catch((e) => e)
	assert.ok(third instanceof Error && !(third instanceof PreferenceConflict))
})

test("a save without an answer in time fails, and the next one still goes", async () => {
	const signals: AbortSignal[] = []
	globalThis.fetch = ((_: string, init: RequestInit) =>
		new Promise<Response>((answer, fail) => {
			const signal = init.signal as AbortSignal
			signals.push(signal)
			if (signals.length > 1) {
				const b = JSON.parse(String(init.body)) as Body
				return answer(saved(b, "v2"))
			}
			signal.addEventListener("abort", () => fail(signal.reason))
		})) as typeof fetch
	const saver = endpointSaver("/save", 20)
	const hung = saver.save({ country: "JP", language: "ja" }, none)
	const next = saver.save({ country: "DE", language: "browser" }, none)
	await assert.rejects(hung)
	assert.equal(signals[0].aborted, true)
	assert.equal((await next).version, "v2")
})
