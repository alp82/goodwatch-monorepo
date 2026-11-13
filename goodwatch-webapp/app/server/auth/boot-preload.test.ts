// With Better Auth on, the runtime loads at start and readiness waits for it; with it off, nothing loads.
import assert from "node:assert/strict"
import { test } from "node:test"
import { preloadAuthRuntime } from "./boot.server.ts"

const deps = (enabled: boolean, load: () => Promise<unknown>) => {
	const checks = new Map<string, () => boolean>()
	return {
		checks,
		options: {
			enabled: () => enabled,
			load,
			addCheck: (name: string, check: () => boolean) => checks.set(name, check),
		},
	}
}

test("with Better Auth off, nothing loads and readiness doesn't wait", () => {
	let loads = 0
	const { checks, options } = deps(false, async () => loads++)
	preloadAuthRuntime(options)
	assert.equal(loads, 0)
	assert.equal(checks.size, 0)
})

test("with Better Auth on, readiness waits until the runtime has loaded", async () => {
	let finish = () => {}
	const loaded = new Promise<void>((resolve) => {
		finish = resolve
	})
	const { checks, options } = deps(true, () => loaded)
	preloadAuthRuntime(options)
	const check = checks.get("auth runtime")
	assert.ok(check)
	assert.equal(check(), false)
	finish()
	await loaded
	await new Promise((resolve) => setImmediate(resolve))
	assert.equal(check(), true)
})

test("a failed load doesn't hold readiness", async () => {
	const { checks, options } = deps(true, () => Promise.reject(new Error("x")))
	const errors: unknown[] = []
	const original = console.error
	console.error = (...args: unknown[]) => errors.push(args)
	try {
		preloadAuthRuntime(options)
		await new Promise((resolve) => setImmediate(resolve))
	} finally {
		console.error = original
	}
	assert.equal(checks.get("auth runtime")?.(), true)
	assert.equal(errors.length, 1)
})
