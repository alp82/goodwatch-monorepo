// PROTOTYPE - throwaway (prototype/explore-r4). What the data kit returns. Pure types; safe to import in the browser.
import type { TitleCard } from "~/server/title-cards.server"
import type { Address, Family, Ingredient, Kind, Level, Sort } from "./address"

export type PrintFamily = "feel" | "humor" | "world" | "story" | "craft"

/** A place by reference: enough to draw a link, a token or a card header. */
export interface PlaceRef extends Ingredient {
	label: string
	/** The mood's hue; a theme's or style's color. */
	hue?: string
	/** A service's logo (TMDB path). */
	logo?: string
	/** A country's ISO code, uppercase. */
	code?: string
	/** A trait's adjective: "heartwarming". */
	adj?: string
	/** A trope's phrase after the kind noun: "with a Chekhov's Gun". */
	say?: string
}

/** A title to show. `card` is what the real poster card takes. */
export interface ShowTitle {
	card: TitleCard
	/** The title page. */
	to: string
	/** A sentence from GoodWatch's title analysis. */
	line?: string
}

/**
 * A fingerprint attribute that sets a place apart, as a word. Show `word` in `color`; `value`/`base`/`meaning` are
 * for progressive disclosure only.
 */
export interface TraitWord {
	key: string
	/** The adjective: "heartwarming". */
	word: string
	/** The attribute's name: "Wholesome". */
	label: string
	family: PrintFamily
	/** The fingerprint family's color. */
	color: string
	/** More of it than usual, or less. */
	dir: "more" | "less"
	/** The place's average, 0-10. */
	value: number
	/** The comparison's average, 0-10 (all titles of the kind unless said otherwise). */
	base: number
	/** What the attribute measures. */
	meaning: string
	/** The trait's own place. */
	part: Ingredient
}

/** One score of the full 74-score fingerprint of a place (the form bars). */
export interface PrintBar {
	key: string
	label: string
	family: PrintFamily
	color: string
	value: number
	base: number
}

/** A kind inside a place: a cluster of its titles by fingerprint ("Darkly funny"). */
export interface KindOf {
	id: string
	name: string
	/** Share of the place's titles, 0-1. */
	share: number
	traits: TraitWord[]
	/** The mood most of its titles share. */
	mood: PlaceRef | null
	titles: ShowTitle[]
}

export interface Neighbor {
	place: PlaceRef
	/** How it differs from here: "warmer", "darker", "more romantic". */
	differs: string
	/** The trait behind that word. */
	trait: TraitWord | null
	/** 0-1; share of this place's titles that are in the neighbor too. */
	overlap: number
	/** 0-1; how alike their fingerprints are. */
	similarity: number
	titles: ShowTitle[]
}

/** An intensity band: "a touch", "plenty", "all the way". */
export interface Band {
	level: Level
	name: string
	/** One line saying what this much of it feels like. */
	blurb: string
	/** Share of the place's titles in the band, 0-1. */
	share: number
	titles: ShowTitle[]
}

export interface Intensity {
	/** The trait the bands run on. */
	trait: TraitWord
	bands: Band[]
}

/** A dial: one named direction with the place's position on it. */
export interface Dial {
	key: string
	low: string
	high: string
	/** The place's position, 0-1. */
	at: number
	/** The nearest place further each way, when one exists. */
	lower: PlaceRef | null
	higher: PlaceRef | null
}

export interface EraShift {
	label: string
	place: PlaceRef | null
	dir: "rose" | "fell"
	/** Shares in percent, before and in this decade (disclosure). */
	from: number
	to: number
}

export interface Era {
	label: string
	startYear: number
	/** What the decade is about, as words. */
	traits: TraitWord[]
	rose: EraShift[]
	fell: EraShift[]
	/** Per year: its standout titles. */
	years: { year: number; titles: ShowTitle[] }[]
}

export interface ServiceProfile {
	service: PlaceRef
	country: string
	countryName: string
	/** False while the country's availability is still loading. */
	loaded: boolean
	/** What it has more of than the average service there, strongest first. */
	goodAt: { place: PlaceRef; times: number }[]
	thinOn: { place: PlaceRef; times: number }[]
	/** The other services of the country, largest first. */
	others: PlaceRef[]
}

export const SOURCE_LABELS = {
	imdb: "IMDb",
	rtCritics: "RT critics",
	rtAudience: "RT audience",
	metacritic: "Metacritic",
	metacriticUsers: "Metacritic users",
	letterboxd: "Letterboxd",
} as const
export type SourceKey = keyof typeof SOURCE_LABELS

export interface BestRow {
	rank: number
	title: ShowTitle
	genres: string[]
	sources: Partial<Record<SourceKey, number>>
}

export interface BestList {
	rows: BestRow[]
	total: number
	/** True when it is the published Best list; false for a ranking inside filters. */
	published: boolean
}

export interface Person {
	id: number
	name: string
	photo: string | null
	role: "Director" | "Creator" | "Actor"
	/** Their /person page. */
	to: string
	/** How many of the place's well-known titles they made or are in. */
	titles: number
	known: string[]
}

export interface AwardWin {
	title: ShowTitle
	/** "Oscar", "Emmy", ... */
	award: string
	/** "Best Picture" */
	category: string
	year: string
	/** The award's page. */
	to: string
}

export interface Suggestion {
	place: PlaceRef
	/** How many titles the blend with it has. */
	count: number
	titles: ShowTitle[]
}

export interface Blend {
	parts: PlaceRef[]
	count: number
	/** How a person would say it: "Cozy comedies from the 1990s". */
	name: string
	/** For two parts: titles only in the first, in both, only in the second. */
	venn: { a: number; both: number; b: number } | null
	/** What only the blend has, as words. */
	traits: TraitWord[]
	/** "Goes well with": more ingredients that still leave a full page. */
	suggestions: Suggestion[]
	/** For each part: its siblings that also work in its place. */
	swaps: { part: PlaceRef; options: PlaceRef[] }[]
}

export interface TitleList {
	titles: ShowTitle[]
	total: number
	page: number
	pages: number
	sort: Sort
	/** Discover with the same filters, for "More filters". Null when Discover can't express the page. */
	discoverHref: string | null
}

export interface Copy {
	lede: string
	short: string
}

/** What the shell hands every concept page. */
export interface Viewer {
	member: boolean
	country: string
	hasServices: boolean
}

export type { Address, Family, Ingredient, Kind, Level, Sort, TitleCard }

// ---------------------------------------------------------------------------------------------------------
// Place cards (round 5: the lab's `card` slot)

/** What `cardData()` (cards.server.ts) loads for a place. Everything a card may show, none of it required to show. */
export interface CardData {
	place: PlaceRef
	/** The copy deck's text: `short` is one line for a card, `lede` two or three sentences. Null when it has none. */
	copy: { short: string; lede: string } | null
	/** Up to four distinct titles of the place (poster and name only). Support, not the card's identity. */
	titles: ShowTitle[]
	/** What sets the place apart, as colored words: up to three, the strongest first. */
	traits: TraitWord[]
	/** The kinds inside the place (genres have them; others when asked for): "Dark comedies". */
	kinds?: { id: string; name: string }[]
	/** Decades: what there was more of than in the decade before. */
	rose?: { label: string; hue?: string }[]
	/** Services: what the service is strong on. */
	goodAt?: PlaceRef[]
	/** Countries: 0-1, how much of the catalog comes from there. */
	weight?: number
}

export interface CardProps extends CardData {
	/** The place's page. A card is one link to it, unless it shows `kinds` as links of their own. */
	href: string
	/** The address of one kind of the place (the place's list narrowed to it). Given with `kinds`. */
	kindHref?: (id: string) => string
	/** "s": a compact card in a dense row. "m": the usual grid card. "l": a lead card with room for the lede. */
	size?: "s" | "m" | "l"
}
