// The type filter every page shares: two independent choices, the format (every title, movies, or shows) and anime
// (with it, only it, or without it). In the URL as `type=movie|show` and `anime=only|none`; defaults are left out.
// Pure and shared by the server and the browser.

export const TITLE_FORMATS = ["all", "movie", "show"] as const
export type TitleFormat = (typeof TITLE_FORMATS)[number]

export const ANIME_CHOICES = ["any", "only", "none"] as const
export type AnimeChoice = (typeof ANIME_CHOICES)[number]

export interface TitleTypeFilter {
	format: TitleFormat
	anime: AnimeChoice
}

/** What the filter decides by. */
export interface TypedTitle {
	mediaType: "movie" | "show"
	anime: boolean
}

export const ALL_TITLE_TYPES: TitleTypeFilter = { format: "all", anime: "any" }

export const TITLE_FORMAT_NAMES: Record<TitleFormat, string> = {
	all: "All",
	movie: "Movies",
	show: "Shows",
}

/** The anime choices spelled out, for a menu. */
export const ANIME_NAMES: Record<AnimeChoice, string> = {
	any: "Include anime",
	only: "Only anime",
	none: "Hide anime",
}

/** The same in one word, for a segmented control under an "Anime" label. */
export const ANIME_SHORT_NAMES: Record<AnimeChoice, string> = {
	any: "Include",
	only: "Only",
	none: "Hide",
}

/** The anime choice as a state: what a chip says once it's set. */
export const ANIME_STATE_NAMES: Record<AnimeChoice, string> = {
	any: "Anime",
	only: "Only anime",
	none: "No anime",
}

const isFormat = (value: unknown): value is TitleFormat =>
	TITLE_FORMATS.includes(value as TitleFormat)
const isAnime = (value: unknown): value is AnimeChoice =>
	ANIME_CHOICES.includes(value as AnimeChoice)

/**
 * The filter from the raw `type` and `anime` values. Unknown values are the defaults; the earlier `type=anime` reads
 * as only anime, unless `anime` says otherwise.
 */
export function titleTypeOf(
	type: string | null | undefined,
	anime: string | null | undefined,
): TitleTypeFilter {
	return {
		format: isFormat(type) ? type : "all",
		anime: isAnime(anime) ? anime : type === "anime" ? "only" : "any",
	}
}

/** The filter from a URL's (or a form's) params. */
export const parseTitleType = (params: {
	get(name: string): string | null
}): TitleTypeFilter => titleTypeOf(params.get("type"), params.get("anime"))

/** The filter as its two URL values; null is the default and stays out of the URL. */
export const titleTypeParams = (
	filter: TitleTypeFilter,
): { type: "movie" | "show" | null; anime: "only" | "none" | null } => ({
	type: filter.format === "all" ? null : filter.format,
	anime: filter.anime === "any" ? null : filter.anime,
})

/** Writes the filter into the params, taking the defaults (and the earlier `type=anime`) out. */
export function writeTitleType(
	params: URLSearchParams,
	filter: TitleTypeFilter,
): URLSearchParams {
	const { type, anime } = titleTypeParams(filter)
	if (type) params.set("type", type)
	else params.delete("type")
	if (anime) params.set("anime", anime)
	else params.delete("anime")
	return params
}

export const isAllTitleTypes = (filter: TitleTypeFilter) =>
	filter.format === "all" && filter.anime === "any"

export const sameTitleType = (a: TitleTypeFilter, b: TitleTypeFilter) =>
	a.format === b.format && a.anime === b.anime

/** Whether a title passes: the format goes by media type, anime by the title's anime flag. */
export const passesTitleType = (filter: TitleTypeFilter, title: TypedTitle) =>
	(filter.format === "all" || title.mediaType === filter.format) &&
	(filter.anime === "any" || title.anime === (filter.anime === "only"))

/** The choice in a few words: "All types", "Shows", "Only anime", "Movies · no anime". */
export function titleTypeSummary(filter: TitleTypeFilter): string {
	if (isAllTitleTypes(filter)) return "All types"
	const anime = ANIME_STATE_NAMES[filter.anime]
	if (filter.format === "all") return anime
	const format = TITLE_FORMAT_NAMES[filter.format]
	return filter.anime === "any" ? format : `${format} · ${anime.toLowerCase()}`
}

/** What the filter keeps, as a plural: "titles", "movies", "anime shows", "shows other than anime". */
export function titleTypeNoun(filter: TitleTypeFilter): string {
	const format =
		filter.format === "all"
			? "titles"
			: TITLE_FORMAT_NAMES[filter.format].toLowerCase()
	if (filter.anime === "only")
		return filter.format === "all" ? "anime" : `anime ${format}`
	return filter.anime === "none" ? `${format} other than anime` : format
}
