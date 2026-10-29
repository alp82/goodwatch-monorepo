/** A timed-out read can finish filling its guarded cache, but never holds up the response. */
export async function withinSocialBudget<T>(load: () => Promise<T>, ms: number, fallback: T): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined
	try {
		return await Promise.race([
			Promise.resolve().then(load),
			new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), ms) }),
		])
	} catch {
		return fallback
	} finally {
		clearTimeout(timer)
	}
}

/** Bound optional title fills across keys, and avoid retrying a broken query on every viewport event. */
export function createSocialFillGate(limit = 16) {
	let active = 0
	const retryAt = new Map<string, number>()
	return async <T>(key: string, load: () => Promise<T>): Promise<T> => {
		if (active >= limit || Date.now() < (retryAt.get(key) ?? 0)) throw new Error("Social fill deferred")
		active++
		try {
			const value = await load()
			retryAt.delete(key)
			return value
		} catch (error) {
			if (retryAt.size >= 1000) retryAt.delete(retryAt.keys().next().value!)
			retryAt.set(key, Date.now() + 5_000)
			throw error
		} finally {
			active--
		}
	}
}
