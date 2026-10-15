import "react"
import "@tanstack/react-query"
import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"
import { applyLocally } from "../../domain/tracking/show-page.ts"
import { CONFLICT, FAILED } from "../../domain/tracking/show-session.ts"
import type {
	ShowTrackingPage,
	ActionAnswer,
} from "../../domain/tracking/show-page.ts"

const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		load(
			url: string,
			context: unknown,
			next: (url: string, context: unknown) => unknown,
		): unknown
	}): void
}
registerHooks({
	load(url, context, next) {
		let source: string | undefined
		if (url.endsWith("/utils/auth.ts"))
			source = 'export const useUser=()=>({user:{id:"fixture"}})'
		else if (url.endsWith("/hooks/useUserDataAccessors.ts"))
			source =
				"export const useIsOnWishlist=()=>false;export const useUserScore=()=>null"
		else if (url.endsWith("/routes/api.user-data.tsx"))
			source = 'export const getQueryKeyUserData=id=>["user-data",id]'
		return source === undefined
			? next(url, context)
			: { format: "module", source, shortCircuit: true }
	},
})
const { getShowStore } = await import("./store.ts")

test("changing episode presentation while a watch is in flight keeps one user/show queue and optimistic mark", async (t) => {
	let finish: ((value: Response) => void) | undefined
	t.mock.method(
		globalThis,
		"fetch",
		async () =>
			new Promise<Response>((resolve) => {
				finish = resolve
			}),
	)
	const store = getShowStore("fixture", 1396)
	const english = {
		state: null,
		log: [],
		running: false,
		episodes: [
			{ id: 101, season: 1, number: 1, airDate: "2020-01-01", name: "Pilot" },
		],
	} as unknown as ShowTrackingPage
	store.load(english)
	const acted = store.act(
		{ type: "watch", season: 1, number: 1 },
		{ actionId: "watch-language-test" },
	)
	assert.equal(acted.ok, true)
	assert.equal(store.snapshot.copy?.log.length, 1)
	const japanese = {
		...english,
		episodes: english.episodes.map((episode) => ({
			...episode,
			name: "始まり",
		})),
	}
	const current = getShowStore("fixture", 1396)
	assert.equal(current, store)
	assert.notEqual(getShowStore("other", 1396), store)
	current.load(japanese)
	assert.equal(current.snapshot.page?.episodes[0].name, "始まり")
	assert.equal(
		current.snapshot.copy?.log.length,
		1,
		"new-language reads cannot erase the pending watch",
	)
	const applied = applyLocally(
		{ state: null, log: [] },
		{ type: "watch", season: 1, number: 1 },
		"watch-language-test",
		{
			showId: 1396,
			episodes: english.episodes,
			today: "2026-10-14",
			now: Date.now(),
		},
	)
	const answer: ActionAnswer = {
		status: "applied",
		refused: null,
		state: applied.copy.state,
		rows: applied.copy.log,
		deleted: [],
		cleared: { wantToSeeAddedAt: null, notInterested: false },
	}
	finish!(Response.json(answer))
	assert.equal((await acted.done)?.status, "applied")
	assert.equal(current.snapshot.copy?.log.length, 1)
})

// A 409 from POST /api/tracking/show: another action on the show came in between, maybe the member undoing this one
// on another device. The page says so in its own words, takes the guess back with what was queued behind it, and
// reads the show again; it never sends the action a second time over that later choice.
const EPISODES = [
	{ id: 201, season: 1, number: 1, airDate: "2020-01-01", name: "One" },
	{ id: 202, season: 1, number: 2, airDate: "2020-01-08", name: "Two" },
	{ id: 203, season: 1, number: 3, airDate: "2020-01-15", name: "Three" },
]
/** The show as the server holds it: episode 1 watched, or nothing tracked. */
const pageWith = (watched: boolean): ShowTrackingPage =>
	({
		...(watched
			? applyLocally(
					{ state: null, log: [] },
					{ type: "watch", season: 1, number: 1 },
					"watch-server-1",
					{ showId: 0, episodes: EPISODES, today: "2026-10-15", now: 1 },
				).copy
			: { state: null, log: [] }),
		running: false,
		episodes: EPISODES,
	}) as unknown as ShowTrackingPage
const ticksOf = (copy: { log: { episode_number: number | null }[] } | null) =>
	(copy?.log ?? []).map((r) => r.episode_number).sort()

for (const [name, conflict] of [
	[
		"a JSON body with the server's own words",
		() =>
			Response.json(
				{ error: "Untrusted words from a proxy or server" },
				{ status: 409 },
			),
	],
	[
		"a body that is not JSON",
		() => new Response("<html>409</html>", { status: 409 }),
	],
	["no body", () => new Response(null, { status: 409 })],
] as const) {
	test(`HTTP 409 (${name}) takes the guess back, says to try again, reads the show again and sends nothing more`, async (t) => {
		const posts: string[] = []
		t.mock.method(
			globalThis,
			"fetch",
			async (_url: string, init?: RequestInit) => {
				posts.push(String(init?.body))
				return conflict()
			},
		)
		const store = getShowStore("fixture", 7000 + name.length)
		store.load(pageWith(true))
		assert.deepEqual(ticksOf(store.snapshot.copy), [1])
		// Another device took episode 1 away meanwhile; the refetch answers with that.
		const elsewhere = pageWith(false)
		let reads = 0
		store.refetch = () => {
			reads += 1
			queueMicrotask(() => store.load({ ...elsewhere }))
		}

		const first = store.act(
			{ type: "watch", season: 1, number: 2 },
			{ actionId: "watch-conflict-2" },
		)
		const behind = store.act(
			{ type: "watch", season: 1, number: 3 },
			{ actionId: "watch-conflict-3" },
		)
		assert.deepEqual([first.ok, behind.ok], [true, true])
		assert.deepEqual(ticksOf(store.snapshot.copy), [1, 2, 3], "shown at once")

		assert.deepEqual([await first.done, await behind.done], [null, null])
		assert.equal(store.snapshot.toast?.tone, "error")
		assert.equal(store.snapshot.toast?.text, CONFLICT)
		assert.equal(reads, 1, "the show is read again once")
		await new Promise((resolve) => setImmediate(resolve))
		assert.deepEqual(
			ticksOf(store.snapshot.copy),
			[],
			"the page shows what the other device left, not the guess",
		)
		assert.equal(
			posts.length,
			1,
			"neither the action nor the one behind it is sent again",
		)
		assert.equal(JSON.parse(posts[0]).actionId, "watch-conflict-2")
		store.dismissToast()
	})
}

test("an HTTP 500 still says the change did not reach us", async (t) => {
	t.mock.method(globalThis, "fetch", async () =>
		Response.json({ error: "Conflict-looking words" }, { status: 500 }),
	)
	const store = getShowStore("fixture", 7100)
	store.load(pageWith(true))
	let reads = 0
	store.refetch = () => {
		reads += 1
	}
	const acted = store.act(
		{ type: "watch", season: 1, number: 2 },
		{ actionId: "watch-failed-2" },
	)
	assert.equal(await acted.done, null)
	assert.deepEqual(
		[store.snapshot.toast?.text, ticksOf(store.snapshot.copy), reads],
		[FAILED, [1], 1],
	)
	store.dismissToast()
})
