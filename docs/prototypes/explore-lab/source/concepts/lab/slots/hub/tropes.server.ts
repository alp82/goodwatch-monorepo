// PROTOTYPE - throwaway (prototype/explore-r7, slot "hub"). A place's defining tropes: not the tropes it has most of
// (every place has Chekhov's Gun), the ones it has far more often than the catalog does. Lift = the trope's share
// inside the place over its share in the whole catalog, weighted a little by how many titles carry it, so one odd
// title can't define a place. Computed once per kind and snapshot, then served from memory.
import type { Ingredient } from "../../../../kit/address"
import { ing } from "../../../../kit/address"
import type { Kit } from "../../../../kit/data.server"
import { TROPES, groupOf } from "../../../../kit/tropes"
import { ensureTropes, tropesVersion } from "../../../../kit/tropes.server"

export interface TropeTag {
	slug: string
	label: string
	hue: string
}

/** Waits for the trope memberships, at most `ms` (a cold process reads them once, about four seconds). */
export async function tropesReady(ms = 6000): Promise<boolean> {
	let done = false
	await Promise.race([
		ensureTropes().then(() => {
			done = true
		}),
		new Promise((r) => setTimeout(r, ms)),
	])
	return done && tropesVersion() > 0
}

// The kit keeps a place's rows private; the blend Venn reads them the same way.
type RowsKit = { rows(parts: Ingredient[]): number[] }
const rowsOf = (kit: Kit, parts: Ingredient[]) => (kit as unknown as RowsKit).rows(parts)

const cache = new Map<string, TropeTag[]>()

/** Up to `n` tropes that define a place, the most distinctive first. Empty before the memberships are read. */
export function definingTropes(kit: Kit, part: Ingredient, n = 2): TropeTag[] {
	const version = tropesVersion()
	if (!version) return []
	const all = rowsOf(kit, [])
	const id = `${kit.kind}|${all.length}|${version}|${part.family}:${part.slug}|${n}`
	const hit = cache.get(id)
	if (hit) return hit
	const mine = rowsOf(kit, [part])
	if (mine.length < 24) return []
	const inside = new Set(mine)
	const scored: { t: (typeof TROPES)[number]; score: number }[] = []
	for (const t of TROPES) {
		const rows = rowsOf(kit, [ing("trope", t.slug)])
		if (rows.length < 12) continue
		let both = 0
		for (const r of rows) if (inside.has(r)) both++
		// At least a handful of titles, and at least 3% of the place: a defining trope is one you meet there.
		if (both < Math.max(6, mine.length * 0.03)) continue
		const lift = both / mine.length / (rows.length / all.length)
		if (lift < 1.7) continue
		scored.push({ t, score: lift * Math.log(both) })
	}
	const out = scored
		.sort((a, b) => b.score - a.score)
		.slice(0, n)
		.map(({ t }) => ({ slug: t.slug, label: t.label, hue: groupOf(t.group).color }))
	if (cache.size > 2000) cache.clear()
	cache.set(id, out)
	return out
}
