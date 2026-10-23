import assert from "node:assert/strict"
import { test } from "node:test"
import {
	applyAction,
	unanimousPick,
	isExhausted,
	topThree,
	summarize,
	type Action,
	type VotingState,
} from "./rules.ts"
import {
	createSessionStore,
	sessionKey,
	guildKey,
	SESSION_TTL,
	type SessionMeta,
	type Session,
} from "./store.server.ts"
import { LuaValkey, hasLua } from "./test-valkey.ts"
import {
	createOutcomeWriter,
	OUTCOME_COLUMNS,
	outcomeRow,
} from "./outcome.server.ts"
const id = "a".repeat(24)
const meta = (overrides: Partial<SessionMeta> = {}): SessionMeta => ({
	id,
	createdAt: 1000,
	guildId: "guild",
	starterId: "starter",
	type: "movie",
	place: { country: "DE", services: [8] },
	deck: ["movie:1", "movie:2", "movie:3"],
	status: "open",
	...overrides,
})
const vote = (
	user: string,
	n: number,
	choice: "yep" | "nope" = "yep",
): Action => ({ kind: "vote", user, titleId: `movie:${n}`, vote: choice })
const pick = (user: string, n: number): Action => ({
	kind: "pick",
	user,
	titleId: `movie:${n}`,
})
function fixture(onClose?: (session: Session) => Promise<void>) {
	let time = 1000
	const redis = new LuaValkey()
	const store = createSessionStore(redis, (p) => p, {
		now: () => time,
		onClose,
	})
	return {
		redis,
		store,
		clock: (n: number) => {
			time = n
		},
	}
}
const cases: { name: string; actions: Action[] }[] = [
	{
		name: "change a pick",
		actions: [
			vote("a", 1),
			vote("a", 2),
			vote("b", 1),
			vote("b", 2),
			pick("a", 1),
			pick("a", 2),
		],
	},
	{
		name: "late first vote breaks a match and clears its pick",
		actions: [
			vote("a", 1),
			vote("a", 2),
			vote("b", 1),
			vote("b", 2),
			pick("a", 2),
			{ kind: "join", user: "c" },
			vote("c", 1),
		],
	},
	{
		name: "undo breaks a match and clears its pick",
		actions: [
			vote("a", 1),
			vote("a", 2),
			vote("b", 1),
			vote("b", 2),
			pick("a", 2),
			{ kind: "undo", user: "b", titleId: "movie:2" },
		],
	},
	{
		name: "leave removes that participant's pick",
		actions: [
			vote("a", 1),
			vote("b", 1),
			pick("a", 1),
			{ kind: "leave", user: "a" },
		],
	},
	{
		name: "unanimous current match decides",
		actions: [vote("a", 1), vote("b", 1), pick("a", 1), pick("b", 1)],
	},
]
for (const c of cases)
	test(
		`picks rules and Lua agreement: ${c.name}`,
		{ skip: !hasLua },
		async () => {
			const { store } = fixture()
			await store.create(meta())
			let state: VotingState = { deck: meta().deck, votes: {} }
			for (const action of c.actions) {
				state = applyAction(state, action)
				const actual = (await store.act(id, action))!
				assert.deepEqual(actual.votes, state.votes)
				assert.deepEqual(actual.picks, state.picks)
				assert.equal(actual.meta.decidedTitleId, unanimousPick(state))
			}
		},
	)
test(
	"pick requires participation and a current match; agreement is never vacuous",
	{ skip: !hasLua },
	async () => {
		const { store } = fixture()
		await store.create(meta())
		assert.equal(unanimousPick({ deck: [], votes: {}, picks: {} }), undefined)
		await assert.rejects(store.act(id, pick("outsider", 1)), /Join to pick/)
		assert.throws(
			() => applyAction({ deck: meta().deck, votes: {} }, pick("outsider", 1)),
			/Join to pick/,
		)
		await store.act(id, vote("a", 1, "nope"))
		await assert.rejects(store.act(id, pick("a", 1)), /current match/)
	},
)
test(
	"concurrent final picks perform exactly one decided CAS and close every mutation gate",
	{ skip: !hasLua },
	async () => {
		const { store, redis } = fixture()
		await store.create(meta())
		await store.act(id, vote("a", 1))
		await store.act(id, vote("b", 1))
		await store.act(id, pick("a", 1))
		const results = await Promise.allSettled(
			Array.from({ length: 8 }, () => store.act(id, pick("b", 1))),
		)
		assert.equal(
			results.filter((r) => r.status === "fulfilled" && r.value?.transitioned)
				.length,
			1,
		)
		assert.equal(results.filter((r) => r.status === "rejected").length, 7)
		assert.equal((await store.load(id))!.meta.status, "decided")
		for (const action of [
			vote("a", 2),
			pick("a", 1),
			{ kind: "join", user: "c" },
			{ kind: "end", user: "starter" },
		] as const)
			await assert.rejects(store.act(id, action), /closed/)
		assert.equal(redis.hashes[guildKey("guild")][id], undefined)
		assert.ok(redis.hashes[`${sessionKey(id)}:meta`].picks)
	},
)
test(
	"End and removal enforce starter permissions in Lua; removal is Leave",
	{ skip: !hasLua },
	async () => {
		const { store } = fixture()
		await store.create(meta())
		await store.act(id, vote("a", 1), "Alice")
		await store.act(id, vote("b", 1, "nope"), "Bob")
		await assert.rejects(
			store.act(id, { kind: "remove", user: "a", target: "b" }),
			/Only the starter/,
		)
		await assert.rejects(
			store.act(id, { kind: "end", user: "a" }),
			/Only the starter/,
		)
		const removed = (await store.act(id, {
			kind: "remove",
			user: "starter",
			target: "b",
		}))!
		assert.deepEqual(Object.keys(removed.votes), ["a"])
		assert.deepEqual(removed.names, { a: "Alice" })
		assert.deepEqual(removed.summary.matches, ["movie:1"])
		const ended = (await store.act(id, { kind: "end", user: "starter" }))!
		assert.equal(ended.meta.status, "ended")
		assert.equal(ended.meta.endedAt, 1000)
	},
)
test(
	"exhaustion ranks the top three by Yep count with deck-order ties; only the starter chooses",
	{ skip: !hasLua },
	async () => {
		const { store, redis } = fixture()
		const m = meta({
			deck: Array.from({ length: 120 }, (_, i) => `movie:${i + 1}`),
		})
		await store.create(m)
		const votes = {
			a: m.deck.map((titleId) => ({ titleId, vote: "nope" as const })),
			b: m.deck.map((titleId, i) => ({
				titleId,
				vote: i < 4 ? ("yep" as const) : ("nope" as const),
			})),
		}
		redis.hashes[`${sessionKey(id)}:votes`] = Object.fromEntries(
			Object.entries(votes).map(([u, b]) => [u, JSON.stringify(b)]),
		)
		const session = (await store.load(id))!
		assert.equal(isExhausted(session), true)
		assert.deepEqual(
			topThree(session).map((t) => [t.titleId, t.yep]),
			[
				["movie:1", 1],
				["movie:2", 1],
				["movie:3", 1],
			],
		)
		assert.equal(isExhausted({ ...session, deck: m.deck.slice(0, 30) }), false)
		await assert.rejects(
			store.act(id, { kind: "choose", user: "b", titleId: "movie:1" }),
			/Only the starter/,
		)
		await assert.rejects(
			store.act(id, { kind: "choose", user: "starter", titleId: "movie:4" }),
			/top three/,
		)
		const decided = (await store.act(id, {
			kind: "choose",
			user: "starter",
			titleId: "movie:2",
		}))!
		assert.equal(decided.meta.decidedTitleId, "movie:2")
		assert.equal(decided.meta.decisionBy, "starter")
	},
)
test(
	"24 h expiry is fixed, prunes guild reservations, and survives expired live hashes without ballots",
	{ skip: !hasLua },
	async () => {
		const { store, redis, clock } = fixture()
		await store.create(meta())
		await store.act(id, vote("a", 1))
		clock(1000 + 3600_000)
		await store.act(id, { kind: "join", user: "b" })
		assert.equal(redis.expires[`${sessionKey(id)}:votes`], SESSION_TTL - 3600)
		assert.equal(redis.expires[`${sessionKey(id)}:meta`], SESSION_TTL - 3600)
		const record = redis.hashes[`${sessionKey(id)}:record`].data
		assert.doesNotMatch(record, /votes|picks|Alice|interactionToken|movie:1/)
		delete redis.hashes[`${sessionKey(id)}:meta`]
		delete redis.hashes[`${sessionKey(id)}:votes`]
		clock(1000 + SESSION_TTL * 1000)
		const expired = (await store.load(id))!
		assert.equal(expired.meta.status, "expired")
		assert.equal(expired.meta.endedAt, 1000 + SESSION_TTL * 1000)
		assert.equal(expired.summary.participantCount, 1)
		assert.equal(expired.transitioned, true)
		assert.equal((await store.load(id))!.transitioned, false)
		assert.equal(redis.hashes[guildKey("guild")][id], undefined)
	},
)
test(
	"concurrent guild reservations cap at three, isolate guilds, and release on End or time expiry",
	{ skip: !hasLua },
	async () => {
		const { store, clock } = fixture()
		const ids = ["a", "b", "c", "d"].map((s) => s.repeat(24))
		const results = await Promise.allSettled(
			ids.map((id) => store.create(meta({ id }))),
		)
		assert.equal(results.filter((r) => r.status === "fulfilled").length, 3)
		assert.equal(results.filter((r) => r.status === "rejected").length, 1)
		await store.create(meta({ id: "e".repeat(24), guildId: "other" }))
		await store.act(ids[0], { kind: "end", user: "starter" })
		await store.create(meta({ id: ids[3] }))
		clock(1000 + SESSION_TTL * 1000)
		await store.create(
			meta({ id: "f".repeat(24), createdAt: 1000 + SESSION_TTL * 1000 }),
		)
	},
)
test("outcome allowlist writes counts and outcome only; missing table logs once and never rejects", async () => {
	const state = {
		deck: meta().deck,
		votes: { secret: [{ titleId: "movie:1", vote: "yep" as const }] },
		picks: { secret: "movie:1" },
	}
	const session: Session = {
		...state,
		summary: summarize(state),
		meta: meta({
			status: "decided",
			decidedTitleId: "show:123",
			participantCount: 2,
			endedAt: 2000,
		}),
	}
	const calls: { sql: string; args: unknown[] }[] = []
	const log: string[] = []
	const writer = createOutcomeWriter(
		async (sql, args) => {
			calls.push({ sql, args })
		},
		(s) => log.push(s),
	)
	await writer(session)
	assert.deepEqual(OUTCOME_COLUMNS, [
		"session_id",
		"guild_id",
		"channel_id",
		"message_id",
		"starter_id",
		"type",
		"mood",
		"status",
		"decided_tmdb_id",
		"decided_media_type",
		"participant_count",
		"created_at",
		"ended_at",
	])
	assert.deepEqual(calls[0].args, [
		id,
		"guild",
		null,
		null,
		"starter",
		"movie",
		null,
		"decided",
		123,
		"show",
		2,
		1000,
		2000,
	])
	assert.deepEqual(calls[0].args, outcomeRow(session))
	assert.match(calls[0].sql, /ON CONFLICT \(session_id\) DO NOTHING/)
	assert.doesNotMatch(JSON.stringify(calls), /secret|yep|picks|votes/)
	const missing = createOutcomeWriter(
		async () => {
			throw new Error("RelationUnknown discord_together")
		},
		(s) => log.push(s),
	)
	await Promise.all([missing(session), missing(session), missing(session)])
	assert.equal(log.length, 1)
})

test("losing the ballot hash expires the session instead of silently resetting participation", {skip: !hasLua}, async () => {
	const {store, redis} = fixture()
	await store.create(meta())
	await store.act(id, vote("a", 1))
	delete redis.hashes[`${sessionKey(id)}:votes`]
	const expired = (await store.act(id, {kind: "join", user: "b"}))!
	assert.equal(expired.meta.status, "expired")
	assert.equal(expired.summary.participantCount, 1)
	assert.equal(expired.transitioned, true)
})

test("a press at the fixed deadline expires once without recording the vote even if live hashes remain", {skip: !hasLua}, async () => {
	const {store, clock} = fixture()
	await store.create(meta())
	await store.act(id, vote("a", 1))
	clock(1000 + SESSION_TTL * 1000 - 1)
	assert.equal((await store.act(id, {kind: "join", user: "b"}))!.meta.status, "open")
	clock(1000 + SESSION_TTL * 1000)
	const expired = (await store.act(id, vote("a", 2)))!
	assert.equal(expired.meta.status, "expired")
	assert.equal(expired.transitioned, true)
	assert.equal(expired.votes.a.length, 1)
	assert.equal((await store.load(id))!.transitioned, false)
})

test(
	"closure effects run once and closed metadata keeps its original 48 h deadline",
	{ skip: !hasLua },
	async () => {
		for (const status of ["decided", "ended", "expired"] as const) {
			let closed = 0,
				releases = 0
			const { store, redis, clock } = fixture(async () => {
				closed++
			})
			const evaluate = redis.eval.bind(redis)
			redis.eval = async (script, n, ...args) => {
				if (n === 1 && args[1] === "release") releases++
				return evaluate(script, n, ...args)
			}
			await store.create(meta())
			await store.act(id, vote("a", 1))
			clock(1000 + 3600_000)
			if (status === "decided") await store.act(id, pick("a", 1))
			else if (status === "ended")
				await store.act(id, { kind: "end", user: "starter" })
			else {
				delete redis.hashes[`${sessionKey(id)}:meta`]
				delete redis.hashes[`${sessionKey(id)}:votes`]
				clock(1000 + SESSION_TTL * 1000)
				assert.equal((await store.load(id))!.transitioned, true)
			}
			for (const hours of [25, 30, 47]) {
				clock(1000 + hours * 3600_000)
				assert.equal((await store.load(id))!.transitioned, false)
				assert.equal(
					redis.expires[`${sessionKey(id)}:meta`],
					(48 - hours) * 3600,
				)
				assert.equal(
					redis.expires[`${sessionKey(id)}:record`],
					(48 - hours) * 3600,
				)
			}
			assert.equal(closed, 1)
			assert.equal(releases, 1)
		}
	},
)
