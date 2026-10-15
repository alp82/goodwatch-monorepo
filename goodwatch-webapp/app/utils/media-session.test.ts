import assert from "node:assert/strict"
import { test } from "node:test"
import { establishMediaSession, clearMediaSession } from "./media-session.ts"
const store = () => {
	const values = new Map<string, string>()
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => {
			values.set(key, value)
		},
		removeItem: (key: string) => {
			values.delete(key)
		},
	}
}
test("member hard loads remember session per tab and avoid POST/revalidation when unchanged", async () => {
	const storage = store()
	let posts = 0
	const send: typeof fetch = async () => {
		posts++
		return Response.json({ changed: false })
	}
	assert.equal(
		await establishMediaSession("a", false, { storage, send }),
		false,
	)
	assert.equal(
		await establishMediaSession("a", false, { storage, send }),
		false,
	)
	assert.equal(posts, 1)
	assert.equal(await establishMediaSession("a", true, { storage, send }), false)
	assert.equal(posts, 2, "a real sign-in must reconcile even a remembered user")
	clearMediaSession(storage)
	await establishMediaSession("a", false, { storage, send })
	assert.equal(posts, 3)
	await establishMediaSession("b", false, { storage, send })
	assert.equal(posts, 4)
})
test("changed preference adoption asks for revalidation and failed checks remain retryable", async () => {
	const storage = store()
	await assert.rejects(
		establishMediaSession("a", false, {
			storage,
			send: async () => Response.json({ error: "failed" }, { status: 500 }),
		}),
	)
	assert.equal(
		await establishMediaSession("a", false, {
			storage,
			send: async () => Response.json({ changed: true }),
		}),
		true,
	)
	assert.equal(
		await establishMediaSession("a", false, {
			storage,
			send: async () => {
				throw new Error("must skip")
			},
		}),
		false,
	)
})
test("storage failures degrade to a bounded POST with no unchanged-session reload; stale users cannot set markers", async () => {
	const storage = {
		getItem: () => {
			throw new Error("blocked")
		},
		setItem: () => {
			throw new Error("blocked")
		},
		removeItem: () => {
			throw new Error("blocked")
		},
	}
	assert.equal(
		await establishMediaSession("a", false, {
			storage,
			send: async () => Response.json({ changed: false }),
		}),
		false,
	)
	clearMediaSession(storage)
	const working = store()
	let posts = 0
	const send: typeof fetch = async () => {
		posts++
		return Response.json({ changed: false })
	}
	await establishMediaSession("a", false, {
		storage: working,
		send,
		isCurrent: () => false,
	})
	await establishMediaSession("a", false, { storage: working, send })
	assert.equal(posts, 2)
})
