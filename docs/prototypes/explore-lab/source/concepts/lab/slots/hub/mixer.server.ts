// PROTOTYPE - throwaway (prototype/explore-r6, slot "hub", variant "mixer"; was round 5 "mix"). The hub led by a
// blend you build in its title: the sentence's ingredients travel in `?mix=mood:cozy,genre:comedy` ("-" is an empty sentence; without it a
// hand-picked blend of the day). The loader returns that blend's titles and, per family, what each further ingredient
// would leave ("full", "thin", "none"), so the shelves under the sentence only offer what works.
import { FAMILIES, type Family, type Ingredient, same, sortParts } from "../../../../kit/address"
import { MIN_PAGE } from "../../../../kit/data.server"
import type { PlaceRef, ShowTitle, TraitWord } from "../../../../kit/types"
import { pitchFor } from "../../../blend/curated"
import { shortsOf } from "../../../blend/loader.server"
import type { SlotLoader } from "../../contract"
import {
	type HubBlend,
	type ShelfPlace,
	featuredBlends,
	hubBlends,
	moodsByTone,
	shelf,
} from "./shared.server"

export const MIX_PARAM = "mix"
export const idOf = (p: Ingredient) => `${p.family}:${p.slug}`

export interface MixOption extends ShelfPlace {
	/** "in": already in the sentence. Otherwise what adding it leaves. */
	state: "in" | "full" | "thin" | "none"
}

export interface MixData {
	parts: PlaceRef[]
	/** How many well-known titles are all of it at once (for decisions, never shown). */
	count: number
	pitch?: string
	/** What only this blend has, as words. */
	traits: TraitWord[]
	titles: ShowTitle[]
	swaps: { part: PlaceRef; options: PlaceRef[] }[]
	shorts: Record<string, string>
	/** The next hand-picked blend, for "Another one". */
	next: Ingredient[] | null
	shelves: { family: Family; options: MixOption[] }[]
	blends: HubBlend[]
	streamingReady: boolean
}

const tidyRef = (ref: PlaceRef): PlaceRef =>
	ref.code === "HK" ? { ...ref, label: "Hong Kong" } : ref

const SHELVES: Family[] = ["mood", "genre", "decade", "country", "service"]

export const load: SlotLoader<MixData> = async ({ kit, url }) => {
	const featured = featuredBlends(kit)
	const raw = url.searchParams.get(MIX_PARAM)
	const asked: Ingredient[] | null =
		raw === null
			? null
			: raw
					.split(",")
					.filter(Boolean)
					.flatMap((s) => {
						const [family, slug] = s.split(":") as [Family, string]
						return FAMILIES.includes(family) && slug && kit.has(family, slug)
							? [{ family, slug }]
							: []
					})
	// The kit's own slugs: with movies and shows together "science-fiction" is "sci-fi-fantasy".
	const parts = sortParts(
		(asked ?? featured[0]?.parts ?? []).map((p) => ({ family: p.family, slug: kit.ref(p).slug })),
	)
	const id = parts.map(idOf).join("+")
	const at = featured.findIndex(
		(f) =>
			sortParts(f.parts.map((p) => ({ family: p.family, slug: kit.ref(p).slug })))
				.map(idOf)
				.join("+") === id,
	)
	const next = featured.length > 1 ? featured[(at + 1) % featured.length].parts : null

	const count = kit.count(parts)
	// The sentence's own titles come first: they are the page's lead.
	const titles = parts.length ? await kit.showcase(parts, 18) : await kit.popular(18)
	const blend = parts.length ? await kit.blend(parts, { suggestions: 0, titles: 0 }) : null
	const traits = blend?.traits.length
		? blend.traits.slice(0, 3)
		: parts.length
			? kit.traits(parts, { n: 3 }).more
			: []

	const shelves = SHELVES.map((family) => {
		const places =
			family === "mood"
				? moodsByTone(kit)
				: shelf(kit, family, family === "country" ? 14 : family === "service" ? 10 : undefined)
		// An ingredient of the sentence that the row would not reach leads it, so it can be seen and taken out.
		for (const p of parts)
			if (p.family === family && !places.some((s) => same(s.place, p)))
				places.unshift({ place: tidyRef(kit.ref(p)) })
		return {
			family,
			options: places.map((s): MixOption => {
				if (parts.some((p) => same(p, s.place))) return { ...s, state: "in" }
				if (!parts.length) return { ...s, state: "full" }
				const n = kit.count([...parts, s.place])
				return { ...s, state: n >= MIN_PAGE ? "full" : n > 0 ? "thin" : "none" }
			}),
		}
	}).filter((s) => s.options.length > 0)

	return {
		parts: parts.map((p) => kit.ref(p)),
		count,
		pitch: pitchFor(kit.kind, parts),
		traits,
		titles,
		swaps: blend?.swaps ?? [],
		shorts: shortsOf(kit, parts),
		next,
		shelves,
		blends: await hubBlends(kit, 4),
		streamingReady: kit.streamingReady,
	}
}
