// Which titles carry each trope with a Browse page, and how each bends it, ready in memory for every process.
//
// One Crate statement per trope reads its write-ups (`trope` rows: media type, TMDB id and the first words of the
// write-up). The result goes into the shared Redis cache as a compact record (trope-members.ts), so the fleet reads
// Crate once a day per trope and a fresh process only reads Redis: about 1.5 MB for the whole directory, in parallel.
// A record is kept seven days past its day, so a quiet night never leaves a process with nothing.
//
// The directory (which tropes have a page) lives in `~/domain/tropes`; callers pass its TV Tropes page names, so this
// module never decides which tropes exist. A trope whose read failed keeps its previous members, never an empty set.
import { type Play, playOf } from "~/domain/tropes/play"
import { htmlToText } from "~/server/profile/trope-text"
import { cached } from "~/utils/cache"
import { query } from "~/utils/crate"
import { type TropeMembers, type TropeRecord, decodeTrope, encodeTrope } from "./trope-members"

/** How long a process keeps its members before it asks the shared cache again. */
const REFRESH_MS = 6 * 60 * 60 * 1000
/** The shared cache's day: after it, the next request refreshes the record in the background. */
const TTL_MINUTES = 24 * 60
/** How long past its day a record may still be served while it refreshes. */
const STALE_MINUTES = 7 * 24 * 60
/** Reads in flight at once on a cold fleet (one Crate statement each). */
const PARALLEL = 8
/** The most write-ups one trope has is about 12,000; the limit only guards a runaway read. */
const ROW_LIMIT = 40_000

/** A trope's TV Tropes page, from its page name (`ChekhovsGun`). */
export const tropeUrlOf = (pageName: string) =>
	`https://tvtropes.org/pmwiki/pmwiki.php/Main/${pageName}`

async function readTrope({ pageName }: { pageName: string }): Promise<TropeRecord> {
	const rows = await query<{ media_type: string; media_tmdb_id: number; head: string | null }>(
		`SELECT media_type, media_tmdb_id, substr(content, 1, 96) AS head FROM trope
		  WHERE url = ? AND media_type IN ('movie', 'show') LIMIT ${ROW_LIMIT}`,
		[tropeUrlOf(pageName)],
		{ timeoutMs: 10_000 },
	)
	return encodeTrope(
		rows.map((r) => ({
			media_type: r.media_type,
			media_tmdb_id: Number(r.media_tmdb_id),
			// A tag cut off by the substring is dropped before the text is read.
			play: r.head ? playOf(htmlToText(r.head.replace(/<[^>]*$/, ""))) : null,
		})),
	)
}

const tropeRecord = (pageName: string) =>
	cached({
		name: "browse-trope-members-v1",
		params: { pageName },
		ttlMinutes: TTL_MINUTES,
		staleMinutes: STALE_MINUTES,
		target: readTrope,
	})

interface Loaded {
	byName: Map<string, TropeMembers>
	/** Raised on every completed load; part of derived caches' identity. */
	version: number
	at: number
	names: string
}

let loaded: Loaded = { byName: new Map(), version: 0, at: 0, names: "" }
let loading: Promise<void> | null = null

async function loadAll(pageNames: readonly string[]): Promise<void> {
	const byName = new Map(loaded.byName)
	const queue = [...pageNames]
	const worker = async () => {
		for (let name = queue.shift(); name; name = queue.shift()) {
			try {
				const members = decodeTrope(await tropeRecord(name))
				if (members) byName.set(name, members)
			} catch (error) {
				console.error(`Browse tropes: reading ${name} failed:`, error)
			}
		}
	}
	await Promise.all(Array.from({ length: PARALLEL }, worker))
	loaded = { byName, version: loaded.version + 1, at: Date.now(), names: pageNames.join(",") }
}

/**
 * Starts (or joins) the load of the given tropes' members. The first load is waited for; a later refresh (every six
 * hours, or when the directory changes) runs in the background while the current members keep serving.
 */
export function ensureTropeMembers(pageNames: readonly string[]): Promise<void> {
	const changed = loaded.names !== pageNames.join(",")
	const stale = Date.now() - loaded.at > REFRESH_MS
	if (!loading && (loaded.version === 0 || stale || changed)) {
		loading = loadAll(pageNames).finally(() => {
			loading = null
		})
	}
	return loaded.version === 0 && loading ? loading : Promise.resolve()
}

/** Waits for the first load at most `ms`; true when members are there. */
export async function tropeMembersReady(pageNames: readonly string[], ms = 3000): Promise<boolean> {
	await Promise.race([ensureTropeMembers(pageNames), new Promise((r) => setTimeout(r, ms))])
	return loaded.version > 0
}

/** A trope's titles, or null before the first load finished (a trope that failed to load is empty). */
export function tropeMembers(pageName: string): TropeMembers | null {
	if (loaded.version === 0) return null
	return loaded.byName.get(pageName) ?? EMPTY
}

/** Every directory member has a successful read, including legitimately empty records. */
export const allTropeMembersLoaded = (names: readonly string[]) =>
	names.every((name) => loaded.byName.has(name))

/** Raised on every completed load: include it in the key of anything computed from members. */
export const tropeMembersVersion = () => loaded.version

/** How a title plays a trope, or null when it doesn't carry it or members aren't loaded. */
export const tropePlay = (pageName: string, key: number): Play | null =>
	tropeMembers(pageName)?.play(key) ?? null

const EMPTY = decodeTrope(encodeTrope([])) as TropeMembers
