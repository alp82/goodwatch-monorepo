// The deck "this or that" deals from, and its rounds (deck.ts), for full, sparse and empty members.
import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const { buildDeck, choose, deal, neither, restart, roundsFor, turnOf } =
	await import("./deck.ts")
const { FEW, FULL, NEW, NO_SHOWS, NO_WISHLIST } = await import(
	"./member-fixtures.test-support.ts"
)

const WISHLIST = FULL.wishlist?.titles ?? []

const keysOf = (deck: { card: { key: number } }[]) =>
	deck.map((t) => t.card.key)

test("full: Tonight's pick leads, then the three lists take turns, each title once", () => {
	const deck = buildDeck(FULL)
	assert.equal(deck[0].card.key, FULL.tonight?.card.key)
	assert.equal(deck[0].source, "continue")
	assert.equal(deck[0].episode, "S1 E1 · Pilot")
	// Show 1 is the pick, so the first turn's Continue title is already in; then movie, For you, show 2, ...
	assert.deepEqual(
		deck.slice(1, 6).map((t) => t.source),
		["wishlist", "forYou", "continue", "wishlist", "forYou"],
	)
	assert.equal(new Set(keysOf(deck)).size, deck.length)
	assert.equal(deck.length, 36)
	assert.equal(deck[1].why, "On your Wishlist")
	assert.match(deck[2].why, /^For you · \d+% match$/)
	assert.equal(deck[3].why, "Next episode")
})

test("few: For you is still forming, so its guesses wait until the member's own lists run out", () => {
	const deck = buildDeck(FEW)
	assert.deepEqual(
		deck.map((t) => t.source),
		["continue", "wishlist", "wishlist", ...Array(9).fill("forYou")],
	)
})

test("few: no run deals a first guess while a title of the member's own lists is left", () => {
	const deck = buildDeck(FEW)
	const source = new Map(deck.map((t) => [t.card.key, t.source]))
	const own = deck.filter((t) => t.source !== "forYou").map((t) => t.card.key)
	// Keeping the Wishlist movie: the challenger is the other Wishlist movie, not a guess from For you.
	let duel = deal(deck, 0)
	assert.deepEqual([duel.left, duel.right], own.slice(0, 2))
	duel = choose(deck, duel, "right")
	assert.equal(duel.right, own[1])
	assert.equal(duel.left, own[2])
	assert.equal(source.get(duel.left ?? 0), "wishlist")
	// The member's own lists are dealt: now the guesses come in.
	duel = choose(deck, duel, "left")
	assert.equal(source.get(duel.right ?? 0), "forYou")
	// A run that starts further down, among the guesses, still deals the own titles first.
	for (let epoch = 1; epoch < deck.length; epoch++) {
		const run = deal(deck, epoch)
		assert.equal(source.get(run.left ?? 0) === "forYou", false, `${epoch}`)
		assert.equal(source.get(run.right ?? 0) === "forYou", false, `${epoch}`)
	}
})

test("no shows: Tonight's pick is a movie, and the Wishlist and For you take turns", () => {
	const deck = buildDeck(NO_SHOWS)
	assert.equal(deck[0].source, "wishlist")
	assert.equal(deck[0].card.key, NO_SHOWS.tonight?.card.key)
	assert.ok(deck.every((t) => t.source !== "continue"))
	assert.deepEqual(
		deck.slice(1, 5).map((t) => t.source),
		["forYou", "wishlist", "forYou", "wishlist"],
	)
})

test("no wishlist: Continue and For you take turns", () => {
	const deck = buildDeck(NO_WISHLIST)
	assert.ok(deck.every((t) => t.source !== "wishlist"))
	assert.deepEqual(
		deck.slice(0, 4).map((t) => t.source),
		["continue", "forYou", "continue", "forYou"],
	)
})

test("new: nothing on any list, so there is no deck (First steps take its place)", () => {
	assert.deepEqual(buildDeck(NEW), [])
})

test("a list that couldn't be read drops out like an empty one", () => {
	const deck = buildDeck({ ...FULL, wishlist: null, forYou: null })
	assert.ok(deck.every((t) => t.source === "continue"))
})

test("titles without a poster are left out", () => {
	const deck = buildDeck({
		...NEW,
		wishlist: {
			titles: [{ ...WISHLIST[0], poster_path: null }],
			total: 1,
		},
	})
	assert.deepEqual(deck, [])
})

test("a round: the kept side stays, a challenger from another list takes the other, three taps give the pick", () => {
	const deck = buildDeck(FULL)
	let duel = deal(deck, 0)
	const first = { left: duel.left, right: duel.right }
	assert.notEqual(duel.left, duel.right)
	duel = choose(deck, duel, "left")
	assert.equal(duel.left, first.left)
	assert.notEqual(duel.right, first.right)
	assert.equal(duel.done, null)
	duel = choose(deck, duel, "right")
	const kept = duel.right
	duel = choose(deck, duel, "right")
	assert.equal(duel.taps, 3)
	assert.equal(duel.done, kept)
	assert.ok(duel.runnerUp !== null && duel.runnerUp !== kept)
	// Done is done: another tap changes nothing.
	assert.equal(choose(deck, duel, "left"), duel)
})

test("a challenger comes from another list than the kept title's when there is one", () => {
	const deck = buildDeck(FULL)
	const source = new Map(deck.map((t) => [t.card.key, t.source]))
	let duel = deal(deck, 0)
	assert.notEqual(source.get(duel.left ?? 0), source.get(duel.right ?? 0))
	duel = choose(deck, duel, "left")
	assert.notEqual(source.get(duel.right ?? 0), source.get(duel.left ?? 0))
})

test("short decks play fewer rounds: two titles one tap, one title none", () => {
	const two = buildDeck({
		...NEW,
		wishlist: { titles: WISHLIST.slice(0, 2), total: 2 },
	})
	assert.equal(roundsFor(two), 1)
	const duel = choose(two, deal(two, 0), "right")
	assert.equal(duel.done, two[1].card.key)
	const one = buildDeck({
		...NEW,
		wishlist: { titles: WISHLIST.slice(0, 1), total: 1 },
	})
	assert.equal(one.length, 1)
	assert.equal(deal(one, 0).right, null)
})

test("Neither deals a pair this run hasn't shown and keeps the taps; when the deck runs dry it starts over", () => {
	const deck = buildDeck(FULL)
	let duel = choose(deck, deal(deck, 0), "left")
	const shown = new Set(duel.seen)
	const next = neither(deck, duel)
	assert.equal(next.taps, 1)
	assert.ok(!shown.has(next.left ?? 0) && !shown.has(next.right ?? 0))
	const three = buildDeck({
		...NEW,
		wishlist: { titles: WISHLIST.slice(0, 3), total: 3 },
	})
	duel = deal(three, 0)
	const again = neither(three, duel)
	assert.deepEqual([again.left, again.right], [duel.left, duel.right])
})

test("Start over turns the deck, so the new run deals other titles first", () => {
	const deck = buildDeck(FULL)
	const duel = restart(deck, deal(deck, 0))
	assert.equal(duel.epoch, 1)
	assert.equal(duel.taps, 0)
	assert.equal(duel.left, deck[turnOf(deck.length)].card.key)
	// Every title leads a run before any leads twice.
	const leads = Array.from(
		{ length: deck.length },
		(_, epoch) => deal(deck, epoch).left,
	)
	assert.equal(new Set(leads).size, deck.length)
})

test("Start over changes short decks too: two titles swap sides, four start elsewhere", () => {
	for (const n of [2, 3, 4, 5, 8]) {
		const deck = buildDeck({
			...NEW,
			wishlist: { titles: WISHLIST.slice(0, n), total: n },
		})
		assert.equal(deck.length, n)
		const first = deal(deck, 0)
		const next = restart(deck, first)
		assert.notDeepEqual(
			[next.left, next.right],
			[first.left, first.right],
			`${n} titles`,
		)
	}
	const two = buildDeck({
		...NEW,
		wishlist: { titles: WISHLIST.slice(0, 2), total: 2 },
	})
	const swapped = restart(two, deal(two, 0))
	assert.deepEqual(
		[swapped.left, swapped.right],
		[two[1].card.key, two[0].card.key],
	)
	const four = buildDeck({
		...NEW,
		wishlist: { titles: WISHLIST.slice(0, 4), total: 4 },
	})
	assert.equal(restart(four, deal(four, 0)).left, four[3].card.key)
})

test("the rounds are pure: the same taps on the same deck give the same pick", () => {
	const play = () => {
		const deck = buildDeck(FULL)
		let duel = deal(deck, 0)
		for (const side of ["left", "right", "left"] as const)
			duel = choose(deck, duel, side)
		return duel
	}
	assert.deepEqual(play(), play())
})
