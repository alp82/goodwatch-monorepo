import assert from "node:assert/strict"
import test from "node:test"
import { createTmdbClient } from "./tmdb-client.server.ts"

test("TMDB account import retains paginated custom lists, mixed identities, source order and empty lists", async () => {
	const client = createTmdbClient({
		apiKey: "application-secret",
		sleep: async () => {},
		fetch: async (input) => {
			const url = new URL(String(input))
			assert.equal(url.searchParams.get("session_id"), "member-secret")
			if (url.pathname === "/3/account/42/lists") {
				const page = Number(url.searchParams.get("page"))
				return Response.json({
					page,
					total_pages: 2,
					total_results: 2,
					results: [
						page === 1
							? {
									id: 90,
									name: "An evening",
									description: "Movies and shows",
									item_count: 2,
								}
							: { id: 91, name: "Empty", description: "", item_count: 0 },
					],
				})
			}
			if (url.pathname === "/3/list/90") {
				const page = Number(url.searchParams.get("page"))
				return Response.json({
					id: 90,
					name: "An evening",
					description: "Movies and shows",
					item_count: 2,
					page,
					total_pages: 2,
					total_results: 2,
					items: [
						page === 1
							? {
									id: 1396,
									media_type: "tv",
									name: "Breaking Bad",
									first_air_date: "2008-01-20",
								}
							: {
									id: 862,
									media_type: "movie",
									title: "Toy Story",
									release_date: "1995-11-22",
								},
					],
				})
			}
			if (url.pathname === "/3/list/91")
				return Response.json({
					id: 91,
					name: "Empty",
					description: "",
					item_count: 0,
					page: 1,
					total_pages: 0,
					total_results: 0,
					items: [],
				})
			return Response.json({
				page: 1,
				total_pages: 0,
				total_results: 0,
				results: [],
			})
		},
	})
	const parsed = await client.readAccount("42", "member-secret")
	assert.deepEqual(
		parsed.observations.map((row) => [
			row.kind,
			row.customList?.name,
			row.customList?.description,
			row.customList?.entries.map(({ position, note, entry }) => [
				position,
				note,
				entry.mediaType,
				entry.tmdbId,
				entry.title,
				entry.year,
			]),
		]),
		[
			[
				"list",
				"An evening",
				"Movies and shows",
				[
					[1, "", "show", 1396, "Breaking Bad", 2008],
					[2, "", "movie", 862, "Toy Story", 1995],
				],
			],
			["list", "Empty", "", []],
		],
	)
	assert.ok(parsed.observations.every((row) => row.kind === "list"))
})

function sourceFixture(
	change: { index?: object; details?: object; reject?: boolean } = {},
) {
	return createTmdbClient({
		apiKey: "synthetic-key",
		sleep: async () => {},
		fetch: async (input) => {
			const path = new URL(String(input)).pathname
			if (path.endsWith("/lists"))
				return Response.json({
					page: 1,
					total_pages: 1,
					total_results: 1,
					results: [{ id: 9, name: "Evening", description: "", item_count: 1 }],
					...change.index,
				})
			if (path === "/3/list/9") {
				if (change.reject) throw new Error("secret-key-in-provider-url")
				return Response.json({
					id: 9,
					name: "Evening",
					description: "",
					item_count: 1,
					page: 1,
					total_pages: 1,
					total_results: 1,
					items: [{ id: 862, media_type: "movie", title: "Toy Story" }],
					...change.details,
				})
			}
			return Response.json({
				page: 1,
				total_pages: 0,
				total_results: 0,
				results: [],
			})
		},
	})
}

test("TMDB custom-list failures and malformed paging never become successful empty lists or leak credentials", async () => {
	for (const change of [
		{ index: { results: null } },
		{ index: { page: 2 } },
		{ index: { total_pages: 2501 } },
		{ index: { total_results: 50_001 } },
		{
			index: {
				results: [
					{ id: 9, name: "Evening", description: "", item_count: 1 },
					{ id: 9, name: "Evening", description: "", item_count: 1 },
				],
			},
		},
		{ details: { id: 8 } },
		{ details: { page: 2 } },
		{ details: { total_pages: 2501 } },
		{
			details: {
				items: [
					{ id: 862, media_type: "movie" },
					{ id: 862, media_type: "movie" },
				],
			},
		},
		{ details: { items: [{ id: 862 }] } },
		{ reject: true },
	])
		await assert.rejects(
			sourceFixture(change).readAccount("42", "synthetic-session"),
			(error) =>
				error instanceof Error &&
				!/secret-key|synthetic-session/.test(error.message),
		)
})

test("TMDB count mismatches remain actionable and unsupported media remains visible rather than becoming a movie", async () => {
	const parsed = await sourceFixture({
		details: {
			total_results: 2,
			item_count: 2,
			items: [{ id: 12, media_type: "person", name: "Unsupported" }],
		},
	}).readAccount("42", "synthetic-session")
	assert.ok(
		parsed.warnings.some((warning) => warning.message.includes("count")),
	)
	assert.equal(
		parsed.observations[0].customList?.entries[0].entry.problem?.outcome,
		"unsupported",
	)
})

test("even a count-consistent TMDB account preview warns that list coverage and notes may be missing", async () => {
	const parsed = await sourceFixture().readAccount("42", "synthetic-session")
	assert.ok(
		parsed.warnings.some(
			(warning) =>
				warning.kind === "actionable" &&
				/list/i.test(warning.message) &&
				/notes/i.test(warning.message),
		),
	)
})
