// The hub's blends, picked by hand from real counts
// (every one of these has a full page today; the loader drops any that stops having one). Each has one line in the
// voice of a film lover talking to a friend. Pure data.
import { type Ingredient, type Kind, ing } from "~/domain/browse/address"

export interface Curated {
	parts: Ingredient[]
	/** One human line: why you'd want this tonight. */
	pitch: string
}

const m = (slug: string) => ing("mood", slug)
const g = (slug: string) => ing("genre", slug)
/** The curated sets are written for movies and for shows; both together read the movie set. */
type Two = "movie" | "show"
export const two = (k: Kind): Two => (k === "show" ? "show" : "movie")

const th = (slug: string) => ing("theme", slug)
const st = (slug: string) => ing("style", slug)
const d = (slug: string) => ing("decade", slug)
const c = (slug: string) => ing("country", slug)

/** The big ones at the top of the hub: one is shown, the others are a click on "Another one" away. */
export const FEATURED: Record<Two, Curated[]> = {
	movie: [
		{
			parts: [m("cozy"), st("animated"), c("japan")],
			pitch:
				"Hand-drawn worlds, quiet magic, and food that looks better than dinner. Put the kettle on.",
		},
		{
			parts: [m("funny"), g("horror")],
			pitch: "The scream and the laugh turn out to be the same reflex. Best with a loud room.",
		},
		{
			parts: [m("tense"), g("thriller"), d("1970s")],
			pitch:
				"Wiretaps, parking garages, and nobody you can trust. Paranoia never looked this good.",
		},
		{
			parts: [m("romantic"), g("comedy"), d("1990s")],
			pitch: "Answering machines, airport dashes, and two people who obviously belong together.",
		},
		{
			parts: [m("thrilling"), c("hong-kong-sar-china")],
			pitch: "Gunfights staged like dance numbers and stunts no insurer would sign off on today.",
		},
		{
			parts: [m("trippy"), g("science-fiction")],
			pitch: "Big ideas, strange images, and an ending you'll argue about on the way home.",
		},
	],
	show: [
		{
			parts: [m("quirky"), c("united-kingdom"), g("comedy")],
			pitch:
				"Awkward silences, odd little towns, and jokes that arrive a beat later than you expect.",
		},
		{
			parts: [m("magical"), c("japan"), st("animated")],
			pitch:
				"Spirits, far-off kingdoms, and adventures that take their time. Easy to fall into for a season.",
		},
		{
			parts: [m("tense"), th("politics")],
			pitch: "Back rooms, leaked memos, and one vote that changes everything. Cancel your evening.",
		},
		{
			parts: [m("cozy"), g("mystery")],
			pitch: "Someone has been murdered, and somehow it's the most relaxing hour of your week.",
		},
		{
			parts: [m("romantic"), c("south-korea")],
			pitch: "Slow glances, fate working overtime, and a kiss that takes ten episodes to earn.",
		},
		{
			parts: [m("funny"), g("crime")],
			pitch: "Bad plans, worse criminals, and detectives who can't stop bickering.",
		},
	],
}

/** Blends most people already have a name for. */
export const FAVORITES: Record<Two, Curated[]> = {
	movie: [
		{
			parts: [m("cozy"), g("comedy")],
			pitch: "Low stakes, warm hearts, a few good laughs.",
		},
		{
			parts: [m("dark"), g("thriller")],
			pitch: "Bad people, worse nights, no easy way out.",
		},
		{
			parts: [m("scary"), d("1980s")],
			pitch: "Rubber monsters, synths, and a cabin in the woods.",
		},
		{
			parts: [g("crime"), c("france")],
			pitch: "Trench coats, heists, and very few words.",
		},
		{
			parts: [m("magical"), g("family")],
			pitch: "Wonder the whole sofa can agree on.",
		},
		{
			parts: [g("action"), d("1990s")],
			pitch: "One-liners, real explosions, big hair.",
		},
		{
			parts: [m("romantic"), c("france")],
			pitch: "Love that talks a lot and regrets nothing.",
		},
		{
			parts: [m("sad"), g("animation")],
			pitch: "Drawings that will absolutely make you cry.",
		},
	],
	show: [
		{
			parts: [m("cozy"), g("comedy")],
			pitch: "Friends you'd like to have, one episode at a time.",
		},
		{
			parts: [m("dark"), g("crime")],
			pitch: "One case, a whole season, and no clean hands.",
		},
		{
			parts: [m("funny"), g("animation")],
			pitch: "Cartoons that are definitely not for the kids.",
		},
		{
			parts: [m("thrilling"), g("action-adventure")],
			pitch: "Cliffhangers built to ruin your bedtime.",
		},
		{
			parts: [m("mysterious"), c("united-kingdom")],
			pitch: "British mysteries to piece together.",
		},
		{
			parts: [m("coming-of-age"), g("comedy")],
			pitch: "First jobs, first loves, bad haircuts.",
		},
		{
			parts: [m("trippy"), g("sci-fi-fantasy")],
			pitch: "Timelines bend and nothing is what it seems.",
		},
		{
			parts: [m("cozy"), g("reality")],
			pitch: "Nice people making nice things. That's the show.",
		},
	],
}

/** Blends you wouldn't think to ask for, that turn out to be full of good things. */
export const ODD: Record<Two, Curated[]> = {
	movie: [
		{
			parts: [m("cozy"), g("mystery")],
			pitch: "A murder, but make it comfortable.",
		},
		{
			parts: [m("sad"), g("comedy")],
			pitch: "You'll laugh, then it catches you off guard.",
		},
		{
			parts: [st("slow-burn"), g("science-fiction")],
			pitch: "The future, in no hurry at all.",
		},
		{
			parts: [m("funny"), g("western")],
			pitch: "Saddle up. Nobody here can shoot straight.",
		},
		{
			parts: [m("dark"), g("animation")],
			pitch: "Cartoons that keep the lights off.",
		},
		{
			parts: [m("tense"), g("documentary")],
			pitch: "It really happened, and you still hold your breath.",
		},
		{
			parts: [m("quirky"), g("crime")],
			pitch: "Crooks with odd hobbies and worse luck.",
		},
		{
			parts: [m("scary"), c("japan")],
			pitch: "Long hair, cursed tapes, sleep optional.",
		},
	],
	show: [
		{
			parts: [m("sad"), g("comedy")],
			pitch: "Funny until the last five minutes.",
		},
		{
			parts: [m("tense"), g("documentary")],
			pitch: "True stories that play like thrillers.",
		},
		{
			parts: [m("funny"), th("money")],
			pitch: "Rich people behaving terribly. Delicious.",
		},
		{
			parts: [m("dark"), st("animated")],
			pitch: "Drawn by hand, not for the faint of heart.",
		},
		{
			parts: [m("quirky"), g("mystery")],
			pitch: "Strange towns with stranger secrets.",
		},
		{
			parts: [m("funny"), th("sports")],
			pitch: "Underdogs, locker rooms, terrible pep talks.",
		},
		{
			parts: [m("deep"), st("slow-burn")],
			pitch: "Give it three episodes. Then it owns you.",
		},
		{
			parts: [m("scary"), g("sci-fi-fantasy")],
			pitch: "Something is out there, and it's patient.",
		},
	],
}

/** Best with one thing added, for the hub's Best teaser and the Best page with nothing picked yet. */
export const BEST_STARTS: Record<Two, Ingredient[]> = {
	movie: [m("cozy"), g("comedy"), d("2010s"), m("scary"), c("japan"), g("science-fiction")],
	show: [m("funny"), g("drama"), d("2010s"), m("dark"), c("united-kingdom"), g("animation")],
}

const key = (parts: Ingredient[]) =>
	parts
		.map((p) => `${p.family}:${p.slug}`)
		.sort()
		.join("+")

/** The hand-written line of a blend that is one of the curated ones. */
export function pitchFor(kind: Kind, parts: Ingredient[]): string | undefined {
	const k = key(parts)
	return [...FEATURED[two(kind)], ...FAVORITES[two(kind)], ...ODD[two(kind)]].find(
		(c) => key(c.parts) === k,
	)?.pitch
}
