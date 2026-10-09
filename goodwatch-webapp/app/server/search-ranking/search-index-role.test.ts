import assert from "node:assert/strict"
import http from "node:http"
import { test } from "node:test"
import { readiness } from "../lifecycle.server.ts"
import { getSearchIndex, loadedSearchIndexBuild, startSearchIndex } from "./search-index.server.ts"

test("page role skips index readiness, timers and downloads and rejects index access", async (t) => {
	const original = process.env.WEBAPP_ROLE
	process.env.WEBAPP_ROLE = "page"
	t.after(() => {
		if (original === undefined) delete process.env.WEBAPP_ROLE
		else process.env.WEBAPP_ROLE = original
	})
	const unexpected = () => { throw new Error("Unexpected search work") }
	const request = t.mock.method(http, "request", unexpected)
	const fetch = t.mock.method(globalThis, "fetch", unexpected)
	const interval = t.mock.method(globalThis, "setInterval", unexpected)
	const timeout = t.mock.method(globalThis, "setTimeout", unexpected)
	const before = readiness(0)
	startSearchIndex()
	startSearchIndex()
	assert.deepEqual(readiness(0), before)
	assert.equal(readiness(0).waitingFor.includes("search index"), false)
	await assert.rejects(getSearchIndex(), /page role has no search index/)
	assert.equal(loadedSearchIndexBuild(), null)
	for (const mock of [request, fetch, interval, timeout]) assert.equal(mock.mock.callCount(), 0)
})
