// PROTOTYPE - throwaway (prototype/explore-r4). The address model every concept shares. Pure: loader and browser.
//
// A page is one of: the hub, a family landing, a place (one ingredient or a blend of several), Best, or the kit
// gallery. Its real address is A's tree (/movies/moods/cozy, /movies/moods/cozy/comedy, /movies/streaming/us/netflix,
// /movies/best); the first pair that A's tree knows goes into the path, every further ingredient into `?with=`.
// Under the prototype the same address sits behind `/prototype/explore/<concept>`.

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
	trait: { one: "Trait", many: "Traits", seg: "traits" },
	// Round 6: TV Tropes' named storytelling devices (kit/tropes.ts). The fingerprint traits keep their places for
	// blends and dials, but their index now answers with the tropes.
	trope: { one: "Trope", many: "Tropes", seg: "tropes" },
}

export interface Ingredient {
	family: Family
	slug: string
}

export type View = "hub" | "family" | "place" | "best" | "kit"

/** Intensity bands of a trait or a place: "not always about the 10's". */
export type Level = "touch" | "plenty" | "full"
export const LEVELS: readonly Level[] = ["touch", "plenty", "full"]
/** For a blend of two: only the first, both, only the second. */
export type Venn = "a" | "both" | "b"
export type Sort = "popular" | "top" | "newest"
export const SORTS: readonly Sort[] = ["popular", "top", "newest"]

export interface Address {
	view: View
	kind: Kind
	/** The family of a family landing. */
	family?: Family
	/** A place's ingredients (one, or a blend), or Best's filters. Canonical order: FAMILIES, then slug. */
	parts: Ingredient[]
	/** The streaming country, lowercase. */
	country: string
	// List state, all optional.
	sort?: Sort
	page?: number
	/** On my services. */
	mine?: boolean
	/** Not seen yet. */
	unseen?: boolean
	level?: Level
	venn?: Venn
	/** A kind inside the place (kit.kinds), by its id. */
	kind_?: string
	/** Best of one release year. */
	year?: number
}

export const PREFIX = "/prototype/explore"

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

/** The second family A's tree hangs under a lead family as a path segment. */
const PAIR: Partial<Record<Family, Family>> = {
	mood: "genre",
	genre: "decade",
	country: "genre",
	service: "mood",
	theme: "decade",
	// Round 7: a trope through the years ("/movies/tropes/final-girl/1980s"); any other ingredient joins as `with`.
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
function split(parts: Ingredient[]) {
	const sorted = sortParts(parts)
	for (const lead of sorted) {
		const tail = sorted.find((p) => p !== lead && PAIR[lead.family] === p.family)
		if (tail) return { lead, tail, rest: sorted.filter((p) => p !== lead && p !== tail) }
	}
	const [lead, ...rest] = sorted
	return { lead, tail: undefined, rest }
}

const withParam = (parts: Ingredient[]) => parts.map((p) => `${p.family}:${p.slug}`).join(",")

function query(a: Address, rest: Ingredient[], extra?: Record<string, string | undefined>) {
	const q = new URLSearchParams()
	if (rest.length) q.set("with", withParam(rest))
	if (a.sort && a.sort !== "popular") q.set("sort", a.sort)
	if (a.page && a.page > 1) q.set("page", String(a.page))
	if (a.mine) q.set("mine", "1")
	if (a.unseen) q.set("unseen", "1")
	if (a.level) q.set("level", a.level)
	if (a.venn && a.venn !== "both") q.set("venn", a.venn)
	if (a.kind_) q.set("k", a.kind_)
	if (a.year) q.set("year", String(a.year))
	for (const [k, v] of Object.entries(extra ?? {})) {
		if (v === undefined || v === "") q.delete(k)
		else q.set(k, v)
	}
	const s = q.toString()
	return s ? `?${s}` : ""
}

/** The page's real address in A's tree, with its query. */
export function realPath(a: Address, extra?: Record<string, string | undefined>): string {
	const t = `/${kindSeg(a.kind)}`
	if (a.view === "kit") return "/_kit"
	if (a.view === "hub") return t
	if (a.view === "family" && a.family)
		return `${t}/${FAMILY[a.family].seg}${a.family === "service" ? `/${a.country}` : ""}`
	if (a.view === "best") return `${t}/best${query(a, sortParts(a.parts), extra)}`
	const { lead, tail, rest } = split(a.parts)
	if (!lead) return t
	const country = lead.family === "service" ? `/${a.country}` : ""
	return `${t}/${FAMILY[lead.family].seg}${country}/${lead.slug}${tail ? `/${tail.slug}` : ""}${query(a, rest, extra)}`
}

/** The address under a concept. `extra` sets or (with undefined) drops query parameters. */
export const href = (concept: string, a: Address, extra?: Record<string, string | undefined>) =>
	a.view === "kit" ? `${PREFIX}/_kit` : `${PREFIX}/${concept}${realPath(a, extra)}`

/** The canonical, indexable address: the path, without list state. */
export const canonicalPath = (a: Address) =>
	realPath({ ...a, sort: undefined, page: undefined, mine: undefined, unseen: undefined })

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
export const best = (kind: Kind, parts: Ingredient[] = [], year?: number): Address => ({
	view: "best",
	kind,
	parts: sortParts(parts),
	country: "us",
	year,
})
export const ing = (family: Family, slug: string): Ingredient => ({ family, slug })

/** The same page with one more ingredient (never replaces one), or without one. */
export const add = (a: Address, p: Ingredient): Address => ({
	...a,
	view: a.view === "best" ? "best" : "place",
	parts: sortParts([...a.parts, p]),
	page: undefined,
	venn: undefined,
	kind_: undefined,
	level: undefined,
})
export function remove(a: Address, p: Ingredient): Address {
	const parts = a.parts.filter((x) => !same(x, p))
	if (a.view === "best") return { ...a, parts, page: undefined }
	if (!parts.length) return hub(a.kind)
	return { ...a, parts, page: undefined, venn: undefined, kind_: undefined, level: undefined }
}
export const swap = (a: Address, from: Ingredient, to: Ingredient): Address =>
	add(remove(a, from) as Address, to)
export const otherKind = (a: Address): Address => ({
	...a,
	kind: a.kind === "movie" ? "show" : "movie",
	page: undefined,
})
/** The same page for another kind (movies, shows, or both together). */
export const withKind = (a: Address, kind: Kind): Address =>
	a.kind === kind ? a : { ...a, kind, page: undefined, kind_: undefined }

// ---------------------------------------------------------------------------------------------------------
// Parsing

export interface SlugIndex {
	/** Whether a family has this slug. */
	has(family: Family, slug: string): boolean
	/** The place's own slug when the given one only leads to it (a merged genre's part, an older slug). */
	canon?(family: Family, slug: string): string
}

const familyOfSeg = (seg: string) => FAMILIES.find((f) => FAMILY[f].seg === seg)

/** `path` is what follows the concept (`/movies/moods/cozy`); `search` the URL's query. Null: no such page. */
export function parse(path: string, search: URLSearchParams, index: SlugIndex): Address | null {
	const segs = path.split("/").filter(Boolean)
	if (segs[0] === "_kit") return { view: "kit", kind: "movie", parts: [], country: "us" }
	const kind = kindOfSeg(segs[0])
	if (!kind) return null
	const canon = (family: Family, slug: string) => index.canon?.(family, slug) ?? slug
	const withParts: Ingredient[] = (search.get("with") ?? "")
		.split(",")
		.filter(Boolean)
		.flatMap((s) => {
			const [family, slug] = s.split(":") as [Family, string]
			return FAMILIES.includes(family) && slug && index.has(family, slug)
				? [{ family, slug: canon(family, slug) }]
				: []
		})
	const state = {
		sort: SORTS.includes(search.get("sort") as Sort) ? (search.get("sort") as Sort) : undefined,
		page: Math.max(1, Number(search.get("page")) || 1),
		mine: search.get("mine") === "1" || undefined,
		unseen: search.get("unseen") === "1" || undefined,
		level: LEVELS.includes(search.get("level") as Level)
			? (search.get("level") as Level)
			: undefined,
		venn: (["a", "b"] as const).includes(search.get("venn") as "a")
			? (search.get("venn") as Venn)
			: undefined,
		kind_: search.get("k") ?? undefined,
		year: Number(search.get("year")) || undefined,
	}
	if (segs.length === 1) return { ...hub(kind) }
	if (segs[1] === "best") return { ...best(kind, withParts, state.year), ...state }
	const family = familyOfSeg(segs[1])
	if (!family) return null
	let rest = segs.slice(2)
	let country = "us"
	if (family === "service") {
		country = (rest[0] ?? "us").toLowerCase()
		rest = rest.slice(1)
	}
	// The traits' index was where tropes were missed: it answers with the tropes now.
	if (!rest.length) return familyPage(kind, family === "trait" ? "trope" : family, country)
	if (!index.has(family, rest[0])) return null
	const parts: Ingredient[] = [{ family, slug: canon(family, rest[0]) }]
	if (rest[1]) {
		const pair = PAIR[family]
		if (!pair || !index.has(pair, rest[1])) return null
		parts.push({ family: pair, slug: canon(pair, rest[1]) })
	}
	return { ...place(kind, [...parts, ...withParts], country), ...state }
}
