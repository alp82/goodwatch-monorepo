// PROTOTYPE - throwaway (prototype/explore-r5). What a place's identity is drawn from, for every place of every
// family at once: a mood's position among the moods, a genre's whole fingerprint against the usual, the decades in
// order, and each place's words. The identity cards read it by `family:slug`, so a card looks the same on every page,
// whatever that page's own loader handed it. Read-only.
import type { Family } from "../../../../kit/address"
import type { Kit } from "../../../../kit/data.server"
import type { PlaceRef, PrintFamily } from "../../../../kit/types"
import { cardCopy } from "../../cards.server"
import type { SlotLoader } from "../../contract"

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

export async function marksOf(kit: Kit): Promise<Marks> {
	const out: Marks = {
		bars: kit
			.print([])
			.map((b) => ({ key: b.key, label: b.label, family: b.family, color: b.color })),
		genres: {},
		moods: {},
		decades: kit.members("decade").map((d) => d.slug),
		words: {},
		lines: {},
		kinds: {},
		rose: {},
		goodAt: {},
	}
	for (const family of FAMILIES)
		for (const place of kit.members(family)) {
			const part = [{ family, slug: place.slug }]
			const id = `${family}:${place.slug}`
			out.words[id] = kit
				.traits(part, { n: 3 })
				.more.map((w) => ({ key: w.key, word: w.word, color: w.color }))
			const line = cardCopy(kit, place)?.short
			if (line) out.lines[id] = line
			if (family === "genre") {
				out.genres[place.slug] = kit.print(part).map((b) => Math.round((b.value - b.base) * 10))
				out.kinds[place.slug] = (await kit.kinds(part, 0)).map((k) => ({ id: k.id, name: k.name }))
			}
			if (family === "mood") {
				const at = Object.fromEntries(kit.dials(part[0]).map((d) => [d.key, d.at]))
				out.moods[place.slug] = {
					tone: at.tone ?? 0.5,
					pace: at.pace ?? 0.5,
					world: at.world ?? 0.5,
					mind: at.mind ?? 0.5,
				}
			}
			if (family === "decade") {
				const era = await kit.era(place.slug, 0)
				out.rose[place.slug] = (era?.rose ?? [])
					.slice(0, 3)
					.map((r) => ({ label: r.label, hue: r.place?.hue }))
			}
			if (family === "service")
				out.goodAt[place.slug] = (kit.serviceProfile(place.slug)?.goodAt ?? [])
					.slice(0, 3)
					.map((g) => g.place)
		}
	return out
}

/** The loader every identity card variant shares. */
export const loadMarks: SlotLoader<Marks> = async ({ kit }) => {
	const started = performance.now()
	const marks = await marksOf(kit)
	const ms = performance.now() - started
	if (ms > 150) console.info(`[lab card] marks ${Math.round(ms)} ms`)
	return marks
}
