import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { test } from "node:test"
import type { ViewerContext } from "../viewer.server.ts"

const movie = (id: number) => ({
	media_type: "movie",
	tmdb_id: id,
	title: `Movie ${id}`,
	release_year: 2024,
})
const state = {
	tracked: movie(1) as ReturnType<typeof movie> | null,
	offServices: false,
	cards: [] as number[][],
	suggestions: 0,
	missing: false,
}
Object.assign(globalThis, { __discordTonight: state })
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		resolve(
			specifier: string,
			context: { parentURL?: string },
			next: (
				specifier: string,
				context: { parentURL?: string },
			) => { url: string },
		): { url: string; shortCircuit?: boolean }
	}): void
}
registerHooks({
	resolve(specifier, context, next) {
		if (!context.parentURL?.endsWith("/tonight.server.ts"))
			return next(specifier, context)
		const modules: Record<string, string> = {
			"~/domain/moods":
				"export const maskOfMoods = moods => moods.length ? 1 : 0",
			"~/domain/my-shows":
				'export const episodeCode=()=>"S1 E1"; export const tonightsPickOf=()=>globalThis.__discordTonight.tracked ? ({kind:"movie"}) : null',
			"~/server/home-doors.server":
				"export const getTonightParts=async()=>({movies:[globalThis.__discordTonight.tracked],shows:{continue:[]},newOn:{},movieFits:true,movieByMatch:false})",
			"~/server/taste/index.server": "export const loadTaste=async()=>({})",
			"~/server/title-cards.server":
				'export const getTitleCards=async(keys)=>{const s=globalThis.__discordTonight;s.cards.push(keys);return s.missing ? [] : keys.map(key=>({media_type:key>=2e12?"show":"movie",tmdb_id:key%1e12,title:"A title",release_year:2024}))}',
			"~/server/watch-next.server": `export const sortFactsOutsideSnapshot=async()=>new Map();
   export const planWatchNext=()=>({head:[1,2,3,4].map(id=>({key:1e12+id})),tiers:[{keys:[1e12+5,2e12+6]}],entries:new Map([1,2,3,4,5].map(id=>[1e12+id,{moodMask:0,fit:globalThis.__discordTonight.offServices ? 0 : 1}]).concat([[2e12+6,{moodMask:1,fit:1}]])),need:1,heroFits:true,sort:"match"});
   export const worthwhileSuggestions=(ctx,taste,options)=>{globalThis.__discordTonight.suggestions++;return [1e12+7,2e12+8].filter(key=>!options.fits||options.fits(key)).slice(0,options.count)}`,
			"~/ui/living-room/tv/tv-machine":
				'export const DOOR_HREF={movie:"/watch/movies"}',
			"~/utils/title-key":
				'export const titleKey=(kind,id)=>(kind==="show"?2e12:1e12)+id',
		}
		const body = modules[specifier]
		return body
			? {
					url: `data:text/javascript,${encodeURIComponent(body)}`,
					shortCircuit: true,
				}
			: next(specifier, context)
	},
})
const { getTonightsPick } = await import("../tonight.server.ts")
const ctx: ViewerContext = {
	viewer: { kind: "member", userId: "member" },
	country: "DE",
	services: [8],
	seen: new Set(),
	ratings: new Map(),
	wishlist: new Map([[1e12 + 1, new Date()]]),
	skipped: new Set(),
	notInterested: new Set(),
	hidden: new Set(),
	forYou: true,
}
function reset() {
	state.tracked = movie(1)
	state.offServices = false
	state.cards = []
	state.suggestions = 0
	state.missing = false
}
test("member picks preserve the default tracked choice, and Another can reach beyond the first Wishlist picks", async () => {
	reset()
	const initial = await getTonightsPick(ctx)
	assert.equal(initial?.title.tmdb_id, 1)
	assert.equal(state.suggestions, 0)
	const pick = await getTonightsPick(ctx, undefined, {
		fits: (key) => ![1, 2, 3, 4].includes(key - 1e12),
	})
	assert.equal(pick?.title.tmdb_id, 5)
	assert.equal(state.suggestions, 0)
})
test("member picks apply mood and type filters before selecting a Wishlist card", async () => {
	reset()
	const pick = await getTonightsPick(ctx, undefined, {
		moods: ["feelgood"],
		fits: (key) => key >= 2e12,
	})
	assert.equal(pick?.title.media_type, "show")
	assert.equal(pick?.title.tmdb_id, 6)
	assert.deepEqual(state.cards, [[2e12 + 6]])
})
test("filtered member picks fall back to worthwhile suggestions with recent picks excluded", async () => {
	reset()
	const pick = await getTonightsPick(ctx, undefined, {
		fits: (key) => key > 2e12 + 6,
	})
	assert.equal(pick?.title.tmdb_id, 8)
	assert.equal(pick?.reason, "suggestion")
	assert.equal(state.suggestions, 1)
	const empty = await getTonightsPick(ctx, undefined, { fits: () => false })
	assert.equal(empty, null)
})

test("filtered Another skips Wishlist entries that do not fit services", async () => {
	reset()
	state.offServices = true
	const pick = await getTonightsPick(ctx, undefined, {
		fits: (key) => key > 1e12 + 4,
	})
	assert.equal(pick?.title.tmdb_id, 6)
	assert.deepEqual(state.cards, [[2e12 + 6]])
})
test("unfiltered website picks retain the Wishlist head even when it does not fit services", async () => {
	reset()
	state.tracked = null
	state.offServices = true
	const pick = await getTonightsPick(ctx)
	assert.deepEqual(pick, {
		title: {
			media_type: "movie",
			tmdb_id: 1,
			title: "A title",
			release_year: 2024,
		},
		reason: "bestMatch",
	})
	assert.deepEqual(state.cards, [[1, 2, 3, 4].map((id) => 1e12 + id)])
	assert.equal(state.suggestions, 0)
})
