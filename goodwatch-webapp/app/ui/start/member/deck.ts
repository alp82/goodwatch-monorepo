// "This or that": the deck of titles a member could start tonight, and the rounds played on it. Pure, so the rules
// are tested without React (deck.test.ts); ThisOrThat.tsx holds the round in a component. Nothing here writes: a tap
// only moves the round on.
//
// The deck, best first, kept deliberately simple:
// 1. Tonight's pick (the one the navigation dock and Watch next show) leads.
// 2. Then the lists take turns, one title each: Continue (the shows with a next episode, most recently active first),
//    the Wishlist's movies (My movies' order), For you (movies and shows taking turns, in the server's order).
//    Taking turns puts every list in the first few titles, so the pairs move between kinds of evening.
// 3. Each title once; the first list that reaches it wins.
// A list with no titles drops out of the turns. While For you is still forming (fewer than PERSONAL_AT ratings) its
// titles are guesses, so they wait until the member's own lists run out instead of taking turns with them: they come
// last in the deck, and a run deals none while it still has a title of the member's own lists to deal.
//
// A round: two titles side by side. Tapping one keeps it and deals a challenger from another list (when there is
// one) to the other side; ROUNDS taps give tonight's pick. "Neither" deals a fresh pair; Start over starts a run at
// another title, so even a deck of two or four deals differently. A short deck plays fewer rounds: two titles, one
// tap; one title is simply tonight's pick.
import type { TitleCard } from "~/server/title-cards.server"
import { type MemberStartData, PERSONAL_AT } from "./member-data"

export type DeckSource = "continue" | "wishlist" | "forYou"

export const SOURCE_LABEL: Record<DeckSource, string> = {
	continue: "Continue",
	wishlist: "Wishlist",
	forYou: "For you",
}

export type DeckTitle = {
	card: TitleCard
	source: DeckSource
	/** "Next episode", "On your Wishlist", "For you · 89% match". */
	why: string
	/** "S2 E1 · Name" for a show with a next episode. */
	episode: string | null
	/** A first guess of For you while it is still forming: dealt only once the member's own lists are dealt. */
	guess: boolean
}

const whyOf = (card: TitleCard, source: DeckSource) =>
	source === "continue"
		? "Next episode"
		: source === "wishlist"
			? "On your Wishlist"
			: card.match
				? `For you · ${card.match}% match`
				: "For you"

export function buildDeck(
	data: Pick<
		MemberStartData,
		"tonight" | "continue" | "wishlist" | "forYou" | "ratings"
	>,
): DeckTitle[] {
	const forming = data.ratings < PERSONAL_AT
	const shows = data.continue?.titles ?? []
	const episodes = new Map(shows.map((show) => [show.card.key, show.episode]))
	const forYou = data.forYou?.titles ?? []
	const lists: [DeckSource, TitleCard[]][] = [
		["continue", shows.map((show) => show.card)],
		["wishlist", data.wishlist?.titles ?? []],
		["forYou", forming ? [] : forYou],
	]
	const out: DeckTitle[] = []
	const keys = new Set<number>()
	const add = (
		card: TitleCard | undefined,
		source: DeckSource,
		episode?: string | null,
	) => {
		if (!card?.poster_path || keys.has(card.key)) return
		keys.add(card.key)
		out.push({
			card,
			source,
			why: whyOf(card, source),
			episode: episode ?? episodes.get(card.key) ?? null,
			guess: forming && source === "forYou",
		})
	}
	if (data.tonight)
		add(data.tonight.card, data.tonight.source, data.tonight.episode)
	const longest = Math.max(...lists.map(([, list]) => list.length))
	for (let i = 0; i < longest; i++)
		for (const [source, list] of lists) add(list[i], source)
	if (forming) for (const card of forYou) add(card, "forYou")
	return out
}

/** Three taps make tonight's pick. */
export const ROUNDS = 3

/** How many taps this deck plays: fewer for a short deck (two titles: one tap). */
export const roundsFor = (deck: readonly DeckTitle[]) =>
	Math.max(1, Math.min(ROUNDS, deck.length - 1))

export type Duel = {
	/** Turns the deck on Start over, so a new run deals other titles. */
	epoch: number
	left: number | null
	right: number | null
	/** The titles this run has dealt. */
	seen: number[]
	taps: number
	/** The side just chosen (for its nod). */
	chose: "left" | "right" | null
	/** Tonight's pick once the run is done, and the title it beat last. */
	done: number | null
	runnerUp: number | null
}

/** How far each run turns the deck at least: Tonight's pick leads the first run, later runs start further down. */
const TURN = 4

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)

/**
 * How far one run turns a deck of `n`: TURN or more, but less than the deck (a short deck turns by one less than its
 * size), and sharing no factor with `n`, so every title leads a run before any leads twice. A deck of two swaps its
 * sides; a deck of four starts at its last title.
 */
export function turnOf(n: number): number {
	if (n < 2) return 0
	for (let step = Math.min(TURN, n - 1); step < n; step++)
		if (gcd(step, n) === 1) return step
	return 1
}

/** The deck in this run's order. */
export function runOrder(
	deck: readonly DeckTitle[],
	epoch: number,
): DeckTitle[] {
	const n = deck.length
	const k = n ? (epoch * turnOf(n)) % n : 0
	return [...deck.slice(k), ...deck.slice(0, k)]
}

/**
 * The next title this run hasn't dealt, from another list than `avoid` when there is one. First guesses wait while a
 * title of the member's own lists is left, even when that title is from the same list as `avoid`.
 */
function nextOf(
	order: readonly DeckTitle[],
	seen: ReadonlySet<number>,
	avoid?: DeckSource,
): DeckTitle | null {
	const fresh = order.filter((title) => !seen.has(title.card.key))
	const own = fresh.filter((title) => !title.guess)
	const pool = own.length ? own : fresh
	return pool.find((title) => title.source !== avoid) ?? pool[0] ?? null
}

/** A run's first pair, with the titles already dealt left out. */
export function deal(
	deck: readonly DeckTitle[],
	epoch: number,
	seenBefore: readonly number[] = [],
): Duel {
	const order = runOrder(deck, epoch)
	const seen = new Set(seenBefore)
	const a = nextOf(order, seen)
	if (a) seen.add(a.card.key)
	const b = nextOf(order, seen, a?.source)
	if (b) seen.add(b.card.key)
	return {
		epoch,
		left: a?.card.key ?? null,
		right: b?.card.key ?? null,
		seen: [...seen],
		taps: 0,
		chose: null,
		done: null,
		runnerUp: null,
	}
}

/** The member keeps one side: a challenger takes the other, or the run is done. */
export function choose(
	deck: readonly DeckTitle[],
	duel: Duel,
	side: "left" | "right",
): Duel {
	if (duel.done !== null) return duel
	const win = side === "left" ? duel.left : duel.right
	const lose = side === "left" ? duel.right : duel.left
	if (win === null) return duel
	const taps = duel.taps + 1
	const seen = new Set(duel.seen)
	const winner = deck.find((title) => title.card.key === win)
	const challenger =
		taps < roundsFor(deck)
			? nextOf(runOrder(deck, duel.epoch), seen, winner?.source)
			: null
	if (!challenger)
		return { ...duel, taps, chose: side, done: win, runnerUp: lose }
	seen.add(challenger.card.key)
	return {
		...duel,
		taps,
		chose: side,
		seen: [...seen],
		left: side === "left" ? win : challenger.card.key,
		right: side === "right" ? win : challenger.card.key,
	}
}

/** Neither: a fresh pair from what this run hasn't dealt (the taps so far count); when that runs dry, a new run. */
export function neither(deck: readonly DeckTitle[], duel: Duel): Duel {
	const next = deal(deck, duel.epoch, duel.seen)
	return next.left !== null && next.right !== null
		? { ...next, taps: duel.taps }
		: deal(deck, duel.epoch)
}

/** Start over: a new run from another title of the deck. */
export const restart = (deck: readonly DeckTitle[], duel: Duel): Duel =>
	deal(deck, duel.epoch + 1)

/**
 * The duel on a deck that changed under it. A deck that only grew (For you arriving after the page) keeps the run,
 * and a deck of one that became a pair deals its first pair. A deck that lost a title on screen or tonight's pick
 * (the page's data read again) deals a new run, since those sides would be blank. Returns `duel` itself when nothing
 * changes.
 */
export function keepDuel(deck: readonly DeckTitle[], duel: Duel): Duel {
	const keys = new Set(deck.map((title) => title.card.key))
	const lost = (key: number | null) => key !== null && !keys.has(key)
	// A finished run shows only its pick (and the runner-up); a run in play, its two sides.
	if (
		duel.done !== null ? lost(duel.done) : lost(duel.left) || lost(duel.right)
	)
		return deal(deck, duel.epoch)
	if (lost(duel.runnerUp)) return { ...duel, runnerUp: null }
	if (duel.right === null && duel.done === null && deck.length > 1)
		return deal(deck, duel.epoch)
	return duel
}
