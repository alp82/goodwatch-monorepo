import type { TitleKey } from "~/utils/title-key"
import { catalogRows } from "./title-filter/order.server"
// Pure snapshot selection, also used by the offline inspection script. Cache only keys, never viewer cards.
import type { TitleSnapshot } from "./title-snapshot/snapshot.server"

let cached: { version: string; keys: readonly TitleKey[] } | null = null

export function starterBucket(snapshot: TitleSnapshot, key: TitleKey): string {
	const facts = snapshot.facts(key)
	return JSON.stringify([
		facts?.mediaType,
		facts?.origin ?? null,
		facts?.moods[0] ?? null,
	])
}

/** Popular, well-rated titles in distinct buckets, alternating movies and shows (movie first). */
export function starterTitleKeys(snapshot: TitleSnapshot): readonly TitleKey[] {
	if (cached?.version === snapshot.version) return cached.keys
	const pools: Record<"movie" | "show", TitleKey[]> = { movie: [], show: [] }
	const buckets = new Set<string>()
	for (const row of catalogRows(snapshot, "popular").rows) {
		const facts = snapshot.factsAt(row)
		if (facts.score === null || facts.score < 75 || facts.votes < 100_000)
			continue
		const key = snapshot.columns.pointIds[row]
		const bucket = starterBucket(snapshot, key)
		if (buckets.has(bucket)) continue
		buckets.add(bucket)
		if (pools[facts.mediaType].length < 6) pools[facts.mediaType].push(key)
		if (pools.movie.length === 6 && pools.show.length === 6) break
	}
	const keys: TitleKey[] = []
	for (let i = 0; i < 6; i++) {
		// Keep the alternation if a small snapshot cannot supply six of each kind.
		if (pools.movie[i] === undefined) break
		keys.push(pools.movie[i])
		if (pools.show[i] === undefined) break
		keys.push(pools.show[i])
	}
	cached = { version: snapshot.version, keys: Object.freeze(keys) }
	return cached.keys
}
