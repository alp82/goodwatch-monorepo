import assert from "node:assert/strict"
import { test } from "node:test"
import { createPersonalOrderDirtyMarker } from "./rebuild.server.ts"

test("every member writes to the shared dirty set without a Windmill request", async (t) => {
	const dirty = new Set<string>()
	const calls: string[][] = []
	const fetch = t.mock.method(globalThis, "fetch", async () => {
		throw Error("Unexpected HTTP")
	})
	const mark = createPersonalOrderDirtyMarker(async (key, member) => {
		calls.push([key, member])
		dirty.add(member)
	})
	await Promise.all([mark("owner"), mark("owner"), mark("other"), mark("")])
	assert.deepEqual(calls, [
		["personal-order:dirty", "owner"],
		["personal-order:dirty", "owner"],
		["personal-order:dirty", "other"],
	])
	assert.deepEqual([...dirty], ["owner", "other"])
	assert.equal(fetch.mock.callCount(), 0)
})

test("dirty-set failure cannot fail an interaction or expose connector errors", async (t) => {
	const warn = t.mock.method(console, "warn", () => {})
	const mark = createPersonalOrderDirtyMarker(async () => {
		throw Error("secret")
	})
	await mark("owner")
	assert.deepEqual(warn.mock.calls[0].arguments, [
		"Personal order dirty-set write failed",
	])
})
