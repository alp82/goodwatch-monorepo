import type { BrowseLoader } from "~/ui/browse/view"
// What the Shelf shows: every genre with its size, its
// color, the words that set it apart, its kinds with a few titles each, and a handful of picks that are not just the
// most popular ones. Read-only.
import { copyFor, pageCopy } from "~/domain/browse/copy-lookup"
import type { Copy } from "~/domain/browse/types"
import type { Places } from "~/server/browse/places.server"
import type { Ingredient } from "~/domain/browse/address"
import type { KindOf, PlaceRef, ShowTitle } from "~/domain/browse/types"
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

export interface AtlasGenreSummary extends GenreHead {
	/** Well-known titles that carry the genre (a title can carry several genres). */
	n: number
	/** The color of what sets the genre apart most (its lead trait's family). */
	color: string
	words: Word[]
}

export interface AtlasGenre extends AtlasGenreSummary {
	kinds: AtlasKind[]
	/** The titles that define it most (fit, not popularity). */
	titles: Lite[]
	/** One title per reason, none of them among `titles` or the kinds' posters. */
	picks: Pick[]
}

export interface AtlasData {
	copy: Copy | null
	genres: AtlasGenreSummary[]
	initial: AtlasGenre | null
	/** Well-known titles of this kind in all. */
	total: number
}

function genreSummary(atlas: Places, g: PlaceRef): AtlasGenreSummary {
	const words = atlas.traits([g], { n: 3 }).more.map(word)
	return {
		place: g,
		short: copyFor(atlas.kind, "genre", g.slug)?.short ?? null,
		plural: atlas.name([g]),
		n: atlas.count([g]),
		color: words[0]?.color ?? "#fbbf24",
		words,
	}
}

/** The shelf deliberately assigns all headliners before kind posters, then allocates kind posters
 * in picker order. Reproduce those reservations through the selected genre. The large ranked
 * lists and final picks are only read for the panel the visitor requested. */
async function panelFor(
	atlas: Places,
	members: PlaceRef[],
	at: number,
	summary: AtlasGenreSummary,
): Promise<AtlasGenre> {
	atlas.limitGenreRankings()
	const groups = members.map((genre) => [genre])
	const tops = 6
	await atlas.readShowcaseCandidates(groups, tops)
	let titles: Lite[] = []
	for (const [index, group] of groups.entries()) {
		const selected = await atlas.showcase(group, tops)
		if (index === at) titles = selected.map(lite)
	}
	const kinds = (await atlas.kindsByPlace(groups.slice(0, at + 1), 4, at))[at]
	const shown = new Set([
		...titles.map((t) => t.key),
		...kinds.flatMap((k) => k.titles.map((t) => String(t.card.key))),
	])
	const visibleKinds = kinds.filter((k) => k.titles.length >= 2)
	const picks = await picksFor(atlas, groups[at], shown, visibleKinds)
	return {
		...summary,
		titles,
		picks,
		kinds: visibleKinds
			.sort((a, b) => b.share - a.share)
			.map((k) => ({
				id: k.id,
				name: k.name,
				share: k.share,
				words: k.traits.slice(0, 2).map(word),
				titles: k.titles.map(lite),
			})),
	}
}

export async function loadGenrePanel(atlas: Places, slug: string): Promise<AtlasGenre | null> {
	const members = atlas.members("genre")
	const at = members.findIndex((g) => g.slug === slug)
	return at < 0 ? null : panelFor(atlas, members, at, genreSummary(atlas, members[at]))
}

export async function loadAtlas(atlas: Places): Promise<AtlasData> {
	const members = atlas.members("genre")
	const genres = members.map((g) => genreSummary(atlas, g))
	return {
		copy: pageCopy(atlas.kind, "hub", "genres"),
		genres,
		initial: genres.length ? await panelFor(atlas, members, 0, genres[0]) : null,
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
	const bar = Math.max(72, (top.titles.length ? score(top.titles[30] ?? top.titles[0]) : 0) - 6)
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

/** The genres index: all picker labels and the complete first panel. */
export const loadGenresPage: BrowseLoader<AtlasData> = ({ atlas }) => loadAtlas(atlas)
