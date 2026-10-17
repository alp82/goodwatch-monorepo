// The shapes of the intro's data (server/living-room/intro): what the API at /api/intro answers and the scenes read.
import type { Grouping } from "~/domain/explorer"
import type { TitleCard } from "~/server/title-cards.server"
import type { PillarTiers } from "~/server/utils/fingerprint"

export type FeelAttr = {
	key: string
	label: string
	adjective: string
	emoji: string
	color: string
	value: number
}

export type FeelTitle = {
	title: string
	poster_path: string | null
	backdrop_path: string | null
	year: number | null
	score: number | null
	pillars: PillarTiers
	/** The strongest worded attributes (no craft), strongest first; values 0-10. */
	top: FeelAttr[]
}

export type SearchResult = {
	key: string
	title: string
	year: number | null
	poster: string | null
	score: number | null
	votes: number
}

export type FeelSearch = {
	q: string
	/** The reading the search used, as its chips show it. */
	reading: { text: string; kind: string; key?: string }[]
	/** The search's own results (its first 24), best known first. */
	titles: SearchResult[]
}

export type FeelData = {
	/** The search scene's phrase, with the site search's own reading and results for it. */
	searches: { space: FeelSearch }
}

export type CatalogCounts = {
	/** Every movie and show in the catalog: the filters scene's opening number. */
	movies: number
	shows: number
}

export type IslandTitle = {
	key: number
	title: string
	poster: string
	backdrop: string | null
	score: number | null
}

export type Island = {
	id: string
	grouping: Grouping
	name: string
	color: string
	count: number
	x: number
	y: number
	picture: string | null
}

export type IslandCombo = {
	/** The picked islands, in the order they are picked. */
	of: { grouping: Grouping; id: string }[]
	/** Titles after each pick: the first island's, then the first two's, then all three's. */
	counts: number[]
	/** Famous shared titles first. */
	titles: IslandTitle[]
	famous: number
}

export type IslandsData = {
	islands: Island[]
	two: IslandCombo | null
	three: IslandCombo | null
}

export type PickFeelData = { pick: FeelTitle | null; pickKey: number | null }

export type FilterTitle = {
	key: string
	title: string
	poster: string | null
	score: number | null
}

export type FilterKind = "all" | "services" | "seen" | "mood" | "age" | "score"

export type FilterStep = {
	id: string
	kind: FilterKind
	/** The switch's words. */
	label: string
	/** For the score switch: the threshold this step sets. */
	score?: number
	total: number
	titles: FilterTitle[]
}

export type FilterData = {
	country: string
	/** Every title in the catalog, and the movie and show split, straight from Crate (for the record). */
	catalog: { movies: number; shows: number }
	services: { id: number; name: string; logo: string | null }[]
	mood: { key: string; name: string; hue: string }
	/** The example member's seen count. */
	seenCount: number
	steps: FilterStep[]
}

export type NetflixData = {
	home: string
	/** Famous titles on Netflix where the visitor lives, most famous first; the visitor's country is the last row. */
	netflix: Where[]
	/** Netflix itself, with its logo. */
	service: Service | null
}

export type Service = { id: number; name: string; logo: string }

export type CountryOffers = { country: string; services: Service[] }

export type Where = {
	key: number
	title: string
	poster: string | null
	backdrop: string | null
	countries: CountryOffers[]
}

export type AtlasData = {
	/** The big brands, in a fixed order, with their real logos. */
	popular: Service[]
	/** Other services with a logo that carry titles somewhere, most titles first: the wall. */
	wall: Service[]
	/** How many services GoodWatch knows across all countries. */
	serviceCount: number
	/** How many countries those services cover. */
	countryCount: number
	/** A title's services country by country, for when no intro title is on Netflix where the visitor is. */
	where: Where[]
	/** The country `where` was read for. */
	home: string
}

export type PickData = {
	loved: number[]
	pick: number | null
	match: number | null
	rank: number | null
}

export type FiveScores = {
	key: number
	imdb: number | null
	tomatometer: number | null
	rtAudience: number | null
	metacritic: number | null
	metacriticUser: number | null
}

export type ScoreData = {
	sources: FiveScores[]
}

export type SourceScores = {
	key: number
	imdb: number | null
	metacritic: number | null
	metacriticUser: number | null
	tomatometer: number | null
	rtAudience: number | null
}

export type Offer = {
	key: number
	country: string
	type: string
	id: number
	name: string
	logo: string
}

export type TopService = {
	id: number
	name: string
	logo: string
	titles: number
}

export type SourceData = {
	sources: SourceScores[]
	offers: Offer[]
	top: TopService[]
}

export type IntroCard = TitleCard & { feels: string[] }
