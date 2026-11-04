// A title's tropes as the title page and its Tropes sub-page show them, in three cuts of one read
// (title-tropes.server.ts loads and caches the whole):
// - the index: every trope without its write-up (the signature tropes keep theirs), what the sub-page's first view
//   shows and what its HTML carries;
// - the texts: every write-up, read in the browser when a trope opens or find needs them;
// - the teaser: the title page's two signature cards and the count.
// The query keys are shared by the loaders (which dehydrate them into the page) and the hooks (model.ts).
import type { Paragraph } from "./excerpt"

/** Carried by at most this many titles in the catalog: "Rare". */
export const RARE = 60

export interface PageTrope {
	/** The TV Tropes page it groups under, or a `label:` identity. */
	id: string
	name: string
	/** The TV Tropes page; empty when unknown. */
	url: string
	/** What the trope is, one sentence; null without a catalog description. */
	meaning: string | null
	/**
	 * This title's write-up, spoilers marked; null when the page lists the name only. Left out (undefined) in the
	 * index for all but the signature tropes, until the texts are there.
	 */
	paragraphs?: Paragraph[] | null
	/** The write-up's first spoiler-free sentence or two (with the write-up). */
	teaser?: string | null
	/** The write-up's length on TV Tropes, characters. */
	length: number
	/** Titles in the catalog that carry it; null when the count wasn't read in time. */
	titles: number | null
	/** In the title's leading signature run on its TV Tropes page (listed before the A to Z). */
	lead: boolean
}

// A type, not an interface: the data cache takes plain object types only.
export type AllTropesResponse = {
	tropes: PageTrope[]
	total: number
	/** Ids of the most telling tropes, in order. */
	signature: string[]
}

/** The index: AllTropesResponse with write-ups only for the signature tropes. */
export type TropesIndex = AllTropesResponse

/** Every write-up by trope id. */
export type TropeTexts = Record<
	string,
	{ paragraphs: Paragraph[] | null; teaser: string | null }
>

/** What a trope card shows. */
export type CardTrope = {
	id: string
	name: string
	url: string
	titles: number | null
	rare: boolean
	teaser?: string | null
}

/** The title page's Tropes section: its two cards and how many there are (a type: the data cache keeps it). */
export type TropesTeaser = {
	total: number
	cards: CardTrope[]
}

/** The title page shows two signature cards. */
export const TEASER_CARDS = 2

type Kind = "movie" | "show"
export const tropesIndexKey = (type: Kind, id: number) =>
	["title-tropes", type, id] as const
export const tropeTextsKey = (type: Kind, id: number) =>
	["title-trope-texts", type, id] as const
export const tropesTeaserKey = (type: Kind, id: number) =>
	["title-tropes-teaser", type, id] as const

/** The index of a whole read: the signature tropes keep their write-ups, the rest go to the texts. */
export function tropesIndexOf(all: AllTropesResponse): TropesIndex {
	const signature = new Set(all.signature)
	return {
		...all,
		tropes: all.tropes.map(({ paragraphs, teaser, ...t }) =>
			signature.has(t.id) ? { ...t, paragraphs, teaser } : t,
		),
	}
}

export function tropeTextsOf(all: AllTropesResponse): TropeTexts {
	const out: TropeTexts = {}
	for (const t of all.tropes)
		out[t.id] = { paragraphs: t.paragraphs ?? null, teaser: t.teaser ?? null }
	return out
}

/** The index with the texts put back (each trope's write-up once it is there). */
export function withTexts(
	index: TropesIndex,
	texts: TropeTexts | undefined,
): AllTropesResponse {
	if (!texts) return index
	return {
		...index,
		tropes: index.tropes.map((t) => {
			const x = texts[t.id]
			return x && t.paragraphs === undefined ? { ...t, ...x } : t
		}),
	}
}

const card = (t: PageTrope): CardTrope => ({
	id: t.id,
	name: t.name,
	url: t.url,
	titles: t.titles,
	rare: t.titles != null && t.titles <= RARE,
	teaser: t.teaser ?? null,
})

/** The signature tropes as cards, those whose write-up opens without a spoiler first. */
export function signatureCards(
	all: AllTropesResponse,
	n = Number.POSITIVE_INFINITY,
) {
	const byId = new Map(all.tropes.map((t) => [t.id, t]))
	const sig = all.signature.flatMap((id) => {
		const t = byId.get(id)
		return t ? [card(t)] : []
	})
	return [
		...sig.filter((t) => t.teaser),
		...sig.filter((t) => !t.teaser),
	].slice(0, n)
}

export const tropesTeaserOf = (all: AllTropesResponse): TropesTeaser => ({
	total: all.total,
	cards: signatureCards(all, TEASER_CARDS),
})
