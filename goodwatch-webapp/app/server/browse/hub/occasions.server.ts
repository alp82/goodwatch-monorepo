// Hand-written ways in: the
// night you're having (each occasion a real blend whose two parts mean different things) and best-of questions (each
// the top of a filtered ranking). Shows have their own sets; movies and shows together read the movie set.
import { type Ingredient, type Kind, ing } from "~/domain/browse/address"

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
 * Best-of lists the hub cycles through (a much larger pool, so it keeps going). `q` asks it, `key` is the
 * word in `q` that the progress line underlines, `short` names it for screen readers and links. Any list without a
 * full page today, or without five titles, is left out.
 */
type Question = { q: string; key: string; short: string; parts: Ingredient[] }
const Q = (q: string, key: string, parts: Ingredient[]): Question => ({
	q,
	key,
	short: q.replace(/^Top /, ""),
	parts,
})

export const QUESTIONS: Record<"movie" | "show", Question[]> = {
	movie: [
		Q("Top cozy movies", "cozy", [m("cozy")]),
		Q("Top thrillers of the ’70s", "’70s", [g("thriller"), d("1970s")]),
		Q("Top Japanese animation", "Japanese", [g("animation"), c("japan")]),
		Q("Top horror of the ’80s", "’80s", [g("horror"), d("1980s")]),
		Q("Top Korean thrillers", "Korean", [g("thriller"), c("south-korea")]),
		Q("Top dark movies", "dark", [m("dark")]),
		Q("Top comedies of the 2010s", "2010s", [g("comedy"), d("2010s")]),
		Q("Top westerns ever made", "westerns", [g("western")]),
		Q("Top trippy movies", "trippy", [m("trippy")]),
		Q("Top French dramas", "French", [g("drama"), c("france")]),
		Q("Top romances of the ’90s", "’90s", [g("romance"), d("1990s")]),
		Q("Top sad movies", "sad", [m("sad")]),
		Q("Top Italian crime", "Italian", [g("crime"), c("italy")]),
		Q("Top science fiction of the ’80s", "’80s", [g("science-fiction"), d("1980s")]),
		Q("Top quirky movies", "quirky", [m("quirky")]),
		Q("Top Indian dramas", "Indian", [g("drama"), c("india")]),
		Q("Top mysteries of the ’40s", "’40s", [g("mystery"), d("1940s")]),
		Q("Top magical movies", "magical", [m("magical")]),
		Q("Top Spanish thrillers", "Spanish", [g("thriller"), c("spain")]),
		Q("Top family movies of the 2000s", "2000s", [g("family"), d("2000s")]),
		Q("Top tense movies", "tense", [m("tense")]),
		Q("Top British comedies", "British", [g("comedy"), c("united-kingdom")]),
		Q("Top documentaries of the 2020s", "2020s", [g("documentary"), d("2020s")]),
		Q("Top romantic movies", "romantic", [m("romantic")]),
	],
	show: [
		Q("Top cozy shows", "cozy", [m("cozy")]),
		Q("Top crime shows of the 2010s", "2010s", [g("crime"), d("2010s")]),
		Q("Top British comedies", "British", [g("comedy"), c("united-kingdom")]),
		Q("Top anime series", "anime", [g("animation"), c("japan")]),
		Q("Top Korean dramas", "Korean", [g("drama"), c("south-korea")]),
		Q("Top dark shows", "dark", [m("dark")]),
		Q("Top documentary series", "documentary", [g("documentary")]),
		Q("Top mysteries of the 2020s", "2020s", [g("mystery"), d("2020s")]),
		Q("Top funny shows", "funny", [m("funny")]),
		Q("Top dramas of the 2000s", "2000s", [g("drama"), d("2000s")]),
		Q("Top Spanish thrillers", "Spanish", [g("thriller"), c("spain")]),
		Q("Top trippy shows", "trippy", [m("trippy")]),
		Q("Top comedies of the ’90s", "’90s", [g("comedy"), d("1990s")]),
		Q("Top German dramas", "German", [g("drama"), c("germany")]),
		Q("Top tense shows", "tense", [m("tense")]),
		Q("Top science fiction of the 2010s", "2010s", [g("science-fiction"), d("2010s")]),
		Q("Top sad shows", "sad", [m("sad")]),
		Q("Top family shows", "family", [g("family")]),
		Q("Top quirky shows", "quirky", [m("quirky")]),
		Q("Top French crime", "French", [g("crime"), c("france")]),
	],
}

export const setOf = (k: Kind) => (k === "show" ? "show" : "movie")
