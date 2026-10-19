import { createHash } from "node:crypto"
export interface TvtimeMovieEvidence {
	titles: string[]
	dates: string[]
	countries: string[]
}
import type { TvtimeSuggestionProof } from "../../domain/imports.ts"
export type { TvtimeSuggestionProof } from "../../domain/imports.ts"
export interface TvtimeMovieSuggestion {
	state: "suggested" | "manual" | "unavailable" | "already_resolved"
	reason?: import("../../domain/imports.ts").WishlistSuggestionReason
	proposal?: {
		mediaType: "movie"
		tmdbId: number
		title: string
		year: number | null
		posterPath: string | null
	}
	proof?: TvtimeSuggestionProof
}
type Movie = {
	id: number
	title?: string
	original_title?: string
	original_language?: string
	release_date?: string
	alternative_titles?: { titles: { title: string; iso_3166_1?: string }[] }
	translations?: {
		translations: {
			iso_3166_1?: string
			iso_639_1?: string
			data: { title?: string }
		}[]
	}
	release_dates?: {
		results: {
			iso_3166_1: string
			release_dates: { release_date: string; type: number }[]
		}[]
	}
}
export const normalizeTvtimeTitle = (value: string) =>
	value.normalize("NFC").trim().toLowerCase().replace(/\s+/gu, " ")
export function tvtimeEvidenceFingerprint(e: TvtimeMovieEvidence) {
	return createHash("sha256")
		.update(
			JSON.stringify({
				titles: [...new Set(e.titles.map(normalizeTvtimeTitle))].sort(),
				dates: [...new Set(e.dates)].sort(),
				countries: [...new Set(e.countries)].sort(),
			}),
		)
		.digest("hex")
}
export async function suggestTvtimeMovie(
	e: TvtimeMovieEvidence,
	io: {
		get: (path: string, params?: Record<string, string>) => Promise<unknown>
		catalog: (id: number) => Promise<{
			title: string
			year: number | null
			posterPath: string | null
		} | null>
		now?: () => number
	},
): Promise<TvtimeMovieSuggestion> {
	const titles = [...new Set(e.titles.map(normalizeTvtimeTitle))]
	const dates = [...new Set(e.dates)]
	const countries = [...new Set(e.countries)]
	const manual = (
		reason: import("../../domain/imports.ts").WishlistSuggestionReason,
	): TvtimeMovieSuggestion => ({ state: "manual", reason })
	if (
		titles.length !== 1 ||
		!titles[0] ||
		dates.length !== 1 ||
		!/^\d{4}-\d\d-\d\d$/.test(dates[0]) ||
		!Number.isFinite(Date.parse(dates[0])) ||
		new Date(dates[0]).toISOString().slice(0, 10) !== dates[0] ||
		dates[0].slice(0, 4) < "1800" ||
		countries.length > 1
	)
		return manual("conflicting_source_evidence")
	try {
		const ids = new Set<number>()
		let pages = 1
		for (let page = 1; page <= pages; page++) {
			const found = (await io.get("/search/movie", {
				query: titles[0],
				include_adult: "true",
				page: String(page),
			})) as { results?: { id: number }[]; total_pages?: number }
			if (
				!Array.isArray(found.results) ||
				!Number.isInteger(found.total_pages) ||
				Number(found.total_pages) < 0
			)
				return {
					state: "unavailable",
					reason: "tvtime_suggestion_unavailable",
				}
			if (page === 1) {
				pages = Number(found.total_pages)
				if (pages > 5) return manual("tvtime_suggestion_search_incomplete")
			}
			for (const result of found.results) {
				if (!Number.isSafeInteger(result.id) || result.id <= 0)
					return {
						state: "unavailable",
						reason: "tvtime_suggestion_unavailable",
					}
				ids.add(result.id)
			}
			if (ids.size > 100) return manual("tvtime_suggestion_search_incomplete")
		}
		const qualifying: {
			id: number
			title: TvtimeSuggestionProof["title"]
			date: TvtimeSuggestionProof["date"]
		}[] = []
		for (const id of ids) {
			const m = (await io.get(`/movie/${id}`, {
				append_to_response: "alternative_titles,release_dates,translations",
			})) as Movie
			if (
				m.id !== id ||
				!m.alternative_titles ||
				!Array.isArray(m.alternative_titles.titles) ||
				!m.release_dates ||
				!Array.isArray(m.release_dates.results) ||
				!m.translations ||
				!Array.isArray(m.translations.translations)
			)
				return {
					state: "unavailable",
					reason: "tvtime_suggestion_unavailable",
				}
			const names: TvtimeSuggestionProof["title"][] = [
				{ value: m.title ?? "", kind: "primary", locale: "en-US" },
				{
					value: m.original_title ?? "",
					kind: "original",
					locale: m.original_language ?? "und",
				},
				...m.alternative_titles.titles.map((t) => ({
					value: t.title,
					kind: "alternative" as const,
					locale: "und",
					country: t.iso_3166_1,
				})),
				...m.translations.translations.map((t) => ({
					value: t.data.title ?? "",
					kind: "translation" as const,
					country: t.iso_3166_1,
					locale: t.iso_639_1 ?? "und",
				})),
			]
			const title = names.find(
				(t) => normalizeTvtimeTitle(t.value) === titles[0],
			)
			if (!title) continue
			let date: TvtimeSuggestionProof["date"] | undefined =
				m.release_date === dates[0]
					? { value: dates[0], basis: "primary" }
					: undefined
			if (!date && countries.length === 1)
				for (const region of m.release_dates.results) {
					if (region.iso_3166_1 !== countries[0]) continue
					const release = region.release_dates.find(
						(r) =>
							[1, 2, 3].includes(r.type) &&
							r.release_date.slice(0, 10) === dates[0],
					)
					if (release) {
						date = {
							value: dates[0],
							basis: "country",
							country: region.iso_3166_1,
							releaseType: release.type,
						}
						break
					}
				}
			if (date) qualifying.push({ id, title, date })
		}
		if (qualifying.length !== 1)
			return manual(
				qualifying.length
					? "tvtime_suggestion_ambiguous"
					: "tvtime_suggestion_no_exact_match",
			)
		const match = qualifying[0]
		const catalog = await io.catalog(match.id)
		if (!catalog) return manual("tvtime_suggestion_catalog_missing")
		return {
			state: "suggested",
			proposal: { mediaType: "movie", tmdbId: match.id, ...catalog },
			proof: {
				rule: "tvtime_exact_title_release_date_v1",
				mediaType: "movie",
				tmdbId: match.id,
				sourceFingerprint: tvtimeEvidenceFingerprint(e),
				title: match.title,
				date: match.date,
				candidateCount: 1,
				sourceCountry: countries[0] ?? null,
				verifiedCandidates: ids.size,
				discoveryBound: { pages: 5, candidates: 100 },
				discoveryComplete: true,
				pages,
				verifiedAt: new Date((io.now ?? Date.now)()).toISOString(),
			},
		}
	} catch (error) {
		if (
			error instanceof Error &&
			(error.name === "ResolutionStopped" || error.name === "ResolutionBudget")
		)
			throw error
		return { state: "unavailable", reason: "tvtime_suggestion_unavailable" }
	}
}
