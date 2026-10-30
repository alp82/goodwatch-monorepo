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
