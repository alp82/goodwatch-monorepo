import { randomBytes } from "node:crypto"
import * as z from "zod4"
import {
	discoverFilters,
	validDiscoverRanges,
} from "../mcp/discover-filters.ts"
import type { ReadArgs } from "../mcp/tools.server.ts"
import type { GuestTitle } from "./cards.ts"
/** A /discover page's filters, or a /search query (with empty `args`), kept for paging and Back. */
export interface DiscoverState {
	args: ReadArgs
	query?: string
	/** Ranked IDs and their display snapshot. Paging never calls the search engine. */
	search?: { ids: string[]; titles: GuestTitle[]; note?: string }
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
		query: z.string().min(1).max(120).optional(),
		search: z
			.object({
				ids: z.array(z.string().regex(/^(movie|show):[1-9]\d{0,9}$/)).max(100),
				titles: z
					.array(
						z.object({
							id: z.string().regex(/^(movie|show):[1-9]\d{0,9}$/),
							name: z.string(),
							year: z.number().nullable(),
							poster_url: z.string().nullable().optional(),
							runtime_minutes: z.number().nullable().optional(),
							goodwatch_score: z.number().nullable().optional(),
						}),
					)
					.max(100),
				note: z.string().max(200).optional(),
			})
			.optional(),
	})
	.strict()
export const DISCOVER_TTL = 3600
/** Leave room for the action and page number within Discord's 100 characters. */
export async function saveDiscoverState(
	state: DiscoverState,
	forceStore = false,
): Promise<string> {
	const encoded = Buffer.from(JSON.stringify(state)).toString("base64url")
	if (!forceStore && !state.search && encoded.length <= 40) return `i${encoded}`
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
