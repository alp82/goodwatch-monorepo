import { randomBytes } from "node:crypto"
import * as z from "zod4"
import {
	discoverFilters,
	validDiscoverRanges,
} from "../mcp/discover-filters.ts"
import type { ReadArgs } from "../mcp/tools.server.ts"
export interface DiscoverState {
	args: ReadArgs
}
const stateSchema = z
	.object({
		args: z
			.object({
				...discoverFilters,
				for_you: z.boolean().optional(),
				exclude_seen: z.boolean().optional(),
			})
			.strict()
			.refine(validDiscoverRanges),
	})
	.strict()
export const DISCOVER_TTL = 3600
/** Leave room for the action and page number within Discord's 100 characters. */
export async function saveDiscoverState(state: DiscoverState): Promise<string> {
	const encoded = Buffer.from(JSON.stringify(state)).toString("base64url")
	if (encoded.length <= 65) return `i${encoded}`
	const key = randomBytes(9).toString("hex")
	const { getRedisCluster, withRedisDeadline } = await import(
		"../../utils/cache"
	)
	const redis = getRedisCluster()
	if (!redis) throw new Error("Discover storage unavailable")
	await withRedisDeadline(
		redis.set(
			`discord:discover:v1:${key}`,
			JSON.stringify(state),
			"EX",
			DISCOVER_TTL,
		),
	)
	return `k${key}`
}
export async function loadDiscoverState(
	key: string,
): Promise<DiscoverState | null> {
	if (!/^(i[A-Za-z0-9_-]{1,65}|k[a-f0-9]{18})$/.test(key)) return null
	let raw: string | null | undefined
	if (key[0] === "i") raw = Buffer.from(key.slice(1), "base64url").toString()
	else {
		const { getRedisCluster, withRedisDeadline } = await import(
			"../../utils/cache"
		)
		const redis = getRedisCluster()
		raw = redis
			? await withRedisDeadline(
					redis.get(`discord:discover:v1:${key.slice(1)}`),
			  )
			: null
	}
	if (!raw) return null
	try {
		const result = stateSchema.safeParse(JSON.parse(raw))
		return result.success ? result.data : null
	} catch {
		return null
	}
}
