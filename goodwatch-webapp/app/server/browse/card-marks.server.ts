// What a place's identity is drawn from: a mood's position among the moods, a genre's whole fingerprint against the usual, the decades in
// order, and each place's words. The identity cards read it by `family:slug`, so a card looks the same on every page,
// whatever that page's own loader handed it. Read-only.
import type { Family } from "~/domain/browse/address"
import type { Places } from "~/server/browse/places.server"
import type { PlaceRef, PrintFamily } from "~/domain/browse/types"
import { cardCopy } from "~/server/browse/cards.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import { breathe } from "./breathe"
import { createVersionMemo } from "./version-memo"

export interface MarkWord {
	key: string
	word: string
	color: string
}

export interface Marks {
	/** The fingerprint's 74 scores in order: which family each belongs to. */
	bars: { key: string; label: string; family: PrintFamily; color: string }[]
	/** Genre slug → how far each score sits from the usual, in tenths (value - base, fingerprint order). */
	genres: Record<string, number[]>
	/** Mood slug → where it sits among the moods, 0-1: lighter→darker, calmer→intense, grounded→fantastic, easy→demanding. */
	moods: Record<string, { tone: number; pace: number; world: number; mind: number }>
	/** The decades with a page, oldest first (slugs). */
	decades: string[]
	/** `family:slug` → what sets the place apart, as words. */
	words: Record<string, MarkWord[]>
	/** `family:slug` → the copy deck's one line. */
	lines: Record<string, string>
	/** Genre slug → its kinds. */
	kinds: Record<string, { id: string; name: string }[]>
	/** Decade slug → what there was more of than in the decade before. */
	rose: Record<string, { label: string; hue?: string }[]>
	/** Service slug → what it is strong on. */
	goodAt: Record<string, PlaceRef[]>
}

const FAMILIES: Family[] = ["mood", "genre", "decade", "country", "service", "theme", "style"]

const emptyMarks = (): Marks => ({
	bars: [],
	genres: {},
	moods: {},
	decades: [],
	words: {},
	lines: {},
	kinds: {},
	rose: {},
	goodAt: {},
})

async function familyMarks(atlas: Places, family: Family): Promise<Marks> {
	const out = emptyMarks()
	const members = atlas.members(family)
	if (family === "genre")
		out.bars = atlas
			.print([])
			.map((b) => ({ key: b.key, label: b.label, family: b.family, color: b.color }))
	if (family === "decade") out.decades = members.map((d) => d.slug)
	for (const place of members) {
		await breathe()
		const part = [{ family, slug: place.slug }]
		const id = `${family}:${place.slug}`
		out.words[id] = atlas
			.traits(part, { n: 3 })
			.more.map((w) => ({ key: w.key, word: w.word, color: w.color }))
		const line = cardCopy(atlas, place)?.short
		if (line) out.lines[id] = line
		if (family === "genre") {
			out.genres[place.slug] = atlas.print(part).map((b) => Math.round((b.value - b.base) * 10))
			out.kinds[place.slug] = (await atlas.kinds(part, 0)).map((k) => ({
				id: k.id,
				name: k.name,
			}))
		}
		if (family === "mood") {
			const at = Object.fromEntries(atlas.dials(part[0]).map((d) => [d.key, d.at]))
			out.moods[place.slug] = {
				tone: at.tone ?? 0.5,
				pace: at.pace ?? 0.5,
				world: at.world ?? 0.5,
				mind: at.mind ?? 0.5,
			}
		}
		if (family === "decade") {
			const era = await atlas.era(place.slug, 0)
			out.rose[place.slug] = (era?.rose ?? [])
				.slice(0, 3)
				.map((r) => ({ label: r.label, hue: r.place?.hue }))
		}
		if (family === "service")
			out.goodAt[place.slug] = (atlas.serviceProfile(place.slug)?.goodAt ?? [])
				.slice(0, 3)
				.map((g) => g.place)
	}
	return out
}

// A version still keeps six kind/country catalogs. Each family is populated on its first actual use.
const memo = createVersionMemo<Map<Family, Promise<Marks>>>(6)

const select = <T>(record: Record<string, T>, keys: Set<string>): Record<string, T> =>
	Object.fromEntries(Object.entries(record).filter(([key]) => keys.has(key)))

/** The identities drawn by this page's cards. Other families can fill their own slot on a later request. */
export async function loadMarks(
	atlas: Places,
	cards: readonly { place: PlaceRef }[],
): Promise<Marks | null> {
	if (!cards.length) return null
	const version = String(getTitleSnapshot()?.version ?? "none")
	const catalog = memo.get(version, `${atlas.kind}|${atlas.country}`, () => new Map())
	const selected = emptyMarks()
	for (const family of FAMILIES) {
		const places = cards.filter(({ place }) => place.family === family)
		if (!places.length) continue
		let pending = catalog.get(family)
		if (!pending) {
			pending = familyMarks(atlas, family)
			catalog.set(family, pending)
			pending.catch(() => catalog.delete(family))
		}
		const marks = await pending
		const ids = new Set(places.map(({ place }) => `${family}:${place.slug}`))
		const slugs = new Set(places.map(({ place }) => place.slug))
		Object.assign(selected.words, select(marks.words, ids))
		Object.assign(selected.lines, select(marks.lines, ids))
		if (family === "genre") {
			selected.bars = marks.bars
			selected.genres = select(marks.genres, slugs)
			selected.kinds = select(marks.kinds, slugs)
		}
		if (family === "decade") {
			selected.decades = marks.decades
			selected.rose = select(marks.rose, slugs)
		}
		if (family === "mood") selected.moods = select(marks.moods, slugs)
		if (family === "service") selected.goodAt = select(marks.goodAt, slugs)
	}
	return selected
}
