// PROTOTYPE - throwaway (prototype/explore-r4, concept "blend"). The data of every Blend page. Read-only; everything
// comes from the data kit. `?peek=1` on any place or Best address returns only a few posters of what that blend holds,
// for the pantry's preview.
import {
	FAMILIES,
	FAMILY,
	type Address,
	type Family,
	type Ingredient,
	same,
	sortParts,
} from "../../kit/address"
import type { ConceptLoader } from "../../kit/contract"
import { type Kit, MIN_PAGE } from "../../kit/data.server"
import { copyFor, pageCopy } from "../../kit/optional"
import type {
	AwardWin,
	BestList,
	KindOf,
	Person,
	PlaceRef,
	ShowTitle,
	TitleList,
	TraitWord,
} from "../../kit/types"
import { BEST_STARTS, type Curated, FAVORITES, FEATURED, ODD, two } from "./curated"

/** The families an ingredient can come from (traits are the dials concept's). */
export const PANTRY_FAMILIES: Family[] = FAMILIES.filter((f) => f !== "trait")

export interface PantryOption {
	place: PlaceRef
	/** "full": a whole page; "thin": a handful; "none": nothing is all of it at once. */
	state: "full" | "thin" | "none"
}
export interface PantryGroup {
	family: Family
	options: PantryOption[]
}
export interface Suggest {
	place: PlaceRef
	titles: ShowTitle[]
}
export interface BlendCardData {
	parts: PlaceRef[]
	pitch?: string
	titles: ShowTitle[]
}
export interface PairLink {
	a: PlaceRef
	b: PlaceRef
	/** How often the two turn up together, against chance. */
	strength: "often" | "sometimes" | "rarely"
	/** 0-1, for the glyph's overlap. */
	share: number
}
export interface Loosen {
	parts: PlaceRef[]
	dropped: PlaceRef
	titles: ShowTitle[]
}
export interface StartPlace {
	place: PlaceRef
	titles: ShowTitle[]
	line?: string
	/** How many titles the place has (the map's emphasis; never shown). */
	weight?: number
}

export type BlendData =
	| { view: "peek"; titles: ShowTitle[] }
	| {
			view: "hub"
			lede: string | null
			features: BlendCardData[]
			favorites: BlendCardData[]
			odd: BlendCardData[]
			popular: ShowTitle[]
			startFamily: Family
			startFamilies: Family[]
			start: StartPlace[]
			startMore: number
			best: BestList
			bestStarts: PlaceRef[]
	  }
	| {
			view: "family"
			family: Family
			lede: string | null
			places: StartPlace[]
			pantry: PantryGroup[]
	  }
	| {
			view: "place"
			parts: PlaceRef[]
			count: number
			narrow: boolean
			lede: string | null
			shorts: Record<string, string>
			more: TraitWord[]
			less: TraitWord[]
			together: TraitWord[]
			venn: { a: number; both: number; b: number } | null
			pairs: PairLink[]
			suggestions: Suggest[]
			swaps: { part: PlaceRef; options: PlaceRef[] }[]
			pantry: PantryGroup[]
			defining: ShowTitle[]
			kinds: KindOf[]
			people: Person[]
			awards: AwardWin[]
			list: TitleList
			loosen: Loosen[]
			hasBest: boolean
	  }
	| {
			view: "best"
			parts: PlaceRef[]
			year: number | null
			best: BestList
			page: number
			pages: number
			shorts: Record<string, string>
			suggestions: Suggest[]
			swaps: { part: PlaceRef; options: PlaceRef[] }[]
			pantry: PantryGroup[]
			years: number[]
	  }

/** Two names for nearly the same thing: one is not a suggestion for the other. */
const TWINS: [string, string][] = [
	["mood:romantic", "genre:romance"],
	["mood:scary", "genre:horror"],
	["mood:crime-mystery", "genre:crime"],
	["mood:crime-mystery", "genre:mystery"],
	["mood:crime-mystery", "theme:crime"],
	["mood:crime-mystery", "theme:mystery"],
	["mood:history", "genre:history"],
	["mood:history", "theme:history"],
	["mood:coming-of-age", "theme:growing-up"],
	["mood:other-worlds", "genre:fantasy"],
	["mood:other-worlds", "theme:fantasy"],
	["mood:other-worlds", "genre:sci-fi-fantasy"],
	["genre:animation", "style:animated"],
	["genre:documentary", "style:documentary"],
	["genre:family", "theme:family"],
	["genre:music", "style:music"],
	["genre:war", "theme:war"],
	["genre:crime", "theme:crime"],
	["genre:mystery", "theme:mystery"],
	["genre:fantasy", "theme:fantasy"],
	["genre:history", "theme:history"],
	["genre:science-fiction", "theme:future"],
]
const twinOf = (a: Ingredient, b: Ingredient) =>
	TWINS.some(([x, y]) => (id(a) === x && id(b) === y) || (id(a) === y && id(b) === x))
/** Not worth a suggestion card: a twin of something already in, or the catch-all TV Movie genre. */
const dull = (parts: Ingredient[], p: Ingredient) =>
	(p.family === "genre" && p.slug === "tv-movie") || parts.some((x) => twinOf(x, p))

const BEST_PAGE = 50
const id = (p: Ingredient) => `${p.family}:${p.slug}`

export function pantry(kit: Kit, parts: Ingredient[]): PantryGroup[] {
	return PANTRY_FAMILIES.map((family) => ({
		family,
		options: kit
			.members(family)
			.filter((m) => !parts.some((p) => same(p, m)))
			.map((place): PantryOption => {
				if (!parts.length) return { place, state: "full" }
				const n = kit.count([...parts, place])
				return {
					place,
					state: n >= MIN_PAGE ? "full" : n > 0 ? "thin" : "none",
				}
			}),
	})).filter((g) => g.options.length > 0)
}

export function shortsOf(kit: Kit, parts: Ingredient[]) {
	const out: Record<string, string> = {}
	for (const p of parts) {
		const short = copyFor(kit.kind, p.family, p.slug)?.short
		if (short) out[id(p)] = short
	}
	return out
}

export async function cards(kit: Kit, list: Curated[], n: number, titles: number) {
	const out: BlendCardData[] = []
	for (const c of list) {
		if (out.length >= n) break
		if (!c.parts.every((p) => kit.has(p.family, p.slug))) continue
		if (kit.count(c.parts) < MIN_PAGE * 2) continue
		out.push({
			parts: sortParts(c.parts).map((p) => kit.ref(p)),
			pitch: c.pitch,
			titles: await kit.showcase(c.parts, titles),
		})
	}
	return out
}

async function startPlaces(kit: Kit, family: Family, n?: number): Promise<StartPlace[]> {
	const members = kit.members(family)
	const picked = n ? members.slice(0, n) : members
	const out: StartPlace[] = []
	for (const place of picked)
		out.push({
			place,
			titles: await kit.showcase([place], 3),
			line: copyFor(kit.kind, family, place.slug)?.short,
			weight: Math.sqrt(kit.count([place])),
		})
	return out
}

function pairsOf(kit: Kit, parts: Ingredient[]): PairLink[] {
	const total = Math.max(1, kit.count([]))
	const out: PairLink[] = []
	for (let i = 0; i < parts.length; i++)
		for (let j = i + 1; j < parts.length; j++) {
			const na = kit.count([parts[i]])
			const nb = kit.count([parts[j]])
			const both = kit.count([parts[i], parts[j]])
			const lift = both / Math.max(1, (na * nb) / total)
			out.push({
				a: kit.ref(parts[i]),
				b: kit.ref(parts[j]),
				strength: lift >= 1.35 ? "often" : lift >= 0.7 ? "sometimes" : "rarely",
				share: Math.max(0.06, Math.min(1, both / Math.max(1, Math.min(na, nb)))),
			})
		}
	return out
}

export const load: ConceptLoader<BlendData> = async ({ kit, address, url }) => {
	const parts = address.parts
	const peek = url.searchParams.get("peek") === "1"

	if (address.view === "best") {
		if (peek) {
			const top = await kit.best({ parts, year: address.year, limit: 4 })
			return { view: "peek", titles: top.rows.map((r) => r.title) }
		}
		const page = Math.max(1, address.page ?? 1)
		const best = await kit.best({
			parts,
			year: address.year,
			limit: BEST_PAGE,
			offset: (page - 1) * BEST_PAGE,
		})
		// What to add next: what goes well with the picked parts, or a few good first picks.
		let adds: PlaceRef[]
		let swaps: { part: PlaceRef; options: PlaceRef[] }[] = []
		if (parts.length) {
			const blend = await kit.blend(parts, { suggestions: 10, titles: 0 })
			adds = blend.suggestions.map((s) => s.place).filter((p) => !dull(parts, p))
			swaps = blend.swaps
		} else
			adds = BEST_STARTS[two(kit.kind)]
				.filter((p) => kit.has(p.family, p.slug))
				.map((p) => kit.ref(p))
		const suggestions: Suggest[] = []
		const shown = new Set<number>()
		for (const place of adds) {
			if (suggestions.length >= 4) break
			// The top of what it would rank, and never a poster another card here already shows.
			const top = await kit.best({ parts: [...parts, place], year: address.year, limit: 12 })
			const titles = top.rows.map((r) => r.title).filter((t) => !shown.has(t.card.key))
			if (titles.length < 3) continue
			for (const t of titles.slice(0, 3)) shown.add(t.card.key)
			suggestions.push({ place, titles: titles.slice(0, 3) })
		}
		const now = new Date().getFullYear()
		return {
			view: "best",
			parts: parts.map((p) => kit.ref(p)),
			year: address.year ?? null,
			best,
			page,
			pages: Math.max(1, Math.min(10, Math.ceil(best.total / BEST_PAGE))),
			shorts: shortsOf(kit, parts),
			suggestions,
			swaps,
			pantry: pantry(kit, parts),
			years: [now, now - 1, now - 2, now - 3, now - 4],
		}
	}

	if (address.view === "family" && address.family) {
		const family = address.family
		return {
			view: "family",
			family,
			lede: pageCopy(kit.kind, "hub", FAMILY[family].seg)?.lede ?? null,
			places: await startPlaces(kit, family),
			pantry: pantry(kit, []),
		}
	}

	if (address.view === "place") {
		if (peek)
			return {
				view: "peek",
				titles: await kit.showcase(parts, 4, { used: new Set() }),
			}
		const count = kit.count(parts)
		const narrow = count < MIN_PAGE
		const single = parts.length === 1
		const refs = parts.map((p) => kit.ref(p))
		const defining = single ? await kit.showcase(parts, 3) : []
		const blend = await kit.blend(parts, { suggestions: 11, titles: 3 })
		const suggestions: Suggest[] = blend.suggestions
			.filter((s) => !dull(parts, s.place))
			.slice(0, 8)
			.map((s) => ({ place: s.place, titles: s.titles }))
		// A service alone: lead with the moods it is strongest in, which is what people come to a service page for.
		if (single && parts[0].family === "service") {
			const strong = (kit.serviceProfile(parts[0].slug)?.goodAt ?? [])
				.map((g) => g.place)
				.filter((p) => !suggestions.some((s) => id(s.place) === id(p)))
				.slice(0, 4)
			const lead: Suggest[] = []
			for (const place of strong) {
				if (kit.count([...parts, place]) < MIN_PAGE) continue
				lead.push({ place, titles: await kit.showcase([...parts, place], 3) })
			}
			suggestions.unshift(...lead)
			suggestions.splice(8)
		}
		const { more, less } = single ? kit.traits(parts, { n: 4, less: 2 }) : { more: [], less: [] }
		const loosen: Loosen[] = []
		if (narrow && parts.length > 1)
			for (const dropped of parts) {
				const rest = parts.filter((p) => !same(p, dropped))
				if (kit.count(rest) < MIN_PAGE) continue
				loosen.push({
					parts: rest.map((p) => kit.ref(p)),
					dropped: kit.ref(dropped),
					titles: await kit.showcase(rest, 3),
				})
			}
		loosen.sort((x, y) => kit.count(x.parts) - kit.count(y.parts))
		const [list, kinds, people, awards] = await Promise.all([
			kit.list(parts, {
				sort: address.sort,
				page: address.page,
				mine: address.mine,
				unseen: address.unseen,
				venn: address.venn,
				kindId: address.kind_,
			}),
			single ? kit.kinds(parts, 3) : Promise.resolve([]),
			narrow ? Promise.resolve([]) : kit.people(parts, 8),
			narrow ? Promise.resolve([]) : kit.awards(parts, 6),
		])
		return {
			view: "place",
			parts: refs,
			count,
			narrow,
			lede: single ? (copyFor(kit.kind, parts[0].family, parts[0].slug)?.lede ?? null) : null,
			shorts: shortsOf(kit, parts),
			more,
			less,
			together: single ? [] : blend.traits,
			venn: blend.venn,
			pairs: parts.length >= 3 ? pairsOf(kit, parts) : [],
			suggestions,
			swaps: blend.swaps,
			pantry: pantry(kit, parts),
			defining,
			kinds,
			people,
			awards,
			list,
			loosen,
			hasBest: count >= MIN_PAGE,
		}
	}

	// The hub.
	const kind = kit.kind
	const startFamilies = PANTRY_FAMILIES.filter((f) => kit.members(f).length > 0)
	const asked = url.searchParams.get("from") as Family | null
	const startFamily = asked && startFamilies.includes(asked) ? asked : "mood"
	const features = await cards(kit, FEATURED[two(kind)], 6, 8)
	// A different one leads each day; the rest wait behind "Another one".
	const lead = Math.floor(Date.now() / 86_400_000) % Math.max(1, features.length)
	const favorites = await cards(kit, FAVORITES[two(kind)], 4, 3)
	const odd = await cards(kit, ODD[two(kind)], 4, 3)
	const start = await startPlaces(kit, startFamily, 4)
	return {
		view: "hub",
		lede: pageCopy(kind, "hub", "home")?.lede ?? null,
		features: [...features.slice(lead), ...features.slice(0, lead)],
		favorites,
		odd,
		popular: await kit.popular(12),
		startFamily,
		startFamilies,
		start,
		startMore: Math.max(0, kit.members(startFamily).length - start.length),
		best: await kit.best({ limit: 5 }),
		bestStarts: BEST_STARTS[two(kind)]
			.filter((p) => kit.has(p.family, p.slug))
			.map((p) => kit.ref(p)),
	}
}

export type { Address }
