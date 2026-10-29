// What the ledge shows for the page's focus (ledge-models.ts): a guest's Surprise me, a member's big button with
// their lists, and a search's state for both.
import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const { guestLedge, listLinks, memberLedge, searchLedge } = await import(
	"./ledge-models.ts"
)
const { EMPTY_QUERY, IDLE_RESULTS, querySignature } = await import(
	"../stage/start-query.ts"
)

type Query = typeof EMPTY_QUERY
type Results = typeof IDLE_RESULTS

const card = (n: number) =>
	({
		key: n,
		title: `Title ${n}: The Return`,
		poster_path: `/p${n}.jpg`,
	}) as unknown as Results["cards"][number]

const query = (text: string, picks: string[] = []): Query => ({
	draft: text,
	text,
	picks,
})
const ready = (q: Query, cards: Results["cards"], total?: number): Results => ({
	...IDLE_RESULTS,
	status: "ready",
	signature: querySignature(q),
	cards,
	total: total ?? cards.length,
})

const fan = Array.from({ length: 8 }, (_, i) => ({
	media_type: "movie" as const,
	tmdb_id: i,
	title: `Start ${i}`,
	release_year: 2000,
	poster_path: i === 1 ? null : `/s${i}.jpg`,
	goodwatch_overall_score_normalized_percent: 80,
}))

const guest = {
	query: EMPTY_QUERY,
	results: IDLE_RESULTS,
	view: "empty" as const,
	loved: [],
	pick: null,
	fan,
}

test("a guest's ledge before any choice: Surprise me over a fan of five start titles with posters", () => {
	const m = guestLedge(guest)
	assert.equal(m.kind, "fan")
	assert.deepEqual(m.action, { id: "surprise", label: "Surprise me" })
	assert.equal(m.headline, "Tap three you loved")
	assert.equal(m.posters.length, 5)
	assert.ok(m.posters.every((p) => p.path))
})

test("a search shows its state: searching, the titles found with their count, nothing found, an error", () => {
	const q = query("cozy mystery")
	assert.equal(searchLedge(EMPTY_QUERY, IDLE_RESULTS, "Show"), null)
	const loading = searchLedge(q, IDLE_RESULTS, "Show")
	assert.equal(loading?.busy, true)
	assert.equal(loading?.eyebrow, "Searching")
	const found = searchLedge(q, ready(q, [card(1), card(2)], 1234), "Tap three")
	assert.equal(found?.kind, "row")
	assert.equal(found?.eyebrow, "1,234 titles")
	assert.equal(found?.headline, "cozy mystery")
	assert.deepEqual(found?.action, { id: "open", label: "Tap three" })
	assert.equal(searchLedge(q, ready(q, []), "Show")?.eyebrow, "No matches")
	const failed = { ...ready(q, []), status: "error" as const, error: "Down" }
	assert.equal(searchLedge(q, failed, "Show")?.tone, "rose")
	// Results for an older query count as still searching.
	assert.equal(
		searchLedge(query("other"), ready(q, [card(1)]), "Show")?.busy,
		true,
	)
})

test("a guest's loved titles and their picks take the ledge over the search", () => {
	const q = query("heist")
	const loved = guestLedge({
		...guest,
		query: q,
		results: ready(q, [card(1)]),
		view: "results",
		loved: [card(1)],
	})
	assert.equal(loved.eyebrow, "1 of 3 loved")
	assert.equal(loved.headline, "2 more to go")
	const picks = guestLedge({
		...guest,
		view: "forYou",
		pick: { top: card(7), more: [card(8), card(9)] },
	})
	assert.equal(picks.headline, "Title 7 and 2 more")
	assert.equal(picks.posters.length, 3)
	assert.equal(guestLedge({ ...guest, view: "forYou" }).busy, true)
})

test("a member's ledge is one big button with their lists; a new member's says to get first picks", () => {
	const lists = { movies: 64, shows: 6 }
	const member = {
		query: EMPTY_QUERY,
		results: IDLE_RESULTS,
		unread: false,
		lists,
	}
	const choose = memberLedge({ ...member, hasDeck: true })
	assert.equal(choose.kind, "choose")
	assert.equal(choose.headline, "Choose what to watch next")
	assert.equal(choose.sub, undefined)
	assert.deepEqual(choose.links, listLinks(lists))
	assert.equal(
		memberLedge({ ...member, hasDeck: false }).headline,
		"Get your first picks",
	)
	assert.equal(
		memberLedge({ ...member, hasDeck: false, unread: true }).kind,
		"words",
	)
	const q = query("space")
	assert.equal(
		memberLedge({
			...member,
			hasDeck: true,
			query: q,
			results: ready(q, [card(1)]),
		}).action.label,
		"Show",
	)
})

test("the list links go to My movies and My shows, with how much is on each when there is any", () => {
	assert.deepEqual(listLinks({ movies: 64, shows: 6 }), [
		{ label: "My movies", href: "/watch/movies", note: "64 to see" },
		{ label: "My shows", href: "/watch", note: "6 in progress" },
	])
	assert.deepEqual(
		listLinks({ movies: 0, shows: null }).map((l) => l.note),
		[null, null],
	)
})
