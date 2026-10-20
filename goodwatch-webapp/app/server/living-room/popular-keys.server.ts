import type { PoolCandidates } from "./pool-keys.server"

/** The pool's popularity order and exclusions, with saved-service matches first. Never a taste ranking. */
export function popularHomeKeys(
	candidates: PoolCandidates,
	viewer: {
		seen: ReadonlySet<number>
		skipped: ReadonlySet<number>
		hidden: ReadonlySet<number>
		wishlist: { has(key: number): boolean }
		services: readonly number[]
	},
	onServices: (key: number) => boolean | null,
	limit = 12,
): { keys: number[]; scope: "services" | "mixed" | "all" | "unknown" } {
	const eligible = candidates.all.filter(
		({ key }) =>
			!viewer.hidden.has(key) &&
			!viewer.seen.has(key) &&
			!viewer.skipped.has(key) &&
			!viewer.wishlist.has(key),
	)
	if (!viewer.services.length)
		return {
			keys: eligible.slice(0, limit).map(({ key }) => key),
			scope: "all",
		}
	const own: number[] = []
	const other: number[] = []
	for (const { key } of eligible) {
		const on = onServices(key)
		if (on === null)
			return {
				keys: eligible.slice(0, limit).map(({ key }) => key),
				scope: "unknown",
			}
		if (on) own.push(key)
		else if (other.length < limit) other.push(key)
		if (own.length === limit) break
	}
	return {
		keys: [...own, ...other].slice(0, limit),
		scope:
			own.length >= limit || (own.length > 0 && !other.length)
				? "services"
				: own.length
					? "mixed"
					: "all",
	}
}
