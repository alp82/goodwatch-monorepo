// Catalog lookups for share lists: the titles a card shows, quick picks per list prompt, and title search.
import { type CardTitle, LIST_PROMPTS, type MediaType, titleKey } from "~/ui/share-card/model"
import { query } from "~/utils/crate"
import { canonicalTitleId } from "~/utils/title-identity"

const TMDB_IMAGES = "https://image.tmdb.org/t/p"
const QUICK_PICKS = 48
const QUICK_PICKS_TTL_MS = 6 * 60 * 60 * 1000
const SEARCH_PAGES = 3
const SEARCH_TIMEOUT_MS = 8000

export interface ListEntry {
	media_type: MediaType
	tmdb_id: number
}

type Row = {
	tmdb_id: number
	title: string
	release_year: number | null
	poster_path: string | null
	backdrop_path: string | null
	genres: string[] | null
	score: number | null
}
const COLUMNS = `tmdb_id, title, release_year, poster_path, backdrop_path, genres,
	goodwatch_overall_score_normalized_percent AS score`

const toCardTitle = (type: MediaType, r: Row): CardTitle => ({
	key: titleKey(type, r.tmdb_id),
	type,
	title: r.title,
	year: r.release_year,
	poster: r.poster_path ? `${TMDB_IMAGES}/w500${r.poster_path}` : null,
	backdrop: r.backdrop_path ? `${TMDB_IMAGES}/w1280${r.backdrop_path}` : null,
	genre: r.genres?.[0] ?? null,
	score: r.score == null ? null : Math.round(r.score),
})

export const entryKey = (e: ListEntry) => titleKey(e.media_type, e.tmdb_id)

const TITLE_KEY = /^(movie|show):([1-9]\d{0,9})$/
export function parseTitleKey(key: string): ListEntry | null {
	const match = TITLE_KEY.exec(key)
	if (!match) return null
	const media_type = match[1] as MediaType
	return { media_type, tmdb_id: canonicalTitleId(media_type, Number(match[2])) }
}

/** Card data for the entries, in their order. Entries missing from the catalog are left out. */
export async function resolveCardTitles(entries: ListEntry[]): Promise<CardTitle[]> {
	if (!entries.length) return []
	const found = new Map<string, CardTitle>()
	await Promise.all(
		(["movie", "show"] as const).map(async (type) => {
			const ids = [...new Set(entries.filter((e) => e.media_type === type).map((e) => e.tmdb_id))]
			if (!ids.length) return
			const rows = await query<Row>(`SELECT ${COLUMNS} FROM ${type} WHERE tmdb_id IN (${ids.map(() => "?").join(",")}) AND title IS NOT NULL`, ids)
			for (const r of rows) found.set(titleKey(type, r.tmdb_id), toCardTitle(type, r))
		}),
	)
	return entries.map((e) => found.get(entryKey(e))).filter((t): t is CardTitle => !!t)
}

// Popular titles per list prompt, so nobody starts from an empty search box.
let quickPicks: { at: number; picks: Promise<Record<string, CardTitle[]>> } | null = null

async function loadQuickPicks(): Promise<Record<string, CardTitle[]>> {
	const perPrompt = await Promise.all(
		LIST_PROMPTS.map(async (prompt) => {
			const types = prompt.type === "all" ? (["movie", "show"] as const) : ([prompt.type] as const)
			const lists = await Promise.all(
				types.map(async (type) => {
					const genre = type === "movie" ? prompt.movieGenre : prompt.showGenre
					const rows = await query<Row>(
						`SELECT ${COLUMNS} FROM ${type}
						 WHERE poster_path IS NOT NULL AND goodwatch_overall_score_voting_count >= 20000
						 ${genre ? "AND ? = ANY(genres)" : ""}
						 ORDER BY goodwatch_overall_score_voting_count DESC LIMIT ${QUICK_PICKS}`,
						genre ? [genre] : [],
					)
					return rows.map((r) => toCardTitle(type, r))
				}),
			)
			// Mixed prompts alternate movies and shows.
			const merged = lists.length === 1 ? lists[0] : lists[0].flatMap((movie, i) => [movie, lists[1][i]]).filter(Boolean)
			return [prompt.id, merged.slice(0, QUICK_PICKS)] as const
		}),
	)
	return Object.fromEntries(perPrompt)
}

export function getQuickPicks(): Promise<Record<string, CardTitle[]>> {
	if (!quickPicks || Date.now() - quickPicks.at > QUICK_PICKS_TTL_MS) {
		const picks = loadQuickPicks()
		quickPicks = { at: Date.now(), picks }
		picks.catch(() => {
			quickPicks = null
		})
	}
	return quickPicks.picks
}

type SearchResult = {
	id: number
	media_type: string
	title?: string
	name?: string
	release_date?: string
	first_air_date?: string
	poster_path?: string | null
	backdrop_path?: string | null
}

/** Movies and shows matching the text, from several TMDB search pages, most relevant first. */
export async function searchTitles(text: string, signal?: AbortSignal): Promise<CardTitle[]> {
	const q = text.trim().slice(0, 100)
	if (q.length < 2) return []
	const pages = await Promise.all(
		Array.from({ length: SEARCH_PAGES }, async (_, i) => {
			const params = new URLSearchParams({
				api_key: process.env.TMDB_API_KEY ?? "",
				query: q,
				language: "en-US",
				include_adult: "false",
				page: String(i + 1),
			})
			try {
				const response = await fetch(`https://api.themoviedb.org/3/search/multi?${params}`, {
					signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(SEARCH_TIMEOUT_MS)]) : AbortSignal.timeout(SEARCH_TIMEOUT_MS),
				})
				return response.ok ? (((await response.json()).results ?? []) as SearchResult[]) : []
			} catch {
				return []
			}
		}),
	)
	const seen = new Set<string>()
	const titles: CardTitle[] = []
	for (const r of pages.flat()) {
		if ((r.media_type !== "movie" && r.media_type !== "tv") || !r.poster_path) continue
		const type: MediaType = r.media_type === "tv" ? "show" : "movie"
		const id = canonicalTitleId(type, r.id)
		const key = titleKey(type, id)
		if (seen.has(key)) continue
		seen.add(key)
		titles.push({
			key,
			type,
			title: r.title ?? r.name ?? "",
			year: Number((r.release_date ?? r.first_air_date ?? "").slice(0, 4)) || null,
			poster: `${TMDB_IMAGES}/w500${r.poster_path}`,
			backdrop: r.backdrop_path ? `${TMDB_IMAGES}/w1280${r.backdrop_path}` : null,
			genre: null,
			score: null,
		})
	}
	return titles
}
