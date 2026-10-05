// Which titles the living room pool shows: the best few for any mood, then a few per mood.
//
// The candidates are the same for everyone: the titles of the snapshot that pass the pool's conditions on one UTC day,
// in popularity order. Building them walks the whole snapshot (about 40 ms locally, about 350 ms on a production
// instance), so the process keeps them per snapshot version and day. They hold nothing about a viewer.
//
// What stays per request: the viewer's seen, skipped, and Want to See titles, which are left out, and the taste order
// for a viewer with a taste. Neither is kept, so a member, a guest with progress, and an anonymous visitor each get
// their own result from the same candidates.
import type { MoodKey } from "~/domain/moods"
import { MOOD_KEYS } from "~/domain/moods"
import type { TitleSnapshot } from "~/server/title-snapshot/snapshot.server"

export const PER_MOOD = 3
export const BEST = 6

export interface PoolCandidate {
	key: number
	popularity: number
	moods: MoodKey[]
}

export interface PoolCandidates {
	version: string
	/** Days since the epoch, UTC: a title released later isn't a candidate yet. */
	today: number
	/** Every candidate, by popularity descending, then key ascending. */
	all: readonly PoolCandidate[]
	/** The candidates with each mood, in the same order. */
	byMood: ReadonlyMap<MoodKey, readonly PoolCandidate[]>
}

let memo: PoolCandidates | null = null

/** The candidates of this snapshot version and day. Walks the snapshot once per version and day, then returns the same object. */
export function poolCandidates(
	snapshot: Pick<TitleSnapshot, "version" | "forEach" | "factsAt">,
	today: number,
): PoolCandidates {
	if (memo?.version === snapshot.version && memo.today === today) return memo
	const all: PoolCandidate[] = []
	snapshot.forEach((key, row) => {
		const facts = snapshot.factsAt(row)
		if (
			!facts ||
			facts.adult ||
			!facts.hasPoster ||
			(facts.releaseDay !== null && facts.releaseDay > today) ||
			(facts.score ?? 0) < 70 ||
			facts.votes < 1000
		)
			return
		all.push({ key, popularity: facts.popularity, moods: facts.moods })
	})
	all.sort((a, b) => b.popularity - a.popularity || a.key - b.key)
	const byMood = new Map<MoodKey, PoolCandidate[]>()
	for (const mood of MOOD_KEYS)
		byMood.set(
			mood,
			all.filter((title) => title.moods.includes(mood)),
		)
	memo = { version: snapshot.version, today, all, byMood }
	return memo
}

/**
 * The pool's keys for one viewer, and each mood's first few. `rankOf` is the viewer's taste order (higher first, ties by
 * popularity), or null to order by popularity. By popularity, each list is read off the front of the candidates. By
 * taste, the viewer's candidates are ranked and sorted on every call.
 */
export function selectPoolKeys(
	candidates: PoolCandidates,
	viewer: {
		seen: ReadonlySet<number>
		skipped: ReadonlySet<number>
	notInterested: ReadonlySet<number>
		wishlist: { has(key: number): boolean }
	},
	rankOf: ((key: number) => number) | null,
): { keys: number[]; byMood: Map<MoodKey, number[]> } {
	const excluded = (key: number) =>
		viewer.notInterested.has(key) || viewer.seen.has(key) || viewer.skipped.has(key) || viewer.wishlist.has(key)
	const keys: number[] = []
	const byMood = new Map<MoodKey, number[]>()
	const add = (list: number[]) => {
		for (const k of list) if (!keys.includes(k)) keys.push(k)
	}
	if (rankOf === null) {
		const first = (titles: readonly PoolCandidate[], count: number) => {
			const list: number[] = []
			for (const { key } of titles) {
				if (excluded(key)) continue
				list.push(key)
				if (list.length === count) break
			}
			return list
		}
		add(first(candidates.all, BEST))
		for (const mood of MOOD_KEYS) {
			const list = first(candidates.byMood.get(mood) ?? [], PER_MOOD + 2)
			byMood.set(mood, list)
			add(list.slice(0, PER_MOOD))
		}
	} else {
		const ranked = []
		for (const { key, popularity, moods } of candidates.all) {
			if (excluded(key)) continue
			ranked.push({ key, rank: rankOf(key), popularity, moods })
		}
		ranked.sort(
			(a, b) => b.rank - a.rank || b.popularity - a.popularity || a.key - b.key,
		)
		add(ranked.slice(0, BEST).map(({ key }) => key))
		for (const mood of MOOD_KEYS) {
			const list = ranked
				.filter((title) => title.moods.includes(mood))
				.slice(0, PER_MOOD + 2)
				.map(({ key }) => key)
			byMood.set(mood, list)
			add(list.slice(0, PER_MOOD))
		}
	}
	return { keys, byMood }
}

export function resetPoolCandidatesForTest() {
	memo = null
}
