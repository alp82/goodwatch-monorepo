import "react"
import "@tanstack/react-query"
import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"
import { applyLocally } from "../../domain/tracking/show-page.ts"
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
