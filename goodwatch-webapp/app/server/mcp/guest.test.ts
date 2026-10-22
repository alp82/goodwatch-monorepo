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
				'export const guestContext=(progress,country)=>{globalThis.__discordGuestCalls.push({kind:"context",args:[progress,country]});return {viewer:{kind:"guest"},country,services:[]}}'
		if (specifier === "../title-cards.server")
			body =
				'export const getDisplayFields=async()=>new Map([[42,{runtime:120,poster_path:"/poster.jpg",goodwatch_overall_score_normalized_percent:80}]])'
		if (specifier === "../../utils/title-key")
			body = "export const titleKey=()=>42"
		if (specifier === "./data.server.ts")
			body =
				'const title={media_type:"movie",tmdb_id:42,title:"A title",release_year:2024};export const lookup=async(...args)=>{globalThis.__discordGuestCalls.push({kind:"lookup",args});return [title]};export const resolve=async()=>({title});export const summary=()=>({id:"movie:42",name:"A title",year:2024})'
		if (specifier === "./watch-links.server.ts")
			body =
				'export const watchAvailability=async(...args)=>{globalThis.__discordGuestCalls.push({kind:"availability",args});return {state:"unknown",offers:[]}}'
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
	const availability = calls.find((c) => c.kind === "availability")!
	assert.deepEqual(availability.args[1], {
		viewer: { kind: "guest" },
		country: "GB",
		services: [],
	})
	assert.deepEqual(availability.args[3], { allServices: true })
})
