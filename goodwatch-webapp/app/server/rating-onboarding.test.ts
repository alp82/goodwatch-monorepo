import assert from "node:assert/strict"
import { test } from "node:test"
import { stubModules } from "./rating-onboarding.test-support.ts"

const state = { rowcount: 0, events: 0, order: 0, taste: 0, queries: [] as { sql: string; params: unknown[] }[], answered: false }
Object.assign(globalThis, { ratingTest: state })
stubModules({
	"~/utils/crate": `export const execute = async () => ({ rowcount: globalThis.ratingTest.rowcount }); export const upsert = execute;
	 export const query = async (sql, params) => { const s = globalThis.ratingTest; s.queries.push({sql,params}); const media_type = sql.includes('FROM movie') ? 'movie' : 'show';
	 const excludes = params.slice(0,-1).filter(v => typeof v === 'number');
	 return Array.from({length:50},(_,i) => ({ tmdb_id:i+1, media_type, popularity:1, goodwatch_overall_score_voting_count:100000-i })).filter(t => !excludes.includes(t.tmdb_id) && !(s.answered && t.tmdb_id === 1)).slice(0,params.at(-1)); };`,
	"~/telemetry/product-analytics.server": "export const captureProductEvent = () => globalThis.ratingTest.events++",
	"~/server/userData.server": "export const resetUserDataCache = async () => {}",
	"~/server/onboarding-media.server": "export const resetOnboardingMediaCache = async () => {}",
	"./personal-order/rebuild.server.ts": "export const markPersonalOrderChanged = () => globalThis.ratingTest.order++",
	"~/server/taste/index.server": "export const markTasteChanged = async () => globalThis.ratingTest.taste++",
	"~/server/not-interested-store.server": "export const clearNotInterested = async () => {}; export const readNotInterested = async () => []; export const excludeNotInterested = async (_, rows) => rows",
	"~/utils/cache": "const entries = new Map(); export const cached = async ({name,target,params}) => { const key = name + JSON.stringify(params); if (!entries.has(key)) entries.set(key, await target(params)); return entries.get(key); }",
})
const { updateSkipped } = await import("./skipped.server.ts")
const { updateWishList } = await import("./wishList.server.ts")
const { getSmartTitlesForUser, getSmartTitlesForGuest } = await import("./smart-titles.server.ts")
const params = { user_id: "member", tmdb_id: 42, media_type: "movie" as const }

for (const [name, write] of [["skip", updateSkipped], ["wishlist", updateWishList]] as const) {
	test(`${name}: duplicate add and absent remove succeed without events or rebuilds`, async () => {
		Object.assign(state, {rowcount:0, events:0, order:0, taste:0})
		for (const action of ["add", "remove"] as const) assert.equal((await write({...params, action})).status, "success")
		assert.equal(state.events, 0); assert.equal(state.order, 0); assert.equal(state.taste, 0)
	})
	test(`${name}: real changes emit once, invalid input fails`, async () => {
		Object.assign(state, {rowcount:1, events:0, order:0, taste:0})
		assert.equal((await write({...params, action:"add"})).status, "success")
		assert.equal(state.events, 1); assert.equal(state.order, 1)
		assert.equal((await write({...params, user_id:undefined, action:"add"})).status, "failed")
		assert.equal((await write({...params, tmdb_id:-1, action:"add"})).status, "failed")
	})
}
test("member fetch reads current marks on repeat requests and excludes Wishlist in SQL", async () => {
	state.queries = []; state.answered = false
	const p = { userId:"member", count:20, locale:{country:"US",language:"en"} }
	assert.ok((await getSmartTitlesForUser(p)).some(t => t.tmdb_id === 1))
	state.answered = true
	assert.ok((await getSmartTitlesForUser(p)).every(t => t.tmdb_id !== 1))
	assert.equal(state.queries.length, 4)
	for (const {sql,params} of state.queries) {
		assert.match(sql, /FROM user_score/); assert.match(sql, /FROM user_skipped/)
		assert.match(sql, /FROM user_watch_state/); assert.match(sql, /FROM user_wishlist/)
		assert.deepEqual(params, ["member","member","member","member",20])
	}
})
test("guest exclusions are applied before LIMIT, so a full first page yields more titles", async () => {
	state.answered = false
	const excludeIds = ["movie","show"].flatMap(media_type => Array.from({length:10}, (_,i) => ({media_type,tmdb_id:i+1})))
	const titles = await getSmartTitlesForGuest({count:20,locale:{country:"US",language:"en"},ratingsCount:0,excludeIds})
	assert.equal(titles.length,20)
	assert.ok(titles.every(t => t.tmdb_id > 10))
})
