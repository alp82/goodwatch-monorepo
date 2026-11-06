import assert from "node:assert/strict"
import { test } from "node:test"
import { createEntityResolver } from "./discover-query-entities.server.js"
import "./title-filter/test-alias.ts"
const { interpret } = await import("../domain/discover-query.ts")

function furiosaResolver() {
	// Minimal responses captured from the production palette and cast lookups.
	return createEntityResolver(async (url: URL) => {
		const data =
			url.pathname === "/api/cast"
				? {
						castMembers: [
							{ tmdb_id: 4733641, name: "Furiosa", popularity: 0.0193 },
						],
					}
				: url.pathname === "/api/command-palette"
					? {
							titles: [
								{
									tmdbId: 786892,
									mediaType: "movie",
									title: "Furiosa: A Mad Max Saga",
								},
							],
						}
					: { searchResults: [] }
		return new Response(JSON.stringify(data))
	}, "http://lookup.invalid")
}

test("furiosa stays a title search when a person has the same name", async () => {
	const resolve = furiosaResolver()
	const initial = interpret("furiosa")
	const additions = (await Promise.all(initial.entities.map(resolve))).filter(
		Boolean,
	)
	const result = interpret("furiosa", "", new Date("2026-11-06"), additions)
	assert.equal(result.filters.people, undefined)
	assert.equal(result.filters.similar, undefined)
	assert.equal(result.semanticQuery, "furiosa")
})

for (const query of ["starring Furiosa", "like Furiosa"]) {
	test(`${query} still resolves an explicit reference`, async () => {
		const resolve = furiosaResolver()
		const initial = interpret(query)
		const additions = (await Promise.all(initial.entities.map(resolve))).filter(
			Boolean,
		)
		const result = interpret(query, "", new Date("2026-11-06"), additions)
		assert.equal(result.filters.people, "4733641")
	})
}

test("a bare person name without a competing title still resolves", async () => {
	const resolve = createEntityResolver(
		async (url: URL) =>
			new Response(
				JSON.stringify(
					url.pathname === "/api/cast"
						? { castMembers: [{ tmdb_id: 31, name: "Tom Hanks" }] }
						: { titles: [], searchResults: [] },
				),
			),
		"http://lookup.invalid",
	)
	const initial = interpret("Tom Hanks")
	const additions = (await Promise.all(initial.entities.map(resolve))).filter(
		Boolean,
	)
	assert.equal(
		interpret("Tom Hanks", "", new Date("2026-11-06"), additions).filters
			.people,
		"31",
	)
})

test("original-language recovery uses the normalized palette query and preserves its original title", async () => {
	const read = async (url: URL) => {
		const data =
			url.pathname === "/api/search"
				? {
						searchResults: [
							{
								id: 637,
								media_type: "movie",
								title: "Life Is Beautiful",
								original_title: "La vita è bella",
								release_date: "1997-01-01",
							},
						],
					}
				: {
						titles: [
							{
								tmdbId: 637,
								mediaType: "movie",
								title: "Life Is Beautiful",
								year: "1997",
							},
						],
					}
		if (url.pathname === "/api/search")
			assert.equal(url.searchParams.get("query"), "la vita è bella")
		return new Response(JSON.stringify(data), {
			headers: { "Content-Type": "application/json" },
		})
	}
	const resolve = createEntityResolver(read, "http://lookup.invalid")
	const result = await resolve({
		parameter: "similar",
		name: "La vita è bella",
		start: 5,
		end: 20,
		quoted: true,
	})
	assert.equal(result?.value, "1000000000637")
	assert.equal(result?.parameter, "similar")
})
