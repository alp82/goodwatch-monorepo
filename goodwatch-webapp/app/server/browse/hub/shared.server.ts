// What the hub loads. Read-only.
import { type Family, type Ingredient, sortParts } from "~/domain/browse/address"
import type { Places } from "~/server/browse/places.server"
import { MIN_PAGE } from "~/server/browse/places.server"
import { pageCopy } from "~/domain/browse/copy-lookup"
import type { BestRow, PlaceRef, ShowTitle } from "~/domain/browse/types"
import { type Curated, FAVORITES, FEATURED, ODD, two } from "~/domain/browse/curated"
import { cardCopy, slim } from "~/server/browse/cards.server"

/** A blend as a card: its ingredients, one human line, and a few of its titles. */
export interface HubBlend {
	parts: PlaceRef[]
	pitch?: string
	titles: ShowTitle[]
}

export const homeLede = (atlas: Places) => pageCopy(atlas.kind, "hub", "home")?.lede ?? null

const alive = (atlas: Places, c: Curated) =>
	c.parts.every((p) => atlas.has(p.family, p.slug)) && atlas.count(c.parts) >= MIN_PAGE * 2

/** Hand-picked blends that have a full page today, the two-ingredient ones first: they read at a glance. */
export async function hubBlends(atlas: Places, n: number, titles = 3): Promise<HubBlend[]> {
	const set = two(atlas.kind)
	const picked = [...FAVORITES[set], ...ODD[set], ...FEATURED[set]].filter((c) => alive(atlas, c))
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
			parts: parts.map((p) => atlas.ref(p)),
			pitch: c.pitch,
			titles: titles > 0 ? (await atlas.showcase(c.parts, titles)).map(slim) : [],
		})
	}
	return out
}

/** The blends the Mix sentence starts from, a different one each day. */
export function featuredBlends(atlas: Places): Curated[] {
	const list = FEATURED[two(atlas.kind)].filter((c) => alive(atlas, c))
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

export const shelf = (atlas: Places, family: Family, n?: number): ShelfPlace[] =>
	atlas
		.members(family)
		.slice(0, n)
		.map((m) => ({ place: tidy(m), short: cardCopy(atlas, m)?.short }))

/** The moods from the lightest to the darkest: the order a person can read off a row. */
export function moodsByTone(atlas: Places): ShelfPlace[] {
	const tone = (m: Ingredient) => atlas.dials(m).find((d) => d.key === "tone")?.at ?? 0.5
	return shelf(atlas, "mood")
		.map((s) => ({ s, at: tone(s.place) }))
		.sort((a, b) => a.at - b.at)
		.map((x) => x.s)
}

/**
 * The all-time list, minus titles from this year or last: too new for "of all time", and the one that slips in
 * (a 2026 documentary at number 5) comes from suspect source data. Places renumber, so the ranks stay 1..n.
 */
export const topBest = async (atlas: Places, n: number): Promise<BestRow[]> => {
	const settled = new Date().getFullYear() - 1
	return (await atlas.best({ limit: n + 6 })).rows
		.filter((r) => !r.title.card.release_year || Number(r.title.card.release_year) < settled)
		.slice(0, n)
		.map((r, i) => ({ ...r, rank: i + 1 }))
}
