// Loads the card data of a family's places the same way for every
// page: `cardData(atlas, "mood")`. Read-only. Titles come from `atlas.showcase`, so a page never repeats one.
import type { Family } from "~/domain/browse/address"
import type { Places } from "~/server/browse/places.server"
import { copyFor } from "~/domain/browse/copy-lookup"
import type { CardData, PlaceRef, ShowTitle } from "~/domain/browse/types"

/** A title as decoration inside a card that is one link: the poster and its name only. */
export const slim = (t: ShowTitle): ShowTitle => ({
	to: t.to,
	card: {
		key: t.card.key,
		media_type: t.card.media_type,
		tmdb_id: t.card.tmdb_id,
		title: t.card.title,
		poster_path: t.card.poster_path,
		release_year: t.card.release_year,
	} as ShowTitle["card"],
})

/** A place's hand-written copy (a country's by its ISO code). */
export const cardCopy = (atlas: Places, ref: PlaceRef) =>
	(ref.family === "country" && ref.code
		? copyFor(atlas.kind, "country", ref.code.toLowerCase())
		: null) ?? copyFor(atlas.kind, ref.family, ref.slug)

export interface CardDataOptions {
	/** How many places, in the family's own order (`atlas.members`: genres, countries and services by size, decades oldest first). All when left out. */
	n?: number
	/** Titles per card (default 3; 0 for none). */
	titles?: number
	/** How the titles are chosen (default: "best" for decades and services, "fit" otherwise). */
	by?: "fit" | "popular" | "best"
	/** Trait words per card (default 3). */
	traits?: number
	/** Load the kinds inside each place (default: genres only). */
	kinds?: boolean
	/** Only these places (slugs), in this order. */
	only?: string[]
}

const defaultOrder = (family: Family) =>
	family === "decade" || family === "service" ? "best" : "fit"

/** One place's card data. */
export async function cardOf(
	atlas: Places,
	place: PlaceRef,
	opts: CardDataOptions = {},
): Promise<CardData> {
	const part = [{ family: place.family, slug: place.slug }]
	const n = opts.titles ?? 3
	const by = opts.by ?? defaultOrder(place.family)
	const out: CardData = {
		place,
		copy: cardCopy(atlas, place),
		titles: n > 0 ? (await atlas.showcase(part, n, { by })).map(slim) : [],
		traits: atlas.traits(part, { n: opts.traits ?? 3 }).more,
	}
	if (opts.kinds ?? place.family === "genre")
		out.kinds = (await atlas.kinds(part, 0)).map((k) => ({ id: k.id, name: k.name }))
	if (place.family === "decade") {
		const era = await atlas.era(place.slug, 0)
		out.rose = (era?.rose ?? []).slice(0, 3).map((r) => ({ label: r.label, hue: r.place?.hue }))
	}
	if (place.family === "service")
		out.goodAt = (atlas.serviceProfile(place.slug)?.goodAt ?? []).slice(0, 2).map((g) => g.place)
	return out
}

/**
 * The cards of a family's places. Call it in the order the page shows its modules: an earlier call takes the
 * best-known titles, a later one avoids them.
 */
export async function cardData(
	atlas: Places,
	family: Family,
	opts: CardDataOptions = {},
): Promise<CardData[]> {
	const all = atlas.members(family)
	const wanted = opts.only
		? opts.only.flatMap((slug) => all.filter((m) => m.slug === slug))
		: all.slice(0, opts.n ?? all.length)
	const max = family === "country" ? Math.max(1, ...all.map((m) => atlas.count([m]))) : 1
	// A country card's titles prefer the country's own (by original language): read those languages in one go.
	if (family === "country" && (opts.titles ?? 3) > 0) await atlas.prefetchHomeLanguages(wanted)
	await atlas.readShowcaseCandidates(
		wanted.map((place) => [place]),
		opts.titles ?? 3,
		opts.by ?? defaultOrder(family),
	)
	const out: CardData[] = []
	for (const place of wanted) {
		const card = await cardOf(atlas, place, opts)
		if (family === "country") card.weight = atlas.count([place]) / max
		out.push(card)
	}
	return out
}
