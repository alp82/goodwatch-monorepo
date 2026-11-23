// Where an old Browse address moved. Every old category and Best address answers 301 to its new address, straight to
// the final target (never a chain), so what search engines learned carries over. Pure, with unit tests.
// docs/implementation/explore-rethink/spec.md, section 3.
import { BRANDS } from "~/domain/new-on-services"
import {
	type Ingredient,
	type Kind,
	browsePath,
	isCountryCode,
	kindOfSeg,
	parse,
	place,
} from "./address"

/**
 * The 20 old mood pages (the emoji moods) and the mood that replaced each. Every row is the new mood whose titles
 * overlap most with the old page's rule, measured on the 77,810 well-known titles (1,000+ ratings) on 2026-11-22
 * (Jaccard; the spec records the numbers). Peaceful ties Romantic (0.17) and Cozy (0.16) and goes to Cozy.
 */
export const OLD_MOODS: Readonly<Record<string, string>> = {
	scary: "scary",
	"feel-good": "cozy",
	suspense: "mysterious",
	funny: "funny",
	psychological: "dark",
	nostalgic: "cozy",
	melancholic: "sad",
	bittersweet: "sad",
	whimsical: "magical",
	peaceful: "cozy",
	adrenaline: "thrilling",
	epic: "thrilling",
	romantic: "romantic",
	gritty: "mysterious",
	"mind-bending": "deep",
	"morally-complex": "deep",
	atmospheric: "sad",
	"visually-stunning": "thrilling",
}

/** Old genre slugs whose new slug differs (the TMDB name, slugged the new way). */
export const RENAMED_GENRES: Readonly<Record<string, string>> = {
	"action-and-adventure": "action-adventure",
	"scifi-and-fantasy": "sci-fi-fantasy",
	"war-and-politics": "war-politics",
}

/**
 * The genre pages the old sitemap listed. One that has no page any more (too few well-known titles) moves to its
 * kind's genre index, the page that lists what replaced it.
 */
export const LEGACY_GENRES: Readonly<Record<"movie" | "show", readonly string[]>> = {
	movie: [
		"action",
		"adventure",
		"animation",
		"comedy",
		"crime",
		"documentary",
		"drama",
		"family",
		"fantasy",
		"history",
		"horror",
		"music",
		"mystery",
		"romance",
		"science-fiction",
		"thriller",
		"tv-movie",
		"war",
		"western",
	],
	show: [
		"action-and-adventure",
		"animation",
		"comedy",
		"crime",
		"documentary",
		"drama",
		"family",
		"kids",
		"mystery",
		"news",
		"reality",
		"scifi-and-fantasy",
		"soap",
		"talk",
		"war-and-politics",
		"western",
	],
}

/** Fingerprint traits that name a trope; any other old trait address has no replacement. */
export const TRAIT_TROPES: Readonly<Record<string, string>> = {
	scare: "jump-scare",
	grotesque: "body-horror",
}

const SERVICE_SLUGS = new Set(BRANDS.map((b) => b.slug))

/** The streaming country an old address without one moves to: stable for crawlers. */
export const DEFAULT_STREAMING_COUNTRY = "us"

/** Every slug is a page here: the address the old one moves to is checked by the page it lands on. */
const ANY: Parameters<typeof parse>[2] = { has: () => true }

/**
 * The new address of an old one, with its query, or null when the address didn't move (it's a current address, or
 * nothing replaces it). `pathname` has no trailing slash; `search` is the query with or without its "?".
 */
export function browseRedirect(pathname: string, search = ""): string | null {
	const segs = pathname.split("/").filter(Boolean)
	const kind = kindOfSeg(segs[0])
	if (!kind) return null
	const t = `/${segs[0]}`
	const query = new URLSearchParams(search)
	const keep = query.toString() ? `?${query}` : ""
	const [, family, slug, more] = segs

	if (family === "best" && segs.length === 2) return `${t}/top${keep}`

	// Old category pages: their own query (pages, filters) means nothing to the new page.
	if (family === "moods" && slug && !more) {
		if (slug === "motivational" || slug === "educational" || slug === "history")
			return `${t}/themes/history`
		const now = OLD_MOODS[slug]
		if (now && now !== slug) return `${t}/moods/${now}`
	}
	if (family === "genres" && slug && !more) {
		const now = RENAMED_GENRES[slug]
		if (now) return `${t}/genres/${now}`
	}
	if (family === "streaming") {
		if (!slug) return `${t}/streaming/${DEFAULT_STREAMING_COUNTRY}`
		if (!isCountryCode(slug) && SERVICE_SLUGS.has(slug) && !more)
			return `${t}/streaming/${DEFAULT_STREAMING_COUNTRY}/${slug}`
		if (!isCountryCode(slug)) return null
	}
	if (family === "traits") {
		if (!slug) return `${t}/tropes`
		const trope = !more ? TRAIT_TROPES[slug] : undefined
		return trope ? `${t}/tropes/${trope}` : null
	}

	// `?when=<decade>` and `?from=<country>` were steering forms: the decade or country becomes a real part.
	const when = query.get("when")
	const from = query.get("from")
	if (when || from) {
		const address = parse(pathname, query, ANY)
		if (!address || address.view !== "place") return null
		const parts: Ingredient[] = [...address.parts]
		if (when) parts.push({ family: "decade", slug: when })
		if (from) parts.push({ family: "country", slug: from })
		const next = new URLSearchParams(query)
		next.delete("when")
		next.delete("from")
		next.delete("with")
		const moved = browsePath(place(kind, parts, address.country))
		const [path, own = ""] = moved.split("?")
		const merged = new URLSearchParams(own)
		for (const [k, v] of next) merged.set(k, v)
		const q = merged.toString()
		return `${path}${q ? `?${q}` : ""}`
	}
	// A release year changes Top and the era ribbon. On a mood, genre, theme or style page it
	// never filters a title, but carrying it into each link creates a duplicate of every blend.
	if (slug && ["moods", "genres", "themes", "styles"].includes(family) && query.has("year")) {
		query.delete("year")
		const rest = query.toString()
		return pathname + (rest ? `?${rest}` : "")
	}
	return null
}

/** The address an old one finally lands on: every move applied, so a redirect never points at another redirect. */
export function finalAddress(pathname: string, search = ""): string {
	let [path, query] = [pathname, search.replace(/^\?/, "")]
	for (let i = 0; i < 4; i++) {
		const next = browseRedirect(path, query)
		if (!next) break
		;[path, query = ""] = next.split("?")
	}
	return `${path}${query ? `?${query}` : ""}`
}

/**
 * For an old genre page that isn't a page any more: its kind's genre index. Null when the slug wasn't an old genre
 * page of that kind (then it's simply not found).
 */
export function legacyGenreFallback(kind: Kind, slug: string): string | null {
	if (kind === "all") return null
	const listed = LEGACY_GENRES[kind]
	const now = Object.entries(RENAMED_GENRES).find(([, to]) => to === slug)?.[0] ?? slug
	return listed.includes(now) || listed.includes(slug)
		? `/${kind === "show" ? "shows" : "movies"}/genres`
		: null
}
