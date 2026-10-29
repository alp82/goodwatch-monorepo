// The room's shelf for a member (member-data.ts `memberShelf`): Watch next's movies, else the shows to continue, else
// For you, then the next lists and everyone's start titles fill the free cases.
import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const { MEMBER_SHELF_SIZE, memberShelf } = await import("./member-data.ts")
const { FEW, FULL, NEW, NO_SHOWS, NO_WISHLIST, card } = await import(
	"./member-fixtures.test-support.ts"
)

const everyone = [card("movie", 900), card("show", 901)]
const ids = (titles: { media_type: string; tmdb_id: number }[]) =>
	titles.map((t) => `${t.media_type}:${t.tmdb_id}`)

test("Watch next's movies come first, then the shows to continue and For you fill the free cases", () => {
	const full = memberShelf(FULL, everyone)
	assert.equal(full.length, MEMBER_SHELF_SIZE)
	assert.deepEqual(
		ids(full),
		ids((FULL.wishlist?.titles ?? []).slice(0, MEMBER_SHELF_SIZE)),
	)
	const few = memberShelf(FEW, everyone)
	assert.deepEqual(ids(few).slice(0, 4), [
		...ids(FEW.wishlist?.titles ?? []),
		"show:1",
		ids(FEW.forYou?.titles ?? [])[0],
	])
	assert.equal(few.length, MEMBER_SHELF_SIZE)
})

test("without Wishlist movies the shows lead; without both, For you; without any, everyone's titles", () => {
	assert.deepEqual(
		ids(memberShelf(NO_WISHLIST, everyone)).slice(0, 3),
		ids((NO_WISHLIST.continue?.titles ?? []).slice(0, 3).map((s) => s.card)),
	)
	const forYouOnly = { ...NEW, forYou: FULL.forYou }
	assert.deepEqual(
		ids(memberShelf(forYouOnly, everyone)).slice(0, 3),
		ids((FULL.forYou?.titles ?? []).slice(0, 3)),
	)
	assert.deepEqual(ids(memberShelf(NEW, everyone)), ids(everyone))
	assert.equal(memberShelf(NO_SHOWS, everyone)[0].media_type, "movie")
})

test("each title once, and only with a poster", () => {
	const shared = card("movie", 101)
	const shelf = memberShelf(
		{
			...NEW,
			wishlist: {
				titles: [shared, card("movie", 102, { poster_path: null })],
				total: 2,
			},
		},
		[shared, ...everyone],
	)
	assert.deepEqual(ids(shelf), ["movie:101", ...ids(everyone)])
})
