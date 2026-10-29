import assert from "node:assert/strict"
import { test } from "node:test"
import { startHotOnSocialsWarmup } from "./startup.server.ts"

test("warms once without blocking, only for production processes serving pages outside tests", async () => {
	let calls = 0
	const load = async () => {
		calls++
		throw new Error("store unavailable")
	}
	for (const env of [
		{
			NODE_ENV: "production",
			WEBAPP_ROLE: "page",
			TALKED_ABOUT_NOW_ROW: "off",
		},
		{ NODE_ENV: "production", WEBAPP_ROLE: "both" },
		{ NODE_ENV: "test", WEBAPP_ROLE: "page", TALKED_ABOUT_NOW_ROW: "on" },
		{ NODE_ENV: "development", WEBAPP_ROLE: "page", TALKED_ABOUT_NOW_ROW: "on" },
		{
			NODE_ENV: "production",
			WEBAPP_ROLE: "search",
			TALKED_ABOUT_NOW_ROW: "on",
		},
		{
			NODE_ENV: "production",
			WEBAPP_ROLE: "page",
			NODE_TEST_CONTEXT: "child-v8",
			TALKED_ABOUT_NOW_ROW: "on",
		},
	])
		startHotOnSocialsWarmup(env, load)
	await Promise.resolve()
	assert.equal(calls, 0)
	assert.equal(
		startHotOnSocialsWarmup(
			{
				NODE_ENV: "production",
				WEBAPP_ROLE: "page",
				TALKED_ABOUT_NOW_ROW: "on",
			},
			load,
		),
		undefined,
	)
	startHotOnSocialsWarmup(
		{ NODE_ENV: "production", WEBAPP_ROLE: "page", TALKED_ABOUT_NOW_ROW: "on" },
		load,
	)
	await Promise.resolve()
	assert.equal(calls, 1)
	// Let the rejection handler run. An outage must not become an unhandled rejection.
	await new Promise((resolve) => setImmediate(resolve))
})
