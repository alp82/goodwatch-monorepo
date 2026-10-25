import { randomUUID } from "node:crypto"
export const CORRECTION_CACHE_NAMES = [
	"details-movie-v2",
	"details-show-v3",
	"title-cast-v1",
	"episode-presentation-v2",
	"episode-grid-media-v3",
	"tracking-episode-list-v1",
	"person-profile-v2",
]
let observedRevision = ""
const revisions = new Map<string, { value: string; until: number }>()
export async function correctionCacheRevision(name: string): Promise<string> {
	if (
		!CORRECTION_CACHE_NAMES.includes(name) &&
		name !== "availability-index-corrections"
	)
		return ""
	const hit = revisions.get(name)
	if (hit && hit.until > Date.now()) return hit.value
	const { getRedisCluster, withRedisDeadline } = await import(
		"../../utils/cache.ts"
	)
	const value = await withRedisDeadline(
		getRedisCluster()?.get(`catalog-correction-cache:${name}`) ??
			Promise.resolve(null),
	).catch(() => null)
	const revision = value ?? hit?.value ?? ""
	if (
		name !== "availability-index-corrections" &&
		observedRevision !== revision
	)
		(await import("./apply-corrections.server.ts")).resetCorrectionReader()
	if (name !== "availability-index-corrections") observedRevision = revision
	revisions.set(name, { value: revision, until: Date.now() + 2000 })
	return revision
}
export async function resetCorrectionCaches(provider = false) {
	const { getRedisCluster, withRedisDeadline } = await import(
		"../../utils/cache.ts"
	)
	const value = randomUUID()
	observedRevision = value
	await Promise.all(
		[
			...CORRECTION_CACHE_NAMES,
			...(provider ? ["availability-index-corrections"] : []),
		].map(async (name) => {
			revisions.set(name, { value, until: Date.now() + 2000 })
			await withRedisDeadline<unknown>(
				getRedisCluster()?.set(`catalog-correction-cache:${name}`, value) ??
					Promise.resolve(),
			).catch(() => {})
		}),
	)
}
