import assert from "node:assert/strict"
import { test } from "node:test"
import {
	createG1RebuildScheduler,
	enqueueG1,
	type G1QueueConfig,
} from "./rebuild.server.ts"

const config: G1QueueConfig = {
	url: "https://windmill.example",
	token: "fake-test-token",
	workspace: "goodwatch",
	preview: ["owner", "second"],
}

test("server adapter only sends preview ids to the script's serialized queue", async () => {
	const calls: { url: string; options: RequestInit }[] = []
	const send: typeof fetch = async (url, options) => {
		calls.push({ url: String(url), options: options! })
		return new Response("fake-job")
	}
	await enqueueG1("stranger", config, send)
	assert.equal(calls.length, 0)
	await enqueueG1("owner", config, send)
	assert.equal(
		calls[0].url,
		"https://windmill.example/api/w/goodwatch/jobs/run/p/f/sync/copy/g1_order",
	)
	assert.equal(calls[0].options.method, "POST")
	assert.equal(calls[0].options.redirect, "error")
	assert.deepEqual(JSON.parse(calls[0].options.body as string), {
		member_ids: ["owner"],
		dry_run: false,
	})
	assert.equal(
		(calls[0].options.headers as Record<string, string>).Authorization,
		"Bearer fake-test-token",
	)
	await assert.rejects(
		enqueueG1("owner", { ...config, url: "http://windmill.example" }, send),
		/HTTPS/,
	)
	await assert.rejects(
		enqueueG1(
			"owner",
			config,
			async () => new Response("secret", { status: 503 }),
		),
		/HTTP 503/,
	)
})

test("debounce is per preview member, trails the last write, rechecks removal and contains queue failures", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] })
	let current: G1QueueConfig | null = config
	const queued: string[] = []
	const scheduler = createG1RebuildScheduler(
		() => current,
		async (member) => {
			queued.push(member)
		},
	)
	scheduler.changed("owner")
	scheduler.changed("stranger")
	t.mock.timers.tick(1_000)
	scheduler.changed("owner")
	scheduler.changed("second")
	t.mock.timers.tick(1_499)
	assert.deepEqual(queued, [])
	t.mock.timers.tick(1)
	await Promise.resolve()
	assert.deepEqual(queued, ["owner", "second"])
	scheduler.changed("owner")
	current = { ...config, preview: [] }
	t.mock.timers.tick(1_500)
	assert.equal(queued.length, 2)
	current = null
	scheduler.changed("owner")
	t.mock.timers.tick(1_500)
	assert.equal(queued.length, 2)
	current = config
	scheduler.changed("owner")
	scheduler.stop()
	t.mock.timers.tick(1_500)
	assert.equal(queued.length, 2)
	const warn = t.mock.method(console, "warn", () => {})
	const failed = createG1RebuildScheduler(
		() => config,
		async () => {
			throw Error("secret")
		},
	)
	failed.changed("owner")
	t.mock.timers.tick(1_500)
	await Promise.resolve()
	assert.deepEqual(warn.mock.calls[0].arguments, [
		"G1 rating rebuild enqueue failed",
	])
})
