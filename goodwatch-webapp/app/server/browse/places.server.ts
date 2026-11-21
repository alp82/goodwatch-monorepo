// Browse's place data: everything a Browse loader asks about places, all from the title snapshot, the availability
// index and a few read-only SELECTs. One per request:
//
//   const places = await openPlaces(request, address.kind, address.country)
//   const cozy = [ing("mood", "cozy")]
//   const [titles, words] = await Promise.all([places.showcase(cozy, 6), places.traits(cozy)])
//
// `places.used` remembers every title a showcase handed out, so nothing repeats on one page.
import { MOODS, MOOD_KEYS } from "~/domain/moods"
import { type SortKey, defaultFilterState, filterQuery } from "~/domain/filter-state"
import { BRANDS, brandBySlug } from "~/domain/new-on-services"
import { STYLES, THEMES } from "~/domain/themes-styles"
import { FAMILY_COLOR } from "~/domain/fingerprint-effects/palette"
import { familyOf } from "~/domain/fingerprint-families"
import { isSettled, titleKindOf } from "~/domain/top-lists"
import { AWARD_BODIES } from "~/domain/award-pages"
import { countryServices } from "~/server/availability-index.server"
import { getRankedList } from "~/server/top-lists.server"
import { NO_TASTE } from "~/server/taste/taste.server"
import { adjective, label as keyLabel, meaning } from "~/server/taste-portrait/words.server"
import { type TitleCard, getServiceCards, getTitleCards } from "~/server/title-cards.server"
import { SHOW_BASE, UNKNOWN_SCORE } from "~/server/title-snapshot/format.server"
import { VALID_FINGERPRINT_KEYS } from "~/server/utils/fingerprint"
import { type ViewerContext, getViewerContext } from "~/server/viewer.server"
import { query } from "~/utils/crate"
import { personPath, titlePath } from "~/utils/helpers"
import { type TitleKey, titleKey } from "~/utils/title-key"
import {
	FAMILIES,
	type Family,
	type Ingredient,
	type Kind,
	LEVELS,
	type Level,
	type Sort,
	type Venn,
	same,
	sortParts,
} from "~/domain/browse/address"
import {
	BAND,
	type Base,
	type Catalog,
	type CatalogValue,
	K,
	KEY_AT,
	MISSING,
	TRAIT_KEYS,
	base,
	brandRows,
	catalogOf,
	withEveryCountry,
	clustersOf,
	fitOf,
	levelOf,
	meanCached,
	meanOf,
	ranked,
	released,
	rowsOf,
	similarity,
	testOf,
	topTraits,
	traitSlug,
	valueOf,
	votesOf,
} from "./rows.server"
import type {
	AwardWin,
	Band,
	BestList,
	BestRow,
	Blend,
	Dial,
	Era,
	EraShift,
	Intensity,
	KindOf,
	Neighbor,
	Person,
	PlaceRef,
	PrintBar,
	PrintFamily,
	ServiceProfile,
	ShowTitle,
	SourceKey,
	Suggestion,
	TitleList,
	TraitWord,
	Viewer,
} from "~/domain/browse/types"
import { BAND_WORDS, blendName, comparative } from "~/domain/browse/words"
import { kindNameOf } from "~/domain/browse/kind-names"
import { groupOf, tropeById } from "~/domain/tropes/catalog"
import { ensureTropes } from "./tropes.server"

export class PlacesNotReady extends Error {
	constructor() {
		super("The title snapshot is still loading")
	}
}

const PAGE = 40
/** A blend needs this many well-known titles to be offered as a suggestion or a swap. */
export const MIN_PAGE = 24
const SRC: SourceKey[] = [
	"imdb",
	"rtCritics",
	"rtAudience",
	"metacritic",
	"metacriticUsers",
	"letterboxd",
]
const regionName = new Intl.DisplayNames(["en"], { type: "region" })
const round1 = (x: number) => Math.round(x * 10) / 10

/** The four named directions, each a few scores minus a few others. */
export const AXES = {
	tone: {
		low: "Lighter",
		high: "Darker",
		hi: ["bleakness", "violence", "melancholy", "dark_humor"],
		lo: ["hopefulness", "wholesome", "situational_comedy"],
	},
	pace: {
		low: "Calmer",
		high: "More intense",
		hi: ["adrenaline", "tension", "fast_pace", "spectacle"],
		lo: ["slow_burn", "dialogue_centrality"],
	},
	world: {
		low: "More grounded",
		high: "More fantastic",
		hi: ["fantasy", "futuristic", "surrealism", "wonder", "world_immersion"],
		lo: ["contemporary_realism", "biographical", "historical"],
	},
	mind: {
		low: "Easier",
		high: "More demanding",
		hi: ["complexity", "ambiguity", "philosophical", "non_linear_narrative"],
		lo: ["rewatchability", "physical_comedy"],
	},
} as const
export type AxisKey = keyof typeof AXES
export const AXIS_KEYS = Object.keys(AXES) as AxisKey[]

function axisOf(v: ArrayLike<number>, axis: AxisKey): number {
	const mean = (keys: readonly string[]) => {
		let s = 0
		let n = 0
		for (const key of keys) {
			const x = v[KEY_AT.get(key) as number]
			if (x !== undefined && x !== MISSING) {
				s += x
				n++
			}
		}
		return n ? s / n : 0
	}
	return mean(AXES[axis].hi) - mean(AXES[axis].lo)
}

let logos: Map<number, string> | null = null
async function serviceLogos(): Promise<Map<number, string>> {
	if (logos) return logos
	const cards = await getServiceCards(BRANDS.map((b) => b.logo)).catch(() => [])
	const map = new Map(cards.map((c) => [c.id, c.logo_path]))
	if (map.size) logos = map
	return map
}

const sqlCache = new Map<string, { at: number; value: unknown }>()
async function cachedSql<T>(id: string, run: () => Promise<T>, ttlMs = 30 * 60 * 1000): Promise<T> {
	const hit = sqlCache.get(id)
	if (hit && Date.now() - hit.at < ttlMs) return hit.value as T
	const value = await run()
	if (sqlCache.size > 2000) sqlCache.clear()
	sqlCache.set(id, { at: Date.now(), value })
	return value
}

/** Opens the place data for one request. Throws PlacesNotReady while the title snapshot loads. */
export async function openPlaces(request: Request, kind: Kind, country = "us"): Promise<Places> {
	const b = base(kind)
	const short = catalogOf((key) => keyLabel(key), kind)
	if (!b || !short) throw new PlacesNotReady()
	const catalog = withEveryCountry(short, b)
	// Trope members load once per process: waited for where the page is about tropes (any page may link to one).
	const url = new URL(request.url)
	const tropes = ensureTropes()
	const aboutTropes =
		/\/(?:tropes|traits)(?:\/|$)/.test(url.pathname) ||
		(url.searchParams.get("with") ?? "").includes("trope:")
	const [ctx, logoMap] = await Promise.all([
		getViewerContext(request),
		serviceLogos(),
		aboutTropes ? tropes : null,
	])
	return new Places(b, catalog, ctx, country.toLowerCase(), logoMap)
}

const knownCache = new WeakMap<Base, Set<number>>()
/** A kind's well-known rows as a set. */
function knownRows(b: Base): Set<number> {
	let set = knownCache.get(b)
	if (!set) {
		set = new Set(b.rows)
		knownCache.set(b, set)
	}
	return set
}

export class Places {
	/** Every title a showcase has handed out on this page. Pass your own set to a call to scope it differently. */
	readonly used = new Set<TitleKey>()
	private cardCache = new Map<TitleKey, TitleCard>()
	private lineCache = new Map<TitleKey, string>()

	constructor(
		private b: Base,
		readonly catalog: Catalog,
		readonly ctx: ViewerContext,
		/** The streaming country of the address, lowercase. */
		readonly country: string,
		private logoMap: Map<number, string>,
	) {}

	get kind(): Kind {
		return this.b.kind
	}
	get viewer(): Viewer {
		return {
			member: this.ctx.viewer.kind !== "guest",
			country: this.ctx.country,
			hasServices: this.ctx.services.length > 0,
		}
	}
	/** Whether the country's availability is loaded (service places are empty until then). */
	get streamingReady(): boolean {
		return countryServices(this.country.toUpperCase()) !== null
	}

	// -----------------------------------------------------------------------------------------------------
	// Places

	/** Whether a family has a slug (for address parsing). A slug that leads to a place counts. */
	has = (family: Family, slug: string) => valueOf(this.catalog, { family, slug }) !== undefined

	/**
	 * A place's own slug. Movies and shows together merge the genres one kind splits, so `science-fiction` under
	 * `/all` is `sci-fi-fantasy`; a repaired country slug (`turkiye`) answers to its old one too.
	 */
	canon = (family: Family, slug: string) => valueOf(this.catalog, { family, slug })?.slug ?? slug

	/** Parts in canonical order, each under its own slug, none twice. */
	private norm(parts: Ingredient[]): Ingredient[] {
		return sortParts(parts.map((p) => ({ family: p.family, slug: this.canon(p.family, p.slug) })))
	}

	ref(p: Ingredient): PlaceRef {
		const val = valueOf(this.catalog, p)
		const out: PlaceRef = {
			family: p.family,
			slug: val?.slug ?? p.slug,
			label: val?.label ?? p.slug,
		}
		if (!val) return out
		if (p.family === "mood") out.hue = MOODS.find((m) => m.key === val.id)?.hue
		if (p.family === "theme") out.hue = THEMES.find((t) => t.id === val.id)?.color
		if (p.family === "style") out.hue = STYLES.find((t) => t.id === val.id)?.color
		if (p.family === "country") {
			out.code = val.id
			// The catalog's long name reads badly in a list or a blend's name.
			if (val.id === "HK") out.label = "Hong Kong"
		}
		if (p.family === "service") {
			const brand = brandBySlug(val.id)
			out.logo = brand ? this.logoMap.get(brand.logo) : undefined
		}
		if (p.family === "trope") {
			const t = tropeById(val.id)
			out.hue = t ? groupOf(t.group).color : undefined
			out.say = t?.say
		}
		if (p.family === "trait") {
			out.adj = adjective(val.id)
			out.hue = FAMILY_COLOR[(familyOf(val.id) ?? "story") as PrintFamily]
		}
		return out
	}

	/** A family's places that have a full page for this kind, in the family's own order (genres by size). */
	members(family: Family, min = MIN_PAGE): PlaceRef[] {
		const all = this.catalog[family].map((v) => ({
			ref: this.ref(v),
			n: this.count([{ family, slug: v.slug }]),
		}))
		const kept = all.filter((x) => x.n >= min)
		if (family === "genre" || family === "country" || family === "service")
			kept.sort((a, b) => b.n - a.n)
		return kept.map((x) => x.ref)
	}

	private rows(parts: Ingredient[]): number[] {
		return rowsOf(this.b, this.catalog, this.norm(parts), this.country)
	}
	private mean(parts: Ingredient[]): Float64Array {
		const sorted = this.norm(parts)
		if (!sorted.length) return this.b.mean
		const id = `${sorted.some((p) => p.family === "service") ? this.country : ""}|${sorted.map((p) => `${p.family}:${p.slug}`).join("+")}`
		return meanCached(this.b, id, this.rows(sorted))
	}

	/** How many well-known titles a place or blend has. */
	count(parts: Ingredient[]): number {
		return this.rows(parts).length
	}

	/** How a person would say the place: "Cozy comedies from the 1990s". */
	name(parts: Ingredient[], opts: { top?: boolean; year?: number } = {}): string {
		return blendName(
			this.kind,
			this.norm(parts).map((p) => this.ref(p)),
			opts,
		)
	}

	// -----------------------------------------------------------------------------------------------------
	// Titles

	private keyOf = (r: number) => this.b.snap.columns.pointIds[r] as TitleKey

	private async cards(keys: TitleKey[]): Promise<void> {
		const missing = [...new Set(keys)].filter((k) => !this.cardCache.has(k))
		const batches: TitleKey[][] = []
		for (let i = 0; i < missing.length; i += 60) batches.push(missing.slice(i, i + 60))
		for (const cards of await Promise.all(
			batches.map((keys2) => getTitleCards(keys2, this.ctx, NO_TASTE)),
		))
			for (const c of cards) this.cardCache.set(c.key, c)
	}

	/** The title analysis texts (read-only SELECT), a sentence each. */
	private async lines(keys: TitleKey[], terms: string[]): Promise<void> {
		const missing = keys.filter((k) => !this.lineCache.has(k))
		if (!missing.length) return
		const read = async (table: "movie" | "show", ids: number[]) => {
			if (!ids.length) return
			const rows = await query<{ tmdb_id: number; essence_text: string | null }>(
				`SELECT tmdb_id, essence_text FROM ${table} WHERE tmdb_id IN (${ids.map(() => "?").join(",")})`,
				ids,
			).catch(() => [])
			for (const row of rows)
				if (row.essence_text)
					this.lineCache.set(titleKey(table, row.tmdb_id), pickSentence(row.essence_text, terms))
		}
		await Promise.all([
			read(
				"movie",
				missing.filter((k) => k < SHOW_BASE).map((k) => k - 1e12),
			),
			read(
				"show",
				missing.filter((k) => k >= SHOW_BASE).map((k) => k - SHOW_BASE),
			),
		])
	}

	private async titles(rows: number[], withLines = false, terms: string[] = []) {
		const keys = rows.map(this.keyOf)
		await Promise.all([this.cards(keys), withLines ? this.lines(keys, terms) : null])
		return keys.flatMap((k): ShowTitle[] => {
			const card = this.cardCache.get(k)
			if (!card) return []
			return [
				{
					card,
					to: titlePath(card.media_type, card.tmdb_id, card.title),
					line: withLines ? this.lineCache.get(k) : undefined,
				},
			]
		})
	}

	/** Titles by key, in order (for a page that holds keys of its own). */
	async byKeys(keys: TitleKey[]): Promise<ShowTitle[]> {
		const rows = keys.map((k) => this.b.snap.rowOf(k)).filter((r) => r >= 0)
		return this.titles(rows)
	}

	/** The traits a showcase weighs fit by. */
	private fitTraits(parts: Ingredient[], n = 5) {
		const mine = this.mean(parts)
		const ks = topTraits(mine, this.b.mean, n)
		const lows = topTraits(mine, this.b.mean, 3, -1).filter((k) => this.b.mean[k] - mine[k] > 0.8)
		return {
			ks,
			ws: ks.map((k) => Math.max(0.2, mine[k] - this.b.mean[k])),
			not: { ks: lows, ws: lows.map((k) => this.b.mean[k] - mine[k]) },
		}
	}

	/**
	 * Representative titles of a place: released, well-known, a strong fit, never one this page has shown already
	 * (`used`), and not two of one series. `by`: "fit" (the most typical), "popular" (what people watch now) or
	 * "best" (the best-scored among the well-known). `lines` adds a sentence of the title analysis to each.
	 */
	async showcase(
		parts: Ingredient[],
		n: number,
		opts: {
			by?: "fit" | "popular" | "best"
			lines?: boolean
			used?: Set<TitleKey>
			/** Draw from these rows instead of the place's (kinds, bands). */
			rows?: number[]
		} = {},
	): Promise<ShowTitle[]> {
		const used = opts.used ?? this.used
		const rows = opts.rows ?? this.rows(parts)
		const home = await this.homeTiers(parts, rows)
		const order = this.rank(rows, parts, opts.by ?? "fit", used, home)
		const picked = await this.distinct(order, n, used)
		const terms = opts.lines
			? this.fitTraits(parts).ks.flatMap((k) => [
					keyLabel(VALID_FINGERPRINT_KEYS[k]),
					adjective(VALID_FINGERPRINT_KEYS[k]),
				])
			: []
		return this.titles(picked, opts.lines, terms)
	}

	/** A place's released, well-known, not yet shown rows, best candidates first. */
	private rank(
		rows: number[],
		parts: Ingredient[],
		by: "fit" | "popular" | "best",
		used: Set<TitleKey>,
		/** A country's place: how much each row is the country's own (see `homeTiers`). */
		home: Map<number, number> | null = null,
	): number[] {
		const b = this.b
		// Well-known for real: the place's most-rated released titles.
		let pool = rows
			.filter((r) => released(b, r) && !used.has(this.keyOf(r)))
			.sort((x, y) => votesOf(b, y) - votesOf(b, x))
		if (home) {
			// The country's own titles stand for it; a co-production fills in only where they run short.
			const own = pool.filter((r) => home.get(r) === 0)
			pool =
				own.length >= 30 ? own : [...pool].sort((x, y) => (home.get(x) ?? 2) - (home.get(y) ?? 2))
		}
		pool = pool.slice(0, 240)
		const tier = (r: number) => (home ? (home.get(r) ?? 2) : 0)
		const tiered = (order: number[]) =>
			home
				? order
						.map((r, i) => ({ r, i }))
						.sort((x, y) => tier(x.r) - tier(y.r) || x.i - y.i)
						.map((x) => x.r)
				: order
		if (by === "popular") return tiered(pool.sort((x, y) => b.rank[x] - b.rank[y]))
		if (by === "best") return tiered(ranked(b, pool))
		const { ks, ws, not } = this.fitTraits(parts)
		const fit = new Map(pool.map((r) => [r, fitOf(b, r, ks, ws, not)]))
		return tiered(pool.sort((x, y) => (fit.get(y) ?? 0) - (fit.get(x) ?? 0)))
	}

	/**
	 * For a place with a country in it: how much each of its best-known rows is the country's own. Membership is
	 * production country, so Fight Club is a German title and In the Mood for Love a French one; a card that shows
	 * them for Germany and France looks wrong. 0: made in the country's language and the country leads the
	 * production (or is alone). 1: in its language, as a partner. 2: the rest. Null when no country is in the place.
	 * Only representative picks use this; a country's full list stays every title it helped make.
	 */
	/** A place's most-rated released rows, the ones `homeTiers` reads the original language of. */
	private homeTop(rows: number[]): number[] {
		const b = this.b
		return rows
			.filter((r) => released(b, r))
			.sort((x, y) => votesOf(b, y) - votesOf(b, x))
			.slice(0, 700)
	}

	/**
	 * Reads the original languages that the given countries' showcases need, in one go: a page with many country cards
	 * (the hub's map, the places index) would otherwise read them country by country.
	 */
	async prefetchHomeLanguages(countries: PlaceRef[]): Promise<void> {
		const keys = new Set<TitleKey>()
		for (const p of countries)
			for (const r of this.homeTop(this.rows([{ family: p.family, slug: p.slug }])))
				keys.add(this.keyOf(r))
		await languagesOf([...keys])
	}

	private async homeTiers(
		parts: Ingredient[],
		rows: number[],
	): Promise<Map<number, number> | null> {
		const countries = parts.filter((p) => p.family === "country")
		const facts = this.b.snap.columns.facts
		if (!countries.length || !facts) return null
		const b = this.b
		const c = b.snap.columns
		const n = facts.releaseYears.length
		const top = this.homeTop(rows)
		const langs = await languagesOf(top.map(this.keyOf))
		const out = new Map<number, number>()
		const codes = countries.map((p) => valueOf(this.catalog, p)?.id ?? "")
		const us = facts.countries.indexOf("US")
		const withUs = (r: number) =>
			[0, 1, 2, 3].some((slot) => facts.countryIndexes[slot * n + r] === us)
		for (const r of top) {
			let worst = 0
			for (const code of codes) {
				const idx = facts.countries.indexOf(code)
				const first = facts.countryIndexes[r] === idx
				const alone = first && facts.countryIndexes[n + r] >= facts.countries.length
				const lang = langs.get(c.pointIds[r] as TitleKey)
				const homeLangs = HOME_LANGUAGES[code]
				let tier: number
				if (!homeLangs || !lang) tier = first ? 0 : 2
				else if (!homeLangs.includes(lang)) tier = 2
				// Hollywood lists its partners in any order: an English-language title with the US in it is American,
				// and that makes it a partner's title only second (Oppenheimer is no card for the United Kingdom).
				else if (code === "US") tier = 0
				else if (lang === "en" && !alone && withUs(r)) tier = 1
				else tier = first || alone ? 0 : 1
				worst = Math.max(worst, tier)
			}
			out.set(r, worst)
		}
		return out
	}

	/** The first `n` of ranked rows with no two of one series (Paddington and Paddington 2), marked as used. */
	private async distinct(ranked: number[], n: number, used: Set<TitleKey>): Promise<number[]> {
		const head = ranked.slice(0, n * 2 + 8)
		await this.cards(head.map(this.keyOf))
		const out: number[] = []
		const names: string[] = []
		for (const r of head) {
			if (out.length >= n) break
			const key = this.keyOf(r)
			const card = this.cardCache.get(key)
			if (!card || used.has(key)) continue
			const name = seriesName(card.title)
			if (names.some((x) => sameSeries(x, name))) continue
			names.push(name)
			used.add(key)
			out.push(r)
		}
		return out
	}

	/**
	 * A place's full list. Popular, Top rated (a score that trusts many ratings over few) or Newest; On my services and
	 * Not seen yet as on Discover; an intensity band, a kind, or one side of a two-part blend.
	 */
	async list(
		parts: Ingredient[],
		opts: {
			sort?: Sort
			page?: number
			mine?: boolean
			unseen?: boolean
			level?: Level
			venn?: Venn
			kindId?: string
			year?: number
			size?: number
		} = {},
	): Promise<TitleList> {
		const b = this.b
		const c = b.snap.columns
		const sorted = this.norm(parts)
		let rows = this.rows(sorted)
		if (opts.venn && opts.venn !== "both" && sorted.length === 2) {
			const [a, x] = sorted
			const keep = opts.venn === "a" ? a : x
			const drop = new Set(this.rows([opts.venn === "a" ? x : a]))
			rows = this.rows([keep]).filter((r) => !drop.has(r))
		}
		if (opts.level && sorted.length) rows = this.bandRows(sorted, opts.level)
		if (opts.kindId) rows = this.kindRows(sorted).find((k) => k.id === opts.kindId)?.rows ?? rows
		const facts = c.facts
		if (opts.year && facts) rows = rows.filter((r) => facts.releaseYears[r] === opts.year)
		if (opts.unseen) rows = rows.filter((r) => !this.ctx.seen.has(this.keyOf(r)))
		if (opts.mine && this.ctx.services.length) {
			const services = countryServices(this.ctx.country)
			if (services) {
				const mine = new Set(
					this.ctx.services.map((id) => services.indexOfService(id)).filter((i) => i >= 0),
				)
				rows = rows.filter((r) => {
					const sr = services.rowOf(c.pointIds[r])
					if (sr < 0) return false
					for (let i = services.offsets[sr]; i < services.offsets[sr + 1]; i++)
						if (mine.has(services.entries[i])) return true
					return false
				})
			}
		}
		const sort = opts.sort ?? "popular"
		if (sort === "top") rows = ranked(b, rows)
		else if (sort === "newest")
			rows = rows.filter((r) => released(b, r)).sort((x, y) => c.releaseDays[y] - c.releaseDays[x])
		else rows = [...rows].sort((x, y) => b.rank[x] - b.rank[y])
		const size = opts.size ?? PAGE
		const pages = Math.max(1, Math.min(25, Math.ceil(rows.length / size)))
		const page = Math.min(pages, Math.max(1, opts.page ?? 1))
		return {
			titles: await this.titles(rows.slice((page - 1) * size, page * size)),
			total: rows.length,
			page,
			pages,
			sort,
			discoverHref: this.discoverHref(sorted, sort),
		}
	}

	/** the well-known titles among these keys, most popular first. */
	knownKeys(keys: Iterable<TitleKey>): TitleKey[] {
		const known = knownRows(this.b)
		const rows: number[] = []
		for (const k of keys) {
			const r = this.b.snap.rowOf(k)
			if (r >= 0 && known.has(r)) rows.push(r)
		}
		return rows.sort((x, y) => this.b.rank[x] - this.b.rank[y]).map(this.keyOf)
	}

	/** titles for keys, in their order. */
	titlesOf(keys: TitleKey[]): Promise<ShowTitle[]> {
		return this.titles(keys.map((k) => this.b.snap.rowOf(k)).filter((r) => r >= 0))
	}

	/** What people watch now across the whole kind (place it once per page). */
	popular(n: number, used: Set<TitleKey> = this.used): Promise<ShowTitle[]> {
		const picked: number[] = []
		for (const r of this.b.rows) {
			if (picked.length >= n) break
			const key = this.keyOf(r)
			if (used.has(key) || !released(this.b, r)) continue
			used.add(key)
			picked.push(r)
		}
		return this.titles(picked)
	}

	/** Discover with the same filters, when Discover can express them. */
	discoverHref(parts: Ingredient[], sort: Sort = "popular"): string | null {
		if (parts.some((p) => p.family === "trait" || p.family === "trope")) return null
		const plain = { onMyServices: false, notSeenYet: false }
		const state = defaultFilterState(plain)
		state.type = this.kind
		for (const p of parts) {
			const v = valueOf(this.catalog, p)
			if (!v) continue
			if (p.family === "mood") state.moods = [...state.moods, v.id as never].slice(0, 3)
			if (p.family === "genre") state.genres = [...state.genres, ...(v.ids ?? [v.id])]
			if (p.family === "theme") state.themes = [...state.themes, v.id as never]
			if (p.family === "style") state.styles = [...state.styles, v.id as never]
			if (p.family === "decade") state.years = { min: Number(v.id), max: Number(v.id) + 9 }
			if (p.family === "country")
				state.productionCountries = [...(state.productionCountries ?? []), v.id]
			if (p.family === "service") {
				state.services = [...(state.services ?? []), ...(brandBySlug(v.id)?.ids ?? [])]
				state.streamingCountry = this.country.toUpperCase()
			}
		}
		return `/discover?${filterQuery(state, sort as SortKey, plain)}`
	}

	/** Fingerprint scores of titles (0-10, or an axis's value), keyed by title: for re-sorting in the browser. */
	scores(titles: ShowTitle[], keys: (string | AxisKey)[]): Record<number, number[]> {
		const out: Record<number, number[]> = {}
		for (const t of titles) {
			const r = this.b.snap.rowOf(t.card.key)
			if (r < 0) continue
			const v = this.b.snap.fingerprintAt(r)
			out[t.card.key] = keys.map((key) => {
				if (key in AXES) return round1(axisOf(v, key as AxisKey))
				const x = v[KEY_AT.get(key) as number]
				return x === undefined || x === MISSING ? 0 : x
			})
		}
		return out
	}

	// -----------------------------------------------------------------------------------------------------
	// Character

	private word(k: number, mean: Float64Array, ref: Float64Array): TraitWord {
		const key = VALID_FINGERPRINT_KEYS[k]
		const family = (familyOf(key) ?? "story") as PrintFamily
		return {
			key,
			word: adjective(key),
			label: keyLabel(key),
			family,
			color: FAMILY_COLOR[family],
			dir: mean[k] >= ref[k] ? "more" : "less",
			value: round1(mean[k]),
			base: round1(ref[k]),
			meaning: meaning(key),
			part: { family: "trait", slug: traitSlug(key) },
		}
	}

	/**
	 * What sets a place apart, as words: `more` it has more of than usual, `less` it has less of. `against` compares
	 * with another place instead of with all titles of the kind.
	 */
	traits(
		parts: Ingredient[],
		opts: { n?: number; less?: number; against?: Ingredient[] } = {},
	): { more: TraitWord[]; less: TraitWord[] } {
		const mine = this.mean(parts)
		const ref = opts.against ? this.mean(opts.against) : this.b.mean
		// A trait place would only name itself.
		const own = new Set(
			parts.filter((p) => p.family === "trait").map((p) => valueOf(this.catalog, p)?.id),
		)
		const keep = (k: number) => !own.has(VALID_FINGERPRINT_KEYS[k])
		const more = topTraits(mine, ref, (opts.n ?? 4) + own.size)
			.filter(keep)
			.slice(0, opts.n ?? 4)
		// The trait a person would name first leads (a thriller is tense before it is crime-focused), when the place
		// has more of it than usual.
		const named = !opts.against && parts.length === 1 ? this.namedTrait(parts[0]) : undefined
		if (named !== undefined && mine[named] > ref[named] && more[0] !== named) {
			const rest = more.filter((k) => k !== named)
			more.splice(0, more.length, named, ...rest.slice(0, Math.max(0, (opts.n ?? 4) - 1)))
		}
		return {
			more: more.map((k) => this.word(k, mine, ref)),
			less: topTraits(mine, ref, opts.less ?? 2, -1).map((k) => this.word(k, mine, ref)),
		}
	}

	/**
	 * How much of each fingerprint attribute a place has on average (0-10), by fingerprint key ("political"). For
	 * comparing one attribute across places, such as a theme through the decades. Unknown keys give 0.
	 */
	levels(parts: Ingredient[], keys: string[]): number[] {
		const mine = this.mean(parts)
		return keys.map((key) => {
			const k = KEY_AT.get(key)
			return k === undefined ? 0 : round1(mine[k] * 10) / 10
		})
	}

	/** The same attributes over all titles of the kind: the average and how far titles spread around it. */
	usual(keys: string[]): { mean: number; sd: number }[] {
		return keys.map((key) => {
			const k = KEY_AT.get(key)
			return k === undefined ? { mean: 0, sd: 1 } : { mean: this.b.mean[k], sd: this.b.sd[k] }
		})
	}

	/** The place's whole fingerprint, 74 bars in fingerprint order, against all titles of the kind. */
	print(parts: Ingredient[]): PrintBar[] {
		const mine = this.mean(parts)
		return VALID_FINGERPRINT_KEYS.map((key, k) => {
			const family = (familyOf(key) ?? "story") as PrintFamily
			return {
				key,
				label: keyLabel(key),
				family,
				color: FAMILY_COLOR[family],
				value: round1(mine[k]),
				base: round1(this.b.mean[k]),
			}
		})
	}

	private kindCache = new Map<string, { id: string; rows: number[]; ks: number[] }[]>()
	private kindRows(parts: Ingredient[]) {
		const id = this.norm(parts)
			.map((p) => `${p.family}:${p.slug}`)
			.join("+")
		const hit =
			this.kindCache.get(id) ??
			kindMemo.get(`${this.b.snap.version}|${this.kind}|${this.country}|${id}`)
		if (hit) return hit
		const rows = this.rows(parts)
		const mine = this.mean(parts)
		const raw = rows.length >= 60 ? clustersOf(this.b.snap, rows, rows.length > 600 ? 4 : 3) : []
		const taken = new Set<number>()
		const out = raw
			.sort((a, b) => b.rows.length - a.rows.length)
			.map((cl) => {
				const m = meanOf(this.b.snap, cl.rows)
				const ks = topTraits(m, mine, 5)
					.filter((k) => !taken.has(k))
					.slice(0, 2)
				for (const k of ks) taken.add(k)
				return { id: traitSlug(VALID_FINGERPRINT_KEYS[ks[0] ?? 0]), rows: cl.rows, ks }
			})
		this.kindCache.set(id, out)
		if (kindMemo.size > 600) kindMemo.clear()
		kindMemo.set(`${this.b.snap.version}|${this.kind}|${this.country}|${id}`, out)
		return out
	}

	/**
	 * The kinds inside a place: three or four groups of its titles by fingerprint, each named by what sets it apart
	 * inside the place ("Darkly funny"). A kind's list is the place with `kind_` set to its id.
	 */
	async kinds(parts: Ingredient[], titles = 6): Promise<KindOf[]> {
		const all = this.rows(parts)
		const mine = this.mean(parts)
		const c = this.b.snap.columns
		const groups = this.kindRows(parts)
		const total = groups.reduce((s, g) => s + g.rows.length, 0) || 1
		const placeKey = this.norm(parts)
			.map((p) => `${p.family}:${p.slug}`)
			.join("+")
		const home = await this.homeTiers(parts, all)
		// A kind is shown under a name a person would say (domain/browse/kind-names.ts), or not at all.
		const isShow = (r: number) => c.pointIds[r] >= SHOW_BASE
		// A place that is one kind all but entirely (seven shows carry Romance beside eleven thousand movies) clusters
		// as that kind does.
		const shows = this.kind === "all" ? all.filter(isShow).length : 0
		const only =
			this.kind !== "all" || !all.length
				? undefined
				: shows / all.length >= 0.99
					? "show"
					: shows / all.length <= 0.01
						? "movie"
						: undefined
		const named = groups
			.map((g) => ({ g, name: kindNameOf(this.kind, placeKey, g.id, only) }))
			.filter((x): x is { g: (typeof groups)[number]; name: string } => x.name !== null)
		return Promise.all(
			named.map(async ({ g, name }) => {
				const m = meanOf(this.b.snap, g.rows)
				const words = g.ks.map((k) => this.word(k, m, mine))
				const moodHit = MOODS.map((md, i) => ({
					md,
					n: g.rows.filter((r) => c.moods[r] & (1 << i)).length,
				})).sort((x, y) => y.n - x.n)[0]
				const moodVal =
					moodHit && moodHit.n / g.rows.length >= 0.35
						? this.catalog.mood.find((v) => v.id === moodHit.md.key)
						: undefined
				// Typical titles: fit on the kind's own traits, drawn from the kind's rows.
				const ws = g.ks.map((k) => Math.max(0.2, m[k] - mine[k]))
				const order = g.rows
					.filter((r) => released(this.b, r) && !this.used.has(this.keyOf(r)))
					.sort((x, y) => votesOf(this.b, y) - votesOf(this.b, x))
					.slice(0, 160)
					.map((r) => ({ r, s: fitOf(this.b, r, g.ks, ws), t: home?.get(r) ?? (home ? 2 : 0) }))
					.sort((x, y) => x.t - y.t || y.s - x.s)
					.map((x) => x.r)
				const pool = await this.distinct(order, titles, this.used)
				return {
					id: g.id,
					name,
					share: g.rows.length / total,
					traits: words,
					mood: moodVal ? this.ref(moodVal) : null,
					titles: await this.titles(pool),
				}
			}),
		).then((list) => (all.length ? list : []))
	}

	/** Candidates a place can be compared with: its family's other places, or every family's. */
	private candidates(p: Ingredient, within: "family" | "all"): Ingredient[] {
		const families = within === "family" ? [p.family] : FAMILIES.filter((f) => f !== "trait")
		return families.flatMap((family) =>
			this.catalog[family]
				.filter((v) => !(v.family === p.family && v.slug === p.slug))
				.map((v) => ({ family, slug: v.slug })),
		)
	}

	/**
	 * The places next door: nearest by fingerprint, each with the word that differs ("warmer", "darker") and a poster
	 * trio. `within`: "family" (other moods of a mood) or "all" (every family).
	 */
	async neighbors(
		p: Ingredient,
		opts: { n?: number; within?: "family" | "all"; titles?: number } = {},
	): Promise<Neighbor[]> {
		const mine = this.mean([p])
		const myRows = new Set(this.rows([p]))
		const scored = this.candidates(p, opts.within ?? "family")
			.map((cand) => {
				const rows = this.rows([cand])
				if (rows.length < MIN_PAGE) return null
				let both = 0
				for (const r of rows) if (myRows.has(r)) both++
				const overlap = myRows.size ? both / myRows.size : 0
				// A place that is nearly the same set (Animation and Animated) is not a neighbor.
				if (both / Math.min(rows.length, myRows.size || 1) > 0.92) return null
				return { cand, overlap, sim: similarity(this.b, mine, this.mean([cand])) }
			})
			.filter((x): x is NonNullable<typeof x> => x !== null)
			.sort((a, b) => b.sim + b.overlap * 0.5 - (a.sim + a.overlap * 0.5))
			.slice(0, opts.n ?? 4)
		return Promise.all(
			scored.map(async ({ cand, overlap, sim }) => {
				const theirs = this.mean([cand])
				const k = topTraits(theirs, mine, 1)[0]
				const trait = k === undefined ? null : this.word(k, theirs, mine)
				return {
					place: this.ref(cand),
					differs: trait ? comparative(trait.key, trait.word) : "",
					trait,
					overlap: round1(overlap * 100) / 100,
					similarity: Math.round(sim * 100) / 100,
					titles: opts.titles === 0 ? [] : await this.showcase([cand], opts.titles ?? 3),
				}
			}),
		)
	}

	/** The trait a place's intensity runs on: a trait place's own, otherwise what sets it apart most. */
	private leadTrait(parts: Ingredient[]): number {
		const t = parts.find((p) => p.family === "trait")
		if (t) return KEY_AT.get(valueOf(this.catalog, t)?.id ?? "") ?? TRAIT_KEYS[0]
		const lead =
			parts.find((p) => ["mood", "theme", "style", "genre"].includes(p.family)) ?? parts[0]
		return this.namedTrait(lead) ?? topTraits(this.mean([lead]), this.b.mean, 1)[0]
	}

	/** The trait a person would name for a place (LEAD_TRAITS), as a fingerprint index. */
	private namedTrait(p: Ingredient): number | undefined {
		const key = LEAD_TRAITS[`${p.family}:${this.canon(p.family, p.slug)}`]
		return key ? KEY_AT.get(key) : undefined
	}

	/** The rows of an intensity band: titles of the kind (and the blend's other parts) with that much of the lead. */
	private bandRows(parts: Ingredient[], level: Level): number[] {
		const lead =
			parts.find((p) => p.family === "trait") ??
			parts.find((p) => ["mood", "theme", "style", "genre"].includes(p.family)) ??
			parts[0]
		const k = this.leadTrait(parts)
		const score = levelOf(this.b.snap, this.catalog, lead, VALID_FINGERPRINT_KEYS[k])
		// A genre, decade, country or service stays a hard filter; a mood, theme, style or trait IS the intensity.
		const soft = ["mood", "theme", "style", "trait"].includes(lead.family)
		const others = soft ? parts.filter((p) => !same(p, lead)) : parts
		const [lo, hi] = BAND[level]
		return this.rows(others).filter((r) => {
			const x = score(r)
			return x >= lo && x <= hi
		})
	}

	/**
	 * Intensity: the place's lead trait in three bands (a touch, plenty, all the way), each with titles. "Not always
	 * about the 10's": a touch of scary is its own list. A band's full list is the place with `level` set.
	 */
	async intensity(parts: Ingredient[], titles = 6): Promise<Intensity | null> {
		if (!parts.length) return null
		const k = this.leadTrait(parts)
		if (k === undefined) return null
		const trait = this.word(k, this.mean(parts), this.b.mean)
		const perBand = LEVELS.map((level) => ({ level, rows: this.bandRows(parts, level) }))
		const total = perBand.reduce((s, x) => s + x.rows.length, 0) || 1
		const bands: Band[] = await Promise.all(
			perBand.map(async ({ level, rows }) => ({
				level,
				name: BAND_WORDS[level].name,
				blurb: BAND_WORDS[level].blurb(trait.word),
				share: rows.length / total,
				titles: await this.showcase(parts, titles, { rows, by: "fit" }),
			})),
		)
		return { trait, bands }
	}

	/**
	 * The place on the four named directions (lighter-darker, calmer-more intense, grounded-fantastic, easier-more
	 * demanding), 0-1 across its family, with the nearest place of its family further each way.
	 */
	dials(p: Ingredient): Dial[] {
		const places = [p, ...this.candidates(p, "family")].filter(
			(x) => this.rows([x]).length >= MIN_PAGE,
		)
		return AXIS_KEYS.map((axis) => {
			const at = places.map((x) => ({ x, v: axisOf(this.mean([x]), axis) }))
			const vals = at.map((a) => a.v)
			const lo = Math.min(...vals)
			const hi = Math.max(...vals)
			const mine = at[0].v
			const below = at.filter((a) => a.v < mine - 1e-6).sort((a, b) => b.v - a.v)[0]
			const above = at.filter((a) => a.v > mine + 1e-6).sort((a, b) => a.v - b.v)[0]
			return {
				key: axis,
				low: AXES[axis].low,
				high: AXES[axis].high,
				at: hi > lo ? Math.round(((mine - lo) / (hi - lo)) * 100) / 100 : 0.5,
				lower: below ? this.ref(below.x) : null,
				higher: above ? this.ref(above.x) : null,
			}
		})
	}

	/** A decade: what it is about (words), what rose and fell against the decade before, and each year's standouts. */
	async era(slug: string, perYear = 3, opts: { lines?: boolean } = {}): Promise<Era | null> {
		const val = this.catalog.decade.find((d) => d.slug === slug)
		const facts = this.b.snap.columns.facts
		if (!val || !facts) return null
		const c = this.b.snap.columns
		const from = Number(val.id)
		const part: Ingredient = { family: "decade", slug }
		const rows = this.rows([part])
		const prevVal = this.catalog.decade.find((d) => Number(d.id) === from - 10)
		const prev = prevVal ? this.rows([{ family: "decade", slug: prevVal.slug }]) : []
		const ref = prev.length >= 50 ? prev : this.b.rows
		const share = (set: number[], test: (r: number) => boolean) =>
			set.length ? (set.filter(test).length / set.length) * 100 : 0
		const shifts: (Omit<EraShift, "dir"> & { d: number })[] = [
			...MOODS.map((m, i) => {
				const bit = 1 << i
				const test = (r: number) => (c.moods[r] & bit) !== 0
				const v = this.catalog.mood.find((x) => x.id === m.key)
				const a = share(ref, test)
				const z = share(rows, test)
				return {
					label: m.name,
					place: v ? this.ref(v) : null,
					from: round1(a),
					to: round1(z),
					d: z - a,
				}
			}),
			...this.catalog.genre.map((v) => {
				const test = testOf(this.b.snap, this.catalog, v, this.country) ?? (() => false)
				const a = share(ref, test)
				const z = share(rows, test)
				return {
					label: v.label,
					place: this.ref(v) as PlaceRef | null,
					from: round1(a),
					to: round1(z),
					d: z - a,
				}
			}),
		].filter((s) => s.from + s.to >= 3 && s.place)
		// Romance and Romantic rise together: of two places that share most of the decade's titles, keep the first.
		const rowSet = new Set(rows)
		const untwinned = (list: typeof shifts, n: number) => {
			const kept: { s: (typeof shifts)[number]; set: Set<number> }[] = []
			for (const s of list) {
				if (kept.length >= n) break
				const mine = new Set(this.rows([s.place as Ingredient]).filter((r) => rowSet.has(r)))
				const twin = kept.some(({ set }) => {
					let both = 0
					for (const r of mine) if (set.has(r)) both++
					return both / Math.max(1, Math.min(mine.size, set.size)) > 0.45
				})
				if (!twin) kept.push({ s, set: mine })
			}
			return kept.map((k) => k.s)
		}
		// The decade's true standouts, whatever the page showed before; later showcases then avoid them.
		const local = new Set<TitleKey>()
		const strip = (s: (typeof shifts)[number], dir: "rose" | "fell"): EraShift => ({
			label: s.label,
			place: s.place,
			dir,
			from: s.from,
			to: s.to,
		})
		const years = await Promise.all(
			Array.from({ length: 10 }, async (_, i) => {
				const year = from + i
				const pool = rows.filter((r) => facts.releaseYears[r] === year)
				return {
					year,
					titles: await this.showcase([part], perYear, {
						rows: pool,
						by: "best",
						used: local,
						lines: opts.lines,
					}),
				}
			}),
		)
		for (const key of local) this.used.add(key)
		return {
			label: val.label,
			startYear: from,
			traits: this.traits([part], { n: 4 }).more,
			rose: untwinned(
				[...shifts].sort((a, b) => b.d - a.d).filter((s) => s.d > 0),
				3,
			).map((s) => strip(s, "rose")),
			fell: untwinned(
				[...shifts].sort((a, b) => a.d - b.d).filter((s) => s.d < 0),
				3,
			).map((s) => strip(s, "fell")),
			years: years.filter((y) => y.titles.length),
		}
	}

	/**
	 * What a service is good at in a country: the moods and genres it has more of than the average service there.
	 * `only` keeps one family (the service page says it in moods, which carry their own colors).
	 */
	serviceProfile(
		slug: string,
		country = this.country,
		only?: "mood" | "genre",
	): ServiceProfile | null {
		const val = this.catalog.service.find((s) => s.slug === slug)
		if (!val) return null
		const code = country.toUpperCase()
		const named = regionName.of(code) ?? code
		const service = this.ref({ family: "service", slug })
		const empty: ServiceProfile = {
			service,
			country: code,
			countryName: /^United |Netherlands|Philippines/.test(named) ? `the ${named}` : named,
			loaded: false,
			goodAt: [],
			thinOn: [],
			others: [],
		}
		const brands = brandRows(this.b, country)
		if (!brands) return empty
		const c = this.b.snap.columns
		const sized = [...brands.entries()]
			.filter(([, rows]) => rows.length >= 30)
			.sort((a, b) => b[1].length - a[1].length)
		const rows = brands.get(val.id) ?? []
		if (!rows.length) return { ...empty, loaded: true }
		const share = (set: number[], test: (r: number) => boolean) =>
			set.length ? set.filter(test).length / set.length : 0
		const index = (test: (r: number) => boolean) => {
			const shares = sized.map(([, rs]) => share(rs, test))
			const avg = shares.length ? shares.reduce((s, x) => s + x, 0) / shares.length : 0
			const mine = share(rows, test)
			return { times: avg ? Math.round((mine / avg) * 100) / 100 : 0, mine }
		}
		const scored = [
			...MOODS.map((m, i) => {
				const v = this.catalog.mood.find((x) => x.id === m.key)
				return { v, ...index((r) => (c.moods[r] & (1 << i)) !== 0) }
			}),
			...this.catalog.genre.map((v) => ({
				v: v as CatalogValue | undefined,
				...index(testOf(this.b.snap, this.catalog, v, this.country) ?? (() => false)),
			})),
		].filter((x) => x.v && x.mine >= 0.04 && (!only || x.v.family === only))
		const refOf = (x: (typeof scored)[number]) => ({
			place: this.ref(x.v as Ingredient),
			times: x.times,
		})
		// Scary and Horror say the same thing twice: of two places that share most of the service's titles, keep one.
		const distinct = (list: typeof scored, n: number) => {
			const kept: { x: (typeof scored)[number]; set: Set<number> }[] = []
			for (const x of list) {
				if (kept.length >= n) break
				const mine = new Set(this.rows([x.v as Ingredient]).filter((r) => rowSet.has(r)))
				const twin = kept.some(({ set }) => {
					let both = 0
					for (const r of mine) if (set.has(r)) both++
					return both / Math.max(1, Math.min(mine.size, set.size)) > 0.45
				})
				if (!twin) kept.push({ x, set: mine })
			}
			return kept.map((k) => k.x)
		}
		const rowSet = new Set(rows)
		return {
			...empty,
			loaded: true,
			goodAt: distinct(
				[...scored].sort((a, b) => b.times - a.times).filter((x) => x.times > 1.05),
				3,
			).map(refOf),
			thinOn: distinct(
				[...scored].sort((a, b) => a.times - b.times).filter((x) => x.times < 0.9),
				2,
			).map(refOf),
			others: sized
				.filter(([s]) => s !== val.id)
				.map(([s]) => this.ref({ family: "service", slug: s })),
		}
	}

	// -----------------------------------------------------------------------------------------------------
	// Best

	private sourcesOf(r: number): Partial<Record<SourceKey, number>> {
		const sources = this.b.snap.columns.facts?.sources
		const out: Partial<Record<SourceKey, number>> = {}
		if (!sources) return out
		for (const src of SRC) {
			const x = sources[src][r]
			if (x !== UNKNOWN_SCORE) out[src] = x
		}
		return out
	}

	/**
	 * Best: without filters, the published Best list (the real ranking). With ingredients or a year ("best cozy movies
	 * of 2026"), the place's titles ranked by a score that trusts many ratings over few. Every row carries each
	 * source's own score.
	 */
	async best(
		opts: {
			parts?: Ingredient[]
			year?: number
			limit?: number
			offset?: number
			/** All time: leave out titles too new for their score to have settled (domain/top-lists.ts). */
			settled?: boolean
		} = {},
	): Promise<BestList> {
		const b = this.b
		const c = b.snap.columns
		const parts = this.norm(opts.parts ?? [])
		const limit = opts.limit ?? 50
		const offset = opts.offset ?? 0
		const genresOf = (r: number) => c.genreNames.filter((_, g) => c.genres[r] & (1 << g))
		let rows: number[]
		let published = false
		if (!parts.length && !opts.year) {
			const lists = await Promise.all(
				this.medias.map((m) => getRankedList(titleKindOf(m === "show" ? "shows" : "movies"))),
			)
			rows = lists.flatMap(({ titles }) =>
				titles.map((t) => b.snap.rowOf(titleKey(t.media_type, t.tmdb_id))).filter((r) => r >= 0),
			)
			// Movies and shows together: both published rankings, merged by the GoodWatch score (more ratings first on
			// a tie).
			if (lists.length > 1)
				rows.sort((x, y) => c.scores[y] - c.scores[x] || c.votes[y] - c.votes[x])
			published = true
		} else {
			const facts = c.facts
			rows = this.rows(parts).filter(
				(r) =>
					released(b, r) &&
					(!opts.year || facts?.releaseYears[r] === opts.year) &&
					(!opts.settled || isSettled(facts?.releaseYears[r] || null)),
			)
			// The bar for "enough ratings" comes from the set itself: a year of the 1930s, a shelf of shows and last
			// year's movies are rated on very different scales.
			rows = ranked(b, rows)
		}
		const shown = rows.slice(offset, offset + limit)
		const titles = await this.titles(shown)
		const byKey = new Map(titles.map((t) => [t.card.key, t]))
		const out: BestRow[] = shown.flatMap((r, i) => {
			const title = byKey.get(this.keyOf(r))
			return title
				? [{ rank: offset + i + 1, title, genres: genresOf(r), sources: this.sourcesOf(r) }]
				: []
		})
		return { rows: out, total: rows.length, published }
	}

	// -----------------------------------------------------------------------------------------------------
	// People and awards (read-only SELECTs over the place's best-known titles)

	/** The tmdb ids of a place's best-known titles of one media type. */
	private topIds(parts: Ingredient[], n: number, media: "movie" | "show"): number[] {
		const c = this.b.snap.columns
		const off = media === "show" ? SHOW_BASE : 1e12
		return this.rows(parts)
			.filter((r) => c.pointIds[r] >= SHOW_BASE === (media === "show"))
			.sort((x, y) => c.votes[y] - c.votes[x])
			.slice(0, n)
			.map((r) => c.pointIds[r] - off)
	}
	private get medias(): ("movie" | "show")[] {
		return this.kind === "all" ? ["movie", "show"] : [this.kind]
	}

	/**
	 * The people of a place: who directed (movies) or created (shows) the most of its best-known titles, and who
	 * acts in the most. Each links to their /person page.
	 */
	async people(parts: Ingredient[], n = 6): Promise<Person[]> {
		const per = await Promise.all(this.medias.map((m) => this.peopleOf(parts, n, m)))
		if (per.length === 1) return per[0]
		// Movies and shows together: who made them first, then who acts in them, the busiest first, nobody twice.
		const seen = new Set<number>()
		const all = per.flat().filter((p) => !seen.has(p.id) && seen.add(p.id))
		const group = (p: Person) => (p.role === "Actor" ? 1 : 0)
		const sorted = all.sort((a, b) => group(a) - group(b) || b.titles - a.titles)
		const makers = sorted.filter((p) => group(p) === 0).slice(0, n)
		const actors = sorted.filter((p) => group(p) === 1).slice(0, n)
		return [...makers, ...actors]
	}

	private async peopleOf(
		parts: Ingredient[],
		n: number,
		media: "movie" | "show",
	): Promise<Person[]> {
		const ids = this.topIds(parts, 400, media)
		if (ids.length < 12) return []
		const id = `people|${this.b.snap.version}|${media}|${ids.length}|${ids.slice(0, 8).join(",")}|${ids[ids.length - 1]}`
		return cachedSql(id, async () => {
			const marks = ids.map(() => "?").join(",")
			const job = media === "show" ? "Creator" : "Director"
			const [makers, actors] = await Promise.all([
				query<{ person_tmdb_id: number; n: number }>(
					`SELECT person_tmdb_id, count(DISTINCT media_tmdb_id) AS n FROM person_worked_on
					 WHERE media_type = ? AND job = ? AND media_tmdb_id IN (${marks})
					 GROUP BY person_tmdb_id ORDER BY n DESC, person_tmdb_id LIMIT ?`,
					[media, job, ...ids, n],
				).catch(() => []),
				query<{ person_tmdb_id: number; n: number }>(
					`SELECT person_tmdb_id, count(DISTINCT media_tmdb_id) AS n FROM person_appeared_in
					 WHERE media_type = ? AND order_default < 3 AND media_tmdb_id IN (${marks})
					 GROUP BY person_tmdb_id ORDER BY n DESC, person_tmdb_id LIMIT ?`,
					[media, ...ids, n],
				).catch(() => []),
			])
			const wanted = [...makers, ...actors].filter((p) => p.n >= 2)
			if (!wanted.length) return []
			const persons = await query<{ tmdb_id: number; name: string; profile_path: string | null }>(
				`SELECT tmdb_id, name, profile_path FROM person WHERE tmdb_id IN (${wanted.map(() => "?").join(",")})`,
				wanted.map((p) => p.person_tmdb_id),
			).catch(() => [])
			const byId = new Map(persons.map((p) => [p.tmdb_id, p]))
			const seen = new Set<number>()
			const make = (rows: typeof makers, role: Person["role"]) =>
				rows.flatMap((row): Person[] => {
					const p = byId.get(row.person_tmdb_id)
					if (!p || row.n < 2 || seen.has(p.tmdb_id)) return []
					seen.add(p.tmdb_id)
					return [
						{
							id: p.tmdb_id,
							name: p.name,
							photo: p.profile_path,
							role,
							to: personPath(p.tmdb_id, p.name),
							titles: Number(row.n),
							known: [],
						},
					]
				})
			return [...make(makers, media === "show" ? "Creator" : "Director"), ...make(actors, "Actor")]
		})
	}

	/** Award winners of a place: its best-known titles that won at the big ceremonies, the headline wins first. */
	async awards(parts: Ingredient[], n = 6): Promise<AwardWin[]> {
		const per = await Promise.all(this.medias.map((m) => this.awardsOf(parts, n, m)))
		if (per.length === 1) return per[0]
		// Movies and shows together: take turns, movies first.
		const out: AwardWin[] = []
		for (let i = 0; out.length < n && i < n; i++)
			for (const list of per) if (list[i] && out.length < n) out.push(list[i])
		return out
	}

	private async awardsOf(
		parts: Ingredient[],
		n: number,
		media: "movie" | "show",
	): Promise<AwardWin[]> {
		const ids = this.topIds(parts, 500, media)
		if (!ids.length) return []
		const id = `awards|${this.b.snap.version}|${media}|${ids.length}|${ids.slice(0, 8).join(",")}|${ids[ids.length - 1]}`
		const wins = await cachedSql(id, () =>
			query<{
				media_tmdb_id: number
				award_name: string
				category_name: string
				ceremony_year: string
			}>(
				`SELECT media_tmdb_id, award_name, category_name, ceremony_year FROM award_title_display
				 WHERE media_type = ? AND has_win = true AND award_name IN (?, ?, ?, ?)
				 AND media_tmdb_id IN (${ids.map(() => "?").join(",")}) LIMIT 3000`,
				[
					media,
					"Academy Awards",
					"Primetime Emmy Awards",
					"Golden Globe Awards",
					"BAFTA Awards",
					...ids,
				],
			).catch(() => []),
		)
		const headline = (cat: string) =>
			/best (motion )?picture|best film$|outstanding (drama|comedy|limited|animated).*(series|program)|best (animated|international|documentary) feature|best television series/i.test(
				cat,
			)
				? 2
				: /director|screenplay|actor|actress/i.test(cat)
					? 1
					: 0
		const bodyRank = (a: string) =>
			["Academy Awards", "Primetime Emmy Awards", "Golden Globe Awards", "BAFTA Awards"].indexOf(a)
		const order = new Map(ids.map((x, i) => [x, i]))
		const bestPer = new Map<number, (typeof wins)[number]>()
		for (const w of wins) {
			const cur = bestPer.get(w.media_tmdb_id)
			const better =
				!cur ||
				headline(w.category_name) > headline(cur.category_name) ||
				(headline(w.category_name) === headline(cur.category_name) &&
					bodyRank(w.award_name) < bodyRank(cur.award_name))
			if (better) bestPer.set(w.media_tmdb_id, w)
		}
		const picked = [...bestPer.values()]
			.sort(
				(a, b) =>
					headline(b.category_name) - headline(a.category_name) ||
					(order.get(a.media_tmdb_id) ?? 0) - (order.get(b.media_tmdb_id) ?? 0),
			)
			.slice(0, n)
		const titles = await this.byKeys(picked.map((w) => titleKey(media, w.media_tmdb_id)))
		const byId = new Map(titles.map((t) => [t.card.tmdb_id, t]))
		return picked.flatMap((w): AwardWin[] => {
			const title = byId.get(w.media_tmdb_id)
			const body = AWARD_BODIES.find((x) => x.official === w.award_name)
			if (!title || !body) return []
			return [
				{
					title,
					award: body.name.replace(/s$/, ""),
					category: w.category_name,
					year: w.ceremony_year,
					to: `/awards/${body.slug}`,
				},
			]
		})
	}

	// -----------------------------------------------------------------------------------------------------
	// Blends

	/**
	 * A blend of any number of ingredients from any family (two of one family are fine). `suggestions`: what goes
	 * well with it and still leaves a full page, each with posters. `swaps`: per part, its siblings that work in its
	 * place. `venn` for two parts.
	 */
	async blend(
		partsIn: Ingredient[],
		opts: { suggestions?: number; titles?: number; families?: Family[] } = {},
	): Promise<Blend> {
		const parts = this.norm(partsIn)
		const rows = this.rows(parts)
		const set = new Set(rows)
		const families = opts.families ?? FAMILIES.filter((f) => f !== "trait")
		const taken = (p: Ingredient) => parts.some((x) => same(x, p))
		// Lift: how much more often the candidate turns up in the blend than in the whole kind.
		const scored = families
			.flatMap((family) => this.catalog[family].map((v) => ({ family, slug: v.slug })))
			.filter((p) => !taken(p))
			.map((p) => {
				const theirs = this.rows([p])
				let both = 0
				if (theirs.length < rows.length) {
					for (const r of theirs) if (set.has(r)) both++
				} else {
					const t = new Set(theirs)
					for (const r of rows) if (t.has(r)) both++
				}
				const expected = (rows.length * theirs.length) / Math.max(1, this.b.rows.length)
				return { p, both, lift: expected ? both / expected : 0 }
			})
			// Not the whole blend again (Animation inside Animated), not a thin page.
			.filter((x) => x.both >= MIN_PAGE && x.both < rows.length * 0.9)
			.sort((a, b) => b.lift * Math.log10(b.both) - a.lift * Math.log10(a.both))
		// Family the genre and Family the theme are one suggestion: skip a candidate whose blend is mostly one already
		// picked. At most two per family, so the row offers different ways on.
		const perFamily = new Map<Family, number>()
		const top: typeof scored = []
		const picked: Set<number>[] = []
		for (const x of scored.slice(0, 60)) {
			if (top.length >= (opts.suggestions ?? 8)) break
			const n = perFamily.get(x.p.family) ?? 0
			if (n >= 2) continue
			const mine = new Set(this.rows([...parts, x.p]))
			const twin = picked.some((other) => {
				let both = 0
				for (const r of mine) if (other.has(r)) both++
				return both / Math.max(1, Math.min(mine.size, other.size)) > 0.45
			})
			if (twin || top.some((t) => this.ref(t.p).label === this.ref(x.p).label)) continue
			perFamily.set(x.p.family, n + 1)
			picked.push(mine)
			top.push(x)
		}
		const suggestions: Suggestion[] = await Promise.all(
			top.map(async (x) => ({
				place: this.ref(x.p),
				count: x.both,
				titles: await this.showcase([...parts, x.p], opts.titles ?? 3),
			})),
		)
		const swaps = parts.map((part) => {
			const rest = parts.filter((x) => !same(x, part))
			const options = this.catalog[part.family]
				.map((v) => ({ family: part.family, slug: v.slug }))
				.filter((p) => !taken(p) && this.count([...rest, p]) >= MIN_PAGE)
				.map((p) => this.ref(p))
			return { part: this.ref(part), options }
		})
		let venn: Blend["venn"] = null
		if (parts.length === 2) {
			const a = this.count([parts[0]])
			const x = this.count([parts[1]])
			venn = { a: a - rows.length, both: rows.length, b: x - rows.length }
		}
		// What only the blend has: traits above every single part's level.
		let traits: TraitWord[] = []
		if (parts.length >= 2 && rows.length >= 5) {
			const mine = this.mean(parts)
			const ceiling = new Float64Array(K)
			for (const p of parts) {
				const m = this.mean([p])
				for (let k = 0; k < K; k++) ceiling[k] = Math.max(ceiling[k], m[k])
			}
			traits = topTraits(mine, ceiling, 3).map((k) => this.word(k, mine, ceiling))
		} else if (parts.length === 1) traits = this.traits(parts, { n: 3 }).more
		return {
			parts: parts.map((p) => this.ref(p)),
			count: rows.length,
			name: this.name(parts),
			venn,
			traits,
			suggestions,
			swaps,
		}
	}

	/**
	 * Blends worth a card on a hub: pairs across families that are much more common together than chance, with a full
	 * page each ("Cozy comedies", "Dark Korean thrillers").
	 */
	async famousBlends(
		n = 8,
		titles = 3,
	): Promise<{ parts: PlaceRef[]; name: string; titles: ShowTitle[] }[]> {
		const pairs: [Family, Family][] = [
			["mood", "genre"],
			["mood", "decade"],
			["genre", "country"],
			["mood", "country"],
			["genre", "decade"],
			["mood", "service"],
		]
		const total = this.b.rows.length
		const out: { parts: Ingredient[]; score: number; fam: string }[] = []
		for (const [fa, fb] of pairs) {
			const best: { parts: Ingredient[]; score: number; fam: string }[] = []
			for (const a of this.catalog[fa])
				for (const x of this.catalog[fb]) {
					const parts = [
						{ family: fa, slug: a.slug },
						{ family: fb, slug: x.slug },
					]
					if (a.slug === "tv-movie" || x.slug === "tv-movie") continue
					const both = this.count(parts)
					if (both < 120) continue
					const na = this.count([parts[0]])
					const nb = this.count([parts[1]])
					// Two names for one thing (Fantasy and Other worlds) are not a blend.
					if (both > Math.min(na, nb) * 0.5) continue
					if (similarity(this.b, this.mean([parts[0]]), this.mean([parts[1]])) > 0.78) continue
					const lift = both / ((na * nb) / total)
					best.push({ parts, score: Math.min(lift, 5) * Math.log10(both) ** 2, fam: `${fa}+${fb}` })
				}
			out.push(...best.sort((p, q) => q.score - p.score).slice(0, 3))
		}
		// Round-robin over the family pairs, never the same place twice.
		const seen = new Set<string>()
		const picked: typeof out = []
		const byFam = new Map<string, typeof out>()
		for (const x of out) byFam.set(x.fam, [...(byFam.get(x.fam) ?? []), x])
		for (let round = 0; picked.length < n && round < 3; round++)
			for (const list of byFam.values()) {
				const x = list[round]
				if (!x || picked.length >= n) continue
				const ids = x.parts.map((p) => `${p.family}:${p.slug}`)
				if (ids.some((id) => seen.has(id))) continue
				for (const id of ids) seen.add(id)
				picked.push(x)
			}
		return Promise.all(
			picked.map(async (x) => ({
				parts: x.parts.map((p) => this.ref(p)),
				name: this.name(x.parts),
				titles: await this.showcase(x.parts, titles),
			})),
		)
	}
}

const kindMemo = new Map<string, { id: string; rows: number[]; ks: number[] }[]>()

/**
 * The trait a person would name first for a place, where the numbers pick another. By the numbers a thriller's
 * strongest trait is crime and a tense title's is bleakness, which made dials ask "How crime-focused?" on Thriller
 * and "How bleak?" on Tense. Places not listed take their strongest trait.
 */
const LEAD_TRAITS: Record<string, string> = {
	"genre:thriller": "tension",
	"genre:horror": "scare",
	"genre:comedy": "situational_comedy",
	"genre:romance": "romance",
	"genre:action": "adrenaline",
	"genre:action-adventure": "adrenaline",
	"genre:drama": "pathos",
	"genre:mystery": "mystery",
	"genre:fantasy": "fantasy",
	"genre:science-fiction": "futuristic",
	"genre:family": "wholesome",
	"genre:kids": "wholesome",
	"genre:history": "historical",
	"genre:war": "warfare",
	"genre:war-politics": "political",
	"genre:music": "music_centrality",
	"mood:tense": "tension",
}

/**
 * The languages a country's own titles are made in (TMDB codes; "cn" is Cantonese). A country missing here is
 * judged by who leads the production alone.
 */
const HOME_LANGUAGES: Record<string, string[]> = {
	US: ["en"],
	GB: ["en"],
	CA: ["en", "fr"],
	AU: ["en"],
	NZ: ["en", "mi"],
	IE: ["en", "ga"],
	FR: ["fr"],
	DE: ["de"],
	AT: ["de"],
	CH: ["de", "fr", "it"],
	IT: ["it"],
	ES: ["es", "ca", "eu", "gl"],
	PT: ["pt"],
	BR: ["pt"],
	MX: ["es"],
	AR: ["es"],
	CL: ["es"],
	CO: ["es"],
	JP: ["ja"],
	KR: ["ko"],
	CN: ["zh", "cn"],
	HK: ["cn", "zh"],
	TW: ["zh", "cn"],
	IN: ["hi", "ta", "te", "ml", "kn", "bn", "mr", "pa", "gu"],
	SE: ["sv"],
	DK: ["da"],
	NO: ["no", "nb"],
	FI: ["fi"],
	IS: ["is"],
	NL: ["nl"],
	BE: ["fr", "nl"],
	RU: ["ru"],
	SU: ["ru"],
	PL: ["pl"],
	CZ: ["cs"],
	HU: ["hu"],
	RO: ["ro"],
	GR: ["el"],
	TR: ["tr"],
	IR: ["fa"],
	IL: ["he"],
	EG: ["ar"],
	TH: ["th"],
	ID: ["id"],
	PH: ["tl", "en"],
	ZA: ["en", "af", "zu"],
}

/** Original language by title (read-only SELECT, kept for the life of the process: it never changes). */
const languageCache = new Map<TitleKey, string>()
async function languagesOf(keys: TitleKey[]): Promise<Map<TitleKey, string>> {
	const missing = keys.filter((k) => !languageCache.has(k))
	// Chunks of 400 ids, a few at a time: a page of many countries asks for thousands of titles at once.
	const read = async (table: "movie" | "show", ids: number[]) => {
		const chunks: number[][] = []
		for (let i = 0; i < ids.length; i += 400) chunks.push(ids.slice(i, i + 400))
		let next = 0
		const worker = async () => {
			for (let i = next++; i < chunks.length; i = next++) {
				const chunk = chunks[i]
				const rows = await query<{ tmdb_id: number; original_language_code: string | null }>(
					`SELECT tmdb_id, original_language_code FROM ${table} WHERE tmdb_id IN (${chunk.map(() => "?").join(",")}) LIMIT 400`,
					chunk,
				).catch(() => [])
				for (const row of rows)
					languageCache.set(titleKey(table, row.tmdb_id), row.original_language_code ?? "")
			}
		}
		await Promise.all(Array.from({ length: Math.min(4, chunks.length) }, worker))
	}
	if (missing.length)
		await Promise.all([
			read(
				"movie",
				missing.filter((k) => k < SHOW_BASE).map((k) => k - 1e12),
			),
			read(
				"show",
				missing.filter((k) => k >= SHOW_BASE).map((k) => k - SHOW_BASE),
			),
		])
	return languageCache
}

/** A title without what marks it as one of a series: "Paddington 2" and "Paddington" are "paddington". */
function seriesName(title: string): string {
	return title
		.toLowerCase()
		.replace(/^the /, "")
		.split(/:| - | – /)[0]
		.replace(/\b(part|chapter|vol\.?|volume)\s+\w+$/i, "")
		.replace(/\s+(\d+|ii|iii|iv|v|vi)$/i, "")
		.trim()
}
function sameSeries(a: string, b: string): boolean {
	if (a === b) return true
	let i = 0
	while (i < a.length && i < b.length && a[i] === b[i]) i++
	// A long shared start that ends on a word: "harry potter and the ...".
	return i >= 12 && (a[i - 1] === " " || a[i] === " " || b[i] === " ")
}

/** The sentence of a title analysis that names the page's traits most; the first one otherwise. */
function pickSentence(text: string, terms: string[]): string {
	const sentences = text.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()) ?? [text]
	const words = terms.flatMap((t) => t.toLowerCase().split(/[^a-z]+/)).filter((w) => w.length > 3)
	let best = sentences[0]
	let bestHits = 0
	sentences.forEach((s, i) => {
		const low = s.toLowerCase()
		const hits = words.filter((w) => low.includes(w.slice(0, 5))).length - i * 0.01
		if (hits > bestHits) {
			best = s
			bestHits = hits
		}
	})
	return best
}

export { MOOD_KEYS }
