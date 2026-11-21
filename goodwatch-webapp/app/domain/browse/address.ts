// Browse addresses: the model every Browse page shares. Pure, for the loaders and the browser.
//
// A page is one of: the hub (`/movies`), a family index (`/movies/moods`), a place (one part or a blend of several:
// `/movies/moods/cozy`, `/movies/moods/cozy/comedy`, `/movies/streaming/us/netflix`), or Top (`/movies/top`). The first
// pair the tree knows goes into the path; every further part goes into `?with=family:slug,...`.
// docs/implementation/explore-rethink/spec.md

/** "all" is movies and shows together (`/all/...`). */
export type Kind = "movie" | "show" | "all"
export const KINDS: readonly Kind[] = ["movie", "show", "all"]

export type Family =
	| "mood"
	| "genre"
	| "theme"
	| "style"
	| "decade"
	| "country"
	| "service"
	| "trait"
	| "trope"

/** Path order and blend order: an earlier family leads. */
export const FAMILIES: readonly Family[] = [
	"mood",
	"genre",
	"theme",
	"style",
	"decade",
	"country",
	"service",
	"trait",
	"trope",
]

export const FAMILY: Record<Family, { one: string; many: string; seg: string }> = {
	mood: { one: "Mood", many: "Moods", seg: "moods" },
	genre: { one: "Genre", many: "Genres", seg: "genres" },
	theme: { one: "Theme", many: "Themes", seg: "themes" },
	style: { one: "Style", many: "Styles", seg: "styles" },
	decade: { one: "Decade", many: "Decades", seg: "decades" },
	country: { one: "Country", many: "Countries", seg: "countries" },
	service: { one: "Service", many: "Streaming", seg: "streaming" },
	// Fingerprint traits are dial and blend internals: they have no index and no page of their own.
	trait: { one: "Trait", many: "Traits", seg: "traits" },
	trope: { one: "Trope", many: "Tropes", seg: "tropes" },
}

/** The families that have an index page and appear in the Browse row. */
export const INDEXED: readonly Family[] = ["mood", "genre", "decade", "country", "service", "trope"]

export interface Ingredient {
	family: Family
	slug: string
}

export type View = "hub" | "family" | "place" | "top"

/** Intensity bands of a trait or a place. */
export type Level = "touch" | "plenty" | "full"
export const LEVELS: readonly Level[] = ["touch", "plenty", "full"]
/** For a blend of two: only the first, both, only the second. */
export type Venn = "a" | "both" | "b"
export type Sort = "popular" | "top" | "newest"
export const SORTS: readonly Sort[] = ["popular", "top", "newest"]

export interface Address {
	view: View
	kind: Kind
	/** The family of a family index. */
	family?: Family
	/** A place's parts (one, or a blend), or Top's filters. Canonical order: FAMILIES, then slug. */
	parts: Ingredient[]
	/** The streaming country, lowercase ISO 3166-1 alpha-2. */
	country: string
	// List state, all optional and never part of the canonical address.
	sort?: Sort
	/** Top's page (25 per page). */
	page?: number
	/** The grid's offset on a place page. */
	at?: number
	/** On my services. */
	mine?: boolean
	/** Not seen yet. */
	unseen?: boolean
	/** Top of one release year. */
	year?: number
	/** The first "how much" dial of a place page, at its named stop (`?level=`). */
	level?: Level
	/** A kind inside the place (its cluster id, `?k=`): the steering's "Which kind?". */
	kind_?: string
}

export const kindSeg = (k: Kind) => (k === "all" ? "all" : k === "show" ? "shows" : "movies")
export const kindLabel = (k: Kind) =>
	k === "all" ? "Movies and shows" : k === "show" ? "Shows" : "Movies"
export const kindNoun = (k: Kind) =>
	k === "all" ? "movies and shows" : k === "show" ? "shows" : "movies"
/** One title of the kind: "movie", "show", "title". */
export const kindOne = (k: Kind) => (k === "all" ? "title" : k === "show" ? "show" : "movie")
/** The kind a path's first segment names, or null. */
export const kindOfSeg = (seg: string | undefined): Kind | null =>
	seg === "movies" ? "movie" : seg === "shows" ? "show" : seg === "all" ? "all" : null

/** A streaming country segment: two letters. */
export const isCountryCode = (seg: string | undefined): boolean => /^[a-z]{2}$/i.test(seg ?? "")

/** The second family the tree hangs under a lead family as a path segment. */
export const PAIR: Partial<Record<Family, Family>> = {
	mood: "genre",
	genre: "decade",
	country: "genre",
	service: "mood",
	theme: "decade",
	trope: "decade",
}

export const same = (a: Ingredient, b: Ingredient) => a.family === b.family && a.slug === b.slug

export function sortParts(parts: Ingredient[]): Ingredient[] {
	const seen = new Set<string>()
	return [...parts]
		.filter((p) => {
			const id = `${p.family}:${p.slug}`
			if (seen.has(id)) return false
			seen.add(id)
			return true
		})
		.sort(
			(a, b) =>
				FAMILIES.indexOf(a.family) - FAMILIES.indexOf(b.family) || a.slug.localeCompare(b.slug),
		)
}

/** The lead and tail that go into the path; the rest travel as `with`. */
export function splitParts(parts: Ingredient[]) {
	const sorted = sortParts(parts)
	for (const lead of sorted) {
		const tail = sorted.find((p) => p !== lead && PAIR[lead.family] === p.family)
		if (tail) return { lead, tail, rest: sorted.filter((p) => p !== lead && p !== tail) }
	}
	const [lead, ...rest] = sorted
	return { lead, tail: undefined, rest }
}

export const withParam = (parts: Ingredient[]) =>
	parts.map((p) => `${p.family}:${p.slug}`).join(",")

function query(a: Address, rest: Ingredient[], extra?: Record<string, string | undefined>) {
	const q = new URLSearchParams()
	if (rest.length) q.set("with", withParam(rest))
	if (a.sort && a.sort !== "popular") q.set("sort", a.sort)
	if (a.page && a.page > 1) q.set("page", String(a.page))
	if (a.at && a.at > 0) q.set("at", String(a.at))
	if (a.mine) q.set("mine", "1")
	if (a.unseen) q.set("unseen", "1")
	if (a.year) q.set("year", String(a.year))
	if (a.level) q.set("level", a.level)
	if (a.kind_) q.set("k", a.kind_)
	for (const [k, v] of Object.entries(extra ?? {})) {
		if (v === undefined || v === "") q.delete(k)
		else q.set(k, v)
	}
	const s = q.toString()
	return s ? `?${s}` : ""
}

/** The page's address with its query. `extra` sets or (with undefined) drops query parameters. */
export function browsePath(a: Address, extra?: Record<string, string | undefined>): string {
	const t = `/${kindSeg(a.kind)}`
	if (a.view === "hub") return t
	if (a.view === "family" && a.family)
		return `${t}/${FAMILY[a.family].seg}${a.family === "service" ? `/${a.country}` : ""}`
	if (a.view === "top") return `${t}/top${query(a, sortParts(a.parts), extra)}`
	const { lead, tail, rest } = splitParts(a.parts)
	if (!lead) return t
	const country = lead.family === "service" ? `/${a.country}` : ""
	return `${t}/${FAMILY[lead.family].seg}${country}/${lead.slug}${tail ? `/${tail.slug}` : ""}${query(a, rest, extra)}`
}

/**
 * The canonical address: the path without list state. Top keeps its page, as each of its pages lists other titles.
 * A blend's `with` parts stay (a `with` blend is noindex, but it canonicalizes to itself).
 */
export const canonicalPath = (a: Address) =>
	browsePath({
		...a,
		sort: undefined,
		page: a.view === "top" ? a.page : undefined,
		at: undefined,
		mine: undefined,
		unseen: undefined,
		level: undefined,
		kind_: undefined,
	})

// ---------------------------------------------------------------------------------------------------------
// Building addresses

export const hub = (kind: Kind): Address => ({ view: "hub", kind, parts: [], country: "us" })
export const familyPage = (kind: Kind, family: Family, country = "us"): Address => ({
	view: "family",
	kind,
	family,
	parts: [],
	country,
})
export const place = (kind: Kind, parts: Ingredient[], country = "us"): Address => ({
	view: "place",
	kind,
	parts: sortParts(parts),
	country,
})
export const top = (kind: Kind, parts: Ingredient[] = [], year?: number): Address => ({
	view: "top",
	kind,
	parts: sortParts(parts),
	country: "us",
	year,
})
export const ing = (family: Family, slug: string): Ingredient => ({ family, slug })

/** The same page with one more part (never replaces one). */
export const add = (a: Address, p: Ingredient): Address => ({
	...a,
	view: a.view === "top" ? "top" : "place",
	parts: sortParts([...a.parts, p]),
	page: undefined,
	at: undefined,
	level: undefined,
	kind_: undefined,
})
/** The same page without a part; a place without parts is the hub. */
export function remove(a: Address, p: Ingredient): Address {
	const parts = a.parts.filter((x) => !same(x, p))
	if (a.view === "top") return { ...a, parts, page: undefined }
	if (!parts.length) return hub(a.kind)
	return { ...a, parts, page: undefined, at: undefined, level: undefined, kind_: undefined }
}
export const swap = (a: Address, from: Ingredient, to: Ingredient): Address =>
	add(remove(a, from), to)
/** The same page for another kind (movies, shows, or both together). */
export const withKind = (a: Address, kind: Kind): Address =>
	a.kind === kind ? a : { ...a, kind, page: undefined, at: undefined }

// ---------------------------------------------------------------------------------------------------------
// Parsing

export interface SlugIndex {
	/** Whether a family has this slug. */
	has(family: Family, slug: string): boolean
	/** The place's own slug when the given one only leads to it (a merged genre's part, an older slug). */
	canon?(family: Family, slug: string): string
}

const familyOfSeg = (seg: string) => FAMILIES.find((f) => FAMILY[f].seg === seg)

/** The parts in `?with=` that the index knows, in canonical spelling. */
export function withParts(search: URLSearchParams, index: SlugIndex): Ingredient[] {
	const canon = (family: Family, slug: string) => index.canon?.(family, slug) ?? slug
	return (search.get("with") ?? "")
		.split(",")
		.filter(Boolean)
		.flatMap((s) => {
			const [family, slug] = s.split(":") as [Family, string]
			return FAMILIES.includes(family) && slug && index.has(family, slug)
				? [{ family, slug: canon(family, slug) }]
				: []
		})
}

const positive = (value: string | null) => {
	const n = Number(value)
	return Number.isInteger(n) && n > 0 ? n : undefined
}

/** `path` is the page's pathname (`/movies/moods/cozy`); `search` its query. Null: no such page. */
export function parse(path: string, search: URLSearchParams, index: SlugIndex): Address | null {
	const segs = path.split("/").filter(Boolean)
	const kind = kindOfSeg(segs[0])
	if (!kind) return null
	const canon = (family: Family, slug: string) => index.canon?.(family, slug) ?? slug
	const extra = withParts(search, index)
	const sort = search.get("sort")
	const state = {
		sort: SORTS.includes(sort as Sort) ? (sort as Sort) : undefined,
		page: positive(search.get("page")),
		at: positive(search.get("at")),
		mine: search.get("mine") === "1" || undefined,
		unseen: search.get("unseen") === "1" || undefined,
		year: positive(search.get("year")),
		level: LEVELS.includes(search.get("level") as Level)
			? (search.get("level") as Level)
			: undefined,
		kind_: /^[\w-]{1,64}$/.test(search.get("k") ?? "") ? (search.get("k") as string) : undefined,
	}
	if (segs.length === 1) return hub(kind)
	if (segs[1] === "top")
		return segs.length === 2 ? { ...top(kind, extra, state.year), ...state } : null
	const family = familyOfSeg(segs[1])
	if (!family || family === "trait") return null
	let rest = segs.slice(2)
	let country = "us"
	if (family === "service") {
		// `/movies/streaming/netflix` names a service, not a country: no such page (the redirects send it on).
		if (!isCountryCode(rest[0])) return null
		country = rest[0].toLowerCase()
		rest = rest.slice(1)
	}
	if (!rest.length) return familyPage(kind, family, country)
	if (rest.length > 2 || !index.has(family, rest[0])) return null
	const parts: Ingredient[] = [{ family, slug: canon(family, rest[0]) }]
	if (rest[1]) {
		const pair = PAIR[family]
		if (!pair || !index.has(pair, rest[1])) return null
		parts.push({ family: pair, slug: canon(pair, rest[1]) })
	}
	return { ...place(kind, [...parts, ...extra], country), ...state }
}
