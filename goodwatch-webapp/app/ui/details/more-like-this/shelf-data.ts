// Where More like this's shelves get their titles beyond what the title page's loader sends: the related map's
// nearest titles, a person's other titles in one department and a genre row for any of the title's genres, all from
// /api/title-more-like-this (routes/api.title-more-like-this.ts, no SQL of its own). Plus the shelves' shared helpers.
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import type { RawPack } from "~/ui/related-map/engine"
import { type TitleKey, titleKey } from "~/utils/title-key"

/** A title on a shelf. */
export interface ShelfTitle {
	type: "movie" | "show"
	tmdbId: number
	title: string
	year: number | null
	poster: string | null
	goodwatch: number | null
}

/** The answer of /api/title-more-like-this. */
export interface ShelfAnswer {
	titles: ShelfTitle[]
	/** part=person: the person's name. */
	name?: string
	/** part=similar: the related map's lookup failed. */
	unavailable?: boolean
	/** part=genre: the genre row's heading and page. */
	heading?: string
	path?: string
}

/** A department a person's titles are read for: Directing, Writing, Sound (the composer), Acting, Creator. */
export type As = "Directing" | "Writing" | "Sound" | "Acting" | "Creator"

export const ROLES: readonly As[] = [
	"Directing",
	"Writing",
	"Sound",
	"Acting",
	"Creator",
]

const API = "/api/title-more-like-this"

async function getJson<T>(url: string): Promise<T> {
	const response = await fetch(url)
	if (!response.ok) throw new Error(`${url}: ${response.status}`)
	return response.json()
}

export const shelfKey = (t: { type: string; tmdbId: number }) =>
	`${t.type}:${t.tmdbId}`

/** The related map's nearest titles. `initial`: the loader's, when it had them. */
export function useSimilar(
	type: "movie" | "show",
	id: number,
	enabled: boolean,
	initial?: ShelfTitle[],
) {
	return useQuery({
		queryKey: ["more-like-this", "similar", type, id],
		queryFn: () =>
			getJson<ShelfAnswer>(`${API}?part=similar&type=${type}&id=${id}`),
		enabled: enabled && !initial,
		initialData: initial ? { titles: initial } : undefined,
		staleTime: 5 * 60_000,
	})
}

export const personWork = (
	type: "movie" | "show",
	id: number,
	person: number,
	as: As,
) =>
	getJson<ShelfAnswer>(
		`${API}?part=person&person=${person}&as=${as}&type=${type}&id=${id}`,
	)

export const personWorkKey = (
	type: "movie" | "show",
	id: number,
	person: number | null,
	as: As,
) => ["more-like-this", "person", type, id, person, as]

export function usePersonWork(
	type: "movie" | "show",
	id: number,
	person: number | null,
	as: As,
	enabled: boolean,
) {
	return useQuery({
		queryKey: personWorkKey(type, id, person, as),
		queryFn: () => personWork(type, id, person as number, as),
		enabled: enabled && person != null,
		staleTime: 5 * 60_000,
		placeholderData: keepPreviousData,
	})
}

export function useGenreTitles(
	type: "movie" | "show",
	id: number,
	genre: string | null,
	exclude: readonly number[],
	enabled: boolean,
) {
	return useQuery({
		queryKey: ["more-like-this", "genre", type, id, genre],
		queryFn: () =>
			getJson<ShelfAnswer>(
				`${API}?part=genre&genre=${encodeURIComponent(genre ?? "")}&type=${type}&id=${id}&exclude=${exclude.join(",")}`,
			),
		enabled: enabled && !!genre,
		staleTime: 5 * 60_000,
		placeholderData: keepPreviousData,
	})
}

/**
 * "The Dune series" from the films' names: their shared start, without a trailing "and the", ":" or number. Null when
 * the names share too little ("Mission: Impossible" works, a collection of unrelated names doesn't).
 */
export function seriesName(titles: readonly string[]): string | null {
	if (titles.length < 2) return null
	let prefix = titles[0]
	for (const t of titles.slice(1)) {
		let i = 0
		while (i < prefix.length && i < t.length && prefix[i] === t[i]) i++
		prefix = prefix.slice(0, i)
	}
	// Whole words only.
	const whole = titles.every(
		(t) => t.length === prefix.length || /[\s:\-–—,.]/.test(t[prefix.length]),
	)
	if (!whole) prefix = prefix.replace(/\s*\S*$/, "")
	let name = prefix
	for (let last = ""; last !== name; ) {
		last = name
		name = name
			.replace(/[\s:\-–—,.]+$/, "")
			.replace(/\s+(and|of|the|in|part|chapter|\d+)$/i, "")
			.trim()
	}
	if (name.length < 3) return null
	return /^the\s/i.test(name) ? `${name} series` : `The ${name} series`
}

/** How many titles the shelf holds. */
export const SIMILAR_SHELF = 16

/** The pack's nearest titles, as title keys, most similar first, without the title itself and without posterless ones. */
export function nearestKeys(
	pack: Pick<RawPack, "n">,
	type: "movie" | "show",
	id: number,
	limit = SIMILAR_SHELF,
): TitleKey[] {
	const self = `${type === "movie" ? "m" : "s"}${id}`
	const nearest = [...pack.n]
		.filter((t) => t[0] !== self && t[3])
		.sort((a, b) => b[4] - a[4])
	const seen = new Set<string>()
	const keys: TitleKey[] = []
	for (const t of nearest) {
		if (seen.has(t[0])) continue
		seen.add(t[0])
		const m = /^([ms])(\d+)$/.exec(t[0])
		if (!m) continue
		keys.push(titleKey(m[1] === "m" ? "movie" : "show", Number(m[2])))
		if (keys.length >= limit) break
	}
	return keys
}

/** The id a poster on a shelf carries, so the quick view's way back finds it. */
export const shelfAnchor = (shelf: string, t: ShelfTitle) =>
	`${shelf}-${t.type}-${t.tmdbId}`
