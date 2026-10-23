import assert from "node:assert/strict"
import { test } from "node:test"
import type { MemberEpisodeScore } from "../../domain/episode-scores.ts"
import {
	EpisodeScoreStore,
	type EpisodeScoreSend,
} from "./episode-score-store.ts"

const AT = "2026-10-01T00:00:00.000Z"
const season2: MemberEpisodeScore = {
	scope: "season",
	season: 2,
	key: "s2",
	score: 7,
	label: null,
	updatedAt: AT,
}
const episode = {
	scope: "episode" as const,
	season: 1,
	episode: 3,
	episodeTmdbId: 62087,
}

const tick = () => new Promise((resolve) => setImmediate(resolve))

/** A send that answers when the test says so. */
function controlled() {
	const calls: { body: unknown; resolve: () => void; reject: () => void }[] = []
	const send: EpisodeScoreSend = (body) =>
		new Promise((resolve, reject) => {
			const call = {
				body,
				resolve: () => {
					const request = body as { score: number | null }
					resolve({
						status: request.score === null ? "cleared" : "saved",
						previous: null,
						score:
							request.score === null
								? null
								: {
										...episode,
										key: "e62087",
										score: request.score,
										label: null,
										updatedAt: AT,
									},
					})
				},
				reject: () => reject(new Error("HTTP 500")),
			}
			calls.push(call)
		})
	return { send, calls }
}

test("the store shows what the server sent, keyed by part", () => {
	const store = new EpisodeScoreStore(controlled().send)
	store.seed([season2])
	assert.equal(store.get("s2")?.score, 7)
	assert.equal(store.get("s1"), null)
})

test("a new score shows at once, is sent with the episode's TMDB id, and stays once the server took it", async () => {
	const { send, calls } = controlled()
	const store = new EpisodeScoreStore(send)
	store.seed([])
	let changes = 0
	store.subscribe(() => changes++)
	const done = store.set(episode, 9)
	assert.equal(store.get("e62087")?.score, 9)
	assert.ok(store.isSaving("e62087"))
	assert.deepEqual(calls[0].body, {
		scope: "episode",
		episodeId: 62087,
		score: 9,
	})
	calls[0].resolve()
	assert.equal(await done, true)
	assert.equal(store.get("e62087")?.score, 9)
	assert.equal(store.isSaving("e62087"), false)
	assert.ok(changes >= 2)
})

test("a score the server refused goes back to what was there, and the store says so", async () => {
	const { send, calls } = controlled()
	const errors: string[] = []
	const store = new EpisodeScoreStore(send, (message) => errors.push(message))
	store.seed([season2])
	const done = store.set(season2, 4)
	assert.equal(store.get("s2")?.score, 4)
	assert.deepEqual(calls[0].body, { scope: "season", season: 2, score: 4 })
	calls[0].reject()
	assert.equal(await done, false)
	assert.equal(store.get("s2")?.score, 7)
	assert.equal(errors.length, 1)
	// Clearing that fails puts the score back too.
	const cleared = store.set(season2, null)
	assert.equal(store.get("s2"), null)
	calls[1].reject()
	await cleared
	assert.equal(store.get("s2")?.score, 7)
})

test("only the latest of two quick changes decides what shows; a reload while saving keeps the change on screen", async () => {
	const { send, calls } = controlled()
	const store = new EpisodeScoreStore(send)
	store.seed([])
	const first = store.set(episode, 5)
	const second = store.set(episode, 8)
	// The page is read again while both are on their way: it doesn't know them yet.
	store.seed([])
	assert.equal(store.get("e62087")?.score, 8)
	calls[0].reject()
	await first
	await tick()
	assert.equal(store.get("e62087")?.score, 8)
	calls[1].resolve()
	await second
	assert.equal(store.get("e62087")?.score, 8)
})

test("changes to one score go out one at a time, so an older answer can't win (#759 review)", async () => {
	const { send, calls } = controlled()
	const store = new EpisodeScoreStore(send)
	store.seed([])
	const first = store.set(episode, 5)
	const second = store.set(episode, 8)
	// 8 waits for 5's answer: the server gets them in the member's order.
	assert.deepEqual(
		calls.map((call) => (call.body as { score: number }).score),
		[5],
	)
	assert.equal(store.get("e62087")?.score, 8)
	calls[0].resolve()
	await first
	await tick()
	// 5's answer doesn't replace the newer choice on screen.
	assert.equal(store.get("e62087")?.score, 8)
	assert.deepEqual(
		calls.map((call) => (call.body as { score: number }).score),
		[5, 8],
	)
	calls[1].resolve()
	assert.equal(await second, true)
	assert.equal(store.get("e62087")?.score, 8)
})

test("of several changes made while one is on its way, only the latest is sent next", async () => {
	const { send, calls } = controlled()
	const store = new EpisodeScoreStore(send)
	store.seed([])
	const first = store.set(episode, 5)
	const skipped = store.set(episode, 8)
	const latest = store.set(episode, 6)
	calls[0].resolve()
	await first
	assert.equal(await skipped, true)
	await tick()
	assert.deepEqual(
		calls.map((call) => (call.body as { score: number }).score),
		[5, 6],
	)
	calls[1].resolve()
	await latest
	assert.equal(store.get("e62087")?.score, 6)
	// Another score isn't held up by this one.
	const other = store.set({ scope: "season", season: 2 }, 4)
	assert.equal(calls.length, 3)
	calls[2].resolve()
	await other
})

test("a part is sent by its stored key and keeps its range and name while it changes", async () => {
	const { send, calls } = controlled()
	const store = new EpisodeScoreStore(send)
	const part: MemberEpisodeScore = {
		scope: "part",
		season: 1,
		ranges: [{ season: 1, firstEpisode: 1, lastEpisode: 12 }],
		key: "p:s1e1-12",
		score: 8,
		label: "Spy x Family",
		updatedAt: AT,
	}
	store.seed([part])
	void store.set(part, 6)
	assert.deepEqual(calls[0].body, { scope: "part", key: "p:s1e1-12", score: 6 })
	assert.deepEqual(store.get("p:s1e1-12"), { ...part, score: 6 })
	assert.deepEqual(store.parts(), [{ ...part, score: 6 }])
})
