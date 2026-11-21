// Which titles carry each trope of the directory (domain/tropes/catalog.ts), and the
// write-ups that say how. SELECT only, read from the per-title `trope` rows (media_type, media_tmdb_id, url, name,
// content) and the `trope_catalog_page` descriptions, the same tables production's title Tropes section reads.
//
// Membership comes from the shared trope members cache (trope-members.server.ts: read from Crate once a day across the
// fleet, served stale while it refreshes); the write-ups are read here per trope page with a short cache.
import { query } from "~/utils/crate"
import { type TitleKey, titleKey } from "~/utils/title-key"
import { htmlToText } from "~/server/profile/trope-text"
import { TROPES, type Play, playOf, tropeUrlOf } from "~/domain/tropes/catalog"
import {
	ensureTropeMembers,
	tropeMembers as sharedMembers,
	tropeMembersVersion,
} from "./trope-members.server"

const REFRESH_MS = 12 * 60 * 60 * 1000

/** Starts (or joins) the membership load (T1's shared cache); resolves once every trope has been tried once. */
export const ensureTropes = (): Promise<void> => ensureTropeMembers(TROPES.map((t) => t.id))

/** The titles that carry a trope, or null before the first load finished. */
export function tropeMembers(id: string): { has(key: TitleKey): boolean } | null {
	const members = sharedMembers(id)
	return members ? { has: (key) => members.has(key) } : null
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

/** The first list item (or the whole text), with spoiler spans kept as ranges. */
function firstPoint(html: string): { text: string; spoilers: [number, number][] } {
	const li = /<li>([\s\S]*?)(?:<\/li>|<ul>|$)/i.exec(html)
	let body = li ? li[1] : html
	body = body.replace(/<div class="indent">[\s\S]*$/i, "")
	// Mark spoilers with private-use characters, flatten the rest to text, then turn the marks into ranges.
	body = body.replace(/<span class="spoiler"[^>]*>/gi, "").replace(/<\/span>/gi, "")
	// Some write-ups keep the wiki form ([[spoiler:...]]), sometimes cut before its end.
	body = body.replace(/\[\[spoiler:([\s\S]*?)(?:\]\]|$)/gi, "$1")
	let text = htmlToText(body).replace(/\s+/g, " ").trim()
	if (text.length > 320) {
		const cut = text.slice(0, 320)
		const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "))
		text = `${end > 140 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`}`
	}
	const spoilers: [number, number][] = []
	let out = ""
	let open = -1
	for (const ch of text) {
		if (ch === "") open = out.length
		else if (ch === "") {
			if (open >= 0 && out.length > open) spoilers.push([open, out.length])
			open = -1
		} else out += ch
	}
	if (open >= 0 && out.length > open) spoilers.push([open, out.length])
	return { text: out, spoilers }
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

/**
 * The titles whose write-up opens by bending the trope (subverted, averted, lampshaded...), with how. They are a few
 * percent of a trope's titles, so a page that only read its most popular titles would rarely meet one. One read of
 * every write-up's first words; a failed read is not remembered.
 */
export async function tropeBent(id: string): Promise<Map<TitleKey, Play>> {
	const hit = cache.get(`bent|${id}`)
	if (hit && Date.now() - hit.at < REFRESH_MS) return hit.value as Map<TitleKey, Play>
	const rows = await query<{ media_type: string; media_tmdb_id: number; head: string | null }>(
		"SELECT media_type, media_tmdb_id, substr(content, 1, 64) AS head FROM trope WHERE url = ? LIMIT 30000",
		[tropeUrlOf(id)],
		{ timeoutMs: 10000 },
	).catch(() => null)
	const out = new Map<TitleKey, Play>()
	if (!rows) return out
	for (const r of rows) {
		if (!r.head || (r.media_type !== "movie" && r.media_type !== "show")) continue
		const play = playOf(htmlToText(r.head.replace(/<[^>]*$/, "")))
		if (play !== "straight") out.set(titleKey(r.media_type, Number(r.media_tmdb_id)), play)
	}
	cache.set(`bent|${id}`, { at: Date.now(), value: out })
	return out
}
