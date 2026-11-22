// A place's defining tropes: not the tropes it has most of
// (every place has Chekhov's Gun), the ones it has far more often than the catalog does. Lift = the trope's share
// inside the place over its share in the whole catalog, weighted a little by how many titles carry it, so one odd
// title can't define a place. Computed once per kind and snapshot, then served from memory.
import type { Ingredient } from "~/domain/browse/address"
import { ing } from "~/domain/browse/address"
import type { Places } from "~/server/browse/places.server"
import { TROPES, groupOf } from "~/domain/tropes/catalog"
import { ensureTropes, tropesVersion } from "~/server/browse/tropes.server"
import { breathe } from "~/server/browse/breathe"

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

const cache = new Map<string, TropeTag[]>()

/** Up to `n` tropes that define a place, the most distinctive first. Empty before the memberships are read. */
export async function definingTropes(atlas: Places, part: Ingredient, n = 2): Promise<TropeTag[]> {
	const version = tropesVersion()
	if (!version) return []
	const all = atlas.count([])
	const id = `${atlas.kind}|${all}|${version}|${part.family}:${part.slug}|${n}`
	const hit = cache.get(id)
	if (hit) return hit
	const mine = atlas.count([part])
	if (mine < 24) return []
	const scored: { t: (typeof TROPES)[number]; score: number }[] = []
	for (const t of TROPES) {
		// Counts, not row sets: a pair count reads the smaller set against the other's mask, and each step lets
		// other requests run (a hub asks this for every place it shows).
		await breathe()
		const trope = ing("trope", t.slug)
		const size = atlas.count([trope])
		if (size < 12) continue
		const both = atlas.count([part, trope])
		// At least a handful of titles, and at least 3% of the place: a defining trope is one you meet there.
		if (both < Math.max(6, mine * 0.03)) continue
		const lift = both / mine / (size / all)
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
