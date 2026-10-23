import assert from "node:assert/strict"
import { test } from "node:test"
import {
	createLinkStore,
	LinkingUnavailable,
	type LinkRow,
} from "./link.server.ts"
import { deleteMemberData } from "../account-deletion.server.ts"
function fixture() {
	type Row = LinkRow & { deleted_at: number | null }
	const rows = new Map<string, Row>(),
		invalidated: string[] = [],
		sqls: string[] = []
	let indexed: Row[] = []
	let tail = Promise.resolve()
	const store = createLinkStore({
		query: async (sql, args) => {
			sqls.push(sql)
			assert.match(sql, /deleted_at IS NULL/)
			const source = sql.includes("WHERE discord_user_id = ?")
				? [...rows.values()]
				: indexed
			return source
				.filter(
					(r) =>
						r.deleted_at === null &&
						(sql.includes("OR discord_user_id")
							? r.user_id === args[0] || r.discord_user_id === args[1]
							: sql.includes("WHERE user_id")
							? r.user_id === args[0]
							: r.discord_user_id === args[0]),
				)
				.map((r) => ({ ...r }))
		},
		execute: async (sql, args) => {
			sqls.push(sql)
			if (sql.startsWith("REFRESH"))
				indexed = [...rows.values()].map((r) => ({ ...r }))
			else if (sql.startsWith("INSERT"))
				rows.set(String(args[0]), {
					discord_user_id: String(args[0]),
					user_id: String(args[1]),
					discord_username: String(args[2]),
					deleted_at: null,
				})
			else if (sql.startsWith("UPDATE"))
				for (const r of rows.values()) {
					const matches = sql.includes("OR discord_user_id")
						? r.user_id === args[1] || r.discord_user_id === args[2]
						: sql.includes("WHERE user_id")
						? r.user_id === args[1]
						: r.discord_user_id === args[1]
					if (matches && r.deleted_at === null) r.deleted_at = Number(args[0])
				}
		},
		invalidate: async (id) => {
			invalidated.push(id)
		},
		exclusive: async (work) => {
			const previous = tail
			let release!: () => void
			tail = new Promise<void>((resolve) => {
				release = resolve
			})
			await previous
			try {
				return await work()
			} finally {
				release()
			}
		},
		warn: () => {},
	})
	return { store, rows, invalidated, sqls }
}
test("linking replaces both directions, refreshes indexed reads, invalidates every affected Discord id", async () => {
	const { store, rows, invalidated, sqls } = fixture()
	await store.linkAccounts("1", "alice", "first")
	await store.linkAccounts("2", "bob", "second")
	await store.linkAccounts("2", "alice", "replacement")
	assert.equal(await store.getLinkedUserId("1"), null)
	assert.equal(await store.getLinkedUserId("2"), "alice")
	assert.equal(await store.getUserLink("bob"), null)
	assert.equal(
		(await store.getUserLink("alice"))?.discord_username,
		"replacement",
	)
	assert.ok(rows.get("1")?.deleted_at)
	assert.deepEqual(invalidated, ["1", "2", "2", "1"])
	await store.getLinkedUserId("2")
	assert.match(
		sqls[sqls.length - 1],
		/WHERE discord_user_id = \? AND deleted_at IS NULL/,
	)
})
test("concurrent relinks leave one live link per member", async () => {
	const { store, rows } = fixture()
	await Promise.all([
		store.linkAccounts("1", "alice", "one"),
		store.linkAccounts("2", "alice", "two"),
	])
	assert.equal(
		[...rows.values()].filter((r) => r.deleted_at === null).length,
		1,
	)
})
test("unlink works by Discord id and by member id; account deletion invokes it", async () => {
	const { store } = fixture()
	await store.linkAccounts("1", "alice", "one")
	await store.unlink({ byDiscordUserId: "1" })
	assert.equal(await store.getLinkedUserId("1"), null)
	await store.linkAccounts("1", "alice", "one")
	const calls: string[] = []
	await deleteMemberData("alice", {
		unlink: store.unlink,
		deleteAccountData: async (id) => {
			calls.push(id)
		},
		deleteTrackingData: async (id) => {
			calls.push(id)
		},
		deleteAvatar: async () => true,
	})
	assert.equal(await store.getLinkedUserId("1"), null)
	assert.deepEqual(calls, ["alice", "alice"])
})
test("missing table reads as unlinked; writes produce the rollout message", async () => {
	const missing = async (): Promise<never> => {
		throw new Error("RelationUnknown[Relation 'doc.user_discord_link' unknown]")
	}
	const store = createLinkStore({
		query: missing,
		execute: missing,
		invalidate: async () => {},
		exclusive: (work) => work(),
		warn: () => {},
	})
	assert.equal(await store.getLinkedUserId("1"), null)
	assert.equal(await store.getUserLink("alice"), null)
	assert.equal(await store.available(), false)
	await assert.rejects(
		store.linkAccounts("1", "alice", "one"),
		LinkingUnavailable,
	)
})
test("database failures other than a missing table are not treated as an absent link", async () => {
	const fail = async (): Promise<never> => {
		throw new Error("connection failed")
	}
	const store = createLinkStore({
		query: fail,
		execute: fail,
		invalidate: async () => {},
		exclusive: (work) => work(),
		warn: () => {},
	})
	await assert.rejects(store.getLinkedUserId("1"), /connection failed/)
})

test("account deletion completes before a failed Discord unlink and logs the failure", async (t) => {
	const calls: string[] = []
	const error = new Error("Valkey unavailable")
	const logged = t.mock.method(console, "error", () => {})
	await deleteMemberData("alice", {
		deleteAccountData: async () => {
			calls.push("account")
		},
		deleteTrackingData: async () => {
			calls.push("tracking")
		},
		deleteAvatar: async () => true,
		unlink: async () => {
			calls.push("unlink")
			throw error
		},
	})
	assert.deepEqual(calls, ["account", "tracking", "unlink"])
	assert.equal(logged.mock.calls.length, 1)
	assert.equal(logged.mock.calls[0].arguments[1], error)
})
