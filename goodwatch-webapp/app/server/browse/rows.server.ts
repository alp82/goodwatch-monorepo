// The rows under Browse's place data: which snapshot rows belong to a place, their average fingerprint, and the math on
// top (trait differences, defining rows, clusters). Deterministic and memoized per snapshot version.
import { MOOD_KEYS } from "~/domain/moods"
import { BRANDS, brandOfService } from "~/domain/new-on-services"
import { STYLES, STYLE_KEYS, THEMES, THEME_KEYS, type TitleRule } from "~/domain/themes-styles"
import { countryServices } from "~/server/availability-index.server"
import {
	FLAG_ADULT,
	FLAG_POSTER,
	SHOW_BASE,
	UNKNOWN_DAY,
	UNKNOWN_SCORE,
} from "~/server/title-snapshot/format.server"
import type { TitleKey } from "~/utils/title-key"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import { VALID_FINGERPRINT_KEYS } from "~/server/utils/fingerprint"
import { getCounts } from "./counts.server"
import type { Family, Ingredient, Kind, Level } from "~/domain/browse/address"
import { TROPES } from "~/domain/tropes/catalog"
import { tropeMembers, tropesVersion } from "./tropes.server"

export type Snap = NonNullable<ReturnType<typeof getTitleSnapshot>>

export const K = VALID_FINGERPRINT_KEYS.length
export const MISSING = 255
export const MIN_VOTES = 1000
export const KEY_AT = new Map(VALID_FINGERPRINT_KEYS.map((k, i) => [k as string, i]))

/** The attributes that say what a title is like (not how well it is made). They are the trait family's places. */
export const TRAIT_NAMES = [
	"adrenaline",
	"tension",
	"scare",
	"violence",
	"romance",
	"eroticism",
	"wholesome",
	"wonder",
	"pathos",
	"melancholy",
	"uncanny",
	"catharsis",
	"nostalgia",
	"situational_comedy",
	"wit_wordplay",
	"physical_comedy",
	"cringe_humor",
	"absurdist_humor",
	"satire_parody",
	"dark_humor",
	"fantasy",
	"futuristic",
	"historical",
	"contemporary_realism",
	"crime",
	"mystery",
	"warfare",
	"political",
	"sports",
	"biographical",
	"coming_of_age",
	"family_dynamics",
	"psychological",
	"showbiz",
	"gaming",
	"pop_culture",
	"social_commentary",
	"class_and_capitalism",
	"technology_and_humanity",
	"spiritual",
	"slow_burn",
	"fast_pace",
	"complexity",
	"hopefulness",
	"bleakness",
	"ambiguity",
	"surrealism",
	"eccentricity",
	"philosophical",
	"spectacle",
	"visual_stylization",
	"psychedelic",
	"grotesque",
	"camp_and_irony",
	"music_centrality",
] as const
export const TRAIT_KEYS = TRAIT_NAMES.map((k) => KEY_AT.get(k) as number)
export const traitSlug = (key: string) => key.replace(/_/g, "-")
export const traitKeyOfSlug = (slug: string) => slug.replace(/-/g, "_")

/** Intensity bands on a 0-10 score. */
export const BAND: Record<Level, [number, number]> = {
	touch: [4, 6],
	plenty: [7, 8],
	full: [9, 10],
}

// ---------------------------------------------------------------------------------------------------------
// Base rows

export interface Base {
	snap: Snap
	kind: Kind
	/** Well-known titles of the kind (poster, score, 1,000+ ratings, not adult), most popular first. */
	rows: number[]
	/** Position of a row in `rows` (popularity rank), -1 when it is not well-known. */
	rank: Int32Array
	/** The average fingerprint of `rows`. */
	mean: Float64Array
	/** Standard deviation of each score over `rows`. */
	sd: Float64Array
	/**
	 * Movies and shows together: what a show's rating count is multiplied by to stand beside a movie's (shows are
	 * rated far less often). 1 for one kind alone.
	 */
	showVotes: number
	today: number
}

const baseCache = new Map<string, Base>()

export function base(kind: Kind): Base | null {
	const snap = getTitleSnapshot()
	if (!snap) return null
	const id = `${snap.version}|${kind}`
	const hit = baseCache.get(id)
	if (hit) return hit
	const c = snap.columns
	const rows: number[] = []
	for (let r = 0; r < snap.count; r++) {
		if (!(c.flags[r] & FLAG_POSTER) || c.flags[r] & FLAG_ADULT) continue
		if (c.scores[r] === UNKNOWN_SCORE || c.votes[r] < MIN_VOTES) continue
		if (kind !== "all" && c.pointIds[r] >= SHOW_BASE !== (kind === "show")) continue
		rows.push(r)
	}
	rows.sort((a, b) => c.popularity[b] - c.popularity[a])
	let showVotes = 1
	if (kind === "all") {
		// The 100th most-rated movie against the 100th most-rated show.
		const nth = (show: boolean) =>
			rows
				.filter((r) => c.pointIds[r] >= SHOW_BASE === show)
				.map((r) => c.votes[r])
				.sort((a, b) => b - a)[99] ?? 0
		const [m, sh] = [nth(false), nth(true)]
		if (m && sh) showVotes = Math.max(1, m / sh)
	}
	if (kind === "all") {
		// Popularity runs on different scales for movies and shows (shows would fill the whole top). Take turns
		// instead: each title by how far down its own kind's order it sits.
		const isShow = (r: number) => c.pointIds[r] >= SHOW_BASE
		const total = [rows.filter((r) => !isShow(r)).length, rows.filter(isShow).length]
		const seen = [0, 0]
		const depth = new Map<number, number>()
		for (const r of rows) {
			const k = isShow(r) ? 1 : 0
			depth.set(r, seen[k]++ / Math.max(1, total[k]))
		}
		rows.sort((a, b) => (depth.get(a) ?? 0) - (depth.get(b) ?? 0))
	}
	const rank = new Int32Array(snap.count).fill(-1)
	rows.forEach((r, i) => {
		rank[r] = i
	})
	const mean = meanOf(snap, rows)
	const sd = new Float64Array(K)
	const cnt = new Float64Array(K)
	for (const r of rows) {
		const v = snap.fingerprintAt(r)
		for (let k = 0; k < K; k++)
			if (v[k] !== MISSING) {
				sd[k] += (v[k] - mean[k]) ** 2
				cnt[k]++
			}
	}
	for (let k = 0; k < K; k++) sd[k] = Math.sqrt(sd[k] / Math.max(1, cnt[k])) || 1
	const out: Base = {
		snap,
		kind,
		rows,
		rank,
		mean,
		sd,
		showVotes,
		today: Math.floor(Date.now() / 864e5),
	}
	if (baseCache.size > 8) baseCache.clear()
	baseCache.set(id, out)
	return out
}

/** How many ratings a title has, on one scale for movies and shows when both are listed together. */
export const votesOf = (b: Base, r: number) => {
	const c = b.snap.columns
	return b.showVotes !== 1 && c.pointIds[r] >= SHOW_BASE ? c.votes[r] * b.showVotes : c.votes[r]
}

export const released = (b: Base, r: number) => {
	const d = b.snap.columns.releaseDays[r]
	return d !== UNKNOWN_DAY && d <= b.today
}

// ---------------------------------------------------------------------------------------------------------
// Catalog

export interface CatalogValue {
	family: Family
	slug: string
	label: string
	/** Mood/theme/style key, genre name, a decade's first year, country code, brand slug, fingerprint key. */
	id: string
	/** A merged genre: every genre name it holds (`id` is the first). */
	ids?: string[]
	/** Other slugs that lead here: a merged genre's parts, a slug an older address used. */
	aliases?: string[]
}
export type Catalog = Record<Family, CatalogValue[]>

/**
 * Movies and shows together: the genres that one kind splits and the other doesn't are one place each. Movies know
 * Action and Adventure, shows only Action & Adventure; a list of both that kept all three would show two half-empty
 * shelves and one that is shows only. The merged place takes the wider name and holds every title of its parts; the
 * parts' own slugs (`/all/genres/science-fiction`) lead to it.
 */
const GENRE_MERGE: { slug: string; label: string; names: string[] }[] = [
	{
		slug: "action-adventure",
		label: "Action & Adventure",
		names: ["Action & Adventure", "Action", "Adventure"],
	},
	{
		slug: "sci-fi-fantasy",
		label: "Sci-Fi & Fantasy",
		names: ["Sci-Fi & Fantasy", "Science Fiction", "Fantasy"],
	},
	{ slug: "war-politics", label: "War & Politics", names: ["War & Politics", "War"] },
]

/** "Türkiye" is "turkiye", not "t-rkiye". */
const asciiSlug = (label: string) =>
	label
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/&/g, " ")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")

const catalogCache = new Map<string, Catalog>()

/** The places of each family. `kind` "all" gets the merged genre list; movies and shows get their own genres. */
export function catalogOf(
	traitLabel: (key: string) => string,
	kind: Kind = "movie",
): Catalog | null {
	const counts = getCounts()
	if (!counts) return null
	const merged = kind === "all"
	const cacheId = `${counts.version}|${merged ? "all" : "one"}`
	const hit = catalogCache.get(cacheId)
	if (hit) return hit
	const old = counts.catalog as unknown as Record<
		Exclude<Family, "trait" | "trope">,
		CatalogValue[]
	>
	// A country whose name has letters outside ASCII got a broken slug upstream; the old one still leads here.
	const country = old.country.map((v) => {
		if (![...v.label].some((ch) => ch.charCodeAt(0) > 127)) return v
		const slug = asciiSlug(v.label)
		return slug && slug !== v.slug ? { ...v, slug, aliases: [v.slug] } : v
	})
	let genre = old.genre
	if (merged) {
		const partOf = new Map(GENRE_MERGE.flatMap((m) => m.names.map((n) => [n, m] as const)))
		const done = new Set<string>()
		genre = old.genre.flatMap((v): CatalogValue[] => {
			const m = partOf.get(v.id)
			if (!m) return [v]
			if (done.has(m.slug)) return []
			done.add(m.slug)
			const parts = old.genre.filter((x) => m.names.includes(x.id))
			return [
				{
					family: "genre",
					slug: m.slug,
					label: m.label,
					id: m.names[0],
					ids: m.names,
					aliases: parts.map((x) => x.slug).filter((x) => x !== m.slug),
				},
			]
		})
	}
	const catalog: Catalog = {
		...old,
		genre,
		country,
		trait: TRAIT_NAMES.map((key) => ({
			family: "trait" as const,
			slug: traitSlug(key),
			label: traitLabel(key),
			id: key,
		})),
		// The hand-picked tropes (domain/tropes/catalog.ts); `id` is the TV Tropes page name.
		trope: TROPES.map((t) => ({
			family: "trope" as const,
			slug: t.slug,
			label: t.label,
			id: t.id,
		})),
	}
	if (catalogCache.size > 6) catalogCache.clear()
	catalogCache.set(cacheId, catalog)
	return catalog
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" })
const everyCountryCache = new WeakMap<Catalog, { version: string; catalog: Catalog }>()

/**
 * The catalog with every production country the snapshot knows, not only the counts' short list (24), so
 * Africa and South America have pages too. A country added here is named by its ISO code; whether it gets a page
 * is still `members`' minimum of well-known titles.
 */
export function withEveryCountry(catalog: Catalog, b: Base): Catalog {
	const codes = b.snap.columns.facts?.countries
	if (!codes?.length) return catalog
	const version = String(b.snap.version)
	const hit = everyCountryCache.get(catalog)
	if (hit?.version === version) return hit.catalog
	const known = new Set(catalog.country.map((v) => v.id.toUpperCase()))
	const slugs = new Set(catalog.country.flatMap((v) => [v.slug, ...(v.aliases ?? [])]))
	const extra: CatalogValue[] = []
	for (const code of codes) {
		if (!code || !/^[A-Za-z]{2}$/.test(code) || known.has(code.toUpperCase())) continue
		let label: string | undefined
		try {
			label = regionNames.of(code.toUpperCase())
		} catch {
			label = undefined
		}
		if (!label || label.toUpperCase() === code.toUpperCase()) continue
		const slug = asciiSlug(label)
		if (!slug || slugs.has(slug)) continue
		slugs.add(slug)
		known.add(code.toUpperCase())
		extra.push({ family: "country", slug, label, id: code })
	}
	const out = extra.length ? { ...catalog, country: [...catalog.country, ...extra] } : catalog
	everyCountryCache.set(catalog, { version, catalog: out })
	return out
}

/** A place's catalog entry, by its slug or by a slug that leads to it. */
export const valueOf = (catalog: Catalog, p: Ingredient) =>
	catalog[p.family]?.find((v) => v.slug === p.slug) ??
	catalog[p.family]?.find((v) => v.aliases?.includes(p.slug))

// ---------------------------------------------------------------------------------------------------------
// Membership

const ruleOf = (family: "theme" | "style", id: string): TitleRule | undefined =>
	(family === "theme" ? THEMES : STYLES).find((r) => r.id === id)

/** A theme's or style's rule level (0-10) of one row. */
export function ruleLevel(snap: Snap, rule: TitleRule, r: number): number {
	const v = snap.fingerprintAt(r)
	const c = snap.columns
	const score = (key: string) => {
		const x = v[KEY_AT.get(key) as number]
		return x === MISSING || x === undefined ? 0 : x
	}
	const genres = c.genreNames.filter((_, g) => c.genres[r] & (1 << g))
	return Math.max(0, Math.min(10, Math.round(rule.level(score as never, genres))))
}

export function testOf(
	snap: Snap,
	catalog: Catalog,
	p: Ingredient,
	country: string,
): ((r: number) => boolean) | null {
	const c = snap.columns
	const val = valueOf(catalog, p)
	if (!val) return null
	if (p.family === "mood") {
		const bit = 1 << MOOD_KEYS.indexOf(val.id as never)
		return (r) => (c.moods[r] & bit) !== 0
	}
	if (p.family === "genre") {
		let bits = 0
		for (const name of val.ids ?? [val.id]) {
			const g = c.genreNames.indexOf(name)
			if (g >= 0) bits |= 1 << g
		}
		return (r) => (c.genres[r] & bits) !== 0
	}
	if (p.family === "theme") {
		const bit = 1 << THEME_KEYS.indexOf(val.id as never)
		return (r) => (c.themes[r] & bit) !== 0
	}
	if (p.family === "style") {
		const bit = 1 << STYLE_KEYS.indexOf(val.id as never)
		return (r) => (c.styles[r] & bit) !== 0
	}
	if (p.family === "trait") {
		const k = KEY_AT.get(val.id)
		if (k === undefined) return null
		return (r) => {
			const x = snap.fingerprintAt(r)[k]
			return x !== MISSING && x >= BAND.plenty[0]
		}
	}
	if (p.family === "trope") {
		const keys = tropeMembers(val.id)
		if (!keys) return null
		return (r) => keys.has(c.pointIds[r] as TitleKey)
	}
	const facts = c.facts
	if (p.family === "decade") {
		if (!facts) return null
		const from = Number(val.id)
		return (r) => facts.releaseYears[r] >= from && facts.releaseYears[r] < from + 10
	}
	if (p.family === "country") {
		if (!facts) return null
		const idx = facts.countries.indexOf(val.id)
		const n = facts.releaseYears.length
		return (r) => {
			for (let s = 0; s < 4; s++) if (facts.countryIndexes[s * n + r] === idx) return true
			return false
		}
	}
	if (p.family === "service") {
		const services = countryServices(country.toUpperCase())
		if (!services) return null
		return (r) => {
			const sr = services.rowOf(c.pointIds[r])
			if (sr < 0) return false
			for (let i = services.offsets[sr]; i < services.offsets[sr + 1]; i++)
				if (brandOfService(services.services[services.entries[i]])?.slug === val.id) return true
			return false
		}
	}
	return null
}

/** The lead score a place's intensity runs on: a trait's own score, or a rule's level for a theme or style. */
export function levelOf(
	snap: Snap,
	catalog: Catalog,
	p: Ingredient,
	traitKey: string,
): (r: number) => number {
	const val = valueOf(catalog, p)
	if (val && (p.family === "theme" || p.family === "style")) {
		const rule = ruleOf(p.family, val.id)
		if (rule) return (r) => ruleLevel(snap, rule, r)
	}
	const k = KEY_AT.get(traitKey) as number
	return (r) => {
		const x = snap.fingerprintAt(r)[k]
		return x === MISSING ? 0 : x
	}
}

const partsId = (parts: Ingredient[]) => parts.map((p) => `${p.family}:${p.slug}`).join("+")
const usesCountry = (parts: Ingredient[]) => parts.some((p) => p.family === "service")
/** A trope's members arrive after the snapshot; rows read before them must not stay cached. */
const tropeStamp = (parts: Ingredient[]) =>
	parts.some((p) => p.family === "trope") ? `|t${tropesVersion()}` : ""

const rowCache = new Map<string, number[]>()
const maskCache = new Map<string, Uint8Array>()
const countCache = new Map<string, number>()

const rowsId = (b: Base, parts: Ingredient[], country: string) => {
	const loaded = usesCountry(parts) ? (countryServices(country.toUpperCase())?.loadedAt ?? 0) : 0
	return `${b.snap.version}|${b.kind}|${usesCountry(parts) ? `${country}@${loaded}` : ""}|${partsId(parts)}${tropeStamp(parts)}`
}

/**
 * One ingredient's well-known rows as a byte per snapshot row (1 = has it). A blend's test then costs one array read
 * per row instead of a closure over fingerprints, country slots or a trope's key set: the steering, the pantry and the
 * blend suggestions ask for hundreds of pair counts per page.
 */
function maskOf(b: Base, catalog: Catalog, part: Ingredient, country: string): Uint8Array {
	const id = rowsId(b, [part], country)
	const hit = maskCache.get(id)
	if (hit) return hit
	const mask = new Uint8Array(b.snap.columns.moods.length)
	for (const r of rowsOf(b, catalog, [part], country)) mask[r] = 1
	if (maskCache.size > 1500) maskCache.clear()
	maskCache.set(id, mask)
	return mask
}

/** The smallest available starting set and the masks it still needs to pass. */
function blendPlan(
	b: Base,
	catalog: Catalog,
	parts: Ingredient[],
	country: string,
	added?: Ingredient,
) {
	// Steering and blend suggestions extend the same selection by one ingredient at a time.
	// Reuse its existing rows when they are narrower than the new ingredient. The input
	// was canonicalized and sorted, so the appended ingredient may be anywhere in it.
	if (added && parts.length > 2) {
		const rest = parts.filter((p) => p.family !== added.family || p.slug !== added.slug)
		if (rest.length < parts.length) {
			const selected = rowCache.get(rowsId(b, rest, country))
			if (selected && !selected.length) return { start: selected, masks: [] }
			if (selected && selected.length <= rowsOf(b, catalog, [added], country).length)
				return { start: selected, masks: [maskOf(b, catalog, added, country)] }
		}
	}
	const singles = parts.map((p) => rowsOf(b, catalog, [p], country))
	if (singles.some((s, i) => !s.length && !testOf(b.snap, catalog, parts[i], country))) return null
	const order = singles.map((_, i) => i).sort((x, y) => singles[x].length - singles[y].length)
	return {
		start: singles[order[0]],
		masks: order.slice(1).map((i) => maskOf(b, catalog, parts[i], country)),
	}
}

/**
 * Every place of a family with its well-known rows, built in one pass over the kind's rows (most popular first, like
 * `rows`). Asking a family's members used to scan all rows once per place: a hundred countries meant a hundred passes
 * over about 78,000 rows in one go, long enough to stall the event loop and make the overload guard shed requests.
 * Families whose membership is a column of the snapshot (moods, genres, themes, styles, decades, countries) are read
 * here; services (the viewer's country), tropes and traits keep their own tests. Kept per base, so per snapshot
 * version and kind.
 */
type FamilyIndex = Map<string, number[]>
const INDEXED: ReadonlySet<Family> = new Set([
	"mood",
	"genre",
	"theme",
	"style",
	"decade",
	"country",
])
const familyIndexes = new WeakMap<Base, Map<Family, FamilyIndex | null>>()
export function familyIndex(b: Base, catalog: Catalog, family: Family): FamilyIndex | null {
	if (!INDEXED.has(family)) return null
	let byFamily = familyIndexes.get(b)
	if (!byFamily) {
		byFamily = new Map()
		familyIndexes.set(b, byFamily)
	}
	if (byFamily.has(family)) return byFamily.get(family) ?? null
	const built = buildFamilyIndex(b, catalog, family)
	byFamily.set(family, built)
	return built
}

function buildFamilyIndex(b: Base, catalog: Catalog, family: Family): FamilyIndex | null {
	const c = b.snap.columns
	const values = catalog[family] ?? []
	const out: FamilyIndex = new Map(values.map((v) => [v.id, [] as number[]]))
	const bucket = (id: string) => out.get(id)
	if (family === "decade" || family === "country") {
		const facts = c.facts
		if (!facts) return null
		if (family === "decade") {
			for (const r of b.rows) bucket(String(Math.floor(facts.releaseYears[r] / 10) * 10))?.push(r)
			return out
		}
		const n = facts.releaseYears.length
		const lists = facts.countries.map((code) => bucket(code))
		for (const r of b.rows)
			for (let s = 0; s < 4; s++) {
				const idx = facts.countryIndexes[s * n + r]
				// An unused slot is NO_COUNTRY, past the list; a country repeated in a later slot counts once.
				if (idx >= lists.length) continue
				let again = false
				for (let t = 0; t < s; t++) if (facts.countryIndexes[t * n + r] === idx) again = true
				if (!again) lists[idx]?.push(r)
			}
		return out
	}
	// Bit columns: each value is one bit (a merged genre is several).
	const column =
		family === "mood"
			? c.moods
			: family === "genre"
				? c.genres
				: family === "theme"
					? c.themes
					: c.styles
	const masks = values.map((v) => {
		if (family === "genre") {
			let bits = 0
			for (const name of v.ids ?? [v.id]) {
				const g = c.genreNames.indexOf(name)
				if (g >= 0) bits |= 1 << g
			}
			return bits
		}
		const keys: readonly string[] =
			family === "mood" ? MOOD_KEYS : family === "theme" ? THEME_KEYS : STYLE_KEYS
		const at = keys.indexOf(v.id)
		return at >= 0 ? 1 << at : 0
	})
	const lists = values.map((v) => bucket(v.id) as number[])
	for (const r of b.rows) {
		const bits = column[r]
		if (!bits) continue
		for (let i = 0; i < masks.length; i++) if (bits & masks[i]) lists[i].push(r)
	}
	return out
}

/** A well-known row by its point id, once per base. */
const pointRows = new WeakMap<Base, Map<number, number>>()
/** The well-known rows of a set of title keys, most popular first. */
function rowsOfKeys(b: Base, keys: Iterable<TitleKey>): number[] {
	let byPoint = pointRows.get(b)
	if (!byPoint) {
		const ids = b.snap.columns.pointIds
		byPoint = new Map(b.rows.map((r) => [ids[r] as number, r]))
		pointRows.set(b, byPoint)
	}
	const rows: number[] = []
	for (const key of keys) {
		const r = byPoint.get(key as number)
		if (r !== undefined) rows.push(r)
	}
	return rows.sort((x, y) => b.rank[x] - b.rank[y])
}

/** The well-known rows that have every ingredient, most popular first. Empty when an ingredient can't be read. */
export function rowsOf(b: Base, catalog: Catalog, parts: Ingredient[], country: string): number[] {
	if (!parts.length) return b.rows
	const id = rowsId(b, parts, country)
	const hit = rowCache.get(id)
	if (hit) return hit
	let rows: number[]
	if (parts.length > 1) {
		const plan = blendPlan(b, catalog, parts, country)
		rows = plan ? plan.start.filter((r) => plan.masks.every((m) => m[r] === 1)) : []
	} else {
		// A service's rows come from the country's brand index (one pass per country), a trope's from its member
		// list (a few thousand keys, not a pass over every row), the other columns from the family index above.
		const family = parts[0].family
		const indexed = family === "service" ? brandRows(b, country) : familyIndex(b, catalog, family)
		const keys = family === "trope" ? tropeMembers(valueOf(catalog, parts[0])?.id ?? "") : null
		if (indexed) rows = indexed.get(valueOf(catalog, parts[0])?.id ?? "") ?? []
		else if (keys) rows = rowsOfKeys(b, keys.keys())
		else {
			const test = testOf(b.snap, catalog, parts[0], country)
			rows = test ? b.rows.filter(test) : []
		}
	}
	if (rowCache.size > 4000) rowCache.clear()
	rowCache.set(id, rows)
	return rows
}

/** How many well-known rows have every ingredient, without keeping the rows: the counts behind steering and pantry. */
export function countOf(
	b: Base,
	catalog: Catalog,
	parts: Ingredient[],
	country: string,
	added?: Ingredient,
): number {
	if (parts.length < 2) return rowsOf(b, catalog, parts, country).length
	const id = rowsId(b, parts, country)
	const rows = rowCache.get(id)
	if (rows) return rows.length
	const hit = countCache.get(id)
	if (hit !== undefined) return hit
	const plan = blendPlan(b, catalog, parts, country, added)
	let n = 0
	if (plan)
		for (const r of plan.start) {
			let all = true
			for (const m of plan.masks)
				if (m[r] !== 1) {
					all = false
					break
				}
			if (all) n++
		}
	if (countCache.size > 50_000) countCache.clear()
	countCache.set(id, n)
	return n
}

/** The brands a country carries, with their well-known rows. Null while the country's availability loads. */
const brandCache = new Map<string, Map<string, number[]>>()
export function brandRows(b: Base, country: string): Map<string, number[]> | null {
	const services = countryServices(country.toUpperCase())
	if (!services) return null
	const id = `${b.snap.version}|${b.kind}|${country}@${services.loadedAt}`
	const hit = brandCache.get(id)
	if (hit) return hit
	const c = b.snap.columns
	const out = new Map<string, number[]>(BRANDS.map((br) => [br.slug, []]))
	for (const r of b.rows) {
		const sr = services.rowOf(c.pointIds[r])
		if (sr < 0) continue
		const seen = new Set<string>()
		for (let i = services.offsets[sr]; i < services.offsets[sr + 1]; i++) {
			const brand = brandOfService(services.services[services.entries[i]])
			if (brand && !seen.has(brand.slug)) {
				seen.add(brand.slug)
				out.get(brand.slug)?.push(r)
			}
		}
	}
	if (brandCache.size > 40) brandCache.clear()
	brandCache.set(id, out)
	return out
}

// ---------------------------------------------------------------------------------------------------------
// Fingerprint math

export function meanOf(snap: Snap, rows: number[]): Float64Array {
	const sum = new Float64Array(K)
	const cnt = new Float64Array(K)
	for (const r of rows) {
		const v = snap.fingerprintAt(r)
		for (let k = 0; k < K; k++)
			if (v[k] !== MISSING) {
				sum[k] += v[k]
				cnt[k]++
			}
	}
	for (let k = 0; k < K; k++) sum[k] = cnt[k] ? sum[k] / cnt[k] : 0
	return sum
}

const meanCache = new Map<string, Float64Array>()
export function meanCached(b: Base, id: string, rows: number[]): Float64Array {
	const key = `${b.snap.version}|${b.kind}|${id}`
	let m = meanCache.get(key)
	if (!m) {
		if (meanCache.size > 4000) meanCache.clear()
		meanCache.set(key, (m = meanOf(b.snap, rows)))
	}
	return m
}

/** The trait indexes where `mean` stands furthest above (dir 1) or below (dir -1) `ref`. */
export function topTraits(mean: Float64Array, ref: Float64Array, n: number, dir: 1 | -1 = 1) {
	return [...TRAIT_KEYS]
		.sort((a, b) => dir * (mean[b] - ref[b]) - dir * (mean[a] - ref[a]))
		.slice(0, n)
}

/**
 * How well a row fits a set of traits (weights by how much the trait sets the place apart), plus a small pull toward
 * better-known and better-scored titles.
 */
export function fitOf(
	b: Base,
	r: number,
	ks: number[],
	ws: number[],
	/** Traits the place has least of, with their weights: a title strong in them fits worse. */
	not: { ks: number[]; ws: number[] } = { ks: [], ws: [] },
): number {
	const v = b.snap.fingerprintAt(r)
	const c = b.snap.columns
	let s = 0
	let w = 0
	for (let i = 0; i < ks.length; i++) {
		s += (v[ks[i]] === MISSING ? 0 : v[ks[i]]) * ws[i]
		w += ws[i]
	}
	let miss = 0
	let mw = 0
	for (let i = 0; i < not.ks.length; i++) {
		miss += (v[not.ks[i]] === MISSING ? 0 : v[not.ks[i]]) * not.ws[i]
		mw += not.ws[i]
	}
	return (
		(w ? s / w : 0) -
		(mw ? (miss / mw) * 0.6 : 0) +
		Math.log10(Math.max(10, votesOf(b, r))) * 0.9 +
		c.scores[r] / 25
	)
}

/** Cosine of two means after z-scoring each trait against the kind's titles. */
export function similarity(b: Base, a: Float64Array, x: Float64Array): number {
	let dot = 0
	let na = 0
	let nx = 0
	for (const k of TRAIT_KEYS) {
		const za = (a[k] - b.mean[k]) / b.sd[k]
		const zx = (x[k] - b.mean[k]) / b.sd[k]
		dot += za * zx
		na += za * za
		nx += zx * zx
	}
	return na && nx ? dot / Math.sqrt(na * nx) : 0
}

/** k-means on the trait scores of a place's best-known titles; farthest-point start, so it is deterministic. */
export function clustersOf(snap: Snap, rows: number[], k: number) {
	const pool = rows.slice(0, 1200)
	const D = TRAIT_KEYS.length
	const vecOf = (r: number) => {
		const v = snap.fingerprintAt(r)
		return Float64Array.from(TRAIT_KEYS, (k2) => (v[k2] === MISSING ? 0 : v[k2]))
	}
	const vec = pool.map(vecOf)
	const dist = (a: Float64Array, b: Float64Array) => {
		let s = 0
		for (let i = 0; i < D; i++) s += (a[i] - b[i]) ** 2
		return s
	}
	if (!vec.length) return []
	const centers: Float64Array[] = [Float64Array.from(vec[0])]
	while (centers.length < k) {
		let far = 0
		let farD = -1
		vec.forEach((x, i) => {
			let d = Number.POSITIVE_INFINITY
			for (const c of centers) d = Math.min(d, dist(x, c))
			if (d > farD) {
				farD = d
				far = i
			}
		})
		centers.push(Float64Array.from(vec[far]))
	}
	const nearest = (x: Float64Array) => {
		let best = 0
		let bd = dist(x, centers[0])
		for (let c = 1; c < k; c++) {
			const d = dist(x, centers[c])
			if (d < bd) {
				bd = d
				best = c
			}
		}
		return best
	}
	let assign: number[] = []
	for (let it = 0; it < 15; it++) {
		assign = vec.map(nearest)
		for (let c = 0; c < k; c++) {
			const m = new Float64Array(D)
			let n = 0
			vec.forEach((x, i) => {
				if (assign[i] !== c) return
				n++
				for (let d = 0; d < D; d++) m[d] += x[d]
			})
			if (!n) continue
			for (let d = 0; d < D; d++) m[d] /= n
			centers[c] = m
		}
	}
	// Every row to its nearest center, through one reused buffer (a place can hold tens of thousands of rows).
	const full: number[][] = Array.from({ length: k }, () => [])
	const buf = new Float64Array(D)
	for (const r of rows) {
		const v = snap.fingerprintAt(r)
		for (let i = 0; i < D; i++) {
			const x = v[TRAIT_KEYS[i]]
			buf[i] = x === MISSING ? 0 : x
		}
		full[nearest(buf)].push(r)
	}
	return Array.from({ length: k }, (_, c) => ({ rows: full[c], center: centers[c] })).filter(
		(c) => c.rows.length >= 8,
	)
}

/**
 * How many ratings a title needs before a ranking believes its score: three tenths of what the 10th most-rated
 * title of its own year and kind has. Rating counts differ by orders of magnitude between a movie of 1935, a show,
 * and last year's movies, so one fixed number is either no bar at all (a festival favorite with 60,000 ratings
 * led 2026, a fan-voted series led its year) or a wall (nothing from the 1930s would rank). Judged against its own
 * cohort, a title ranks the same way in a year's list, a decade's and an all-time one.
 */
const barCache = new WeakMap<Base, Map<number, number>>()
function trustBar(b: Base, r: number): number {
	const c = b.snap.columns
	const years = c.facts?.releaseYears
	const cohort = (row: number) => (years?.[row] ?? 0) * 2 + (c.pointIds[row] >= SHOW_BASE ? 1 : 0)
	let bars = barCache.get(b)
	if (!bars) {
		const groups = new Map<number, number[]>()
		for (const row of b.rows) {
			const key = cohort(row)
			const list = groups.get(key)
			if (list) list.push(c.votes[row])
			else groups.set(key, [c.votes[row]])
		}
		bars = new Map()
		for (const [key, votes] of groups) {
			votes.sort((x, y) => y - x)
			bars.set(key, Math.max(3000, votes[Math.min(votes.length - 1, 9)] * 0.3))
		}
		barCache.set(b, bars)
	}
	return bars.get(cohort(r)) ?? 15000
}

/**
 * A score that trusts many ratings more than few: keeps a 97 with 1,000 ratings from leading a ranking. Without a
 * `weight` the bar is the title's own cohort's (`trustBar`); pass one only to rank against a fixed bar.
 */
export function trusted(b: Base, r: number, prior = 68, weight?: number): number {
	const c = b.snap.columns
	const v = c.votes[r]
	if (weight !== undefined)
		return (v / (v + weight)) * c.scores[r] + (weight / (v + weight)) * prior
	// Against the cohort's bar the trust rises steeply: a title rated twice as often as the bar keeps four fifths
	// of its lead over the prior, one rated half as often a fifth. Well-known titles then rank by their score,
	// old or new, and only the little-rated ones are pulled in.
	const w = trustBar(b, r)
	const t = (v * v) / (v * v + w * w)
	return t * c.scores[r] + (1 - t) * prior
}

/** The rows as a ranking: best-scored first, each title's score trusted by its own cohort's bar. */
export function ranked(b: Base, rows: number[]): number[] {
	const score = new Map(rows.map((r) => [r, trusted(b, r)]))
	return [...rows].sort((x, y) => (score.get(y) ?? 0) - (score.get(x) ?? 0))
}
