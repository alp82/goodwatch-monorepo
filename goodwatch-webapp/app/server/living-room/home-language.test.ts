import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { test } from "node:test"

const viewers: unknown[] = []
declare global {
	var __tvLanguageViewers: unknown[]
}
globalThis.__tvLanguageViewers = viewers
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		load(
			url: string,
			context: unknown,
			next: (url: string, context: unknown) => unknown,
		): unknown
	}): void
}
const sources = {
	"/my-shows.server.ts": `export const getMyShows = async viewer => { globalThis.__tvLanguageViewers.push(viewer); return { continue: [], pickUp: [], start: [], waiting: [], onHold: [], dropped: [], total: 0 }; }`,
	"/newly-available.server.ts": `export const getLandings = async () => ({ movies: [], shows: [] }); export const newOnOf = async () => new Map()`,
	"/title-cards.server.ts": `export const getTitleCards = async () => []`,
	"/watch-next.server.ts": `export const sortFactsOutsideSnapshot = async () => new Map(); export const planWatchNext = () => ({ head: [], entries: new Map(), total: 0, need: 0, heroFits: false, sort: "match" })`,
}
registerHooks({
	load(url, context, next) {
		const found = Object.entries(sources).find(([suffix]) =>
			url.endsWith(suffix),
		)
		return found
			? { format: "module", source: found[1], shortCircuit: true }
			: next(url, context)
	},
})
const { getTonightParts } = await import("../home-doors.server.ts")

test("home passes the effective language to My shows before the TV projects episode names", async () => {
	const viewer = {
		viewer: { kind: "member", userId: "test" },
		country: "DE",
		services: [],
		wishlist: new Map(),
		language: "ja",
	}
	await getTonightParts(viewer as never, {} as never)
	assert.deepEqual(viewers.pop(), {
		userId: "test",
		country: "DE",
		services: [],
		taste: {},
		language: "ja",
	})
	await getTonightParts(
		{ ...viewer, language: undefined } as never,
		{} as never,
	)
	assert.equal((viewers.pop() as { language?: string }).language, undefined)
})
