// Website search is the free-text engine. The old catalog lookup remains the bounded, no-model fallback.
import type { ReadingChip } from "../combined-search/reading-retrieval.server.ts"
import type { GuestTitle } from "./cards.ts"
import { within } from "./respond.server.ts"
import { websiteSearch, SEARCH_TIMEOUT_NOTE } from "./search-engine.server.ts"

export interface SearchResult {
	titles: GuestTitle[]
	note?: string
	reading?: ReadingChip[]
}

/** Leave time for the title fallback, state write and message edit inside the 12-second deferral. */
export async function searchTitles(
	query: string,
	user: string,
	options: {
		engine?: typeof websiteSearch
		fallback?: (query: string) => Promise<GuestTitle[]>
		onReading?: (reading: ReadingChip[]) => void
		timeoutMs?: number
	} = {},
): Promise<SearchResult> {
	const abort = new AbortController()
	let timer: ReturnType<typeof setTimeout> | undefined
	let note = SEARCH_TIMEOUT_NOTE
	let lastReading: ReadingChip[] | undefined
	try {
		const result = await Promise.race([
			(options.engine ?? websiteSearch)(
				query,
				user,
				abort.signal,
				undefined,
				(reading) => {
					if (!abort.signal.aborted) {
						lastReading = reading
						options.onReading?.(reading)
					}
				},
			),
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => {
					abort.abort()
					reject(new Error("Search timed out"))
				}, options.timeoutMs ?? 5000)
			}),
		])
		if (result.titles)
			return {
				titles: result.titles,
				note: result.note,
				...(result.reading ?? lastReading
					? { reading: result.reading ?? lastReading }
					: {}),
			}
		note = result.note ?? note
	} catch {
		abort.abort()
	} finally {
		abort.abort()
		clearTimeout(timer)
	}
	return {
		titles: await within(
			(options.fallback ?? titleMatches)(query),
			2000,
			[],
		).catch(() => []),
		note,
		...(lastReading ? { reading: lastReading } : {}),
	}
}

/** Title fallback results: three pages of ten. Website search keeps its full ranked list. */
export const SEARCH_RESULTS = 30
/** Name matches read before ranking: getDisplayFields takes at most 60 titles. */
const SEARCH_BATCH = 60

export interface SearchCandidate extends GuestTitle {
	/** How many votes the GoodWatch score stands on: how well known the title is. */
	votes?: number | null
}

/**
 * Better known titles first (log of the score votes), with a lead for how closely the name matches: exact names, then
 * names that start with the query, then names that contain it as a word. A 4-minute short called "Dune" stays below
 * Dune: Part Two; between equals the newer title comes first.
 */
export function rankSearchResults(query: string, titles: SearchCandidate[]) {
	const q = query.trim().toLowerCase()
	const word = new RegExp(
		`(^|[^\\p{L}\\p{N}])${q.replace(
			/[.*+?^${}()|[\]\\]/g,
			"\\$&",
		)}($|[^\\p{L}\\p{N}])`,
		"u",
	)
	const lead = (name: string) => {
		const n = name.toLowerCase()
		return n === q ? 2 : n.startsWith(q) ? 1 : word.test(n) ? 0.5 : 0
	}
	return titles
		.map((t, at) => ({
			t,
			at,
			rank: lead(t.name) + Math.log10(Math.max(0, t.votes ?? 0) + 1),
		}))
		.sort(
			(a, b) =>
				b.rank - a.rank || (b.t.year ?? 0) - (a.t.year ?? 0) || a.at - b.at,
		)
		.map(({ t: { votes: _votes, ...title } }) => title)
}

/** The old title-list search, used when ranked search is unavailable or the daily cap is reached. */
export async function titleMatches(query: string): Promise<GuestTitle[]> {
	const [{ lookup, summary }, { getDisplayFields }, { titleKey }] =
		await Promise.all([
			import("../mcp/data.server.ts"),
			import("../title-cards.server"),
			import("../../utils/title-key"),
		])
	const found = await lookup(query, 0, SEARCH_BATCH)
	const displays = await getDisplayFields(
		found.map((t) => titleKey(t.media_type, t.tmdb_id)),
	).catch(() => null)
	return rankSearchResults(
		query,
		found.map((t) => {
			const display = displays?.get(titleKey(t.media_type, t.tmdb_id))
			return {
				...summary(t, "https://goodwatch.app"),
				poster_url: display?.poster_path
					? `https://image.tmdb.org/t/p/w342${display.poster_path}`
					: null,
				runtime_minutes: display?.runtime ?? t.runtime_minutes ?? null,
				goodwatch_score:
					display?.goodwatch_overall_score_normalized_percent ?? null,
				votes: display?.goodwatch_overall_score_voting_count ?? null,
			}
		}),
	).slice(0, SEARCH_RESULTS)
}

/** Posters and scores for titles by ID ("movie:603"), for lists whose read leaves them out (/person, /hot). */
export async function titleDisplays(
	ids: string[],
): Promise<Map<string, Partial<GuestTitle>>> {
	const [{ getDisplayFields }, { titleKey }, { canonicalTitleId }] =
		await Promise.all([
			import("../title-cards.server"),
			import("../../utils/title-key"),
			import("../../utils/title-identity"),
		])
	const keys = new Map(
		ids.slice(0, 60).map((id) => {
			const [kind, raw] = id.split(":")
			const type = kind === "show" ? "show" : "movie"
			return [id, titleKey(type, canonicalTitleId(type, Number(raw)))]
		}),
	)
	const displays = await getDisplayFields([...keys.values()])
	return new Map(
		[...keys].flatMap(([id, key]) => {
			const d = displays.get(key)
			return d
				? [
						[
							id,
							{
								poster_url: d.poster_path
									? `https://image.tmdb.org/t/p/w342${d.poster_path}`
									: null,
								runtime_minutes: d.runtime ?? null,
								goodwatch_score:
									d.goodwatch_overall_score_normalized_percent ?? null,
							},
						],
					]
				: []
		}),
	)
}
