import { randomBytes } from "node:crypto"
import { rankedFromParams } from "~/domain/discover-search"
import { getRedisCluster } from "~/utils/cache"
import type { TitleKey } from "~/utils/title-key"
import { createSearchSetStore } from "./discover-search-set-store"

const store = createSearchSetStore(getRedisCluster)
export async function saveSearchSet(
	keys: readonly number[],
): Promise<string | null> {
	const token = randomBytes(16).toString("hex")
	return (await store.save(token, keys)) ? token : null
}

export async function discoverSearchKeys(
	params: URLSearchParams,
): Promise<TitleKey[] | undefined> {
	const token = params.get("searchSet")
	if (!token) return rankedFromParams(params)
	return loadSet(token)
}

/**
 * A search with read preferences (domain/search-preferences.ts): its original reading's pool, saved as `originalSet`
 * when it differs from the ranked list. Undefined without one.
 */
export async function discoverOriginalKeys(
	params: URLSearchParams,
): Promise<TitleKey[] | undefined> {
	const token = params.get("originalSet")
	return token ? loadSet(token) : undefined
}

/** With the original pool: the keys of the two pools that are one title, `[ranked key, original key]` pairs. */
export async function discoverIdentityPairs(
	params: URLSearchParams,
): Promise<[TitleKey, TitleKey][]> {
	const token = params.get("originalSet") ? params.get("identitySet") : null
	if (!token) return []
	const flat = await loadSet(token)
	const pairs: [TitleKey, TitleKey][] = []
	for (let i = 0; i + 1 < flat.length; i += 2) pairs.push([flat[i], flat[i + 1]])
	return pairs
}

/**
 * The ranked list and the original pool in one list, for counts that look at every title a search can show. A title
 * both hold under two keys counts once, under the original pool's key.
 */
export async function discoverSearchPool(
	params: URLSearchParams,
): Promise<TitleKey[] | undefined> {
	const [ranked, original, pairs] = await Promise.all([
		discoverSearchKeys(params),
		discoverOriginalKeys(params),
		discoverIdentityPairs(params),
	])
	if (!ranked || !original) return ranked
	const folded = new Set(pairs.map(([key]) => key))
	return [...new Set([...ranked.filter((key) => !folded.has(key)), ...original])]
}

async function loadSet(token: string): Promise<TitleKey[]> {
	const keys = await store.load(token)
	if (!keys)
		throw new Response(
			JSON.stringify({
				error: "This search has expired. Search again to continue.",
			}),
			{
				status: 410,
				headers: {
					"Content-Type": "application/json",
					"Cache-Control": "private, no-store",
				},
			},
		)
	return keys as TitleKey[]
}
