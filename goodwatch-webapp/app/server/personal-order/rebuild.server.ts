// Durable cross-instance deduplication. Rollout selection belongs to the scheduled job.
export function createPersonalOrderDirtyMarker(
	sadd: (key: string, member: string) => Promise<unknown>,
) {
	return async (member: string): Promise<void> => {
		if (!member) return
		try {
			await sadd("personal-order:dirty", member)
		} catch {
			console.warn("Personal order dirty-set write failed")
		}
	}
}

export const markPersonalOrderChanged = createPersonalOrderDirtyMarker(
	async (key, member) => {
		const { getRedisCluster } = await import("../../utils/cache")
		const redis = getRedisCluster()
		if (!redis) throw new Error("Valkey unavailable")
		await redis.sadd(key, member)
	},
)
