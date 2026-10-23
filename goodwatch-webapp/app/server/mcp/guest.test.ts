import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { test } from "node:test"
const calls: { kind: string; args: unknown[] }[] = []
Object.assign(globalThis, { __discordGuestCalls: calls })
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
		if (!context.parentURL?.endsWith("/mcp/guest.server.ts"))
			return next(specifier, context)
		let body: string | undefined
		if (specifier === "../details.server")
			body =
				'export const getDetailsForMovie=async()=>({details:{synopsis:"Story",genres:["Drama"]}});export const getDetailsForShow=getDetailsForMovie'
		if (specifier === "../viewer.server")
			body =
				'export const guestContext=(progress,country)=>{globalThis.__discordGuestCalls.push({kind:"context",args:[progress,country]});return {viewer:{kind:"guest"},country,services:progress.services??[]}}'
		if (specifier === "../title-cards.server")
			body =
				'export const getDisplayFields=async()=>new Map([[42,{runtime:120,poster_path:"/poster.jpg",backdrop_path:"/backdrop.jpg",goodwatch_overall_score_normalized_percent:80}]])'
		if (specifier === "../../utils/title-key")
			body = "export const titleKey=()=>42"
		if (specifier === "./data.server.ts")
			body =
				'const title={media_type:"movie",tmdb_id:42,title:"A title",release_year:2024};export const lookup=async(...args)=>{globalThis.__discordGuestCalls.push({kind:"lookup",args});return [title]};export const resolve=async()=>({title});export const summary=()=>({id:"movie:42",name:"A title",year:2024})'
		if (specifier === "./watch-links.server.ts")
			body =
				'export const watchAvailability=async(...args)=>{globalThis.__discordGuestCalls.push({kind:"availability",args});return {state:"unknown",offers:[]}}'
		for (const [path, name] of [
			["./similar-titles.server.ts", "similarTitles"],
			["./discover.server.ts", "readDiscover"],
			["./people.server.ts", "readPeople"],
		]) {
			if (specifier === path)
				body = `export const ${name}=async(...args)=>{globalThis.__discordGuestCalls.push({kind:"${name}",args});return {status:"ok"}}`
		}
		return body
			? {
					url: `data:text/javascript,${encodeURIComponent(body)}`,
					shortCircuit: true,
				}
			: next(specifier, context)
	},
})
const { readGuestTool } = await import("./guest.server.ts")
test("guest search uses only plain lookup even with ranked or member filters", async () => {
	calls.length = 0
	const result = await readGuestTool(
		{ country: "DE" },
		"https://goodwatch.app",
		"search_titles",
		{
			query: "A title",
			ranked: true,
			for_you: true,
			exclude_seen: true,
			limit: 100,
		},
	)
	assert.equal(result.ranked, false)
	assert.deepEqual(calls.find((c) => c.kind === "lookup")?.args, [
		"A title",
		0,
		25,
	])
	assert.deepEqual(calls[0].args, [
		{ interactions: [], country: "DE", services: [] },
		"DE",
	])
})
test("guest title reads have no member fields and use all services", async () => {
	calls.length = 0
	const result = await readGuestTool(
		{ country: "GB" },
		"https://goodwatch.app",
		"get_title",
		{ title_id: "movie:42" },
	)
	assert.equal("member" in result, false)
	const read = result.title as Record<string, unknown>
	assert.equal(read.poster_url, "https://image.tmdb.org/t/p/w342/poster.jpg")
	assert.equal(read.backdrop_url, "https://image.tmdb.org/t/p/w780/backdrop.jpg")
	const availability = calls.find((c) => c.kind === "availability")!
	assert.deepEqual(availability.args[1], {
		viewer: { kind: "guest" },
		country: "GB",
		services: [],
	})
	assert.deepEqual(availability.args[3], { allServices: true })
})

for (const query of [undefined, "", " ", "\t\n"])
	test(`guest search rejects blank query without lookup: ${JSON.stringify(
		query,
	)}`, async () => {
		calls.length = 0
		await assert.rejects(
			readGuestTool(
				{ country: "DE" },
				"https://goodwatch.app",
				"search_titles",
				{ query },
			),
			/nonblank query/,
		)
		assert.equal(
			calls.some((call) => call.kind === "lookup"),
			false,
		)
	})

const guestCases: [
	Parameters<typeof readGuestTool>[2],
	Parameters<typeof readGuestTool>[3],
	string,
][] = [
	[
		"get_similar_titles",
		{ title_id: "movie:42", for_you: true },
		"similarTitles",
	],
	[
		"discover_titles",
		{ type: "show", providers: [119], for_you: true },
		"readDiscover",
	],
	["get_discover_filters", {}, "readDiscover"],
	["search_people", { query: "A person", person_id: 12 }, "readPeople"],
	["get_person", { person_id: 12 }, "readPeople"],
]
for (const [name, args, reader] of guestCases)
	test(`guest ${name} reuses ${reader} with a guest context`, async () => {
		calls.length = 0
		await readGuestTool({ country: "DE" }, "https://goodwatch.app", name, args)
		const call = calls.find((c) => c.kind === reader)!
		assert.equal(call.args[0], "")
		assert.equal(call.args[1], "https://goodwatch.app")
		assert.deepEqual(call.args.at(-1), {
			viewer: { kind: "guest" },
			country: "DE",
			services: [],
		})
		if (reader !== "readPeople")
			assert.equal((call.args.at(-2) as { for_you: boolean }).for_you, false)
		if (name === "search_people")
			assert.equal(
				(call.args[2] as { person_id?: number }).person_id,
				undefined,
			)
	})
test("guest person tools reject blank searches and missing person IDs", async () => {
	await assert.rejects(
		readGuestTool({ country: "DE" }, "https://goodwatch.app", "search_people", {
			query: " ",
		}),
		/nonblank/,
	)
	await assert.rejects(
		readGuestTool({ country: "DE" }, "https://goodwatch.app", "get_person", {}),
		/person_id/,
	)
})

test("guest title reads use saved guild services for availability", async () => {
	calls.length = 0
	await readGuestTool(
		{ country: "DE", services: [8] },
		"https://goodwatch.app",
		"get_title",
		{ title_id: "movie:42" },
	)
	const availability = calls.find((c) => c.kind === "availability")!
	assert.deepEqual(availability.args[3], { allServices: false })
	assert.deepEqual((availability.args[1] as { services: number[] }).services, [
		8,
	])
})
