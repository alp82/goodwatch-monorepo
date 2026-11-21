// PROTOTYPE - throwaway (prototype/explore-r7, slot "hub"). Hand-written ways in, kept from round 6's "Ways in": the
// night you're having (each occasion a real blend whose two parts mean different things) and best-of questions (each
// the top of a filtered ranking). Shows have their own sets; movies and shows together read the movie set.
import { type Ingredient, type Kind, ing } from "../../../../kit/address"

const m = (s: string) => ing("mood", s)
const g = (s: string) => ing("genre", s)
const d = (s: string) => ing("decade", s)
const c = (s: string) => ing("country", s)

// Each occasion is a blend whose two parts mean different things (never "Scary horror"). Shows have their own set;
// movies and shows together read the movie set. Any that has no full page today is left out.
export const OCCASIONS: Record<
	"movie" | "show",
	{ name: string; line: string; parts: Ingredient[] }[]
> = {
	movie: [
		{
			name: "Friends over",
			line: "Screams and laughs in the same breath.",
			parts: [m("funny"), g("horror")],
		},
		{
			name: "Date night",
			line: "Easy to talk over, easier to fall for.",
			parts: [m("romantic"), g("comedy")],
		},
		{
			name: "Sunday on the sofa",
			line: "Warm, unhurried, good for the whole room.",
			parts: [m("cozy"), g("animation")],
		},
		{
			name: "Late and alone",
			line: "Strange ideas for when the house is quiet.",
			parts: [m("trippy"), g("science-fiction")],
		},
		{
			name: "A good cry",
			line: "Bring tissues. You'll be glad you did.",
			parts: [m("sad"), g("romance")],
		},
		{
			name: "With the kids",
			line: "Wonder for them, jokes for you.",
			parts: [m("magical"), g("family")],
		},
		{
			name: "Edge of your seat",
			line: "One more scene, then bed. Then one more.",
			parts: [m("tense"), g("crime")],
		},
		{
			name: "Somewhere new",
			line: "Odd, specific, and nothing like home.",
			parts: [m("quirky"), c("france")],
		},
	],
	show: [
		{
			name: "One more episode",
			line: "Cliffhangers built to ruin your sleep.",
			parts: [m("tense"), g("crime")],
		},
		{
			name: "Background comfort",
			line: "On in the background, never really in the background.",
			parts: [m("cozy"), g("comedy")],
		},
		{
			name: "Date night",
			line: "Slow glances and fate working overtime.",
			parts: [m("romantic"), c("south-korea")],
		},
		{
			name: "With the kids",
			line: "Spirits, kingdoms, and adventures worth a season.",
			parts: [m("magical"), g("animation")],
		},
		{
			name: "Late and alone",
			line: "Someone is lying. Work out who.",
			parts: [m("dark"), g("mystery")],
		},
		{
			name: "A good cry",
			line: "Characters you'll miss when it ends.",
			parts: [m("sad"), g("drama")],
		},
		{
			name: "Big laughs",
			line: "Awkward silences and jokes a beat late.",
			parts: [m("quirky"), c("united-kingdom")],
		},
	],
}

/**
 * Best-of lists the hub cycles through (round 10: a much larger pool, so it keeps going). `q` asks it, `key` is the
 * word in `q` that the progress line underlines, `short` names it for screen readers and links. Any list without a
 * full page today, or without five titles, is left out.
 */
type Question = { q: string; key: string; short: string; parts: Ingredient[] }
const Q = (q: string, key: string, parts: Ingredient[]): Question => ({
	q,
	key,
	short: q.replace(/^The best /, ""),
	parts,
})

export const QUESTIONS: Record<"movie" | "show", Question[]> = {
	movie: [
		Q("The best cozy movies", "cozy", [m("cozy")]),
		Q("The best thrillers of the ’70s", "’70s", [g("thriller"), d("1970s")]),
		Q("The best Japanese animation", "Japanese", [g("animation"), c("japan")]),
		Q("The best horror of the ’80s", "’80s", [g("horror"), d("1980s")]),
		Q("The best Korean thrillers", "Korean", [g("thriller"), c("south-korea")]),
		Q("The best dark movies", "dark", [m("dark")]),
		Q("The best comedies of the 2010s", "2010s", [g("comedy"), d("2010s")]),
		Q("The best westerns ever made", "westerns", [g("western")]),
		Q("The best trippy movies", "trippy", [m("trippy")]),
		Q("The best French dramas", "French", [g("drama"), c("france")]),
		Q("The best romances of the ’90s", "’90s", [g("romance"), d("1990s")]),
		Q("The best sad movies", "sad", [m("sad")]),
		Q("The best Italian crime", "Italian", [g("crime"), c("italy")]),
		Q("The best science fiction of the ’80s", "’80s", [g("science-fiction"), d("1980s")]),
		Q("The best quirky movies", "quirky", [m("quirky")]),
		Q("The best Indian dramas", "Indian", [g("drama"), c("india")]),
		Q("The best mysteries of the ’40s", "’40s", [g("mystery"), d("1940s")]),
		Q("The best magical movies", "magical", [m("magical")]),
		Q("The best Spanish thrillers", "Spanish", [g("thriller"), c("spain")]),
		Q("The best family movies of the 2000s", "2000s", [g("family"), d("2000s")]),
		Q("The best tense movies", "tense", [m("tense")]),
		Q("The best British comedies", "British", [g("comedy"), c("united-kingdom")]),
		Q("The best documentaries of the 2020s", "2020s", [g("documentary"), d("2020s")]),
		Q("The best romantic movies", "romantic", [m("romantic")]),
	],
	show: [
		Q("The best cozy shows", "cozy", [m("cozy")]),
		Q("The best crime shows of the 2010s", "2010s", [g("crime"), d("2010s")]),
		Q("The best British comedies", "British", [g("comedy"), c("united-kingdom")]),
		Q("The best anime series", "anime", [g("animation"), c("japan")]),
		Q("The best Korean dramas", "Korean", [g("drama"), c("south-korea")]),
		Q("The best dark shows", "dark", [m("dark")]),
		Q("The best documentary series", "documentary", [g("documentary")]),
		Q("The best mysteries of the 2020s", "2020s", [g("mystery"), d("2020s")]),
		Q("The best funny shows", "funny", [m("funny")]),
		Q("The best dramas of the 2000s", "2000s", [g("drama"), d("2000s")]),
		Q("The best Spanish thrillers", "Spanish", [g("thriller"), c("spain")]),
		Q("The best trippy shows", "trippy", [m("trippy")]),
		Q("The best comedies of the ’90s", "’90s", [g("comedy"), d("1990s")]),
		Q("The best German dramas", "German", [g("drama"), c("germany")]),
		Q("The best tense shows", "tense", [m("tense")]),
		Q("The best science fiction of the 2010s", "2010s", [g("science-fiction"), d("2010s")]),
		Q("The best sad shows", "sad", [m("sad")]),
		Q("The best family shows", "family", [g("family")]),
		Q("The best quirky shows", "quirky", [m("quirky")]),
		Q("The best French crime", "French", [g("crime"), c("france")]),
	],
}

export const setOf = (k: Kind) => (k === "show" ? "show" : "movie")
