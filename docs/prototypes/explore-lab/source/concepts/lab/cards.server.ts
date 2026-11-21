// PROTOTYPE - throwaway (prototype/explore-r5). Loads the card data of a family's places the same way for every
// page: `cardData(kit, "mood")`. Read-only. Titles come from `kit.showcase`, so a page never repeats one.
import type { Family } from "../../kit/address"
import type { Kit } from "../../kit/data.server"
import { copyFor } from "../../kit/optional"
import type { PlaceRef, ShowTitle } from "../../kit/types"
import type { CardData } from "./card"

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
export const cardCopy = (kit: Kit, ref: PlaceRef) =>
	(ref.family === "country" && ref.code
		? copyFor(kit.kind, "country", ref.code.toLowerCase())
		: null) ?? copyFor(kit.kind, ref.family, ref.slug)

export interface CardDataOptions {
	/** How many places, in the family's own order (`kit.members`: genres, countries and services by size, decades oldest first). All when left out. */
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

/** One place's card data. */
export async function cardOf(
	kit: Kit,
	place: PlaceRef,
	opts: CardDataOptions = {},
): Promise<CardData> {
	const part = [{ family: place.family, slug: place.slug }]
	const n = opts.titles ?? 3
	const by = opts.by ?? (place.family === "decade" || place.family === "service" ? "best" : "fit")
	const out: CardData = {
		place,
		copy: cardCopy(kit, place),
		titles: n > 0 ? (await kit.showcase(part, n, { by })).map(slim) : [],
		traits: kit.traits(part, { n: opts.traits ?? 3 }).more,
	}
	if (opts.kinds ?? place.family === "genre")
		out.kinds = (await kit.kinds(part, 0)).map((k) => ({ id: k.id, name: k.name }))
	if (place.family === "decade") {
		const era = await kit.era(place.slug, 0)
		out.rose = (era?.rose ?? []).slice(0, 3).map((r) => ({ label: r.label, hue: r.place?.hue }))
	}
	if (place.family === "service")
		out.goodAt = (kit.serviceProfile(place.slug)?.goodAt ?? []).slice(0, 2).map((g) => g.place)
	return out
}

/**
 * The cards of a family's places. Call it in the order the page shows its modules: an earlier call takes the
 * best-known titles, a later one avoids them.
 */
export async function cardData(
	kit: Kit,
	family: Family,
	opts: CardDataOptions = {},
): Promise<CardData[]> {
	const all = kit.members(family)
	const wanted = opts.only
		? opts.only.flatMap((slug) => all.filter((m) => m.slug === slug))
		: all.slice(0, opts.n ?? all.length)
	const max = family === "country" ? Math.max(1, ...all.map((m) => kit.count([m]))) : 1
	const out: CardData[] = []
	for (const place of wanted) {
		const card = await cardOf(kit, place, opts)
		if (family === "country") card.weight = kit.count([place]) / max
		out.push(card)
	}
	return out
}
