// Short-lived, opaque search snapshots shared by the search and page roles. Only title keys are stored.
export interface SearchSetRedis {
	get(key: string): Promise<string | null>
	setex(key: string, ttl: number, value: string): Promise<unknown>
}
export const SEARCH_SET_TTL = 60 * 60
const PREFIX = "discover-search-set:v1:"
export const validSearchSet = (token: string) => /^[a-f0-9]{32}$/.test(token)

export function createSearchSetStore(redis: () => SearchSetRedis | null) {
	return {
		async save(token: string, keys: readonly number[]) {
			if (!validSearchSet(token) || keys.length > 5000) return false
			const client = redis()
			if (!client) return false
			try {
				await client.setex(
					`${PREFIX}${token}`,
					SEARCH_SET_TTL,
					JSON.stringify(keys),
				)
				return true
			} catch {
				return false
			}
		},
		async load(token: string): Promise<number[] | null> {
			if (!validSearchSet(token)) return null
			try {
				const value = await redis()?.get(`${PREFIX}${token}`)
				if (!value || value.length > 80_000) return null
				const keys: unknown = JSON.parse(value)
				return Array.isArray(keys) &&
					keys.length <= 5000 &&
					keys.every(
						(key) => Number.isSafeInteger(key) && key > 1e12 && key < 3e12,
					)
					? keys
					: null
			} catch {
				return null
			}
		},
	}
}
