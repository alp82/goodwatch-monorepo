import { foldGenres } from "../../domain/genre-fold.ts"
import type { ProfileShell, ProfileTitle } from "../../domain/profile.ts"
import { seesPart } from "../../domain/profile.ts"

export const POOL_LEAST = 10
export const leastTitles = (titles: number) =>
	titles >= 400 ? POOL_LEAST : titles >= 150 ? 6 : 3

export const lovedZ = (loved: number, count: number, rate: number) =>
	count <= 0 || rate <= 0 || rate >= 1
		? 0
		: (loved - rate * count) / Math.sqrt(count * rate * (1 - rate))

export const defining = (length: number, tropeCount: number) =>
	Math.log(1 + Math.max(0, length) / 100) /
	Math.log(10 + Math.max(0, tropeCount))

export interface PoolTitle {
	k: string
	m: 0 | 1
	y: number | null
	s: number
	g: number[]
	r: number[]
	/** Definingness, multiplied by 100 and rounded; parallel to r. */
	d: number[]
}

export interface TropePool {
	genres: string[]
	tropes: string[]
	urls: Record<string, string>
	descriptions: Record<string, string>
	titles: Record<string, ProfileTitle>
	pool: PoolTitle[]
	/** [0, 0] when no release years are known. */
	years: [number, number]
}

export type TropeSight = Pick<ProfileShell, "viewer" | "visibility">
/** The compact pool exposes individual scores and the titles that carry them. */
export const seesTropes = (shell: TropeSight) =>
	seesPart(shell, "taste") && seesPart(shell, "scores")

export interface TropeTitle {
	title: ProfileTitle
	genres: string[]
	names: string[]
}
export interface TropeLength {
	key: string
	name: string
	url: string | null
	length: number | null
}

export function qualifyingTropes(titles: TropeTitle[]): Set<string> {
	const counts = new Map<string, number>()
	for (const t of titles)
		for (const name of new Set(t.names))
			counts.set(name, (counts.get(name) ?? 0) + 1)
	return new Set(
		[...counts]
			.filter(([, n]) => n >= leastTitles(titles.length))
			.map(([name]) => name),
	)
}

export function buildTropePool(
	titles: TropeTitle[],
	lengths: TropeLength[],
	described: Record<string, { text: string; url: string }>,
): TropePool {
	const kept = qualifyingTropes(titles)
	const genres = [
		...new Set(titles.flatMap((t) => foldGenres(t.genres))),
	].sort()
	const tropes = [...kept].sort()
	const genreIx = new Map(genres.map((g, i) => [g, i]))
	const tropeIx = new Map(tropes.map((t, i) => [t, i]))
	const byPair = new Map(lengths.map((t) => [`${t.key}\0${t.name}`, t]))
	const urls = new Map<string, string>()
	for (const row of lengths)
		if (row.url && kept.has(row.name)) urls.set(row.name, row.url)
	const pool: PoolTitle[] = titles.map((t) => {
		const unique = new Set(t.names)
		const names = [...unique].filter((n) => kept.has(n))
		return {
			k: t.title.key,
			m: t.title.mediaType === "movie" ? 0 : 1,
			y: t.title.year,
			s: t.title.score as number,
			g: foldGenres(t.genres).map((g) => genreIx.get(g) as number),
			r: names.map((n) => tropeIx.get(n) as number),
			d: names.map((n) =>
				Math.round(
					defining(
						Number(byPair.get(`${t.title.key}\0${n}`)?.length ?? 0),
						unique.size,
					) * 100,
				),
			),
		}
	})
	const years = pool.flatMap((t) => (t.y == null ? [] : [t.y]))
	return {
		genres,
		tropes,
		pool,
		titles: Object.fromEntries(titles.map((t) => [t.title.key, t.title])),
		urls: Object.fromEntries(
			tropes.map((n) => [n, described[n]?.url ?? urls.get(n) ?? ""]),
		),
		descriptions: Object.fromEntries(
			tropes
				.filter((n) => Object.prototype.hasOwnProperty.call(described, n))
				.map((n) => [n, described[n].text]),
		),
		years: years.length ? [Math.min(...years), Math.max(...years)] : [0, 0],
	}
}

export function definingTop(
	entries: { t: PoolTitle; d: number }[],
	n = 12,
): string[] {
	return [...entries]
		.sort(
			(a, b) =>
				Number(b.t.s >= 7) - Number(a.t.s >= 7) ||
				b.d - a.d ||
				b.t.s - a.t.s ||
				a.t.k.localeCompare(b.t.k),
		)
		.slice(0, n)
		.map((e) => e.t.k)
}

/** Short excerpts end at a sentence where possible. */
export function trimExample(text: string, max = 900, sentencesMax = 7) {
	const sentences = text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [text]
	let out = ""
	for (const s of sentences.slice(0, sentencesMax)) {
		if (out && (out + s).length > max) break
		out += s
	}
	out = out.trim()
	return out.length > max ? `${out.slice(0, max - 1).trimEnd()}…` : out
}

/** Reject the whole request when it exceeds the resource route's bounds. */
export function excerptParams(
	params: URLSearchParams,
): { trope: string; keys: string[] } | null {
	const trope = params.get("trope")?.trim() ?? ""
	const keys = (params.get("keys") ?? "").split(",")
	if (
		!trope ||
		trope.length > 300 ||
		keys.length > 16 ||
		keys.some(
			(k) =>
				!/^(movie|show)-[1-9]\d{0,9}$/.test(k) ||
				Number(k.split("-")[1]) > 2_147_483_647,
		)
	)
		return null
	return { trope, keys: [...new Set(keys)] }
}
