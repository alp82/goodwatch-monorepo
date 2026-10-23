import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { test } from "node:test"
import type { ViewerContext } from "../viewer.server.ts"
const calls: { kind: string; args: unknown[] }[] = []
Object.assign(globalThis, { __guestReaderCalls: calls })
const title = {
	media_type: "movie",
	tmdb_id: 42,
	title: "A title",
	release_year: 2024,
}
const ctx: ViewerContext = {
	viewer: { kind: "guest", progress: { interactions: [] } },
	country: "DE",
	services: [],
	hidden: new Set<number>(),
	seen: new Set<number>(),
	skipped: new Set<number>(),
	ratings: new Map(),
	wishlist: new Map(),
	notInterested: new Set<number>(),
	forYou: true,
}
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		resolve(
			specifier: string,
			context: { parentURL?: string },
			next: (specifier: string, context: { parentURL?: string }) => unknown,
		): unknown
	}): void
}
registerHooks({
	resolve(specifier, context, next) {
		if (
			!/\/mcp\/(similar-titles|discover|people)\.server\.ts$/.test(
				context.parentURL ?? "",
			)
		)
			return next(specifier, context)
		const log =
			"const log=(kind,...args)=>globalThis.__guestReaderCalls.push({kind,args});"
		let body: string | undefined
		if (specifier.includes("viewer.server"))
			body = `${log}export const getMemberViewerContext=async(...args)=>{log("member",...args);return {viewer:{kind:"member",userId:args[0]},country:"US",services:[8],hidden:[],seen:[],skipped:[]}}`
		if (specifier.includes("taste/index.server"))
			body = `${log}export const loadTaste=async(...args)=>{log("taste",...args);return {signal:"none",percentile:keys=>keys.map(()=>null)}}`
		if (specifier.includes("data.server"))
			body = `const title=${JSON.stringify(
				title,
			)};export const resolve=async()=>({title});export const summary=t=>({id:'movie:'+t.tmdb_id,name:t.title,year:t.release_year});export const page=(items)=>({items})`
		if (specifier.includes("related-map.server"))
			body = "export const relatedMapNeighbors=async()=>({n:[]})"
		if (specifier === "./similar-titles.ts")
			body = `${log}export const similarTitleView=(...args)=>{log("similar",...args);return {items:[${JSON.stringify(
				{ ...title, similarity: 0.8 },
			)}]}}`
		if (specifier.includes("product-analytics.server"))
			body = `${log}export const captureProductEvent=(...args)=>log("capture",...args)`
		if (specifier.includes("title-filter/index.server"))
			body = `${log}export const filterTitles=async(...args)=>{log("filter",...args);return {keys:[42],total:1,sortUsed:"popular"}}`
		if (specifier.includes("title-cards.server"))
			body = `export const getDisplayFields=async()=>new Map([[42,${JSON.stringify(
				title,
			)}]])`
		if (specifier.includes("title-snapshot/index.server"))
			body =
				'export const getTitleSnapshot=()=>({columns:{genreNames:["Drama"]},facts:()=>({score:80})})'
		if (specifier.includes("streaming-providers.server"))
			body =
				'export const getStreamingProviders=async()=>[{id:119,name:"Prime Video"}];export const slimStreamingProviders=p=>p'
		if (specifier.includes("combined-search/catalog.server"))
			body =
				'export const searchQuery=async()=>[{tmdb_id:12,name:"A person",known_for_department:"Acting",profile_path:"/person.jpg"}]'
		if (specifier === "./people")
			body = `${log}export const personSummary=p=>({person_id:p.tmdb_id,name:p.name,url:"https://goodwatch.app/person/"+p.tmdb_id}); export const filmographyView=()=>{log("filmography");return []}`
		if (specifier === "../person.server")
			body = `${log}export const getPersonCredits=async()=>{log("credits");return []}`
		if (specifier.includes("search-people/people.server"))
			body =
				'export const knownForOf=async()=>new Map([[12,[{type:"movie",id:42,title:"A title",year:"2024",backdrop:null}]]])'
		return body
			? {
					url: `data:text/javascript,${encodeURIComponent(body)}`,
					shortCircuit: true,
			  }
			: next(specifier, context)
	},
})
const { similarTitles } = await import("./similar-titles.server.ts")
const { readDiscover } = await import("./discover.server.ts")
const { readPeople } = await import("./people.server.ts")
test("guest similar uses supplied exclusions and never reads a member or taste", async () => {
	calls.length = 0
	const result = await similarTitles(
		"",
		"https://goodwatch.app",
		{ title_id: "movie:42", for_you: false },
		ctx,
	)
	assert.equal((result.items as { id: string }[])[0].id, "movie:42")
	assert.equal(
		calls.some((c) => c.kind === "member" || c.kind === "taste"),
		false,
	)
	assert.equal(calls.find((c) => c.kind === "similar")!.args[3], ctx.hidden)
})
test("guest discovery uses local viewer and guest taste, without member telemetry", async () => {
	calls.length = 0
	const result = await readDiscover(
		"",
		"https://goodwatch.app",
		"discover_titles",
		{ providers: [119], for_you: false },
		ctx,
	)
	assert.equal(result.country, "DE")
	const filter = calls.find((c) => c.kind === "filter")!.args[0] as {
		viewer: unknown
		state: { services: number[] }
		forYou: unknown
	}
	assert.equal(filter.viewer, ctx)
	assert.deepEqual(filter.state.services, [119])
	assert.equal(filter.forYou, null)
	assert.deepEqual(calls.find((c) => c.kind === "taste")!.args, [ctx.viewer])
	assert.equal(
		calls.some((c) => c.kind === "member" || c.kind === "capture"),
		false,
	)
	const filters = await readDiscover(
		"",
		"https://goodwatch.app",
		"get_discover_filters",
		{},
		ctx,
	)
	assert.deepEqual(filters.genres, ["Drama"])
	assert.equal(filters.country, "DE")
})
test("guest person uses canonical known-for IDs and profile links without member reads", async () => {
	calls.length = 0
	const result = await readPeople(
		"",
		"https://goodwatch.app",
		{ person_id: 12 },
		ctx,
	)
	assert.ok("person" in result)
	if (!result.person) return
	assert.match(result.person.url, /person/)
	assert.match(result.person.profile_url ?? "", /w185\/person.jpg/)
	assert.deepEqual(result.person.known_for, [
		{ id: "movie:42", name: "A title", year: 2024 },
	])
	assert.equal(
		calls.some((c) =>
			["member", "taste", "credits", "filmography"].includes(c.kind),
		),
		false,
	)
	assert.deepEqual(result.items, [])
})
test("existing member branches keep member context, taste, telemetry and known-for shape", async () => {
	calls.length = 0
	await similarTitles("member-id", "https://goodwatch.app", {})
	assert.ok(calls.some((c) => c.kind === "member" && c.args[0] === "member-id"))
	assert.ok(calls.some((c) => c.kind === "taste"))
	calls.length = 0
	await readDiscover(
		"member-id",
		"https://goodwatch.app",
		"discover_titles",
		{},
	)
	assert.ok(
		calls.some((c) => c.kind === "capture" && c.args[0] === "member-id"),
	)
	assert.ok(calls.some((c) => c.kind === "member"))
	calls.length = 0
	const result = await readPeople("member-id", "https://goodwatch.app", {
		person_id: 12,
		exclude_seen: true,
	})
	assert.ok(calls.some((c) => c.kind === "member"))
	assert.ok(calls.some((c) => c.kind === "taste"))
	assert.ok(calls.some((c) => c.kind === "credits"))
	assert.ok(calls.some((c) => c.kind === "filmography"))
	if (result.person) assert.equal("id" in result.person.known_for[0], false)
})
