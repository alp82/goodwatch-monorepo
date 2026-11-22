import type { BrowseLoader } from "~/ui/browse/view"
// What the Shelf shows: every genre with its size, its
// color, the words that set it apart, its kinds with a few titles each, and a handful of picks that are not just the
// most popular ones. Read-only.
import { copyFor, pageCopy } from "~/domain/browse/copy-lookup"
import type { Copy } from "~/domain/browse/types"
import type { Places } from "~/server/browse/places.server"
import type { Ingredient } from "~/domain/browse/address"
import type { KindOf, ShowTitle } from "~/domain/browse/types"
import { type GenreHead, type Lite, type Word, lite, word } from "~/ui/browse/genres/shared"

/** Why a pick is on the row, in two words a person reads at a glance. */
export type PickWhy = "gem" | "new" | "classic" | "edge" | "crowd"

export interface Pick extends Lite {
	why: PickWhy
	/** For "edge": the kind it comes from. */
	kind?: string
}

export interface AtlasKind {
	id: string
	name: string
	/** Share of the genre's titles, 0-1. */
	share: number
	words: Word[]
	titles: Lite[]
}

export interface AtlasGenre extends GenreHead {
	/** Well-known titles that carry the genre (a title can carry several genres). */
	n: number
	/** The color of what sets the genre apart most (its lead trait's family). */
	color: string
	words: Word[]
	kinds: AtlasKind[]
	/** The titles that define it most (fit, not popularity). */
	titles: Lite[]
	/** One title per reason, none of them among `titles` or the kinds' posters. */
	picks: Pick[]
}

export interface AtlasData {
	copy: Copy | null
	genres: AtlasGenre[]
	/** Well-known titles of this kind in all. */
	total: number
}

export async function loadAtlas(atlas: Places, perKind = 4, tops = 6): Promise<AtlasData> {
	const members = atlas.members("genre")
	// Showcases first, so each genre's famous titles are its own and not spent on another genre's kind.
	const showcases = new Map<string, Lite[]>()
	const groups = members.map((g) => [g])
	await atlas.readShowcaseCandidates(groups, tops)
	for (const g of members) showcases.set(g.slug, (await atlas.showcase([g], tops)).map(lite))
	const kindsByGenre = await atlas.kindsByPlace(groups, perKind)
	// Picks only read ranked lists. Resolve them together so a title in several genres is read once.
	const genres = await Promise.all(
		members.map(async (g, index) => {
			const words = atlas.traits([g], { n: 3 }).more.map(word)
			const kinds = kindsByGenre[index]
			const titles = showcases.get(g.slug) ?? []
			const shown = new Set(
				[...titles, ...kinds.flatMap((k) => k.titles.map(lite))].map((t) => t.key),
			)
			const picks = await picksFor(
				atlas,
				[g],
				shown,
				kinds.filter((k) => k.titles.length >= 2),
			)
			return {
				place: g,
				short: copyFor(atlas.kind, "genre", g.slug)?.short ?? null,
				plural: atlas.name([g]),
				n: atlas.count([g]),
				color: words[0]?.color ?? "#fbbf24",
				words,
				titles,
				picks,
				kinds: kinds
					.filter((k) => k.titles.length >= 2)
					.sort((a, b) => b.share - a.share)
					.map((k) => ({
						id: k.id,
						name: k.name,
						share: k.share,
						words: k.traits.slice(0, 2).map(word),
						titles: k.titles.map(lite),
					})),
			}
		}),
	)
	return {
		copy: pageCopy(atlas.kind, "hub", "genres"),
		genres,
		total: atlas.count([]),
	}
}

const NOW = new Date().getFullYear()

/**
 * Five reasons to watch something that isn't the genre's front row: a title rated like the best but watched by far
 * fewer (gem), a recent standout (new), an old one that holds up (classic), the best of the genre's smallest kind
 * (edge), and the one everybody is watching (crowd). Each reason is skipped when nothing fits it.
 */
async function picksFor(
	atlas: Places,
	parts: Ingredient[],
	shown: Set<string>,
	kinds: KindOf[],
): Promise<Pick[]> {
	const [top, pop] = await Promise.all([
		atlas.list(parts, { sort: "top", size: 160 }),
		atlas.list(parts, { sort: "popular", size: 60 }),
	])
	const popular = new Set(pop.titles.map((t) => String(t.card.key)))
	const used = new Set(shown)
	const out: Pick[] = []
	const year = (t: ShowTitle) => t.card.release_year ?? 0
	const take = (why: PickWhy, list: ShowTitle[], ok: (t: ShowTitle) => boolean, kind?: string) => {
		const t = list.find((x) => !used.has(String(x.card.key)) && x.card.poster_path && ok(x))
		if (!t) return
		used.add(String(t.card.key))
		out.push({ ...lite(t), why, ...(kind ? { kind } : {}) })
	}
	// A gem: Top rated trusts many ratings, so its first rows are the famous ones. Deep in that list, a title still
	// scoring like the best has far fewer ratings: rated like a classic, watched by few. Not an old one (that is
	// "classic") and not what people watch now.
	const score = (t: ShowTitle) => t.card.goodwatch_overall_score_normalized_percent ?? 0
	const deep = top.titles.slice(60)
	const bar = Math.max(72, score(top.titles[30] ?? top.titles[0]) - 6)
	take(
		"gem",
		[...deep].sort((x, y) => score(y) - score(x)),
		(t) =>
			!popular.has(String(t.card.key)) &&
			score(t) >= bar &&
			year(t) >= (atlas.kind === "show" ? 2000 : 1985),
	)
	// Recent titles rarely reach the all-time top: the best-rated recent one among what people watch.
	const recent = pop.titles
		.filter(
			(t) => year(t) >= NOW - 4 && (t.card.goodwatch_overall_score_normalized_percent ?? 0) >= 70,
		)
		.sort(
			(x, y) =>
				(y.card.goodwatch_overall_score_normalized_percent ?? 0) -
				(x.card.goodwatch_overall_score_normalized_percent ?? 0),
		)
	take("new", [...top.titles.filter((t) => year(t) >= NOW - 4), ...recent], () => true)
	take("classic", top.titles, (t) => year(t) > 0 && year(t) < (atlas.kind === "show" ? 2000 : 1975))
	const edge = [...kinds].filter((k) => k.titles.length).sort((a, b) => a.share - b.share)[0]
	if (edge) {
		const more = await atlas.list(parts, { sort: "top", size: 24, kindId: edge.id })
		take("edge", [...more.titles, ...edge.titles], () => true, edge.name)
	}
	take("crowd", pop.titles, () => true)
	return out
}

/** The genres index: every genre with its kinds, the opened genre's card, and the picks beyond the obvious. */
export const loadGenresPage: BrowseLoader<AtlasData> = ({ atlas }) => loadAtlas(atlas, 4, 6)
