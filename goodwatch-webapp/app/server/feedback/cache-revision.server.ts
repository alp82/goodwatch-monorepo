// Cross-process signal for a correction change. The data caches need no reset: every reader applies live
// corrections after its cache (apply-corrections.server.ts), with a five second lookup cache per entity. What a
// process keeps in memory for a specific page must go: its stored HTML pages, its hot OG cards, and a corrected
// country's availability index. Each change is announced in Valkey with the paths it touches, and every process
// polls that key at most every two seconds and resets only those paths. A whole-namespace reset would make every
// title and person page a cache miss at once.
const KEY = "catalog-correction-reset"
const KEEP = 50
const POLL_MS = 2000
export interface CorrectionReset {
	at: number
	/** Path prefixes such as `/movie/603`; a page matches when its path is the prefix or continues with `-` or `/`. */
	paths: string[]
	/** The corrected country when an offer changed. */
	country?: string
}
export const resetMatcher =
	(paths: string[]) =>
	(path: string): boolean =>
		paths.some(
			(prefix) =>
				path === prefix ||
				(path.startsWith(prefix) && /^[-/?]/.test(path.slice(prefix.length))),
		)
/** Resets this process's memory for the given paths and returns what changed. */
export async function applyCorrectionReset(reset: CorrectionReset) {
	const match = resetMatcher(reset.paths)
	const { resetCorrectionReader } = await import("./apply-corrections.server.ts")
	resetCorrectionReader()
	const { resetPageCache } = await import("../page-cache.server.ts")
	resetPageCache(match)
	const { hotCards } = await import("../og-image/hot-cards.server.ts")
	hotCards.forget(match)
	if (reset.country) {
		const { reloadAvailability } = await import(
			"../availability-index.server.ts"
		)
		reloadAvailability(reset.country)
	}
}
let seenAt = Date.now()
let nextPoll = 0
let polling: Promise<void> | null = null
/** Applies resets announced by other processes since the last poll. At most one Valkey read per two seconds. */
export function pollCorrectionResets(now = Date.now()): Promise<void> {
	if (polling) return polling
	if (now < nextPoll) return Promise.resolve()
	nextPoll = now + POLL_MS
	polling = (async () => {
		try {
			const { getRedisCluster, withRedisDeadline } = await import(
				"../../utils/cache.ts"
			)
			const redis = getRedisCluster()
			if (!redis) return
			const raw = await withRedisDeadline(redis.get(KEY))
			if (!raw) return
			const resets = (JSON.parse(raw) as CorrectionReset[]).filter(
				(r) => r.at > seenAt,
			)
			for (const reset of resets) {
				seenAt = Math.max(seenAt, reset.at)
				await applyCorrectionReset(reset)
			}
		} catch {
			/* A missed poll is retried two seconds later. */
		} finally {
			polling = null
		}
	})()
	return polling
}
/** Announces a change to every process and applies it here at once. */
export async function announceCorrectionReset(
	reset: Omit<CorrectionReset, "at">,
) {
	const entry: CorrectionReset = { at: Date.now(), ...reset }
	seenAt = Math.max(seenAt, entry.at)
	await applyCorrectionReset(entry)
	const { getRedisCluster, withRedisDeadline } = await import(
		"../../utils/cache.ts"
	)
	const redis = getRedisCluster()
	if (!redis) return
	await withRedisDeadline(
		(async () => {
			let list: CorrectionReset[] = []
			try {
				list = JSON.parse((await redis.get(KEY)) ?? "[]")
			} catch {
				/* A damaged list starts over. */
			}
			list = [...list.filter((r) => r.at > entry.at - 3600000), entry].slice(
				-KEEP,
			)
			await redis.set(KEY, JSON.stringify(list), "EX", 3600)
		})(),
	)
}
export function resetCorrectionSignalForTest() {
	seenAt = Date.now()
	nextPoll = 0
	polling = null
}
