import assert from "node:assert/strict"
import { test } from "node:test"
import { createEntityResolver } from "./discover-query-entities.server.js"
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
