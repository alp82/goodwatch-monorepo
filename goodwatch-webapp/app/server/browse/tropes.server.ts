// Which titles carry each trope of the directory (domain/tropes/catalog.ts), and the
// write-ups that say how. SELECT only, read from the per-title `trope` rows (media_type, media_tmdb_id, url, name,
// content) and the `trope_catalog_page` descriptions, the same tables production's title Tropes section reads.
//
// Membership comes from the shared trope members cache (trope-members.server.ts: read from Crate once a day across the
// fleet, served stale while it refreshes); the write-ups are read here per trope page with a short cache.
import { query } from "~/utils/crate"
import { type TitleKey, titleKey } from "~/utils/title-key"
import { firstPoint } from "./trope-write-up"
import { TROPES, type Play, playOf, tropeUrlOf } from "~/domain/tropes/catalog"
import {
	ensureTropeMembers,
	tropeMembers as sharedMembers,
	tropeMembersVersion,
} from "./trope-members.server"

/** Starts (or joins) the membership load (T1's shared cache); resolves once every trope has been tried once. */
export const ensureTropes = (): Promise<void> => ensureTropeMembers(TROPES.map((t) => t.id))

/** The titles that carry a trope, or null before the first load finished. */
export function tropeMembers(
	id: string,
): { has(key: TitleKey): boolean; keys(): Iterable<TitleKey> } | null {
	const members = sharedMembers(id)
	return members ? { has: (key) => members.has(key), keys: () => members.keys() } : null
}

/** Raised on every completed load; part of row caches' identity. */
export const tropesVersion = () => tropeMembersVersion()

// ---------------------------------------------------------------------------------------------------------
// Write-ups

export interface TropeExample {
	key: TitleKey
	/** The name the write-up files it under, when it isn't the trope's own ("Chekhov's Dummy"). */
	as: string | null
	play: Play
	/** The write-up's first point, as plain text, at most about 320 characters. */
	text: string
	/** Character ranges of `text` that TV Tropes marks as spoilers. */
	spoilers: [number, number][]
}

const cache = new Map<string, { at: number; value: unknown }>()
async function remember<T>(id: string, ttlMs: number, read: () => Promise<T>): Promise<T> {
	const hit = cache.get(id)
	if (hit && Date.now() - hit.at < ttlMs) return hit.value as T
	const value = await read()
	if (cache.size > 400) cache.clear()
	cache.set(id, { at: Date.now(), value })
	return value
}

/** The write-ups of one trope for the given titles (at most 80), in the given order. */
export async function tropeExamples(id: string, keys: TitleKey[]): Promise<TropeExample[]> {
	const want = keys.slice(0, 80)
	const ids = { movie: [] as number[], show: [] as number[] }
	for (const k of want) {
		if (k >= 2e12) ids.show.push(k - 2e12)
		else ids.movie.push(k - 1e12)
	}
	const read = async (type: "movie" | "show") =>
		ids[type].length
			? query<{ media_tmdb_id: number; name: string | null; content: string | null }>(
					`SELECT media_tmdb_id, name, content FROM trope WHERE url = ? AND media_type = ? AND media_tmdb_id IN (${ids[type].map(() => "?").join(",")}) LIMIT ${ids[type].length * 3}`,
					[tropeUrlOf(id), type, ...ids[type]],
					{ timeoutMs: 6000 },
				).then((rows) => rows.map((r) => ({ ...r, key: titleKey(type, Number(r.media_tmdb_id)) })))
			: Promise.resolve([])
	const rows = await remember(`ex|${id}|${want.join(",")}`, 60 * 60 * 1000, async () =>
		(await Promise.all([read("movie"), read("show")])).flat(),
	)
	const trope = TROPES.find((t) => t.id === id)
	const own = trope?.label.toLowerCase()
	const byKey = new Map<TitleKey, TropeExample>()
	for (const r of rows) {
		if (!r.content || byKey.has(r.key)) continue
		const point = firstPoint(r.content)
		const text = point.text
		// A page TV Tropes runs with spoilers unmarked: the whole write-up is the spoiler.
		const spoilers: [number, number][] = trope?.spoilersOff ? [[0, text.length]] : point.spoilers
		if (text.length < 24) continue
		const name = r.name?.trim() ?? null
		byKey.set(r.key, {
			key: r.key,
			as: name && name.toLowerCase() !== own ? name : null,
			play: playOf(text),
			text,
			spoilers,
		})
	}
	return want.flatMap((k) => byKey.get(k) ?? [])
}

/** What the trope is, from the TV Tropes catalog: its first one or two sentences, plain text. */
export async function tropeOpening(id: string): Promise<string | null> {
	return remember(`open|${id}`, 12 * 60 * 60 * 1000, async () => {
		const rows = await query<{ description: string | null }>(
			"SELECT substr(description, 1, 900) AS description FROM trope_catalog_page WHERE url = ? LIMIT 1",
			[tropeUrlOf(id)],
			{ timeoutMs: 3000 },
		).catch(() => [])
		const raw = rows[0]?.description
		if (!raw) return null
		const para = raw
			.split(/\n\s*\n/)
			.map((p) => p.replace(/\s+/g, " ").trim())
			.find((p) => p.length > 60 && !/^(?:This|The following) (?:page|trope) /i.test(p))
		if (!para) return null
		const sentences = para.match(/[^.!?]+[.!?]+(?=\s|$)/g) ?? [para]
		let out = ""
		for (const s of sentences) {
			if (out && out.length + s.length > 280) break
			out += s
		}
		return out.trim()
	})
}
