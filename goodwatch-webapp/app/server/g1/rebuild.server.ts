// Durable cross-instance deduplication. Rollout selection belongs to the scheduled job.
export function createG1DirtyMarker(
	sadd: (key: string, member: string) => Promise<unknown>,
) {
	return async (member: string): Promise<void> => {
		if (!member) return
		try {
			await sadd("g1:dirty", member)
		} catch {
			console.warn("G1 dirty-set write failed")
		}
	}
}

export const markG1Changed = createG1DirtyMarker(async (key, member) => {
	const { getRedisCluster } = await import("../../utils/cache")
	const redis = getRedisCluster()
	if (!redis) throw new Error("Valkey unavailable")
	await redis.sadd(key, member)
})
