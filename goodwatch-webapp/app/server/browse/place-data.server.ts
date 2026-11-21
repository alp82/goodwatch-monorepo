// What each room and place page shows. Read-only.
//
// Order matters: the atlas hands every title out once per page, so the part of a page a viewer meets first asks first.
import { type Address, type Family, type Ingredient, type Kind, ing } from "~/domain/browse/address"
import type { BrowseLoadArgs } from "./load-args"
import type { Places } from "~/server/browse/places.server"
import { getCountryArrivals } from "~/server/new-on-services.server"
import { copyFor as placeCopy } from "~/domain/browse/copy-lookup"
import { copyFor as deckCopy } from "~/domain/browse/copy/index"
import type {
	AwardWin,
	BestList,
	BestRow,
	EraShift,
	Intensity,
	Neighbor,
	Person,
	PlaceRef,
	ShowTitle,
	TitleCard,
	TitleList,
	TraitWord,
} from "~/domain/browse/types"

export interface Copy {
	lede: string
	short: string
}

export interface CardPlace {
	place: PlaceRef
	titles: ShowTitle[]
	line?: string
	words?: TraitWord[]
}

export interface KindLink {
	id: string
	name: string
	titles: ShowTitle[]
}

export interface GenreRow {
	place: PlaceRef
	line?: string
	/** What sets it apart, for the place card. */
	words?: TraitWord[]
	kinds: KindLink[]
	titles: ShowTitle[]
}

export interface EraCard {
	place: PlaceRef
	line?: string
	lede?: string
	/** What there was more of than in the decade before (genres and moods); empty for the first decade. */
	rose: { label: string; hue?: string }[]
	titles: ShowTitle[]
	words?: TraitWord[]
}

export interface CountryCard {
	place: PlaceRef
	line?: string
	lede?: string
	weight: number
	titles: ShowTitle[]
	words?: TraitWord[]
}

export interface ServiceCard {
	place: PlaceRef
	line?: string
	goodAt: PlaceRef[]
	titles: ShowTitle[]
	newHref: string
	words?: TraitWord[]
}

export interface BestPreset {
	key: string
	label: string
	rows: BestRow[]
	/** The Best page with this filter. */
	parts: Ingredient[]
	year?: number
}

export type BrowsePageData =
	| {
			view: "hub"
			copy: Copy | null
			popular: ShowTitle[]
			moods: CardPlace[]
			best: BestPreset[]
			genres: GenreRow[]
			moreGenres: PlaceRef[]
			eras: EraCard[]
			countries: CountryCard[]
			services: ServiceCard[]
			streamingReady: boolean
	  }
	| { view: "moods"; copy: Copy | null; moods: CardPlace[] }
	| {
			view: "genres"
			copy: Copy | null
			rows: GenreRow[]
			themes: { place: PlaceRef; line?: string }[]
			styles: { place: PlaceRef; line?: string }[]
	  }
	| { view: "eras"; copy: Copy | null; eras: EraCard[] }
	| { view: "places"; copy: Copy | null; countries: CountryCard[] }
	| {
			view: "streaming"
			copy: Copy | null
			services: ServiceCard[]
			ready: boolean
			country: string
	  }
	| { view: "cards"; family: Family; copy: Copy | null; cards: CardPlace[] }
	| {
			view: "top"
			title: string
			copy: Copy | null
			parts: PlaceRef[]
			year?: number
			list: BestList
			page: number
			pages: number
			moods: PlaceRef[]
			genres: PlaceRef[]
			decades: PlaceRef[]
			years: number[]
	  }
	| PlaceData

export interface PlaceData {
	view: "place"
	title: string
	parts: PlaceRef[]
	copy: Copy | null
	more: TraitWord[]
	less: TraitWord[]
	essentials: ShowTitle[]
	kinds: KindLink[]
	activeKind: string | null
	goesWith: { place: PlaceRef; name: string; titles: ShowTitle[] }[]
	neighbors: Neighbor[]
	/** The best-scored well-known title of the place. */
	bestOne: ShowTitle | null
	people: Person[]
	awards: AwardWin[]
	intensity: Intensity | null
	venn: { a: number; both: number; b: number } | null
	list: TitleList
	era: {
		rose: EraShift[]
		fell: EraShift[]
		/** The decade before: "1980s". */
		before: string | null
		years: { year: number; title: ShowTitle }[]
	} | null
	service: {
		goodAt: CardPlace[]
		thinOn: PlaceRef[]
		others: PlaceRef[]
		newHref: string
		countryName: string
		ready: boolean
		/**
		 * a few titles to tease the New page: this week's arrivals, or where none are known (a quiet week, or a
		 * preview without the daily lists) the service's newest well-known titles; `fresh` says which.
		 */
		fresh: "week" | "newest"
		arrivals: {
			key: string
			title: string
			poster_path: string | null
			to: string
			year: number | null
		}[]
	} | null
	/** every decade of the kind in order, so "close to it" can sit on a time line. */
	decades?: PlaceRef[]
	/** A country page: every country with a page, for the map in the head. */
	map: { code: string; name: string; slug: string; weight: number }[] | null
	mapHref: string | null
}

/** A title for decoration inside a card that is one link: the poster and its name only. */
const slim = (t: ShowTitle): ShowTitle => ({
	to: t.to,
	card: {
		key: t.card.key,
		media_type: t.card.media_type,
		tmdb_id: t.card.tmdb_id,
		title: t.card.title,
		poster_path: t.card.poster_path,
		release_year: t.card.release_year,
	} as TitleCard,
})
const slimAll = (ts: ShowTitle[]) => ts.map(slim)

const copyOf = (atlas: Places, ref: PlaceRef): Copy | null =>
	(ref.family === "country" && ref.code
		? placeCopy(atlas.kind, "country", ref.code.toLowerCase())
		: null) ?? placeCopy(atlas.kind, ref.family, ref.slug)

/** The catalog's long name for Hong Kong reads badly in a list. */
const tidy = (ref: PlaceRef): PlaceRef => (ref.code === "HK" ? { ...ref, label: "Hong Kong" } : ref)

/** The deck's kind: movies and shows together have a text of their own. */
const deckKind = (kind: Kind) => (kind === "all" ? "all" : kind === "show" ? "shows" : "movies")
const hubCopy = (kind: Kind, id: string): Copy | null => deckCopy(deckKind(kind), "hub", id)

const newHref = (country: string, slug: string) => `/new/${country}/${slug}`

/** This week's arrivals on a service in the atlas's country, of the atlas's kind: the production New page's own read. */
async function arrivalsOn(atlas: Places, slug: string) {
	try {
		const { brands } = await getCountryArrivals({ country: atlas.country, now: Date.now() })
		const want = atlas.kind === "all" ? null : atlas.kind
		return (brands[slug] ?? [])
			.filter((t) => t.poster_path && (!want || t.media_type === want))
			.slice(0, 10)
			.map((t) => ({
				key: String(t.key),
				title: t.title,
				poster_path: t.poster_path,
				to: t.path,
				year: t.release_year,
			}))
	} catch {
		return []
	}
}

/** What sets a place apart, as words, for the place cards. */
const words = (atlas: Places, p: PlaceRef) => atlas.traits([p], { n: 3 }).more

export async function moodCards(atlas: Places): Promise<CardPlace[]> {
	const out: CardPlace[] = []
	for (const m of atlas.members("mood"))
		out.push({
			place: m,
			titles: slimAll(await atlas.showcase([m], 3)),
			line: copyOf(atlas, m)?.short,
			words: words(atlas, m),
		})
	return out
}

async function kindLinks(atlas: Places, parts: Ingredient[], titles: number): Promise<KindLink[]> {
	if (parts.length !== 1) return []
	const kinds = await atlas.kinds(parts, titles)
	return kinds.map((k) => ({
		id: k.id,
		name: k.name,
		titles: slimAll(k.titles),
	}))
}

export async function genreRows(atlas: Places, n: number, titles: number): Promise<GenreRow[]> {
	const out: GenreRow[] = []
	for (const g of atlas.members("genre").slice(0, n)) {
		const shown = await atlas.showcase([g], titles)
		out.push({
			place: g,
			line: copyOf(atlas, g)?.short,
			words: words(atlas, g),
			titles: shown,
			kinds: (await kindLinks(atlas, [g], 0)).map((k) => ({ ...k, titles: [] })),
		})
	}
	return out
}

export async function eraCards(atlas: Places, titles = 4): Promise<EraCard[]> {
	const out: EraCard[] = []
	// Newest first: the timeline starts at today's end.
	for (const d of [...atlas.members("decade")].reverse()) {
		const era = await atlas.era(d.slug, 0)
		out.push({
			place: d,
			line: copyOf(atlas, d)?.short,
			lede: copyOf(atlas, d)?.lede,
			rose: (era?.rose ?? []).slice(0, 3).map((r) => ({ label: r.label, hue: r.place?.hue })),
			words: words(atlas, d),
			titles: slimAll(await atlas.showcase([d], titles, { by: "best" })),
		})
	}
	return out
}

export async function countryCards(atlas: Places, withTitles: number): Promise<CountryCard[]> {
	const members = atlas.members("country")
	const max = Math.max(1, ...members.map((m) => atlas.count([m])))
	const out: CountryCard[] = []
	for (const [i, c] of members.entries()) {
		const copy = copyOf(atlas, c)
		out.push({
			place: tidy(c),
			line: copy?.short,
			lede: copy?.lede,
			weight: atlas.count([c]) / max,
			words: i < withTitles ? words(atlas, c) : undefined,
			titles: i < withTitles ? slimAll(await atlas.showcase([c], 3)) : [],
		})
	}
	return out
}

export async function serviceCards(atlas: Places, n: number): Promise<ServiceCard[]> {
	const out: ServiceCard[] = []
	for (const s of atlas.members("service").slice(0, n)) {
		const profile = atlas.serviceProfile(s.slug)
		out.push({
			place: s,
			line: copyOf(atlas, s)?.short,
			goodAt: (profile?.goodAt ?? []).slice(0, 2).map((g) => g.place),
			words: words(atlas, s),
			titles: slimAll(await atlas.showcase([s], 3, { by: "best" })),
			newHref: newHref(atlas.country, s.slug),
		})
	}
	return out
}

const THIS_YEAR = new Date().getFullYear()

export async function bestPresets(atlas: Places): Promise<BestPreset[]> {
	const presets: Omit<BestPreset, "rows">[] = [
		{ key: "all", label: "All time", parts: [] },
		{ key: "year", label: String(THIS_YEAR), parts: [], year: THIS_YEAR },
		...["2010s", "2000s", "1990s", "1980s"]
			.filter((d) => atlas.has("decade", d))
			.map((d) => ({ key: d, label: d, parts: [ing("decade", d)] })),
	]
	const out: BestPreset[] = []
	for (const p of presets) {
		const list = await atlas.best({ parts: p.parts, year: p.year, limit: 5 })
		if (list.rows.length >= 5) out.push({ ...p, rows: list.rows })
	}
	return out
}

const MAP_GROUPING: Partial<Record<Family, string>> = {
	mood: "mood",
	theme: "theme",
	style: "style",
	decade: "decade",
	country: "country",
}

async function loadPlace(atlas: Places, address: Address): Promise<PlaceData> {
	const parts = address.parts
	const refs = parts.map((p) => atlas.ref(p))
	const single = parts.length === 1
	const lead = refs[0]
	// A decade's years come first: its standouts are the page's own.
	const era = single && lead.family === "decade" ? await atlas.era(lead.slug, 1) : null
	const essentials = await atlas.showcase(parts, 5, {
		lines: true,
		// A decade, a country and a service are known by their best; a mood or genre by what is most typical of it.
		by:
			single && (lead.family === "service" || lead.family === "decade" || lead.family === "country")
				? "best"
				: "fit",
	})
	const kinds = single ? await kindLinks(atlas, parts, 4) : []
	// One more ingredient comes from another family than the place's own (its own family is "Close to"), and never
	// from streaming, which changes by country.
	const families = (["mood", "genre", "theme", "style", "decade", "country"] as Family[]).filter(
		(f) => !single || f !== lead.family,
	)
	const blend = await atlas.blend(parts, { suggestions: 6, titles: 3, families })
	// "Goes well with" fills its row. On a small or very recent catalog (a service) the decades take every
	// place and the rest count as their twins, so a second ask without the families already shown tops it up.
	if (blend.suggestions.filter((s) => s.place.slug !== "tv-movie").length < 4) {
		const shown = new Set(blend.suggestions.map((s) => s.place.family))
		const wider = await atlas.blend(parts, {
			suggestions: 6,
			titles: 3,
			families: families.filter((f) => !shown.has(f)),
		})
		for (const s of wider.suggestions)
			if (
				!blend.suggestions.some(
					(x) => x.place.family === s.place.family && x.place.slug === s.place.slug,
				)
			)
				blend.suggestions.push(s)
	}
	const neighbors = single
		? (await atlas.neighbors(parts[0], { n: 5, titles: 0 }))
				.filter((n) => n.place.slug !== "tv-movie")
				.slice(0, 4)
		: []
	const [people, awards, intensity, list] = await Promise.all([
		atlas.people(parts, 8),
		atlas.awards(parts, 6),
		single && (lead.family === "mood" || lead.family === "theme" || lead.family === "style")
			? atlas.intensity(parts, 1)
			: Promise.resolve(null),
		atlas.list(parts, {
			sort: address.sort,
			page: address.page,
			mine: address.mine,
			unseen: address.unseen,
			level: address.level,
			kindId: address.kind_,
		}),
	])
	const { more, less } = atlas.traits(parts, { n: 5, less: 2 })
	const profile = single && lead.family === "service" ? atlas.serviceProfile(lead.slug) : null
	// what it's strong and thin on, said in moods (each carries its color).
	const feel = profile ? atlas.serviceProfile(lead.slug, atlas.country, "mood") : null
	let arrivals = profile ? await arrivalsOn(atlas, lead.slug) : []
	let fresh: "week" | "newest" = "week"
	if (profile && arrivals.length < 3) {
		const newest = await atlas.list([lead], { sort: "newest", size: 10 }).catch(() => null)
		const shown = (newest?.titles ?? []).filter((t) => t.card.poster_path)
		if (shown.length >= 3) {
			fresh = "newest"
			arrivals = shown.map((t) => ({
				key: String(t.card.key),
				title: t.card.title,
				poster_path: t.card.poster_path,
				to: t.to,
				year: t.card.release_year,
			}))
		}
	}
	const goodAt: CardPlace[] = []
	for (const g of (feel?.goodAt.length ? feel : profile)?.goodAt.slice(0, 3) ?? []) {
		const both = [parts[0], { family: g.place.family, slug: g.place.slug }]
		goodAt.push({
			place: g.place,
			titles: slimAll(await atlas.showcase(both, 3, { by: "best" })),
			line: atlas.name(both),
		})
	}
	const top = await atlas.best({ parts, limit: 1 })
	const decades = atlas.members("decade")
	const before =
		era && lead.family === "decade"
			? (decades[decades.findIndex((d) => d.slug === lead.slug) - 1]?.label ?? null)
			: null
	const countries =
		single && lead.family === "country"
			? (() => {
					const members = atlas.members("country")
					const max = Math.max(1, ...members.map((m) => atlas.count([m])))
					return members.map((m) => ({
						code: m.code ?? "",
						name: tidy(m).label,
						slug: m.slug,
						weight: atlas.count([m]) / max,
					}))
				})()
			: null
	const grouping = single ? MAP_GROUPING[lead.family] : undefined
	return {
		view: "place",
		title: atlas.name(parts),
		parts: refs,
		copy: single ? copyOf(atlas, lead) : null,
		more,
		less,
		essentials,
		kinds,
		activeKind: kinds.find((k) => k.id === address.kind_)?.name ?? null,
		goesWith: blend.suggestions
			.filter((s) => s.place.slug !== "tv-movie")
			.slice(0, 4)
			.map((s) => ({
				place: s.place,
				name: atlas.name([...parts, { family: s.place.family, slug: s.place.slug }]),
				titles: slimAll(s.titles),
			})),
		bestOne: top.rows[0] ? slim(top.rows[0].title) : null,
		neighbors: neighbors.map((n) => ({ ...n, titles: slimAll(n.titles) })),
		people,
		awards: awards.map((a) => ({ ...a, title: slim(a.title) })),
		intensity: intensity
			? { ...intensity, bands: intensity.bands.map((b) => ({ ...b, titles: slimAll(b.titles) })) }
			: null,
		venn: blend.venn,
		list,
		era: era
			? {
					rose: era.rose.slice(0, 3),
					fell: era.fell.slice(0, 3),
					before,
					years: era.years
						.filter((y) => y.titles.length > 0)
						.map((y) => ({ year: y.year, title: y.titles[0] })),
				}
			: null,
		service: profile
			? {
					goodAt,
					thinOn: (feel?.goodAt.length ? feel : profile).thinOn.slice(0, 2).map((g) => g.place),
					others: profile.others.slice(0, 8),
					newHref: newHref(atlas.country, lead.slug),
					countryName: profile.countryName,
					ready: profile.loaded,
					fresh,
					arrivals,
				}
			: null,
		decades: single && lead.family === "decade" ? atlas.members("decade") : undefined,
		map: countries,
		mapHref: grouping ? `/map?grouping=${grouping}` : null,
	}
}

const BEST_PAGE = 50

/** The content of a Browse page: the hub, a family index, Top, or a place (its lede, essentials, kinds, ways onward). */
export async function loadPage({
	atlas,
	address,
}: Pick<BrowseLoadArgs, "atlas" | "address">): Promise<BrowsePageData> {
	const kind = atlas.kind
	if (address.view === "top") {
		const page = address.page ?? 1
		const list = await atlas.best({
			parts: address.parts,
			year: address.year,
			limit: BEST_PAGE,
			offset: (page - 1) * BEST_PAGE,
		})
		const filtered = address.parts.length > 0 || address.year !== undefined
		return {
			view: "top",
			title: atlas.name(address.parts, { top: true, year: address.year }),
			copy: filtered ? null : deckCopy(deckKind(kind), "best", "all"),
			parts: address.parts.map((p) => atlas.ref(p)),
			year: address.year,
			list,
			page,
			pages: Math.min(14, Math.ceil(list.total / BEST_PAGE)),
			moods: atlas.members("mood"),
			genres: atlas.members("genre"),
			decades: [...atlas.members("decade")].reverse(),
			years: Array.from({ length: 12 }, (_, i) => THIS_YEAR - i),
		}
	}
	if (address.view === "family" && address.family) {
		const family = address.family
		if (family === "mood")
			return { view: "moods", copy: hubCopy(kind, "moods"), moods: await moodCards(atlas) }
		if (family === "genre") {
			const rows = await genreRows(atlas, 40, 6)
			const lines = (f: "theme" | "style") =>
				atlas.members(f).map((p) => ({ place: p, line: copyOf(atlas, p)?.short }))
			return {
				view: "genres",
				copy: hubCopy(kind, "genres"),
				rows,
				themes: lines("theme"),
				styles: lines("style"),
			}
		}
		if (family === "decade")
			return { view: "eras", copy: hubCopy(kind, "decades"), eras: await eraCards(atlas, 6) }
		if (family === "country")
			return {
				view: "places",
				copy: hubCopy(kind, "countries"),
				countries: await countryCards(atlas, 40),
			}
		if (family === "service")
			return {
				view: "streaming",
				copy: hubCopy(kind, "services"),
				services: await serviceCards(atlas, 12),
				ready: atlas.streamingReady,
				country: atlas.country,
			}
		const cards: CardPlace[] = []
		for (const p of atlas.members(family))
			cards.push({
				place: p,
				titles: slimAll(await atlas.showcase([p], 3)),
				line: copyOf(atlas, p)?.short,
				words: atlas.traits([p], { n: 2 }).more,
			})
		return {
			view: "cards",
			family,
			copy: hubCopy(kind, family === "theme" ? "themes" : "styles"),
			cards,
		}
	}
	if (address.view === "place") return loadPlace(atlas, address)

	// The hub. Moods lead; the one Popular rail follows them.
	const moods = await moodCards(atlas)
	const popular = await atlas.popular(12)
	const bestLists = await bestPresets(atlas)
	const allGenres = atlas.members("genre")
	const genres = await genreRows(atlas, 4, 5)
	const eras = await eraCards(atlas)
	const countries = await countryCards(atlas, 4)
	const services = await serviceCards(atlas, 6)
	return {
		view: "hub",
		copy: hubCopy(kind, "home"),
		popular,
		moods,
		best: bestLists,
		genres: genres.map((g) => ({ ...g, titles: slimAll(g.titles) })),
		moreGenres: allGenres.slice(4),
		eras,
		countries,
		services,
		streamingReady: atlas.streamingReady,
	}
}
