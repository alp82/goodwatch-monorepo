// PROTOTYPE - throwaway (prototype/explore-r5, slot "hub"). What the hub variants load the same way. Read-only.
import { type Family, type Ingredient, sortParts } from "../../../../kit/address"
import type { Kit } from "../../../../kit/data.server"
import { MIN_PAGE } from "../../../../kit/data.server"
import { pageCopy } from "../../../../kit/optional"
import type { BestRow, PlaceRef, ShowTitle } from "../../../../kit/types"
import { type Curated, FAVORITES, FEATURED, ODD, two } from "../../../blend/curated"
import { cardCopy, slim } from "../../cards.server"

/** A blend as a card: its ingredients, one human line, and a few of its titles. */
export interface HubBlend {
	parts: PlaceRef[]
	pitch?: string
	titles: ShowTitle[]
}

export const homeLede = (kit: Kit) => pageCopy(kit.kind, "hub", "home")?.lede ?? null

const alive = (kit: Kit, c: Curated) =>
	c.parts.every((p) => kit.has(p.family, p.slug)) && kit.count(c.parts) >= MIN_PAGE * 2

/** Hand-picked blends that have a full page today, the two-ingredient ones first: they read at a glance. */
export async function hubBlends(kit: Kit, n: number, titles = 3): Promise<HubBlend[]> {
	const set = two(kit.kind)
	const picked = [...FAVORITES[set], ...ODD[set], ...FEATURED[set]].filter((c) => alive(kit, c))
	// Mixed so two neighbors don't start with the same ingredient.
	const out: HubBlend[] = []
	const seen = new Set<string>()
	const firsts = new Map<string, number>()
	for (const c of picked) {
		if (out.length >= n) break
		const parts = sortParts(c.parts)
		const id = parts.map((p) => `${p.family}:${p.slug}`).join("+")
		const lead = `${parts[0].family}:${parts[0].slug}`
		if (seen.has(id) || (firsts.get(lead) ?? 0) >= 1) continue
		seen.add(id)
		firsts.set(lead, (firsts.get(lead) ?? 0) + 1)
		out.push({
			parts: parts.map((p) => kit.ref(p)),
			pitch: c.pitch,
			titles: titles > 0 ? (await kit.showcase(c.parts, titles)).map(slim) : [],
		})
	}
	return out
}

/** The blends the Mix sentence starts from, a different one each day. */
export function featuredBlends(kit: Kit): Curated[] {
	const list = FEATURED[two(kit.kind)].filter((c) => alive(kit, c))
	const lead = Math.floor(Date.now() / 86_400_000) % Math.max(1, list.length)
	return [...list.slice(lead), ...list.slice(0, lead)]
}

/** A place on a shelf: its name, mark and one line. No titles. */
export interface ShelfPlace {
	place: PlaceRef
	short?: string
}

/** The catalog's long name for Hong Kong reads badly in a row. */
const tidy = (ref: PlaceRef): PlaceRef => (ref.code === "HK" ? { ...ref, label: "Hong Kong" } : ref)

export const shelf = (kit: Kit, family: Family, n?: number): ShelfPlace[] =>
	kit
		.members(family)
		.slice(0, n)
		.map((m) => ({ place: tidy(m), short: cardCopy(kit, m)?.short }))

/** The moods from the lightest to the darkest: the order a person can read off a row. */
export function moodsByTone(kit: Kit): ShelfPlace[] {
	const tone = (m: Ingredient) => kit.dials(m).find((d) => d.key === "tone")?.at ?? 0.5
	return shelf(kit, "mood")
		.map((s) => ({ s, at: tone(s.place) }))
		.sort((a, b) => a.at - b.at)
		.map((x) => x.s)
}

/**
 * The all-time list, minus titles from this year or last: too new for "of all time", and the one that slips in
 * (a 2026 documentary at number 5) comes from suspect source data. Places renumber, so the ranks stay 1..n.
 */
export const topBest = async (kit: Kit, n: number): Promise<BestRow[]> => {
	const settled = new Date().getFullYear() - 1
	return (await kit.best({ limit: n + 6 })).rows
		.filter((r) => !r.title.card.release_year || Number(r.title.card.release_year) < settled)
		.slice(0, n)
		.map((r, i) => ({ ...r, rank: i + 1 }))
}
