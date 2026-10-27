import "zod"
import assert from "node:assert/strict"
import { test } from "node:test"
import { stubModules } from "./rating-onboarding.test-support.ts"

const state = {
	settings: new Map<string,string>(), skips: new Set<string>(), skipWrites: 0, skipReads: 0,
	resets:0, cleared:0, requests: [] as {method:string; excludes:number}[],
}
Object.assign(globalThis,{ transferTest:state })
stubModules({
	"@remix-run/node": "export const json = (data, init) => Response.json(data,init)",
	"~/telemetry/product-analytics.server": "export const analyticsAction = fn => fn; export const withProductContext = (_,fn) => fn(); export const captureProductEvent = () => {}; export const eventUuid = x => x",
	"~/server/media-preferences-store.server": "export const readMediaPreferences = async () => ({}); export const writeMediaPreferences = async () => {}",
	"~/utils/auth": `export const getAuthFromRequest = async () => ({ user:{id:'11111111-1111-4111-8111-111111111111'}, headers:new Headers() }); export const getUserIdFromRequest = async () => null`,
	"~/utils/crate": `export const query = async (sql,p) => { const s = globalThis.transferTest;
	 if(sql.includes('FROM user_setting')) return s.settings.has(p[1]) ? [{value:s.settings.get(p[1])}] : [];
	 if(sql.includes('FROM user_skipped')) {s.skipReads++; return s.skips.has(p.slice(1).join(':')) ? [{tmdb_id:p[1]}] : [];}
	 throw new Error(sql); };
	 export const upsert = async ({table,data}) => {const s=globalThis.transferTest; for(const r of data) {
	 if(table === 'user_setting') {if(!s.settings.has(r.key)) s.settings.set(r.key,r.value);}
	 else if(table === 'user_skipped') {s.skipWrites++; s.skips.add([r.tmdb_id,r.media_type].join(':'));}
	 else throw new Error(table); } return {rowcount:1};};
	 export const execute = async (sql,p) => { const s=globalThis.transferTest; if(s.settings.get(p[2]) !== p[3]) return {rowcount:0}; s.settings.set(p[2],p[0]); return {rowcount:1}; };`,
	"~/server/guest-import.server": "export const resetGuestImportCaches = async () => globalThis.transferTest.resets++",
	"~/server/not-interested.server": "export const updateNotInterested = async () => ({status:'success'})",
	"~/server/not-interested-store.server": "export const readNotInterested = async () => []; export const clearNotInterested = async () => globalThis.transferTest.cleared++",
	"~/server/tracking.server": "export const applyTrackingEvent = async () => {throw new Error('Skip must not watch or rate a title')}",
	"~/server/userData.server": "export const getUserData = async () => ({})",
	"~/utils/locale": "export default () => ({locale:{language:'en'}})",
	"~/utils/media-presentation": "export const mediaLanguageUrl = (url) => url",
	"~/server/media-payload.server": "export const presentCatalogLoader = fn => fn",
	"@tanstack/react-query": "export const useQuery = () => {}",
	"~/server/cache-identity.server": "export const getLocaleFromRequest = () => ({locale:{language:'en',country:'US'}})",
	"~/server/smart-titles.server": `export const getSmartTitlesForGuest = async ({excludeIds}) => {globalThis.transferTest.requests.push({excludes:excludeIds.length}); return [];}; export const getSmartTitlesForUser = getSmartTitlesForGuest`,
})
const { action: importGuest } = await import("../routes/api.import-guest-interactions.ts")
const { action: postTitles, loader: getTitles, fetchSmartTitles } = await import("../routes/api.smart-titles.ts")
const args = (request: Request) => ({request,params:{},context:{}})
const payload = { id:"22222222-2222-4222-8222-222222222222", accountId:"11111111-1111-4111-8111-111111111111",
	changes:[{id:"movie-5338654",kind:"skip",tmdb_id:5338654,media_type:"movie",value:"add",before:null}] }
const send = (data=payload) => importGuest(args(new Request("http://test/api/import-guest-interactions",{method:"POST",body:JSON.stringify(data)})))
test("guest skips are canonicalized, journaled and verified; retries write nothing twice", async () => {
	const first = await send()
	assert.equal(first.status,200)
	const body = await first.json()
	assert.ok("success" in body && body.success === true)
	assert.ok(state.skips.has("658039:movie")); assert.equal(state.skipWrites,1)
	assert.ok(state.skipReads >= 2); assert.equal(state.cleared,0)
	const journal = JSON.parse(state.settings.get(`browser_transfer:${payload.id}`)!)
	assert.equal(journal.done,true); assert.deepEqual(journal.completed,["movie-5338654"])
	assert.equal((await send()).status,200); assert.equal(state.skipWrites,1)
	assert.equal(state.resets,2)
})
test("skip without a valid title is rejected before journaling", async () => {
	const result = await send({...payload,changes:[{...payload.changes[0],tmdb_id:0}]})
	assert.equal(result.status,400)
})
test("smart titles use GET for small exclusions and POST for long histories, keeping every exclusion", async () => {
	const original = globalThis.fetch
	globalThis.fetch = async (input, init) => {
		const request = new Request(`http://test${input}`,init)
		const result = await (request.method === "POST" ? postTitles : getTitles)(args(request))
		state.requests.at(-1)!.method = request.method
		return Response.json(result)
	}
	try {
		await fetchSmartTitles({count:20,excludeIds:[{tmdb_id:1,media_type:"movie"}]})
		await fetchSmartTitles({count:20,excludeIds:Array.from({length:1000},(_,i) => ({tmdb_id:i+1,media_type:"show"}))})
		assert.deepEqual(state.requests,[{excludes:1,method:"GET"},{excludes:1000,method:"POST"}])
	} finally { globalThis.fetch = original }
})
test("malformed exclusions return 400", async () => {
	await assert.rejects(() => getTitles(args(new Request("http://test/api/smart-titles?excludeIds=bad"))), (e:unknown) => e instanceof Response && e.status === 400)
})
