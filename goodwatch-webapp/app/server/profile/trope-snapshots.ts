import type { TropePool } from "./tropes-model.ts"

interface Dependencies {
	readFast(userId: string): Promise<string | null>
	readStored(userId: string): Promise<string | null>
	readTouched(userId: string): Promise<string | null>
	writeFast(userId: string, value: string): Promise<void>
	writeStored(userId: string, pool: TropePool, readFrom: number): Promise<void>
	now?: () => number
	onError?: (error: unknown) => void
}
const FRESH_MS = 600_000
const SETTLE_MS = 1_500

/** Expiry removes only the fast copy. The last completed snapshot remains readable during rebuilding. */
export function createTropeSnapshots(deps: Dependencies) {
	const now = deps.now ?? Date.now
	const report =
		deps.onError ??
		((error: unknown) => console.error("Profile trope snapshot:", error))
	async function safe<T>(run: () => Promise<T>, fallback: T): Promise<T> {
		try {
			return await run()
		} catch (error) {
			report(error)
			return fallback
		}
	}
	return {
		async read(userId: string) {
			const [fast, touched] = await Promise.all([
				safe(() => deps.readFast(userId), null),
				safe(() => deps.readTouched(userId), undefined),
			])
			function decode(raw: string | null) {
				if (!raw) return null
				try {
					const entry = JSON.parse(raw) as {
						readFrom: number
						stats: TropePool
					}
					if (
						!Number.isFinite(entry.readFrom) ||
						entry.stats?.schema !== 2 ||
						!Array.isArray(entry.stats?.pool) ||
						!Array.isArray(entry.stats.tropes)
					)
						return null
					return {
						pool: entry.stats,
						version: entry.readFrom,
						fresh:
							touched !== undefined &&
							entry.readFrom >= (Number(touched) || 0) + SETTLE_MS &&
							now() - entry.readFrom < FRESH_MS,
					}
				} catch (error) {
					report(error)
					return null
				}
			}
			return (
				decode(fast) ?? decode(await safe(() => deps.readStored(userId), null))
			)
		},
		async write(userId: string, pool: TropePool, readFrom: number) {
			// Only seed Redis after the durable write succeeds; a failed write is retried on a later visit.
			await deps.writeStored(userId, pool, readFrom)
			await safe(
				() => deps.writeFast(userId, JSON.stringify({ readFrom, stats: pool })),
				undefined,
			)
		},
	}
}
