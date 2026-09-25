// Shadow mode (SEARCH_RANKING_MODE=shadow): the current ranking serves every search as before. After the response is
// sent, the new ranking ranks the same search, and its list, stage timings and trace go to Crate (search_shadow) next
// to the served list, joined to search_history by its id.
//
// The served search never waits for this, and nothing here throws: every error is caught and logged. At most
// MAX_RUNNING searches rank at a time; others are skipped, as are searches while the models or the index are still
// loading, or while the encoder's queue is full. A skipped search still gets a row, with the reason.
//
// Nothing from the query text is stored in plain text: the encoded texts, the reference's names and the profile
// terms are sealed with SEARCH_STORAGE_KEY, like the query in search_history.
import type { SystemOneResult, Questions } from "@typesafe-ai/sdk"
import { searchQuery } from "../combined-search/catalog.server.ts"
import {
	type Eligibility,
	readingFields,
} from "../combined-search/reading-retrieval.server.ts"
import { getSearchStore } from "../search-runtime/runtime.server.ts"
import { getSearchRankingMode } from "./mode.server.ts"
import { queryEncoderState, startQueryEncoder } from "./query-encoder.server.ts"
import { type RankedSearch, rankSearch } from "./rank-search.server.ts"
import {
	loadedSearchIndexBuild,
	startSearchIndex,
} from "./search-index.server.ts"
import type { TitleLookupRow } from "./title-blend.server.ts"

const MAX_RUNNING = 2
const SERVED_KEYS = 50
const TMDB_ID_RANGE = 1_000_000_000_000

let running = 0
let started = false

/** At server start: loads the index and the query models in the background in modes shadow and on. */
export function startShadowRanking(): void {
	if (started || getSearchRankingMode() === "off") return
	started = true
	startSearchIndex()
	startQueryEncoder().then(
		(startup) =>
			console.info(
				`Search shadow ranking: query models ready in ${Math.round(startup.totalMs)} ms`,
			),
		() => {
			// Logged by the encoder; it retries on a later search.
		},
	)
}

export interface ShadowSearch {
	historyId: string | null
	query: string
	/** The text the reading used, and whether the language step routed it away from English. */
	text: string
	nonEnglish: boolean
	nativeOnly: boolean
	readings: [SystemOneResult<Questions>, SystemOneResult<Questions>] | null
	eligibility: Eligibility
	titleLookup: TitleLookupRow[]
	servedRankerVersion: string
	servedKeys: string[]
}

const round1 = (ms: number) => Math.round(ms * 10) / 10
const rounded = (timings: Record<string, number>) =>
	Object.fromEntries(
		Object.entries(timings).map(([name, ms]) => [name, round1(ms)]),
	)

const keyOf = (id: number, mediaType: string) =>
	`${mediaType}:${id % TMDB_ID_RANGE}`

/** The display fields the new ranking would need to show its list (it returns ids and titles only). */
async function displayFields(keys: string[]): Promise<number> {
	const started = performance.now()
	await Promise.all(
		(["movie", "show"] as const).map((type) => {
			const ids = keys
				.filter((k) => k.startsWith(`${type}:`))
				.map((k) => Number(k.slice(type.length + 1)))
			if (!ids.length) return Promise.resolve([])
			return searchQuery(
				`SELECT tmdb_id, title, release_year, poster_path, genres, adult, imdb_id, goodwatch_overall_score_voting_count FROM ${type} WHERE tmdb_id IN (${ids.map(() => "?").join(",")})`,
				ids,
			)
		}),
	)
	return performance.now() - started
}

/** The trace, cut to what a comparison needs: the signals of the top list, not of every candidate. */
function sealedTrace(ranked: RankedSearch) {
	const trace = ranked.trace
	if (!trace) return { reference: ranked.reference }
	const top = new Set(trace.discovery.map(([id]) => id))
	const rows = trace.candidates
		.map(([id], i) => (top.has(id) ? i : -1))
		.filter((i) => i >= 0)
	return {
		reference: ranked.reference,
		texts: trace.texts,
		discovery: trace.discovery,
		signals: {
			ids: rows.map((i) => trace.candidates[i][0]),
			...Object.fromEntries(
				Object.entries(trace.signals).map(([name, values]) => [
					name,
					rows.map((i) => Math.round(values[i] * 1e4) / 1e4),
				]),
			),
		},
		candidates: trace.candidates.length,
		profileTerms: trace.profileTerms,
		seeds: trace.seeds,
		own: trace.own?.length ?? null,
		scored: trace.scored,
		filtered: trace.filtered,
		era: trace.era,
	}
}

async function record(
	search: ShadowSearch,
	row: Omit<
		Parameters<ReturnType<typeof getSearchStore>["shadow"]>[0],
		"historyId" | "servedRankerVersion" | "lesserKnown" | "servedKeys"
	>,
) {
	await getSearchStore().shadow({
		historyId: search.historyId,
		servedRankerVersion: search.servedRankerVersion,
		lesserKnown: search.eligibility.lesserKnown,
		servedKeys: search.servedKeys.slice(0, SERVED_KEYS),
		...row,
	})
}

async function run(search: ShadowSearch, queuedAt: number) {
	const waited = performance.now() - queuedAt
	try {
		const ranked = await rankSearch(
			readingFields(
				search.text,
				search.readings as NonNullable<ShadowSearch["readings"]>,
				search.nativeOnly,
			),
			{
				query: search.query,
				text: search.text,
				nonEnglish: search.nonEnglish,
				titleLookup: search.titleLookup,
				trace: true,
			},
			search.eligibility,
		)
		const rankedKeys = ranked.results.map((r) => keyOf(r.id, r.mediaType))
		const display = await displayFields(rankedKeys)
		await record(search, {
			outcome: "ranked",
			rankerVersion: ranked.rankerVersion,
			buildId: ranked.buildId,
			route: ranked.route,
			rankedKeys,
			rankedScores: ranked.results.map((r) => r.score),
			poolSize: ranked.poolSize,
			stageMs: rounded({ ...ranked.timings, display, waited }),
			rounds: ranked.rounds.map((r) => ({
				...r,
				serverMs: round1(r.serverMs),
				wallMs: round1(r.wallMs),
			})),
			sealed: sealedTrace(ranked),
		})
	} catch (error) {
		console.error("Search shadow ranking failed", error)
		await record(search, {
			outcome: "failed",
			reason: (error instanceof Error ? error.message : String(error)).slice(
				0,
				200,
			),
			stageMs: { waited: round1(waited) },
		}).catch((e) => console.error("Search shadow row not written", e))
	}
}

function skip(search: ShadowSearch, reason: string) {
	record(search, { outcome: "skipped", reason }).catch((error) =>
		console.error("Search shadow row not written", error),
	)
}

/**
 * Ranks a served search with the new ranking in the background. Call it after the response is sent. Returns at once
 * and never throws.
 */
export function shadowRank(search: ShadowSearch): void {
	try {
		if (getSearchRankingMode() === "off") return
		startShadowRanking()
		const encoder = queryEncoderState()
		const reason = !search.readings
			? "no reading"
			: !loadedSearchIndexBuild()
				? "index not loaded"
				: !encoder.ready
					? "encoder not ready"
					: encoder.pending >= encoder.maxPending
						? "encoder queue full"
						: running >= MAX_RUNNING
							? "busy"
							: null
		if (reason) {
			skip(search, reason)
			return
		}
		running++
		const queuedAt = performance.now()
		setImmediate(() => {
			run(search, queuedAt).finally(() => {
				running--
			})
		})
	} catch (error) {
		console.error("Search shadow ranking not started", error)
	}
}
