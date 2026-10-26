import { unlimitedRestBudget } from "./rest-test-budget.ts"
import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import {
	memberHandle,
	storeLinkMessage,
	takeLinkMessage,
	confirmLinkMessage,
} from "./link-message.server.ts"
import { createState, consumeState, type StateStore } from "./oauth.server.ts"
import { finishLink } from "./link-callback.server.ts"
import { discordRest } from "./rest.server.ts"

function storage() {
	const values = new Map<string, string>()
	const ttls: number[] = []
	const store: StateStore = {
		put: async (key, value, ttl) => {
			values.set(key, value)
			ttls.push(ttl)
		},
		take: async (key) => {
			const value = values.get(key) ?? null
			values.delete(key)
			return value
		},
	}
	return { store, ttls }
}
test("message nonce is random, single-use even concurrently, and expires after fifteen minutes", async () => {
	const { store, ttls } = storage()
	const nonce = await storeLinkMessage("app", "private-token", store, 1000)
	assert.match(nonce, /^[\w-]{24}$/)
	assert.notEqual(
		nonce,
		await storeLinkMessage("app", "private-token", store, 1000),
	)
	assert.deepEqual(ttls, [900, 900])
	const results = await Promise.all([
		takeLinkMessage(nonce, store, 2000),
		takeLinkMessage(nonce, store, 2000),
	])
	assert.deepEqual(results, [
		{ application_id: "app", token: "private-token" },
		null,
	])
	const expired = await storeLinkMessage("app", "expired", store, 1000)
	assert.equal(await takeLinkMessage(expired, store, 901000), null)
	assert.equal(await takeLinkMessage("bad", store), null)
})
for (const failure of [false, true])
	test(`successful link edits the stored interaction; edit failure=${failure} is ignored`, async () => {
		const { store } = storage()
		const nonce = await storeLinkMessage("stored-app", "stored-token", store)
		const { state, cookie } = await createState(
			"member",
			store,
			Date.now(),
			nonce,
		)
		const calls: { url: string; init?: RequestInit }[] = []
		const rest = discordRest({
			budget: unlimitedRestBudget,
			fetch: async (url, init) => {
				calls.push({ url: String(url), init })
				return new Response(null, { status: failure ? 404 : 200 })
			},
		})
		let linked = false
		const confirm = (nonce: string, user: string) =>
			confirmLinkMessage(nonce, user, {
				take: (n) => takeLinkMessage(n, store),
				handle: async (id) => {
					assert.equal(id, "member")
					return "gwtester"
				},
				edit: (...args) => {
					assert.equal(linked, true)
					return rest.editOriginal(...args)
				},
			})
		const result = await finishLink(
			new Request(
				`https://goodwatch.app/discord/link/callback?state=${state}&code=code&n=${"b".repeat(
					24,
				)}`,
				{ headers: { Cookie: cookie.split(";")[0] } },
			),
			{
				userId: async () => "member",
				consume: (request, user) => consumeState(request, user, store),
				identity: async () => ({ id: "123", username: "discord_name" }),
				link: async () => {
					linked = true
				},
				confirm,
			},
		)
		assert.equal(result.status, "linked")
		assert.equal(calls.length, 1)
		assert.equal(
			calls[0].url,
			"https://discord.com/api/v10/webhooks/stored-app/stored-token/messages/@original",
		)
		assert.equal(calls[0].init?.method, "PATCH")
		assert.match(String(calls[0].init?.body), /Linked to GoodWatch.*gwtester/)
		assert.doesNotMatch(String(calls[0].init?.body), /discord_name/)
		await confirm(nonce, "member")
		assert.equal(calls.length, 1)
	})
test("an edit nonce cannot bypass OAuth validation or a failed account link", async () => {
	for (const failState of [false, true]) {
		let edits = 0
		await finishLink(
			new Request(
				"https://goodwatch.app/discord/link/callback?code=code&n=" +
					"a".repeat(24),
			),
			{
				userId: async () => "member",
				consume: async () => {
					if (failState) throw new Error("invalid state")
					return { nonce: "a".repeat(24) }
				},
				identity: async () => ({ id: "123", username: "discord_name" }),
				link: async () => {
					throw new Error("link failed")
				},
				confirm: async () => {
					edits++
				},
			},
		)
		assert.equal(edits, 0)
	}
})

test("Valkey message storage uses EX 900 and deadlines for both write and atomic take", async () => {
	const { registerHooks } = (await import("node:module")) as unknown as {
		registerHooks: (hooks: {
			resolve: (
				specifier: string,
				context: { parentURL?: string },
				next: (specifier: string, context: { parentURL?: string }) => unknown,
			) => unknown
		}) => { deregister: () => void }
	}
	const { store } = storage()
	let deadlines = 0
	Object.assign(globalThis, {
		__discordMessageRedis: {
			set: async (key: string, value: string, mode: string, ttl: number) => {
				assert.equal(mode, "EX")
				assert.equal(ttl, 900)
				await store.put(key, value, ttl)
			},
			eval: async (script: string, count: number, key: string) => {
				assert.match(script, /GET/)
				assert.match(script, /DEL/)
				assert.equal(count, 1)
				return store.take(key)
			},
		},
		__discordMessageDeadline: (promise: Promise<unknown>) => {
			deadlines++
			return promise
		},
	})
	const hooks = registerHooks({
		resolve(specifier, context, next) {
			if (
				context.parentURL?.endsWith("/discord/oauth.server.ts") &&
				specifier === "../../utils/cache.ts"
			)
				return {
					url: "data:text/javascript,export const getRedisCluster=()=>globalThis.__discordMessageRedis;export const withRedisDeadline=p=>globalThis.__discordMessageDeadline(p)",
					shortCircuit: true,
				}
			return next(specifier, context)
		},
	})
	try {
		const nonce = await storeLinkMessage("app", "private-token")
		assert.deepEqual(await takeLinkMessage(nonce), {
			application_id: "app",
			token: "private-token",
		})
		assert.equal(await takeLinkMessage(nonce), null)
		assert.equal(deadlines, 3)
	} finally {
		hooks.deregister()
	}
})

test("link confirmation falls back from handle to account name then email local part, with safe text", async () => {
	for (const [handle, name, email, expected] of [
		["public_handle", "Display name", "local@example.com", "＠public handle"],
		[
			null,
			"Display_name @everyone",
			"local@example.com",
			"Display name ＠everyone",
		],
		[null, "  ", "email_local@example.com", "email local"],
	] as const) {
		const identity = await memberHandle("private-user-id", {
			profile: async (id) => {
				assert.equal(id, "private-user-id")
				return handle ? { userId: id, handle } : null
			},
			account: async (id) => {
				assert.equal(id, "private-user-id")
				assert.equal(handle, null)
				return { name, email }
			},
		})
		let body: unknown
		await confirmLinkMessage("a".repeat(24), "private-user-id", {
			take: async () => ({ application_id: "app", token: "secret-token" }),
			handle: async () => identity,
			edit: async (_app, _token, card) => {
				body = card
			},
		})
		const card = body as {
			components: { components: { content: string }[] }[]
			allowed_mentions: { parse: string[] }
		}
		assert.equal(
			card.components[0].components[0].content,
			`## Linked to GoodWatch\n${expected}`,
		)
		assert.deepEqual(card.allowed_mentions, { parse: [] })
		assert.doesNotMatch(
			card.components[0].components[0].content,
			/private-user-id|secret-token|example.com|_/,
		)
	}
})
