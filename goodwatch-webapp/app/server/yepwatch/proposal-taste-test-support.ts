import type { Profile, ProfileStore } from "./proposal-taste-profile.ts"
import type { TitleSnapshot } from "../title-snapshot/snapshot.server.ts"
import type { TasteCard } from "../../../packages/yepwatch-contracts/proposal.ts"
export class MemoryProfileStore implements ProfileStore {
	rows = new Map<string, { profile: Profile; seq: number; term: number }>()
	reads = 0
	async read(ids: string[]) {
		this.reads++
		return structuredClone(
			ids.flatMap((id) => (this.rows.has(id) ? [this.rows.get(id)!] : []))
		)
	}
	async save(profile: Profile, old: { seq: number; term: number } | null) {
		const current = this.rows.get(profile.id)
		if (old ? current?.seq !== old.seq : Boolean(current)) return false
		this.rows.set(profile.id, {
			profile: structuredClone(profile),
			seq: (current?.seq ?? 0) + 1,
			term: 1,
		})
		return true
	}
	async delete(id: string) {
		this.rows.delete(id)
	}
	async expire(now: number) {
		for (const [id, row] of this.rows)
			if (row.profile.expires_at <= now) this.rows.delete(id)
	}
}
export const key = (i: number, movie = true) => (movie ? 1e12 : 2e12) + i
/** Ten distinct fingerprint regions, each with multiple movies and shows. */
export function tasteFixture(): TitleSnapshot {
	const entries = Array.from({ length: 40 }, (_, i) => {
		const fp = new Uint8Array(74)
		fp[Math.floor(i / 4)] = 10
		return { key: key(i + 1, i % 4 < 2), fp, votes: 100000 - i * 100 }
	})
	const byKey = new Map(entries.map((e, i) => [e.key, i]))
	const factsAt = (i: number) => ({
		key: entries[i].key,
		tmdbId: i + 1,
		mediaType: i % 4 < 2 ? "movie" : "show",
		genres: [],
		releaseDay: 19000,
		score: 80,
		votes: entries[i].votes,
		popularity: 1,
		origin: null,
		hasPoster: true,
		hasBackdrop: true,
		adult: false,
		anime: false,
		moods: [],
	})
	return {
		version: "taste-synthetic-10",
		builtAt: new Date("2026-01-01"),
		count: entries.length,
		forEach: (fn: (key: number, row: number) => void) =>
			entries.forEach((e, i) => fn(e.key, i)),
		fingerprint: (k: number) => entries[byKey.get(k) ?? -1]?.fp ?? null,
		fingerprintAt: (i: number) => entries[i].fp,
		factsAt,
		facts: (k: number) => (byKey.has(k) ? factsAt(byKey.get(k)!) : null),
	} as unknown as TitleSnapshot
}
export async function tasteDisplays(
	keys: number[]
): Promise<Map<number, TasteCard>> {
	return new Map(
		keys.map((k) => [
			k,
			{
				key: k,
				title: `Title ${k}`,
				year: 2020,
				posterUrl: "/poster.jpg",
				mediaType: k < 2e12 ? "movie" : "tv",
				overview: null,
				runtimeMinutes: 100,
			},
		])
	)
}
