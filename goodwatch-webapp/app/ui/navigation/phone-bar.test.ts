// The phone's top bar for every kind of page: members and guests, each archetype of the B3 design.
import assert from "node:assert/strict"
import { test } from "node:test"
import { GUEST, member } from "../../domain/member-paths.ts"
import { phoneBarOf } from "./phone-bar.ts"

const me = member("alp")
const bar = (pathname: string, viewer = me, search = "") =>
	phoneBarOf({ pathname, search, viewer })

test("area pages: area label over the current tab, siblings in the sheet", () => {
	const shows = bar("/watch/shows")
	assert.equal(shows.kind, "area")
	assert.equal(shows.eyebrow, "Watch")
	assert.equal(shows.title, "My shows")
	assert.deepEqual(
		shows.siblings.map((t) => t.key),
		["up-next", "ready", "for-you", "seen"],
	)
	assert.equal(bar("/watch/shows/on-hold").title, "My shows")
	assert.equal(bar("/watch/movies/want").title, "My movies")
	assert.equal(bar("/watch/seen").title, "Seen")
	assert.equal(bar("/hot").title, "Hot")
	assert.equal(bar("/movies/best").title, "Best")
	assert.equal(bar("/discover").title, "Discover")
	assert.equal(bar("/movies").eyebrow, "Explore")
	const scores = bar("/u/alp/scores")
	assert.equal(scores.eyebrow, "Profile")
	assert.equal(scores.title, "Scores")
	assert.ok(scores.siblings.some((t) => t.key === "rate"))
	assert.equal(bar("/u/alp/scores/rate").title, "Rate more")
	assert.equal(bar("/taste").title, "Taste")
})

test("someone else's profile: @handle over the tab, visitors' tabs; settings home is Settings", () => {
	const other = bar("/u/epix/stats", GUEST)
	assert.equal(other.eyebrow, "@epix")
	assert.equal(other.title, "Stats")
	assert.ok(other.siblings.some((t) => t.key === "wishlist"))
	assert.equal(bar("/settings").title, "Settings")
})

test("search, detail, settings and plain pages", () => {
	assert.equal(bar("/discover", me, "?q=heist").kind, "search")
	for (const path of [
		"/movie/550-fight-club",
		"/show/1396-breaking-bad",
		"/person/287-brad-pitt",
		"/lists/abc",
		"/u/alp/lists/abc",
		"/u/alp/lists/abc/edit",
		"/blog/ghibli",
	])
		assert.equal(bar(path).kind, "detail", path)
	assert.equal(bar("/u/alp/lists/abc").back?.href, "/u/alp/lists")
	const services = bar("/settings/services")
	assert.equal(services.kind, "settings")
	assert.equal(services.title, "Streaming services")
	assert.deepEqual(services.back, { href: "/settings", label: "Settings" })
	assert.equal(services.pinned, true)
	assert.equal(bar("/how-it-works", GUEST).title, "How it works")
	assert.equal(bar("/for-you").kind, "page")
	assert.equal(bar("/").kind, "home")
})
