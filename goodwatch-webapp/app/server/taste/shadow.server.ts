// Shadow mode (REC_TASTE_MATCH=shadow): after "Recommended for you" asks Qdrant's recommend API, compare its list with
// the top 50 the stored taste vector ranks under the same filter, in memory, and log the overlap. The #174 research
// expects about 0.62 for 50 titles. Nothing a person sees changes.
import {
	type TitleKey,
	type TitleSnapshot,
	getTitleSnapshot,
} from "~/server/title-snapshot/index.server"
import { titleKey } from "~/utils/title-key"
import { loadMemberTaste } from "./member.server"

const TOP = 50

export interface RecommendedList {
	userId: string
	mediaType: "movie" | "show" | "all"
	/** The recommend call's filter: at least this many votes and this GoodWatch score, a poster and a backdrop. */
	minVotes: number
	minScore: number
	/** Titles the recommend call excluded (scored, skipped, watched, Want to See). */
	excluded: { media_type: string; tmdb_id: number }[]
	/** The recommend API's titles, in its order. */
	recommended: TitleKey[]
}

// The rows that pass the recommend filter, per snapshot version and filter.
let candidates: { id: string; rows: Int32Array } | null = null

function candidateRows(
	snapshot: TitleSnapshot,
	minVotes: number,
	minScore: number,
): Int32Array {
	const id = `${snapshot.version}:${minVotes}:${minScore}`
	if (candidates?.id === id) return candidates.rows
	const rows: number[] = []
	snapshot.forEach((_key, row) => {
		const facts = snapshot.factsAt(row)
		if (
			facts.votes >= minVotes &&
			(facts.score ?? -1) >= minScore &&
			facts.hasPoster &&
			facts.hasBackdrop
		)
			rows.push(row)
	})
	candidates = { id, rows: Int32Array.from(rows) }
	return candidates.rows
}

/** Logs the overlap; never throws. Call without awaiting. */
export async function logRecommendedOverlap(
	list: RecommendedList,
): Promise<void> {
	try {
		const startedAt = performance.now()
		const snapshot = getTitleSnapshot()
		if (!snapshot || list.recommended.length === 0) return
		const taste = await loadMemberTaste(list.userId)
		const who = list.userId.slice(0, 8)
		if (!taste.vector) {
			console.info(
				`[Taste shadow] Recommended for you, ${who}: no stored taste (${taste.liked} liked titles)`,
			)
			return
		}
		const vector = taste.vector
		const excluded = new Set(
			list.excluded.map((item) =>
				titleKey(item.media_type as "movie" | "show", Number(item.tmdb_id)),
			),
		)
		const keys: TitleKey[] = []
		const cosines: number[] = []
		for (const row of candidateRows(snapshot, list.minVotes, list.minScore)) {
			const facts = snapshot.factsAt(row)
			if (list.mediaType !== "all" && facts.mediaType !== list.mediaType)
				continue
			const key = titleKey(facts.mediaType, facts.tmdbId)
			if (excluded.has(key)) continue
			const cosine = snapshot.cosineAt(row, vector)
			if (cosine === null) continue
			keys.push(key)
			cosines.push(cosine)
		}
		const ranked = keys
			.map((_, i) => i)
			.sort((a, b) => cosines[b] - cosines[a])
			.map((i) => keys[i])
		const n = list.recommended.length
		const top = new Set(ranked.slice(0, TOP))
		const topN = new Set(ranked.slice(0, n))
		const inTop = list.recommended.filter((key) => top.has(key)).length
		const inTopN = list.recommended.filter((key) => topN.has(key)).length
		console.info(
			`[Taste shadow] Recommended for you, ${who}: ${inTop} of the recommend API's ${n} titles are in the stored vector's top ${TOP} (overlap ${(inTop / n).toFixed(2)}), ${inTopN} in its top ${n} (${(inTopN / n).toFixed(2)}); ${keys.length} candidates, ${Math.round(performance.now() - startedAt)} ms`,
		)
	} catch (error) {
		console.error("[Taste shadow] comparison failed:", error)
	}
}
