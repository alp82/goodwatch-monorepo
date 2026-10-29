// The start page's search against a mocked `fetch`: when the field searches (field-commit.ts), what is requested for
// a query, and which answers reach the card (start-search.ts). Nothing here reaches a server.
import assert from "node:assert/strict"
import { type TestContext, mock, test } from "node:test"
import "../../../server/title-filter/test-alias.ts"
import { streamAnswer } from "../../search/search-test-answers.ts"

// Loaded ahead, so the search's lazily loaded request code is ready when a test's first search starts.
await import("../../search/search-request.ts")
const { createFieldCommit, SEARCH_PAUSE_MS } = await import("./field-commit.ts")
const { START_PRESETS } = await import("./presets.ts")
const {
	RESULTS_ERROR,
	START_CARDS,
	createStartSearch,
	resultsPath,
	seeAllHref,
} = await import("./start-search.ts")
const { EMPTY_QUERY, querySignature, reduceQuery } = await import(
	"../stage/start-query.ts"
)
type StartQuery = import("../stage/start-query.ts").StartQuery
type StartQueryAction = import("../stage/start-query.ts").StartQueryAction
type StartResults = import("../stage/start-query.ts").StartResults

const READING = [{ kind: "want", text: "Mystery", key: "mystery" }]

/** A search's stream: the reading, then the ranked list of these movie ids. */
const searchStream = (ids: number[]) =>
	streamAnswer(
		{ kind: "reading", reading: READING },
		{
			kind: "batch",
			batch: {
				rows: ids.map((id) => ({ key: `movie:${id}` })),
				reading: READING,
				people: [],
				errors: [],
			},
		},
	)

const card = (id: number) => ({
	media_type: "movie",
	tmdb_id: id,
	title: `T${id}`,
})
const resultsAnswer = (ids: number[], total = ids.length) =>
	new Response(JSON.stringify({ cards: ids.map(card), total }), {
		headers: { "Content-Type": "application/json" },
	})

type Call = { url: string; init?: RequestInit }

/** Replaces `fetch` for one test; `answer` gets each request. Returns the requests made. */
function stubFetch(
	t: TestContext,
	answer: (call: Call) => Response | Promise<Response>,
) {
	const calls: Call[] = []
	const original = globalThis.fetch
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		const call = { url: String(url), init }
		calls.push(call)
		return answer(call)
	}) as typeof fetch
	t.after(() => {
		globalThis.fetch = original
	})
	return {
		calls,
		searches: () =>
			calls.filter((c) => c.url.startsWith("/api/combined-search")),
		results: () =>
			calls.filter((c) => c.url.startsWith("/api/discover/results")),
	}
}

/** The usual server: every search finds movies 1 to 20, the results are the ranked list (or 30 to 49 without one). */
const server = ({ url }: Call) => {
	if (url.startsWith("/api/combined-search"))
		return searchStream(Array.from({ length: 20 }, (_, i) => i + 1))
	const ranked = new URL(url, "https://x.invalid").searchParams.get("ranked")
	const ids = ranked
		? ranked.split(",").map((key) => Number(key) % 1e12)
		: Array.from({ length: 20 }, (_, i) => 30 + i)
	return resultsAnswer(ids, 120)
}

/** Lets the stream, the dynamic import and the JSON reads run (timers aren't needed for them). */
async function until(ready: () => boolean, what = "the condition") {
	for (let i = 0; i < 2000 && !ready(); i++)
		await new Promise((resolve) => setImmediate(resolve))
	assert.ok(ready(), `waited for ${what}`)
}

const GUEST = { interactions: [], country: "DE", services: null }

/** A page: the query state, the field's commit rule, and the search, wired as the bar and useStartSearch wire them. */
function page({
	member = false,
	services = [] as number[],
}: { member?: boolean; services?: number[] } = {}) {
	let query: StartQuery = EMPTY_QUERY
	const shown: StartResults[] = []
	const search = createStartSearch({
		scope: { country: "DE", services },
		guest: () => (member ? null : GUEST),
		onChange: (results) => shown.push(results),
	})
	const dispatch = (action: StartQueryAction) => {
		query = reduceQuery(query, action)
		search.set(query)
	}
	const field = createFieldCommit({
		searched: () => query.text,
		search: (text) => dispatch({ type: "search", text }),
		clear: () => dispatch({ type: "clearSearch" }),
	})
	const type = (draft: string) => {
		dispatch({ type: "draft", draft })
		field.type(draft)
	}
	return {
		dispatch,
		field,
		type,
		search,
		shown,
		get query() {
			return query
		},
		last: () => shown.at(-1),
	}
}

test("typing searches once, after the pause", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] })
	const net = stubFetch(t, server)
	const p = page()
	for (const draft of ["t", "tw", "twi", "twis", "twist"]) {
		p.type(draft)
		t.mock.timers.tick(SEARCH_PAUSE_MS - 100)
	}
	assert.equal(net.searches().length, 0, "nothing is searched while typing")
	t.mock.timers.tick(100)
	await until(() => p.last()?.status === "ready", "the results")
	assert.equal(net.searches().length, 1)
	assert.equal(JSON.parse(String(net.searches()[0].init?.body)).q, "twist")
	assert.equal(JSON.parse(String(net.searches()[0].init?.body)).discover, true)
	// The same text again (a pause after a space) isn't searched again.
	p.type("twist ")
	t.mock.timers.tick(SEARCH_PAUSE_MS)
	await until(() => true)
	assert.equal(net.searches().length, 1)
})

test("text shorter than two characters is never searched; emptying the field clears only the search", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] })
	const net = stubFetch(t, server)
	const p = page()
	p.dispatch({ type: "picks", picks: ["m:funny"] })
	p.type("a")
	t.mock.timers.tick(SEARCH_PAUSE_MS)
	assert.equal(
		p.field.submit("a"),
		false,
		"Enter on one letter has nothing to show",
	)
	await until(() => p.last()?.status === "ready")
	assert.equal(net.searches().length, 0)
	p.type("heist")
	assert.equal(p.field.submit("heist"), true, "Enter searches at once")
	assert.equal(p.query.text, "heist")
	t.mock.timers.tick(SEARCH_PAUSE_MS)
	await until(() => p.last()?.status === "ready")
	assert.equal(net.searches().length, 1, "Enter dropped the pending pause")
	p.type("")
	assert.deepEqual(p.query, { draft: "", text: "", picks: ["m:funny"] })
})

test("a preset searches its exact phrase at once and drops a pending pause", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] })
	const net = stubFetch(t, server)
	const p = page()
	p.type("chee")
	p.field.preset("rainy day whodunit")
	t.mock.timers.tick(SEARCH_PAUSE_MS * 2)
	await until(() => p.last()?.status === "ready")
	assert.deepEqual(
		net.searches().map((c) => JSON.parse(String(c.init?.body)).q),
		["rainy day whodunit"],
	)
	assert.equal(
		p.query.draft,
		"rainy day whodunit",
		"the field shows the phrase",
	)
})

test("the presets are the owner's six phrases, lower case and without hyphens", () => {
	assert.deepEqual(START_PRESETS, [
		"cheer me up",
		"rainy day whodunit",
		"severance but funny",
		"twist ending",
		"space adventure",
		"grown up cartoons",
	])
	for (const phrase of START_PRESETS) assert.match(phrase, /^[a-z ]+$/)
})

test("the reading shows while the titles are on their way, then the titles (two views at most)", async (t) => {
	let release: () => void = () => {}
	const held = new Promise<void>((resolve) => {
		release = resolve
	})
	stubFetch(t, async (call) => {
		if (call.url.startsWith("/api/discover/results")) await held
		return server(call)
	})
	const p = page()
	p.dispatch({ type: "search", text: "rainy day whodunit" })
	assert.equal(p.last()?.status, "loading")
	await until(() => p.last()?.reading !== null, "the reading")
	assert.equal(p.last()?.status, "loading")
	assert.deepEqual(p.last()?.reading, READING)
	release()
	await until(() => p.last()?.status === "ready")
	const ready = p.last()
	assert.ok(ready)
	assert.equal(ready.signature, querySignature(p.query))
	assert.equal(ready.cards.length, START_CARDS)
	assert.equal(ready.total, 120)
	assert.deepEqual(ready.reading, READING)
})

test("changing the picks re-filters the same ranked list without a new search", async (t) => {
	const net = stubFetch(t, server)
	const p = page()
	p.dispatch({ type: "search", text: "twist ending" })
	await until(() => p.last()?.status === "ready")
	p.dispatch({ type: "picks", picks: ["m:funny", "t:crime", "s:slow"] })
	await until(() => net.results().length === 2 && p.last()?.status === "ready")
	p.dispatch({ type: "removePick", id: "t:crime" })
	await until(() => net.results().length === 3 && p.last()?.status === "ready")
	assert.equal(net.searches().length, 1, "searched once")
	const [first, second, third] = net
		.results()
		.map((c) => new URL(c.url, "https://x.invalid").searchParams)
	assert.equal(second.get("ranked"), first.get("ranked"))
	assert.equal(second.get("moods"), "funny")
	assert.equal(second.get("themes"), "crime")
	assert.equal(second.get("styles"), "slow")
	assert.equal(third.get("themes"), null)
	assert.equal(third.get("sort"), "relevance")
	assert.equal(p.last()?.signature, querySignature(p.query))
	// The reading stays on screen while the picks re-filter.
	const refiltering = p.shown.find(
		(r) =>
			r.signature ===
			querySignature({ text: "twist ending", picks: ["m:funny", "s:slow"] }),
	)
	assert.equal(refiltering?.status, "loading")
	assert.deepEqual(refiltering?.reading, READING)
})

test("picks alone ask for the catalog filtered by them, without a search", async (t) => {
	const net = stubFetch(t, server)
	const p = page()
	p.dispatch({ type: "picks", picks: ["m:scary"] })
	await until(() => p.last()?.status === "ready")
	assert.equal(net.searches().length, 0)
	const params = new URL(net.results()[0].url, "https://x.invalid").searchParams
	assert.equal(params.get("ranked"), null)
	assert.equal(params.get("moods"), "scary")
	assert.equal(params.get("services"), "any")
	assert.equal(params.get("unseen"), "0", "seen titles stay in the row")
	assert.equal(p.last()?.reading, null)
	p.dispatch({ type: "clearPicks" })
	assert.equal(p.last()?.status, "idle")
})

test("a guest POSTs their progress; a member GETs; saved services make the scope theirs", async (t) => {
	const net = stubFetch(t, server)
	const guest = page()
	guest.dispatch({ type: "picks", picks: ["m:funny"] })
	await until(() => guest.last()?.status === "ready")
	const post = net.results()[0].init
	assert.equal(post?.method, "POST")
	assert.deepEqual(JSON.parse(String(post?.body)), { guest: GUEST })

	const member = page({ member: true, services: [8, 337] })
	member.dispatch({ type: "search", text: "space adventure" })
	await until(() => member.last()?.status === "ready")
	const get = net.results().at(-1)
	assert.ok(get)
	assert.equal(get.init?.method, undefined)
	assert.equal(
		new URL(get.url, "https://x.invalid").searchParams.get("services"),
		"mine",
	)
	const body = JSON.parse(String(net.searches().at(-1)?.init?.body))
	assert.deepEqual(body.filters.streaming, {
		country: "DE",
		providerIds: [8, 337],
	})
})

test("a slow answer for an older query never replaces the newer one's", async (t) => {
	const holds = new Map<string, () => void>()
	const net = stubFetch(t, async (call) => {
		if (call.url.startsWith("/api/discover/results")) {
			const moods =
				new URL(call.url, "https://x.invalid").searchParams.get("moods") ?? ""
			// The first query's answer waits until the second one is on screen.
			if (moods === "funny")
				await new Promise<void>((resolve) => holds.set(moods, resolve))
		}
		return server(call)
	})
	const p = page()
	p.dispatch({ type: "picks", picks: ["m:funny"] })
	p.dispatch({ type: "picks", picks: ["m:scary"] })
	await until(() => p.last()?.status === "ready")
	const newer = querySignature(p.query)
	assert.equal(p.last()?.signature, newer)
	await until(() => holds.has("funny"))
	assert.equal(
		net.results()[0].init?.signal?.aborted,
		true,
		"the older request was aborted",
	)
	holds.get("funny")?.()
	await until(() => true)
	await new Promise((resolve) => setTimeout(resolve, 5))
	assert.equal(p.last()?.signature, newer)
	assert.ok(p.shown.every((r) => r.status !== "ready" || r.signature === newer))
})

test("a newer text aborts the older search, and its late answer is dropped", async (t) => {
	let first = true
	const net = stubFetch(t, async (call) => {
		if (call.url.startsWith("/api/combined-search") && first) {
			first = false
			// Answers only once aborted, as fetch does.
			await new Promise<void>((resolve) =>
				call.init?.signal?.addEventListener("abort", () => resolve()),
			)
			throw new DOMException("aborted", "AbortError")
		}
		return server(call)
	})
	const p = page()
	p.dispatch({ type: "search", text: "cheer me up" })
	p.dispatch({ type: "search", text: "space adventure" })
	await until(() => p.last()?.status === "ready")
	assert.equal(net.searches().length, 2)
	assert.equal(p.last()?.signature, querySignature(p.query))
	assert.ok(p.shown.every((r) => r.status !== "error"))
})

test("going back to a text whose search was aborted searches it anew (A, B, A)", async (t) => {
	let first = true
	const net = stubFetch(t, async (call) => {
		if (call.url.startsWith("/api/combined-search") && first) {
			first = false
			// The abort settles late: after the next two searches have started.
			await new Promise<void>((resolve) =>
				call.init?.signal?.addEventListener("abort", () =>
					setTimeout(resolve, 30),
				),
			)
			throw new DOMException("aborted", "AbortError")
		}
		return server(call)
	})
	const p = page()
	p.dispatch({ type: "search", text: "cheer me up" })
	p.dispatch({ type: "search", text: "space adventure" })
	p.dispatch({ type: "search", text: "cheer me up" })
	await until(
		() =>
			p.last()?.status === "ready" &&
			p.last()?.signature === querySignature(p.query),
	)
	assert.equal(net.searches().length, 3)
	assert.ok(p.shown.every((r) => r.status !== "error"))
})

test("a 503 while the snapshot loads is asked again after its Retry-After", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] })
	let refusals = 1
	const net = stubFetch(t, (call) => {
		if (call.url.startsWith("/api/discover/results") && refusals-- > 0)
			return new Response(
				JSON.stringify({ error: "Starting up, try again shortly" }),
				{
					status: 503,
					headers: { "Retry-After": "5" },
				},
			)
		return server(call)
	})
	const p = page()
	p.dispatch({ type: "picks", picks: ["m:funny"] })
	await until(() => net.results().length === 1)
	await until(() => true)
	assert.equal(p.last()?.status, "loading")
	t.mock.timers.tick(4999)
	assert.equal(net.results().length, 1)
	t.mock.timers.tick(1)
	await until(() => p.last()?.status === "ready")
	assert.equal(net.results().length, 2)
})

test("failures show Discover's words in the card; Retry asks again", async (t) => {
	let answer = (_call: Call): Response =>
		new Response(
			JSON.stringify({
				error: "Too many searches right now. Try again in a moment.",
			}),
			{
				status: 429,
			},
		)
	const net = stubFetch(t, (call) => answer(call))
	const p = page()
	p.dispatch({ type: "search", text: "twist ending" })
	await until(() => p.last()?.status === "error")
	assert.equal(
		p.last()?.error,
		"Too many searches right now. Try again in a moment.",
	)
	answer = (call) =>
		call.url.startsWith("/api/combined-search")
			? server(call)
			: new Response("oops", { status: 500 })
	p.search.retry()
	await until(() => p.last()?.status === "error" && net.results().length === 1)
	assert.equal(p.last()?.error, RESULTS_ERROR)
	answer = server
	p.search.retry()
	await until(() => p.last()?.status === "ready")
	assert.equal(
		net.searches().length,
		2,
		"the failed search was asked again, the found one wasn't",
	)
})

test("a search that finds nothing answers at once with no titles", async (t) => {
	const net = stubFetch(t, (call) =>
		call.url.startsWith("/api/combined-search")
			? searchStream([])
			: server(call),
	)
	const p = page()
	p.dispatch({ type: "search", text: "zzzz" })
	await until(() => p.last()?.status === "ready")
	assert.equal(net.results().length, 0)
	assert.deepEqual(p.last()?.cards, [])
	assert.equal(p.last()?.total, 0)
})

test("See all carries the text and the picks to Discover", () => {
	assert.equal(
		seeAllHref({
			text: "rainy day whodunit",
			picks: ["m:funny", "t:crime", "s:slow"],
		}),
		"/discover?q=rainy+day+whodunit&moods=funny&themes=crime&styles=slow",
	)
	assert.equal(
		seeAllHref({ text: "", picks: ["m:scary"] }),
		"/discover?moods=scary",
	)
	assert.equal(
		seeAllHref({ text: "twist ending", picks: [] }),
		"/discover?q=twist+ending",
	)
})

test("the results path names the scope, the sort, and the display language", () => {
	const path = resultsPath({
		picks: ["m:funny"],
		scope: "mine",
		ranked: [1000000000001 as never],
		language: "de",
	})
	const params = new URL(path, "https://x.invalid").searchParams
	assert.equal(params.get("services"), "mine")
	assert.equal(params.get("sort"), "relevance")
	assert.equal(params.get("ranked"), "1000000000001")
	assert.equal(params.get("page"), "1")
	assert.ok(params.get("displayLanguage"))
	mock.reset()
})
