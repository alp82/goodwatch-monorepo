// The copy deck: hand-written text for every place of the browse space, in the voice of a film lover talking to a
// friend. `short` is one line for a card (under 60 characters); `lede` is two or three sentences for the top of the
// place's page. Written once and static: nothing here is generated at request time, and nothing states a count, a
// score or a title that is on a service today.
//
// Ids, per family (lowercase; display names and older slugs are accepted too):
//   moods      the mood keys of domain/moods.ts ("feelgood"; also "cozy")
//   genres     the slug of the TMDB genre name ("science-fiction", "sci-fi-fantasy")
//   themes     the theme ids of domain/themes-styles.ts ("true"; also "true-stories")
//   styles     the style ids ("slow"; also "slow-burn")
//   decades    "1990s" (also "1990")
//   countries  ISO 3166-1 alpha-2 ("jp"; also "japan")
//   services   the brand slugs of domain/new-on-services-brands.json ("amazon-prime")
//   best       "all"
//   hub        "home", or a family's name for that family's own page ("moods")
import { COUNTRIES, COUNTRY_ALIASES } from "./countries.ts"
import { DECADES } from "./decades.ts"
import { GENRES, GENRE_ALIASES } from "./genres.ts"
import { BEST, HUB } from "./misc.ts"
import { MOODS, MOOD_ALIASES } from "./moods.ts"
import { SERVICES, SERVICE_ALIASES } from "./services.ts"
import { STYLES, STYLE_ALIASES, THEMES, THEME_ALIASES } from "./themes-styles.ts"
import type { Deck, Entry, Kind, PlaceCopy } from "./types.ts"

export { headings } from "./headings.ts"
export type { Kind, PlaceCopy } from "./types.ts"

export type CopyFamily =
	| "moods"
	| "genres"
	| "themes"
	| "styles"
	| "decades"
	| "countries"
	| "services"
	| "best"
	| "hub"

const NONE: Record<string, string> = {}

const DECKS: Record<CopyFamily, { deck: Deck; aliases: Record<string, string> }> = {
	moods: { deck: MOODS, aliases: MOOD_ALIASES },
	genres: { deck: GENRES, aliases: GENRE_ALIASES },
	themes: { deck: THEMES, aliases: THEME_ALIASES },
	styles: { deck: STYLES, aliases: STYLE_ALIASES },
	decades: { deck: DECADES, aliases: NONE },
	countries: { deck: COUNTRIES, aliases: COUNTRY_ALIASES },
	services: { deck: SERVICES, aliases: SERVICE_ALIASES },
	best: { deck: BEST, aliases: NONE },
	hub: { deck: HUB, aliases: { streaming: "services", eras: "decades", places: "countries" } },
}

/** "Sci-Fi & Fantasy" and "sci-fi-fantasy" are the same id; so are "Türkiye" and "turkiye". */
const slug = (id: string) =>
	id
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/&/g, " ")
		.replace(/\+/g, " plus ")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")

const isBoth = (entry: Entry): entry is PlaceCopy => "lede" in entry

/** The ids a family has copy for, for the kind. */
export function copyIds(kind: Kind, family: CopyFamily): string[] {
	const { deck } = DECKS[family]
	return Object.keys(deck).filter((id) => {
		const entry = deck[id]
		return isBoth(entry) || Boolean(forKind(entry, kind))
	})
}

/** The place's text, or null when the place has none for this kind (a News movies page doesn't exist). */
export function copyFor(kind: Kind, family: CopyFamily, id: string): PlaceCopy | null {
	const { deck, aliases } = DECKS[family]
	let key = slug(id)
	if (family === "decades" && /^\d{4}$/.test(key)) key = `${key}s`
	if (family === "best") key = "all"
	const entry = deck[key] ?? deck[aliases[key] ?? ""]
	if (!entry) return null
	return isBoth(entry) ? entry : forKind(entry, kind)
}

/**
 * Movies and shows together read their own text. A place only one kind has (Horror is movies, Reality is shows)
 * holds that kind alone under "all" too, so its text is the honest one.
 */
function forKind(entry: Exclude<Entry, PlaceCopy>, kind: Kind): PlaceCopy | null {
	if (kind !== "all") return entry[kind] ?? null
	// Without a text of its own the movie text stands: the deck's test allows that only for the genres that are
	// movies alone when both kinds are listed (Horror, Thriller, Romance, History, Music).
	return entry.all ?? entry.movies ?? entry.shows ?? null
}
