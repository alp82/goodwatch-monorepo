import { hasExpectedMediaScript } from "./media-script.ts"
import {
	presentationLanguage,
	hasValidMediaPresentation,
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

export interface IndexedMediaSources {
	canonical: Map<string, CanonicalMediaRow>
	translations: Map<string, TranslationRow[]>
	posters: Map<string, { best?: PosterRow; paths: Map<string, PosterRow> }>
}
const betterPoster = (a: PosterRow, b: PosterRow) =>
	(a.tmdb_vote_average ?? 0) > (b.tmdb_vote_average ?? 0) ||
	((a.tmdb_vote_average ?? 0) === (b.tmdb_vote_average ?? 0) &&
		((a.tmdb_vote_count ?? 0) > (b.tmdb_vote_count ?? 0) ||
			((a.tmdb_vote_count ?? 0) === (b.tmdb_vote_count ?? 0) &&
				((a.width ?? 0) > (b.width ?? 0) ||
					((a.width ?? 0) === (b.width ?? 0) && a.url_path < b.url_path)))))

/** Build once for a whole page. Poster selection is linear, without per-title scans/sorts. */
export function indexMediaSources(
	sources: Sources,
	language: string,
): IndexedMediaSources {
	const indexed: IndexedMediaSources = {
		canonical: new Map(),
		translations: new Map(),
		posters: new Map(),
	}
	for (const row of sources.canonical) indexed.canonical.set(keyOf(row), row)
	for (const row of sources.translations) {
		const key = keyOf(row)
		const list = indexed.translations.get(key) ?? []
		list.push(row)
		indexed.translations.set(key, list)
	}
	for (const [key, rows] of indexed.translations)
		indexed.translations.set(key, translationCandidates(rows, language))
	const base = presentationLanguage(language).split("-")[0]
	for (const row of sources.posters) {
		const key = keyOf(row)
		let entry = indexed.posters.get(key)
		if (!entry) {
			entry = { paths: new Map() }
			indexed.posters.set(key, entry)
		}
		entry.paths.set(row.url_path, row)
		if (
			row.language_code === base &&
			nonblank(row.url_path) &&
			(!entry.best || betterPoster(row, entry.best))
		)
			entry.best = row
	}
	return indexed
}

/** Pure per-field resolver: never mutate or discard a canonical work for missing translations. */
export function overlayMediaRow<T extends CanonicalMediaRow>(
	row: T,
	language: string,
	sources: Sources | IndexedMediaSources,
): T & { canonical_title: string; presentation: MediaPresentation } {
	const selected = presentationLanguage(language)
	const indexed =
		sources.canonical instanceof Map
			? (sources as IndexedMediaSources)
			: indexMediaSources(sources as Sources, selected)
	const key = keyOf(row)
	const base = indexed.canonical.get(key) ?? row
	const canonicalLanguage = base.canonical_language ?? "en"
	const uncertainInput =
		row.canonical_language === "und" ||
		(!!row.presentation && !nonblank(row.canonical_title))
	const canonicalTitle =
		nonblank(row.canonical_title) ??
		(uncertainInput
			? (nonblank(base.title) ?? nonblank(base.original_title))
			: null) ??
		nonblank(row.title) ??
		nonblank(base.title) ??
		nonblank(base.original_title) ??
		""
	const candidates = indexed.translations.get(key) ?? []
	const pick = (name: "title" | "overview" | "tagline") =>
		candidates.find(
			(candidate) =>
				nonblank(candidate[name]) &&
				hasExpectedMediaScript(candidate[name]!, selected),
		)
	const title = pick("title"),
		overview = pick("overview"),
		tagline = pick("tagline")
	const original =
		!title &&
		languageMatches(base.original_language_code, selected) &&
		hasExpectedMediaScript(base.original_title ?? "", selected)
			? nonblank(base.original_title)
			: null
	const posterEntry = indexed.posters.get(key)
	const poster = posterEntry?.best
	const canonicalPoster = row.presentation
		? (base.poster_path ?? null)
		: (row.poster_path ?? base.poster_path ?? null)
	const knownPoster = canonicalPoster
		? posterEntry?.paths.get(canonicalPoster)
		: undefined
	const canonicalOverview =
		row.presentation || uncertainInput
			? (nonblank(base.synopsis) ?? nonblank(base.overview))
			: (nonblank(row.synopsis) ??
				nonblank(base.synopsis) ??
				nonblank(row.overview) ??
				nonblank(base.overview))
	const canonicalTagline =
		(row.presentation || uncertainInput ? null : nonblank(row.tagline)) ??
		nonblank(base.tagline) ??
		null
	const actualCanonicalLanguage = (text: string | null) =>
		hasExpectedMediaScript(text ?? "", canonicalLanguage)
			? canonicalLanguage
			: "und"
	const titleLanguage = title
		? translationLocale(title)
		: original
			? (base.original_language_code ?? "und")
			: !nonblank(base.title) && canonicalTitle === base.original_title
				? hasExpectedMediaScript(
						canonicalTitle,
						base.original_language_code ?? "und",
					)
					? (base.original_language_code ?? "und")
					: "und"
				: actualCanonicalLanguage(canonicalTitle)
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
			overview
				? translationLocale(overview)
				: actualCanonicalLanguage(canonicalOverview),
			overview ? "localized" : "canonical",
			selected,
			overview ? translationLocale(overview) : undefined,
		),
		tagline: field(
			tagline
				? translationLocale(tagline)
				: actualCanonicalLanguage(canonicalTagline),
			tagline ? "localized" : "canonical",
			selected,
			tagline ? translationLocale(tagline) : undefined,
		),
	}
	return {
		...row,
		canonical_title: canonicalTitle,
		title: title?.title ?? original ?? canonicalTitle,
		poster_path: poster?.url_path ?? canonicalPoster,
		synopsis: overview?.overview ?? canonicalOverview ?? null,
		...(Object.prototype.hasOwnProperty.call(row, "overview")
			? { overview: overview?.overview ?? canonicalOverview ?? null }
			: {}),
		tagline: tagline?.tagline ?? canonicalTagline,
		presentation,
	}
}

export interface MediaSourceCache {
	load?(
		keys: readonly string[],
		language: string,
		loader: (missing: string[]) => Promise<ReadonlyMap<string, Sources>>,
	): Promise<Map<string, Sources>>
	read(keys: readonly string[], language: string): Promise<Map<string, Sources>>
	write(entries: ReadonlyMap<string, Sources>, language: string): Promise<void>
}

/** English catalog projections need no translation/image read; unproved upstream text still needs canonical repair. */
export const canonicalEnglishEquivalent = (row: CanonicalMediaRow) =>
	(!row.canonical_language || row.canonical_language === "en") &&
	(!row.presentation || row.presentation.language === "en") &&
	!!nonblank(row.title) &&
	!(
		row.original_language_code &&
		row.original_language_code !== "en" &&
		row.original_title === row.title
	) &&
	(row.original_language_code !== "en" ||
		!nonblank(row.original_title) ||
		row.original_title === row.title)

export function overlayMediaRows<T extends CanonicalMediaRow>(
	rows: readonly T[],
	language: string,
	sources: Sources,
) {
	const indexed = indexMediaSources(sources, language)
	return rows.map((row) => overlayMediaRow(row, language, indexed))
}

export function createMediaOverlay(
	read: OverlayQuery,
	cache?: MediaSourceCache,
	onReadError: () => void = () => {},
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
		const canonical = await read<CanonicalMediaRow>(
			"SELECT 'movie' AS media_type, tmdb_id, title, original_title, original_language_code, poster_path, synopsis, tagline FROM movie WHERE tmdb_id = ANY(?) UNION ALL SELECT 'show' AS media_type, tmdb_id, title, original_title, original_language_code, poster_path, synopsis, tagline FROM show WHERE tmdb_id = ANY(?)",
			args,
		)
		const paths = [
			...new Set(
				[...canonical, ...rows].flatMap((row) =>
					row.poster_path ? [row.poster_path] : [],
				),
			),
		]
		const [translations, posters] = await Promise.all([
			read<TranslationRow>(
				`SELECT media_tmdb_id, media_type, language_code, country_code, title, overview, tagline FROM translation WHERE ${scope} AND language_code = ?`,
				[...args, language.split("-")[0]],
			),
			read<PosterRow>(
				`SELECT media_tmdb_id, media_type, language_code, url_path, tmdb_vote_average, tmdb_vote_count, width, height FROM media_image WHERE ${scope} AND image_type = 'posters' AND (language_code = ANY(?) OR url_path = ANY(?))`,
				[...args, [language.split("-")[0]] as never, paths as never],
			),
		])
		return { canonical, translations, posters }
	}
	return async function overlay<T extends CanonicalMediaRow>(
		rows: readonly T[],
		language: string,
	) {
		const selected = presentationLanguage(language)
		const pending = rows.filter(
			(row) =>
				!hasValidMediaPresentation(row, selected) &&
				!(selected === "en" && canonicalEnglishEquivalent(row)),
		)
		const unique = [
			...new Map(pending.map((row) => [keyOf(row), row])).values(),
		]
		const all: Sources = { canonical: [], translations: [], posters: [] }
		for (let i = 0; i < unique.length; i += OVERLAY_BATCH_SIZE) {
			const batch = unique.slice(i, i + OVERLAY_BATCH_SIZE)
			try {
				const keys = batch.map(keyOf)
				const fetchMissing = async (missingKeys: string[]) => {
					const wanted = new Set(missingKeys)
					const missing = batch.filter((row) => wanted.has(keyOf(row)))
					const loaded = await load(missing, selected)
					const index = indexMediaSources(loaded, selected)
					const entries = new Map<string, Sources>()
					for (const row of missing) {
						const key = keyOf(row),
							base = index.canonical.get(key),
							posters = index.posters.get(key)
						const kept = new Map<string, PosterRow>()
						if (posters?.best) kept.set(posters.best.url_path, posters.best)
						for (const path of [base?.poster_path, row.poster_path]) {
							const image = path && posters?.paths.get(path)
							if (image) kept.set(image.url_path, image)
						}
						entries.set(key, {
							canonical: base ? [base] : [],
							translations: index.translations.get(key) ?? [],
							posters: [...kept.values()],
						})
					}
					return entries
				}
				let hits: Map<string, Sources>
				if (cache?.load) hits = await cache.load(keys, selected, fetchMissing)
				else {
					hits = (await cache?.read(keys, selected)) ?? new Map()
					const missing = keys.filter((key) => !hits.has(key))
					if (missing.length) {
						const entries = await fetchMissing(missing)
						await cache?.write(entries, selected)
						for (const [key, value] of entries) hits.set(key, value)
					}
				}
				for (const source of hits.values()) {
					all.canonical.push(...source.canonical)
					all.translations.push(...source.translations)
					all.posters.push(...source.posters)
				}
			} catch (error) {
				onReadError()
				console.error("Media presentation overlay unavailable", {
					language: selected,
					error,
				})
			}
		}
		const indexed = indexMediaSources(all, selected)
		return rows.map((row) =>
			hasValidMediaPresentation(row, selected)
				? { ...row }
				: overlayMediaRow(row, selected, indexed),
		)
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
