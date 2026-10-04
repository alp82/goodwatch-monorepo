import assert from "node:assert/strict"
import {
	type TestContext,
	afterEach,
	beforeEach,
	describe,
	it,
} from "node:test"
import {
	QueryClient,
	QueryObserver,
	dehydrate,
	hydrate,
} from "@tanstack/react-query"
import {
	OVERALL_PANEL,
	type RelatedPanel,
	type RelatedPanelSource,
	activeRelatedPanelKey,
	getQueryKeyRelatedPanel,
	relatedPanelKeys,
	relatedPanelParams,
	relatedPanelQueryOptions,
	relatedPanelUrl,
	toRelatedPanel,
} from "./related-panel.ts"

const matrix: RelatedPanelSource = {
	mediaType: "movie",
	details: { tmdb_id: 603 },
	fingerprint: {
		highlightKeys: ["futuristic", "philosophical", "spectacle"],
	},
}

const panelOf = (id: number): RelatedPanel => ({
	movies: [
		{
			tmdb_id: id,
			title: `Movie ${id}`,
			release_year: "1999",
			poster_path: "/m.jpg",
			goodwatch_overall_score_normalized_percent: 80,
		},
	],
	shows: [],
})

// The browser side of a title page: a query client that starts with the state the server
// embedded in the document, and one mounted panel at a time (what useQuery does).
const openTitlePage = (t: TestContext, media: RelatedPanelSource) => {
	const server = new QueryClient()
	server.setQueryData(
		getQueryKeyRelatedPanel(relatedPanelParams(media, OVERALL_PANEL)),
		panelOf(1),
	)
	// The same default as the app's client in root.tsx.
	const browser = new QueryClient({
		defaultOptions: { queries: { staleTime: 60 * 1000, retry: false } },
	})
	hydrate(browser, dehydrate(server))

	let unmount = () => {}
	const select = async (panelKey: string) => {
		unmount()
		const observer = new QueryObserver<RelatedPanel>(
			browser,
			relatedPanelQueryOptions(relatedPanelParams(media, panelKey)),
		)
		unmount = observer.subscribe(() => {})
		const pendingAtMount = observer.getCurrentResult().isPending
		// Lets a started request finish.
		await new Promise((resolve) => setTimeout(resolve, 5))
		return { pendingAtMount, result: observer.getCurrentResult() }
	}
	const intent = (panelKey: string) =>
		browser.prefetchQuery(
			relatedPanelQueryOptions(relatedPanelParams(media, panelKey)),
		)
	// Clearing the clients drops their garbage collection timers, so the test process can end.
	t.after(() => {
		unmount()
		browser.clear()
		server.clear()
	})
	return { browser, select, intent }
}

describe("related panel", () => {
	let requests: string[] = []
	const realFetch = globalThis.fetch

	beforeEach(() => {
		requests = []
		globalThis.fetch = (async (input: string) => {
			requests.push(input)
			return new Response(JSON.stringify(panelOf(requests.length + 1)))
		}) as typeof fetch
	})
	afterEach(() => {
		globalThis.fetch = realFetch
	})

	it("lists the overall panel first, then the title's highlight keys", () => {
		assert.deepEqual(relatedPanelKeys(matrix.fingerprint), [
			"overall",
			"futuristic",
			"philosophical",
			"spectacle",
		])
		assert.deepEqual(relatedPanelKeys(null), ["overall"])
	})

	it("falls back to the overall panel when the title lacks the selected one", () => {
		const keys = relatedPanelKeys(matrix.fingerprint)
		assert.equal(activeRelatedPanelKey(keys, "overall"), "overall")
		assert.equal(activeRelatedPanelKey(keys, "spectacle"), "spectacle")
		assert.equal(activeRelatedPanelKey(keys, "romance"), "overall")
	})

	it("asks for a whole panel in one URL, without a media type", () => {
		assert.equal(
			relatedPanelUrl(relatedPanelParams(matrix, OVERALL_PANEL)),
			"/api/related?tmdbId=603&sourceMediaType=movie",
		)
		assert.equal(
			relatedPanelUrl(relatedPanelParams(matrix, "futuristic")),
			"/api/related?tmdbId=603&sourceMediaType=movie&fingerprintKey=futuristic",
		)
	})

	it("shows the default panel from the document, without a request", async (t) => {
		const page = openTitlePage(t, matrix)
		const { pendingAtMount, result } = await page.select(OVERALL_PANEL)
		assert.equal(pendingAtMount, false)
		assert.deepEqual(result.data, panelOf(1))
		assert.deepEqual(requests, [])
	})

	it("sends no request for the default panel when the document is old", async (t) => {
		// A page from a cache carries data that is older than the client's default stale time.
		t.mock.timers.enable({ apis: ["Date"], now: Date.now() })
		const page = openTitlePage(t, matrix)
		t.mock.timers.tick(3 * 60 * 60 * 1000)
		const { result } = await page.select(OVERALL_PANEL)
		assert.deepEqual(result.data, panelOf(1))
		assert.deepEqual(requests, [])
	})

	it("sends one request for a newly selected panel, and shows a loading state meanwhile", async (t) => {
		const page = openTitlePage(t, matrix)
		await page.select(OVERALL_PANEL)
		const { pendingAtMount, result } = await page.select("futuristic")
		assert.equal(pendingAtMount, true)
		assert.equal(result.isPending, false)
		assert.deepEqual(result.data, panelOf(2))
		assert.deepEqual(requests, [
			"/api/related?tmdbId=603&sourceMediaType=movie&fingerprintKey=futuristic",
		])
	})

	it("doesn't request a panel again on return, even after the default stale time", async (t) => {
		t.mock.timers.enable({ apis: ["Date"], now: Date.now() })
		const page = openTitlePage(t, matrix)
		await page.select(OVERALL_PANEL)
		await page.select("futuristic")
		await page.select("spectacle")
		assert.equal(requests.length, 2)

		t.mock.timers.tick(10 * 60 * 1000)
		const overall = await page.select(OVERALL_PANEL)
		const futuristic = await page.select("futuristic")
		assert.equal(overall.pendingAtMount, false)
		assert.equal(futuristic.pendingAtMount, false)
		assert.deepEqual(futuristic.result.data, panelOf(2))
		assert.equal(requests.length, 2)
	})

	it("requests a panel once when intent comes before the selection", async (t) => {
		const page = openTitlePage(t, matrix)
		await page.select(OVERALL_PANEL)

		// Hover, then a click while the request is still running.
		const prefetch = page.intent("philosophical")
		const { result } = await page.select("philosophical")
		await prefetch
		assert.deepEqual(result.data, panelOf(2))
		assert.equal(requests.length, 1)

		// Hover again on a loaded panel, and on the default one.
		await page.intent("philosophical")
		await page.intent(OVERALL_PANEL)
		assert.equal(requests.length, 1)
	})

	it("leaves a failed panel without data, so the section shows its empty state", async (t) => {
		globalThis.fetch = (async () =>
			new Response("busy", { status: 503 })) as typeof fetch
		const page = openTitlePage(t, matrix)
		const { result } = await page.select("futuristic")
		assert.equal(result.isPending, false)
		assert.equal(result.data, undefined)
	})
})

describe("toRelatedPanel", () => {
	const title = (tmdb_id: number, votes: number) => ({
		tmdb_id,
		title: `Title ${tmdb_id}`,
		release_year: "2001",
		poster_path: `/${tmdb_id}.jpg`,
		backdrop_path: `/${tmdb_id}-b.jpg`,
		goodwatch_overall_score_normalized_percent: 70 + tmdb_id,
		goodwatch_overall_score_voting_count: votes,
		imdb_url: "",
		streaming_availability: ["8_US"],
	})

	it("puts the two titles with the most votes first and keeps the rest in order", () => {
		const panel = toRelatedPanel({
			movies: [title(1, 10), title(2, 500), title(3, 20), title(4, 900)],
			shows: [title(5, 1)],
		})
		assert.deepEqual(
			panel.movies.map((card) => card.tmdb_id),
			[4, 2, 1, 3],
		)
		assert.deepEqual(
			panel.shows.map((card) => card.tmdb_id),
			[5],
		)
	})

	it("keeps only the fields a card shows", () => {
		const panel = toRelatedPanel({ movies: [title(1, 10)], shows: [] })
		assert.deepEqual(panel.movies, [
			{
				tmdb_id: 1,
				title: "Title 1",
				release_year: "2001",
				poster_path: "/1.jpg",
				goodwatch_overall_score_normalized_percent: 71,
			},
		])
	})
})
