// PROTOTYPE - throwaway (prototype/explore-r4, concept `guide`). The evening line-up: which channels the hub shows, in
// what order, on each day of the week. Programmed by hand, the way a schedule is: one feeling leads the night and the
// rest follows it. A channel that has no page for the kind (Horror for shows) is skipped.
import type { Family, Ingredient } from "../../kit/address"

const ch = (family: Family, slug: string): Ingredient => ({ family, slug })

export interface Lineup {
	day: string
	/** One line about tonight, as a person would say it. */
	note: string
	channels: Ingredient[]
}

// Index: Date.getUTCDay(), Sunday first. Movie slugs; shows use `SHOW_SLUG` where a genre is named differently.
export const LINEUPS: Lineup[] = [
	{
		day: "Sunday",
		note: "A slow one. Warm things first, then somewhere far away.",
		channels: [
			ch("mood", "cozy"),
			ch("genre", "family"),
			ch("country", "japan"),
			ch("mood", "magical"),
			ch("decade", "1980s"),
			ch("service", "disney-plus"),
			ch("mood", "coming-of-age"),
			ch("genre", "animation"),
		],
	},
	{
		day: "Monday",
		note: "Start the week laughing. It gets stranger as the night goes on.",
		channels: [
			ch("mood", "funny"),
			ch("genre", "comedy"),
			ch("decade", "1990s"),
			ch("mood", "quirky"),
			ch("country", "united-kingdom"),
			ch("service", "netflix"),
			ch("theme", "showbiz"),
			ch("mood", "cozy"),
		],
	},
	{
		day: "Tuesday",
		note: "Something to solve tonight. Bring your own theories.",
		channels: [
			ch("mood", "crime-mystery"),
			ch("genre", "thriller"),
			ch("theme", "true-stories"),
			ch("mood", "tense"),
			ch("decade", "1970s"),
			ch("country", "south-korea"),
			ch("service", "hbo-max"),
			ch("genre", "mystery"),
		],
	},
	{
		day: "Wednesday",
		note: "A night for the ones that stay with you.",
		channels: [
			ch("mood", "deep"),
			ch("genre", "drama"),
			ch("country", "france"),
			ch("mood", "sad"),
			ch("decade", "1950s"),
			ch("theme", "the-mind"),
			ch("service", "mubi"),
			ch("style", "slow-burn"),
		],
	},
	{
		day: "Thursday",
		note: "Leave the planet for a few hours.",
		channels: [
			ch("mood", "other-worlds"),
			ch("genre", "science-fiction"),
			ch("decade", "1980s"),
			ch("mood", "trippy"),
			ch("country", "japan"),
			ch("theme", "future"),
			ch("service", "apple-tv"),
			ch("genre", "fantasy"),
		],
	},
	{
		day: "Friday",
		note: "Loud, fast, and a little scary. It's Friday.",
		channels: [
			ch("mood", "thrilling"),
			ch("genre", "action"),
			ch("mood", "scary"),
			ch("decade", "2000s"),
			ch("country", "hong-kong-sar-china"),
			ch("style", "spectacle"),
			ch("service", "amazon-prime"),
			ch("genre", "horror"),
		],
	},
	{
		day: "Saturday",
		note: "Big screen night: romance, adventure, and the classics.",
		channels: [
			ch("mood", "romantic"),
			ch("genre", "adventure"),
			ch("decade", "1940s"),
			ch("mood", "magical"),
			ch("country", "italy"),
			ch("style", "stylized"),
			ch("service", "disney-plus"),
			ch("genre", "western"),
		],
	},
]

/** Genres that TV names differently. */
export const SHOW_SLUG: Record<string, string> = {
	action: "action-adventure",
	adventure: "action-adventure",
	"science-fiction": "sci-fi-fantasy",
	fantasy: "sci-fi-fantasy",
	war: "war-politics",
	thriller: "crime",
	horror: "mystery",
	western: "western",
}

/** The channel groups of the row under Explore: the line-up, then one per family. */
export const GROUPS: { family: Family; label: string; line: string }[] = [
	{ family: "mood", label: "Moods", line: "How the evening should feel." },
	{ family: "genre", label: "Genres", line: "The kind of story." },
	{ family: "theme", label: "Themes", line: "What it's about." },
	{ family: "style", label: "Styles", line: "How it's told." },
	{ family: "decade", label: "Eras", line: "When it was made." },
	{ family: "country", label: "Countries", line: "Where it comes from." },
	{ family: "service", label: "Streaming", line: "Where you can watch it." },
]
