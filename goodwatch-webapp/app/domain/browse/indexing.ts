// Which Browse pages search engines may index, and the breadcrumb trail every Browse page describes in its structured
// data. One rule for the page's robots tag and for the sitemap, so the sitemap never lists a page that says noindex.
// docs/implementation/explore-rethink/spec.md, section 4.
import {
	type Address,
	FAMILY,
	type Family,
	type Ingredient,
	browsePath,
	familyPage,
	hub,
	kindLabel,
	place,
	splitParts,
} from "./address"

/** The fewest well-known titles a place or blend needs before it's a page worth indexing. */
export const MIN_INDEXED_TITLES = 24

/** Families that resolve as blend parts but have no page of their own in any index, nav, or sitemap. */
const UNLISTED: ReadonlySet<Family> = new Set(["theme", "style", "trait"])

/**
 * Whether a Browse page may be indexed. `count` is how many well-known titles the page's place or blend has (ignored
 * for the hub and the family indexes).
 *
 * Indexed: the hubs and family indexes for movies and shows, single places and two-part path blends with a full page.
 * Not indexed (noindex, follow): anything under `/all`, `?with=` blends (three or more parts, or a pair the path
 * doesn't hold), theme and style pages, and places or blends under the minimum.
 */
export function isIndexable(a: Address, count: number): boolean {
	if (a.kind === "all") return false
	if (a.view === "hub") return true
	if (a.view === "family") return !a.family || !UNLISTED.has(a.family)
	if (a.view !== "place") return false
	if (!a.parts.length || a.parts.some((p) => UNLISTED.has(p.family))) return false
	if (count < MIN_INDEXED_TITLES) return false
	return splitParts(a.parts).rest.length === 0
}

export interface BrowseCrumb {
	label: string
	path: string
}

/**
 * The trail a Browse page sits on, for its BreadcrumbList: the kind's hub, the family index of the page's lead part,
 * then the page itself. The visible trail is gone (the Browse row shows where you are); the structured data stays.
 */
export function browseCrumbs(a: Address, name: string): BrowseCrumb[] {
	const kind = { label: kindLabel(a.kind), path: browsePath(hub(a.kind)) }
	if (a.view === "hub") return [kind]
	if (a.view === "family" && a.family)
		return [
			kind,
			{ label: FAMILY[a.family].many, path: browsePath(familyPage(a.kind, a.family, a.country)) },
		]
	const lead: Ingredient | undefined = splitParts(a.parts).lead
	if (!lead) return [kind]
	const family = {
		label: FAMILY[lead.family].many,
		path: browsePath(familyPage(a.kind, lead.family, a.country)),
	}
	const self = { label: name, path: browsePath(place(a.kind, a.parts, a.country)) }
	return [kind, family, self]
}
