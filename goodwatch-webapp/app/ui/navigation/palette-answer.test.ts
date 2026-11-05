// The command palette against the answers its title lookup can get once the search roles sit behind the proxy. The
// palette shows the rows of `shownPaletteAnswer(typed, query.data)` and never reads the query's error, so each case
// runs the palette's query the way `useQuery` does and checks the rows.
import assert from "node:assert/strict"
import { type TestContext, test } from "node:test"
import { QueryClient, QueryObserver } from "@tanstack/react-query"
import "../../server/title-filter/test-alias.ts"
import type {
	PaletteAnswer,
	PaletteTitle,
} from "../../utils/command-palette.ts"
import {
	busyAnswer,
	gatewayAnswers,
	networkError,
	stubFetch,
} from "../search/search-test-answers.ts"

const { fetchPaletteAnswer, paletteAnswerQuery, shownPaletteAnswer } =
	await import("./palette-answer.ts")

const matrix: PaletteTitle = {
	mediaType: "movie",
	tmdbId: 603,
	title: "The Matrix",
	year: "1999",
	posterPath: "/matrix.jpg",
}

// The palette with "matr" typed, once its lookup has settled. The app's client retries a failed lookup with a delay;
// here the retries run at once.
const typeMatr = async (
	t: TestContext,
	client = new QueryClient({
		defaultOptions: { queries: { retryDelay: 0 } },
	}),
) => {
	const observer = new QueryObserver<PaletteAnswer>(
		client,
		paletteAnswerQuery("matr"),
	)
	t.after(observer.subscribe(() => {}))
	t.after(() => client.clear())
	while (observer.getCurrentResult().isFetching)
		await new Promise((resolve) => setTimeout(resolve, 1))
	const result = observer.getCurrentResult()
	const shown = shownPaletteAnswer(true, result.data)
	return {
		rows: shown.titles,
		more: shown.more,
		groups: shown.groups,
		result,
		client,
	}
}

test("the lookup's titles are the palette's title rows", async (t) => {
	const fetched = stubFetch(t, () => Response.json({ titles: [matrix] }))
	const palette = await typeMatr(t)
	assert.deepEqual(palette.rows, [matrix])
	assert.equal(
		(fetched.mock.calls[0].arguments as unknown[])[0],
		"/api/command-palette?q=matr",
	)
})

test("the lookup's count of more matches comes along; a missing or odd one reads as none", async (t) => {
	stubFetch(t, () => Response.json({ titles: [matrix], more: 42 }))
	assert.equal((await typeMatr(t)).more, 42)
	for (const more of [undefined, -3, "42", null]) {
		stubFetch(t, () => Response.json({ titles: [matrix], more }))
		const answer = await fetchPaletteAnswer(
			"matr",
			new AbortController().signal,
		)
		assert.deepEqual([answer.titles, answer.more], [[matrix], 0])
	}
})

const failures: Record<string, () => Response> = {
	...gatewayAnswers,
	"the search role's busy answer": busyAnswer,
	"a 200 with an HTML body": () =>
		new Response("<html><body>Welcome</body></html>"),
	"a 200 with JSON that has no titles": () =>
		Response.json({ error: "Not found" }),
	"a 200 whose titles aren't a list": () =>
		Response.json({ titles: "The Matrix" }),
	"a 200 with the JSON null": () => Response.json(null),
}
for (const [name, answer] of Object.entries(failures))
	test(`${name} leaves the palette without title rows`, async (t) => {
		stubFetch(t, answer)
		const palette = await typeMatr(t)
		assert.deepEqual(palette.rows, [])
	})

test("a request without an answer leaves the palette without title rows", async (t) => {
	stubFetch(t, () => {
		throw networkError()
	})
	const palette = await typeMatr(t)
	assert.deepEqual(palette.rows, [])
})

test("a failed lookup isn't kept as an empty answer: the same text is looked up again", async (t) => {
	stubFetch(t, gatewayAnswers["a 502 with an HTML body"])
	const first = await typeMatr(t)
	assert.deepEqual(first.rows, [])
	stubFetch(t, () => Response.json({ titles: [matrix] }))
	const again = await typeMatr(t, first.client)
	assert.deepEqual(again.rows, [matrix])
})

test("text that's too short asks nothing and shows no title rows", async (t) => {
	const fetched = stubFetch(t, () => Response.json({ titles: [matrix] }))
	const client = new QueryClient()
	const observer = new QueryObserver<PaletteAnswer>(
		client,
		paletteAnswerQuery("m"),
	)
	t.after(observer.subscribe(() => {}))
	assert.equal(fetched.mock.callCount(), 0)
	assert.deepEqual(
		shownPaletteAnswer(false, { titles: [matrix], more: 3, groups: [] }),
		{ titles: [], more: 0, groups: [] },
	)
})

test("the lookup itself rejects, so the query can tell a failure from no matches", async (t) => {
	stubFetch(t, gatewayAnswers["a 504 without a body"])
	await assert.rejects(fetchPaletteAnswer("matr", new AbortController().signal))
	stubFetch(t, () => Response.json({ titles: [] }))
	assert.deepEqual(
		await fetchPaletteAnswer("matr", new AbortController().signal),
		{ titles: [], more: 0, groups: [] },
	)
})

test("an answer without groups (a search role on older code) groups its titles into movies and shows", async (t) => {
	const show: PaletteTitle = { ...matrix, mediaType: "show", tmdbId: 1 }
	stubFetch(t, () => Response.json({ titles: [matrix, show], more: 4 }))
	const { groups } = await typeMatr(t)
	assert.deepEqual(
		groups.map((g) => [g.key, g.total, g.estimated, g.items.length]),
		[
			["movies", 3, true, 1],
			["shows", 3, true, 1],
		],
	)
})

test("the answer's groups come through; malformed and empty ones are left out", async (t) => {
	const people = {
		key: "people",
		label: "People",
		total: 1,
		items: [
			{
				key: "person-1",
				label: "Christopher Nolan",
				href: "/person/1",
				match: 1,
			},
		],
	}
	stubFetch(t, () =>
		Response.json({
			titles: [],
			groups: [
				people,
				{ key: "tropes", label: "Tropes", total: 0, items: [] },
				{ key: "nope", items: [] },
			],
		}),
	)
	assert.deepEqual((await typeMatr(t)).groups, [people])
})
