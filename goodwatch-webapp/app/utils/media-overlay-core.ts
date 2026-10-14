import {
	presentationLanguage,
	type MediaPresentation,
	type FieldPresentation,
} from "./media-presentation.ts"

export const OVERLAY_BATCH_SIZE = 200
export interface CanonicalMediaRow {
	media_type: "movie" | "show"
	tmdb_id: number
	presentation?: MediaPresentation
	/** A noncanonical upstream read may lack proof of its fallback language. */
	canonical_language?: string
	canonical_title?: string
	title?: string | null
	poster_path?: string | null
	synopsis?: string | null
	overview?: string | null
	tagline?: string | null
	original_title?: string | null
	original_language_code?: string | null
}
export interface TranslationRow {
	media_tmdb_id: number
	media_type: "movie" | "show"
	language_code: string
	country_code: string
	title: string | null
	overview: string | null
	tagline: string | null
}
export interface PosterRow {
	media_tmdb_id: number
	media_type: "movie" | "show"
	language_code: string
	url_path: string
	tmdb_vote_average: number | null
	tmdb_vote_count: number | null
	width: number | null
	height: number | null
}
export type Sources = {
	canonical: CanonicalMediaRow[]
	translations: TranslationRow[]
	posters: PosterRow[]
}
export type OverlayQuery = <T extends {}>(
	sql: string,
	params?: (string | number | Date)[],
) => Promise<T[]>
const nonblank = (value: string | null | undefined) =>
	typeof value === "string" && value.trim() ? value : null
export const keyOf = (row: {
	media_type: string
	tmdb_id?: number
	media_tmdb_id?: number
}) => `${row.media_type}-${row.tmdb_id ?? row.media_tmdb_id}`
const preferredRegion: Record<string, string> = {
	en: "US",
	de: "DE",
	fr: "FR",
	es: "ES",
	it: "IT",
	"pt-BR": "BR",
	"pt-PT": "PT",
	ja: "JP",
	ko: "KR",
	"zh-Hans": "CN",
	"zh-Hant": "TW",
	pl: "PL",
	ru: "RU",
	ar: "SA",
}
export function translationCandidates<
	T extends { language_code: string; country_code: string },
>(rows: readonly T[], language: string): T[] {
	const selected = presentationLanguage(language)
	const base = selected.split("-")[0]
	const regions =
		selected === "zh-Hans"
			? ["CN", "SG"]
			: selected === "zh-Hant"
				? ["TW", "HK", "MO"]
				: selected.startsWith("pt-")
					? [preferredRegion[selected]]
					: null
	const order = (region: string) =>
		regions
			? regions.indexOf(region)
			: region === preferredRegion[selected]
				? 0
				: 1
	return rows
		.filter(
			(row) =>
				row.language_code === base &&
				(!regions || regions.includes(row.country_code)),
		)
		.sort(
			(a, b) =>
				order(a.country_code) - order(b.country_code) ||
				a.country_code.localeCompare(b.country_code),
		)
}
const translationLocale = (row: {
	language_code: string
	country_code: string
}) => `${row.language_code}${row.country_code ? `-${row.country_code}` : ""}`
const languageMatches = (actual: string | null | undefined, selected: string) =>
	typeof actual === "string" && actual.toLowerCase() === selected.split("-")[0]
const field = (
	language: string,
	source: FieldPresentation["source"],
	selected: string,
	locale?: string,
): FieldPresentation => ({
	language,
	source,
	fallback: source !== "localized",
	...(locale ? { translationLocale: locale } : {}),
})

/** Pure per-field resolver: never mutate or discard a canonical work for missing translations. */
export function overlayMediaRow<T extends CanonicalMediaRow>(
	row: T,
	language: string,
	sources: Sources,
): T & { canonical_title: string; presentation: MediaPresentation } {
	const selected = presentationLanguage(language)
	const base =
		sources.canonical.find((item) => keyOf(item) === keyOf(row)) ?? row
	const canonicalLanguage = base.canonical_language ?? "en"
	const uncertainInput = row.canonical_language === "und"
	const canonicalTitle =
		nonblank(row.canonical_title) ??
		(uncertainInput
			? (nonblank(base.title) ?? nonblank(base.original_title))
			: null) ??
		nonblank(row.title) ??
		nonblank(base.title) ??
		nonblank(base.original_title) ??
		""
	const candidates = translationCandidates(
		sources.translations.filter((item) => keyOf(item) === keyOf(row)),
		selected,
	)
	const pick = (name: "title" | "overview" | "tagline") =>
		candidates.find((candidate) => nonblank(candidate[name]))
	const title = pick("title"),
		overview = pick("overview"),
		tagline = pick("tagline")
	const original =
		!title && languageMatches(base.original_language_code, selected)
			? nonblank(base.original_title)
			: null
	const posterRows = sources.posters.filter(
		(item) => keyOf(item) === keyOf(row),
	)
	const posters = posterRows
		.filter(
			(item) =>
				item.language_code === selected.split("-")[0] &&
				nonblank(item.url_path),
		)
		.sort(
			(a, b) =>
				(b.tmdb_vote_average ?? 0) - (a.tmdb_vote_average ?? 0) ||
				(b.tmdb_vote_count ?? 0) - (a.tmdb_vote_count ?? 0) ||
				(b.width ?? 0) - (a.width ?? 0) ||
				a.url_path.localeCompare(b.url_path),
		)
	const poster = posters[0]
	const canonicalPoster = row.presentation
		? (base.poster_path ?? null)
		: (row.poster_path ?? base.poster_path ?? null)
	const knownPoster = posterRows.find(
		(item) => item.url_path === canonicalPoster,
	)
	const titleLanguage = title
		? translationLocale(title)
		: original
			? (base.original_language_code ?? "und")
			: !nonblank(base.title) && canonicalTitle === base.original_title
				? (base.original_language_code ?? "und")
				: canonicalLanguage
	const presentation: MediaPresentation = {
		language: selected,
		title: field(
			titleLanguage,
			title ? "localized" : original ? "original" : "canonical",
			selected,
			title ? translationLocale(title) : undefined,
		),
		poster: field(
			poster?.language_code || knownPoster?.language_code || "und",
			poster ? "localized" : "canonical",
			selected,
		),
		overview: field(
			overview ? translationLocale(overview) : canonicalLanguage,
			overview ? "localized" : "canonical",
			selected,
			overview ? translationLocale(overview) : undefined,
		),
		tagline: field(
			tagline ? translationLocale(tagline) : canonicalLanguage,
			tagline ? "localized" : "canonical",
			selected,
			tagline ? translationLocale(tagline) : undefined,
		),
	}
	const canonicalOverview =
		row.presentation || uncertainInput
			? (nonblank(base.synopsis) ?? nonblank(base.overview))
			: (nonblank(row.synopsis) ??
				nonblank(base.synopsis) ??
				nonblank(row.overview) ??
				nonblank(base.overview))
	return {
		...row,
		canonical_title: canonicalTitle,
		title: title?.title ?? original ?? canonicalTitle,
		poster_path: poster?.url_path ?? canonicalPoster,
		synopsis: overview?.overview ?? canonicalOverview ?? null,
		...(Object.prototype.hasOwnProperty.call(row, "overview")
			? { overview: overview?.overview ?? canonicalOverview ?? null }
			: {}),
		tagline:
			tagline?.tagline ??
			(row.presentation || uncertainInput ? null : nonblank(row.tagline)) ??
			nonblank(base.tagline) ??
			null,
		presentation,
	}
}

export function createMediaOverlay(
	read: OverlayQuery,
	cache?: (
		params: { keys: string[]; language: string },
		get: () => Promise<Sources>,
	) => Promise<Sources>,
) {
	const load = async (
		rows: readonly CanonicalMediaRow[],
		language: string,
	): Promise<Sources> => {
		const movies = rows
			.filter((row) => row.media_type === "movie")
			.map((row) => row.tmdb_id)
		const shows = rows
			.filter((row) => row.media_type === "show")
			.map((row) => row.tmdb_id)
		const scope =
			"((media_type = 'movie' AND media_tmdb_id = ANY(?)) OR (media_type = 'show' AND media_tmdb_id = ANY(?)))"
		const args = [movies as never, shows as never]
		const base = language.split("-")[0]
		const [canonical, translations, posters] = await Promise.all([
			read<CanonicalMediaRow>(
				`SELECT 'movie' AS media_type, tmdb_id, title, original_title, original_language_code, poster_path, synopsis, tagline FROM movie WHERE tmdb_id = ANY(?) UNION ALL SELECT 'show' AS media_type, tmdb_id, title, original_title, original_language_code, poster_path, synopsis, tagline FROM show WHERE tmdb_id = ANY(?)`,
				args,
			),
			read<TranslationRow>(
				`SELECT media_tmdb_id, media_type, language_code, country_code, title, overview, tagline FROM translation WHERE ${scope} AND language_code = ?`,
				[...args, base],
			),
			read<PosterRow>(
				`SELECT media_tmdb_id, media_type, language_code, url_path, tmdb_vote_average, tmdb_vote_count, width, height FROM media_image WHERE ${scope} AND image_type = 'posters' `,
				args,
			),
		])
		return { canonical, translations, posters }
	}
	return async function overlay<T extends CanonicalMediaRow>(
		rows: readonly T[],
		language: string,
	) {
		const selected = presentationLanguage(language)
		const unique = [
			...new Map(rows.map((row) => [keyOf(row), row])).values(),
		].sort((a, b) => keyOf(a).localeCompare(keyOf(b)))
		const all: Sources = { canonical: [], translations: [], posters: [] }
		for (let i = 0; i < unique.length; i += OVERLAY_BATCH_SIZE) {
			const batch = unique.slice(i, i + OVERLAY_BATCH_SIZE)
			const params = { keys: batch.map(keyOf), language: selected }
			// Canonical poster paths are facts from Crate, not device state; the cached batch reads include those rows.
			let source: Sources
			try {
				source = cache
					? await cache(params, () => load(batch, selected))
					: await load(batch, selected)
			} catch (error) {
				// A failed translation read must not fail the canonical entity or fill the source cache.
				console.error("Media presentation overlay unavailable", {
					language: selected,
					error,
				})
				source = { canonical: batch, translations: [], posters: [] }
			}
			all.canonical.push(...source.canonical)
			all.translations.push(...source.translations)
			all.posters.push(...source.posters)
		}
		return rows.map((row) => overlayMediaRow(row, selected, all))
	}
}

/** Keep a surface's projection: cards don't acquire an unread full synopsis just because the resolver loaded it. */
export function copyPresentationFields<T extends CanonicalMediaRow>(
	row: T,
	presented: T & { canonical_title: string; presentation: MediaPresentation },
) {
	const copy = {
		...row,
		canonical_title: presented.canonical_title,
		presentation: presented.presentation,
	}
	for (const name of [
		"title",
		"poster_path",
		"synopsis",
		"overview",
		"tagline",
	] as const) {
		if (Object.prototype.hasOwnProperty.call(row, name))
			Object.assign(copy, { [name]: presented[name] })
	}
	return copy
}
