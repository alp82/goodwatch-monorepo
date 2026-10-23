// Dev prerequisite: lua. Set TOGETHER_SKIP_LUA=1 only to explicitly skip Lua agreement tests.
import assert from "node:assert/strict"
import { test } from "node:test"
import {
	applyAction,
	summarize,
	nextTitle,
	growDeck,
	shouldGrow,
	type Action,
	type VotingState,
	type Summary,
} from "./rules.ts"
import {
	createSessionStore,
	sessionKey,
	SESSION_TTL,
	type SessionMeta,
} from "./store.server.ts"
import { LuaValkey, hasLua } from "./test-valkey.ts"
export const meta = (): SessionMeta => ({
	id: "a".repeat(24),
	guildId: "guild",
	starterId: "starter",
	createdAt: 0,
	type: "movie",
	place: { country: "DE", services: [] },
	deck: ["movie:1", "movie:2", "movie:3"],
	status: "open",
})
const vote = (
	user: string,
	n: number,
	choice: "yep" | "nope" = "yep",
): Action => ({ kind: "vote", user, titleId: `movie:${n}`, vote: choice })
const expected = (
	participantCount: number,
	stillVoting: number,
	matches: number[] = [],
	possible: [number, number][] = [],
): Summary => ({
	participantCount,
	stillVoting,
	matches: matches.map((n) => `movie:${n}`),
	possibleMatches: possible.map(([n, waitingFor]) => ({
		titleId: `movie:${n}`,
		waitingFor,
	})),
})
const scenarios: { name: string; actions: Action[]; expected: Summary }[] = [
	{
		name: "empty lobby has no vacuous matches",
		actions: [],
		expected: expected(0, 0),
	},
	{
		name: "Join alone is not participation",
		actions: [{ kind: "join", user: "a" }],
		expected: expected(0, 0),
	},
	{
		name: "first vote creates participation",
		actions: [vote("a", 1)],
		expected: expected(1, 1, [1]),
	},
	{
		name: "late participant breaks a match",
		actions: [vote("a", 1), vote("a", 2), vote("b", 1)],
		expected: expected(2, 2, [1], [[2, 1]]),
	},
	{
		name: "late participant restores a match",
		actions: [vote("a", 1), vote("a", 2), vote("b", 1), vote("b", 2)],
		expected: expected(2, 2, [1, 2]),
	},
	{
		name: "nope blocks a match",
		actions: [vote("a", 1), vote("b", 1, "nope")],
		expected: expected(2, 2),
	},
	{
		name: "leave removes votes and restores a match",
		actions: [vote("a", 1), vote("b", 1, "nope"), { kind: "leave", user: "b" }],
		expected: expected(1, 1, [1]),
	},
	{
		name: "undo returns to last title",
		actions: [
			vote("a", 1),
			vote("a", 2),
			{ kind: "undo", user: "a", titleId: "movie:2" },
		],
		expected: expected(1, 1, [1]),
	},
	{
		name: "undo first vote removes participation",
		actions: [vote("a", 1), { kind: "undo", user: "a", titleId: "movie:1" }],
		expected: expected(0, 0),
	},
	{
		name: "stale and duplicate votes cannot advance",
		actions: [vote("a", 2), vote("a", 1), vote("a", 1, "nope")],
		expected: expected(1, 1, [1]),
	},
	{
		name: "stale undo cannot remove another vote",
		actions: [
			vote("a", 1),
			vote("a", 2),
			{ kind: "undo", user: "a", titleId: "movie:1" },
		],
		expected: expected(1, 1, [1, 2]),
	},
	{
		name: "completed participants stop voting",
		actions: [vote("a", 1), vote("a", 2), vote("a", 3)],
		expected: expected(1, 0, [1, 2, 3]),
	},
	{
		name: "waiting count includes all missing voters",
		actions: [vote("a", 1), vote("a", 2), vote("b", 1), vote("c", 1)],
		expected: expected(3, 3, [1], [[2, 2]]),
	},
	{
		name: "everyone leaving resets lobby",
		actions: [vote("a", 1), { kind: "leave", user: "a" }],
		expected: expected(0, 0),
	},
]
for (const scenario of scenarios) {
	test(scenario.name, () => {
		let state: VotingState = { deck: meta().deck, votes: {} }
		for (const action of scenario.actions) state = applyAction(state, action)
		assert.deepEqual(summarize(state), scenario.expected)
		assert.equal(nextTitle(state, "new"), "movie:1")
	})
	test(
		`production Lua agrees after each step: ${scenario.name}`,
		{ skip: !hasLua },
		async () => {
			const redis = new LuaValkey(),
				store = createSessionStore(redis, (p) => p)
			let actual = (await store.create(meta()))!
			let state: VotingState = { deck: meta().deck, votes: {} }
			assert.deepEqual(actual.summary, summarize(state))
			for (const action of scenario.actions) {
				state = applyAction(state, action)
				actual = (await store.act(meta().id, action))!
				assert.deepEqual(actual.summary, summarize(state))
				assert.deepEqual(actual.votes, state.votes)
			}
			assert.deepEqual(actual.summary, scenario.expected)
			assert.equal(redis.expires[`${sessionKey(meta().id)}:meta`], SESSION_TTL)
			assert.equal(redis.expires[`${sessionKey(meta().id)}:votes`], SESSION_TTL)
		},
	)
}
test("growth triggers at five remaining, appends thirty, deduplicates, caps at 120", () => {
	const candidates = Array.from({ length: 130 }, (_, i) => `movie:${i + 1}`)
	const deck = growDeck([], candidates)
	assert.equal(deck.length, 30)
	for (const n of [0, 24, 25, 30]) {
		const state = {
			deck,
			votes: {
				a: deck
					.slice(0, n)
					.map((titleId) => ({ titleId, vote: "yep" as const })),
			},
		}
		assert.equal(shouldGrow(state), n >= 25)
		assert.equal(nextTitle(state, "a"), deck[n])
	}
	let grown = growDeck(deck, candidates)
	assert.deepEqual(grown.slice(0, 30), deck)
	assert.equal(grown.length, 60)
	grown = growDeck(growDeck(grown, candidates), candidates)
	assert.equal(grown.length, 120)
	assert.equal(
		shouldGrow({
			deck: grown,
			votes: { a: grown.map((titleId) => ({ titleId, vote: "yep" })) },
		}),
		false,
	)
	assert.deepEqual(growDeck([], ["movie:1", "movie:1"]), ["movie:1"])
})
test(
	"Lua growth CAS, missing sessions, binding, concurrent participants, and cap",
	{ skip: !hasLua },
	async () => {
		const store = createSessionStore(new LuaValkey(), (p) => p),
			id = meta().id
		assert.equal(await store.load(id), null)
		assert.equal(await store.act(id, vote("a", 1)), null)
		await store.create(meta())
		await Promise.all(
			Array.from({ length: 12 }, (_, i) => store.act(id, vote(String(i), 1))),
		)
		assert.equal((await store.load(id))!.summary.participantCount, 12)
		await assert.rejects(
			store.act(id, { kind: "join", user: "extra" }),
			/This session is full/,
		)
		await assert.rejects(
			store.act(id, vote("extra", 1)),
			/This session is full/,
		)
		await store.act(id, { kind: "join", user: "0" })
		await store.act(id, { kind: "leave", user: "0" })
		await store.act(id, vote("extra", 1))
		const candidates = Array.from({ length: 60 }, (_, i) => `movie:${i + 1}`)
		const grown = (await store.grow(id, 3, candidates, false))!
		assert.deepEqual(grown.deck, growDeck(meta().deck, candidates))
		assert.deepEqual(
			(await store.grow(id, 3, ["show:999"], true))!.deck,
			grown.deck,
		)
		assert.equal(
			(await store.bind(id, "channel", "message"))!.meta.messageId,
			"message",
		)
		let state: VotingState = { deck: meta().deck, votes: {} }
		for (let i = 0; i < 12; i++) state = applyAction(state, vote(String(i), 1))
		assert.throws(() => applyAction(state, vote("extra", 1)), /full/)
	},
)

test("all 225 reachable two-person, three-title states obey unanimity, waiting, and next-title rules", async () => {
	const deck = meta().deck
	const ballots: VotingState["votes"][string][] = [[]]
	for (let length = 1; length <= deck.length; length++) {
		for (let mask = 0; mask < 2 ** length; mask++)
			ballots.push(
				deck.slice(0, length).map((titleId, i) => ({
					titleId,
					vote: mask & (1 << i) ? "yep" : "nope",
				})),
			)
	}
	for (const a of ballots)
		for (const b of ballots) {
			const votes: VotingState["votes"] = {}
			if (a.length) votes.a = a
			if (b.length) votes.b = b
			const state = { deck, votes },
				s = summarize(state)
			assert.equal(
				s.participantCount,
				Number(a.length > 0) + Number(b.length > 0),
			)
			assert.equal(
				s.stillVoting,
				Number(a.length > 0 && a.length < 3) +
					Number(b.length > 0 && b.length < 3),
			)
			assert.equal(nextTitle(state, "a"), deck[a.length])
			assert.equal(nextTitle(state, "b"), deck[b.length])
			for (let i = 0; i < deck.length; i++) {
				const cast = [a, b].filter((v) => v.length).map((v) => v[i]?.vote)
				const yep = cast.filter((v) => v === "yep").length
				assert.equal(
					s.matches.includes(deck[i]),
					!!cast.length && cast.every((v) => v === "yep"),
				)
				assert.equal(
					s.possibleMatches.some((p) => p.titleId === deck[i]),
					yep > 0 && !cast.includes("nope") && yep < cast.length,
				)
			}
			if (hasLua) {
				const redis = new LuaValkey()
				redis.hashes[`${sessionKey(meta().id)}:meta`] = {
					data: JSON.stringify(meta()),
				}
				redis.hashes[`${sessionKey(meta().id)}:votes`] = Object.fromEntries(
					Object.entries(votes).map(([u, v]) => [u, JSON.stringify(v)]),
				)
				const actual = await createSessionStore(redis, (p) => p).load(meta().id)
				assert.deepEqual(actual!.summary, s)
			}
		}
})

test("every store operation is deadline-bound and unavailable Valkey propagates", async () => {
	let deadlines = 0
	const client = { eval: async () => null }
	const store = createSessionStore(client, async (p) => {
		deadlines++
		return p
	})
	await store.create(meta())
	await store.load(meta().id)
	await store.act(meta().id, vote("a", 1))
	await store.grow(meta().id, 3, [], true)
	await store.bind(meta().id, "c", "m")
	assert.equal(deadlines, 5)
	const unavailable = createSessionStore(client, async () => {
		throw new Error("Redis command timed out")
	})
	await assert.rejects(unavailable.load(meta().id), /timed out/)
})

test(
	"Lua caps repeated growth at 120 and preserves existing votes; the closed gate refuses mutations",
	{ skip: !hasLua },
	async () => {
		const store = createSessionStore(new LuaValkey(), (p) => p)
		const m = meta()
		await store.create(m)
		await store.act(m.id, vote("a", 1))
		const candidates = Array.from({ length: 150 }, (_, i) => `movie:${i + 1}`)
		for (const length of [3, 33, 63, 93, 120])
			await store.grow(m.id, length, candidates, false)
		const session = (await store.load(m.id))!
		assert.equal(session.deck.length, 120)
		assert.deepEqual(session.votes.a, [{ titleId: "movie:1", vote: "yep" }])
		const closed = meta()
		closed.id = "b".repeat(24)
		closed.status = "ended"
		await store.create(closed)
		for (const action of [
			vote("a", 1),
			{ kind: "join", user: "a" },
			{ kind: "leave", user: "a" },
		] as Action[])
			await assert.rejects(
				store.act(closed.id, action),
				/This session is closed/,
			)
	},
)
