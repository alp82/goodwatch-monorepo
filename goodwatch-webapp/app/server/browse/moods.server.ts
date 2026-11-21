// The moods index: the sixteen moods as card data with
// their place on the dials' directions, the dials themselves, and the order people are watching them in right now.
import { ing } from "~/domain/browse/address"
import type { CardData } from "~/domain/browse/types"
import { base, released, rowsOf } from "~/server/browse/rows.server"
import type { DialSpec } from "~/domain/browse/tune"
import { loadDials } from "~/server/browse/dials.server"
import { cardData } from "~/server/browse/cards.server"
import type { BrowseLoader } from "~/ui/browse/view"

export interface MoodCard extends CardData {
	to: string
	/** The mood's place on each dial's direction, 0-1, by the dial's `col`. */
	s: number[]
	tone: number
	pace: number
	/** 0 is the mood most watched right now. */
	watched: number
}

export interface MoodsData {
	head: {
		title: string
		kicker: string
		lede: string | null
		crumbs: { label: string; to?: string }[]
	}
	dials: DialSpec[]
	/** In the order people are watching them right now. */
	moods: MoodCard[]
}

/** How many of the titles people watch most right now count toward a mood's place in the resting order. */
const NOW = 400

export const loadMoods =
	(titles: number): BrowseLoader<MoodsData> =>
	async (args) => {
		const { atlas } = args
		// Cards first: they take the best-known titles of each mood.
		const cards = await cardData(atlas, "mood", { titles })
		const dials = await loadDials(args)
		if (dials.view !== "family") throw new Response("Not a family page", { status: 404 })
		const b = base(atlas.kind)
		const share = new Map<string, number>()
		for (const c of cards) {
			let n = 0
			if (b)
				for (const r of rowsOf(b, atlas.catalog, [ing("mood", c.place.slug)], atlas.country)) {
					// Rows come most popular first: stop at the first one outside what people watch now.
					if (b.rank[r] >= NOW) break
					if (released(b, r)) n++
				}
			share.set(c.place.slug, n)
		}
		const at = new Map(dials.places.map((p) => [p.place.slug, p]))
		const order = [...cards].sort(
			(x, y) => (share.get(y.place.slug) ?? 0) - (share.get(x.place.slug) ?? 0),
		)
		return {
			head: { title: dials.title, kicker: dials.kicker, lede: dials.lede, crumbs: dials.crumbs },
			dials: dials.dials,
			moods: order.flatMap((c, i) => {
				const p = at.get(c.place.slug)
				return p ? [{ ...c, to: p.to, s: p.s, tone: p.tone, pace: p.pace, watched: i }] : []
			}),
		}
	}

/** The moods index: the lattice with three posters per mood. */
export const loadMoodsPage = loadMoods(3)
