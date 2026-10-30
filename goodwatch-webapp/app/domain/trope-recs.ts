// By your tropes (Watch › Recommendations): its addresses, the short trope keys in them, and the small words the page
// and its links share. Pure; the API's shapes are in server/trope-recs/ranking.ts (docs/implementation/trope-recs.md).
import { WATCH_PATHS } from "./member-paths.ts"

export type RecKind = "all" | "movie" | "show"
export const REC_KINDS: [RecKind, string][] = [
	["all", "All"],
	["movie", "Movies"],
	["show", "Shows"],
]

/** One of the member's top tropes, as /api/trope-recs and /api/trope-recs/tropes send it. */
export interface MemberTropeRef {
	/** A canonical TV Tropes URL, or an unresolved `label:` identity. */
	id: string
	name: string
	/** The member's rank for it, from 1. */
	rank: number
	count: number
	loved: number
	labels: string[]
}

const PAGE =
	/^https:\/\/tvtropes\.org\/pmwiki\/pmwiki\.php\/([A-Za-z]+)\/([A-Za-z0-9_]+)$/

/**
 * The trope's key in an address: a Main page's name ("AntiHero"), another namespace's as "Namespace.Page", and an
 * unresolved identity as itself (URLSearchParams escapes it).
 */
export function tropeSlug(id: string): string {
	const page = PAGE.exec(id)
	if (!page) return id
	return page[1] === "Main" ? page[2] : `${page[1]}.${page[2]}`
}

/** The member's trope an address names, by its key (any case) or its full id; null when they don't have it. */
export function findTrope<T extends Pick<MemberTropeRef, "id">>(
	tropes: readonly T[],
	param: string | null | undefined,
): T | null {
	if (!param) return null
	const wanted = param.toLowerCase()
	return (
		tropes.find((t) => t.id === param) ??
		tropes.find((t) => tropeSlug(t.id).toLowerCase() === wanted) ??
		null
	)
}

/** By your tropes, or one trope's picks (`trope` is its id), with the kind when it isn't All. */
export function tropeRecsPath(
	options: { trope?: string | null; kind?: RecKind } = {},
): string {
	const params = new URLSearchParams()
	if (options.trope) params.set("trope", tropeSlug(options.trope))
	if (options.kind && options.kind !== "all") params.set("kind", options.kind)
	const q = params.toString()
	return q ? `${WATCH_PATHS.forYouTropes}?${q}` : WATCH_PATHS.forYouTropes
}

/** The page's query: the trope key as written, and the kind (All for anything else). */
export function readRecsQuery(search: URLSearchParams): {
	trope: string | null
	kind: RecKind
} {
	const kind = search.get("kind")
	return {
		trope: search.get("trope") || null,
		kind: kind === "movie" || kind === "show" ? kind : "all",
	}
}

const plain = (name: string) =>
	name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")

/**
 * Finds the member's trope for a trope name as a title page lists it: by the names merged into the trope (its
 * labels) or its display name, ignoring case, spaces and punctuation.
 */
export function tropeByName<T extends Pick<MemberTropeRef, "name" | "labels">>(
	tropes: readonly T[],
): (name: string) => T | null {
	const byName = new Map<string, T>()
	for (const t of tropes)
		for (const label of [t.name, ...t.labels]) {
			const key = plain(label)
			if (key && !byName.has(key)) byName.set(key, t)
		}
	return (name) => byName.get(plain(name)) ?? null
}

/** The quiet line under a pick's poster: "#3 · 94 · 5 of your tropes" (the count only where it's given). */
export function rankLine(
	place: number,
	match: number,
	matched?: number,
): string {
	const parts = [`#${place}`, String(match)]
	if (matched !== undefined) parts.push(`${matched} of your tropes`)
	return parts.join(" · ")
}
