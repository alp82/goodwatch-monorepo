// Try again on error cards: the original interaction's command and options (or the pressed component) are kept in
// Valkey for 15 minutes under a short random key, and the button carries only `gw1:retry:<key>`.
import { randomBytes } from "node:crypto"
import * as z from "zod4"
import type { Interaction } from "./router.server.ts"

export const RETRY_TTL = 900
const KEY = /^[a-f0-9]{18}$/

const optionSchema = z.object({
	name: z.string().max(32),
	value: z.union([z.string().max(200), z.number()]).optional(),
})
const entrySchema = z
	.object({
		/** The Discord user who ran the command or pressed the button. */
		user: z.string().min(1).max(32),
		/** The original interaction's ID, so a retried write keeps its idempotency key. */
		id: z.string().regex(/^[A-Za-z0-9_-]{1,65}$/).optional(),
		type: z.union([z.literal(2), z.literal(3), z.literal(5)]),
		data: z
			.object({
				name: z.string().max(32).optional(),
				options: z.array(optionSchema).max(25).optional(),
				custom_id: z.string().max(100).optional(),
				values: z.array(z.string().max(100)).max(25).optional(),
				components: z
					.array(
						z.object({
							type: z.number(),
							component: z
								.object({
									custom_id: z.string().max(100).optional(),
									values: z.array(z.string().max(100)).max(25).optional(),
								})
								.optional(),
							components: z
								.array(
									z.object({
										custom_id: z.string().max(100).optional(),
										values: z.array(z.string().max(100)).max(25).optional(),
									}),
								)
								.max(5)
								.optional(),
						}),
					)
					.max(5)
					.optional(),
			})
			.strict(),
	})
	.strict()
export type RetryEntry = z.infer<typeof entrySchema>

export interface RetryStore {
	get(key: string): Promise<string | null>
	set(key: string, value: string, ttlSeconds: number): Promise<void>
}

/** What a retry needs from an interaction, or null for one that can't be re-run (autocomplete, pings, Try again itself). */
export function retryEntry(interaction: Interaction): RetryEntry | null {
	const user = interaction.member?.user?.id ?? interaction.user?.id
	const data = interaction.data
	if (!user || !data || ![2, 3, 5].includes(interaction.type)) return null
	if (data.custom_id && isRetryId(data.custom_id)) return null
	const picked = {
		...(data.name ? { name: data.name } : {}),
		...(data.options
			? {
					options: data.options.map((o) => ({
						name: o.name,
						...(o.value !== undefined ? { value: o.value } : {}),
					})),
				}
			: {}),
		...(data.custom_id ? { custom_id: data.custom_id } : {}),
		...(data.values ? { values: data.values } : {}),
		...(data.components ? { components: data.components } : {}),
	}
	const parsed = entrySchema.safeParse({
		user,
		...(interaction.id && /^[A-Za-z0-9_-]{1,65}$/.test(interaction.id)
			? { id: interaction.id }
			: {}),
		type: interaction.type,
		data: picked,
	})
	return parsed.success ? parsed.data : null
}

export const retryCustomId = (key: string) => `gw1:retry:${key}`
export const isRetryId = (customId: string) => customId.startsWith("gw1:retry:")
export function parseRetryId(customId: string) {
	const match = /^gw1:retry:([a-f0-9]{18})$/.exec(customId)
	return match ? match[1] : null
}

const storeKey = (key: string) => `discord:retry:v1:${key}`

export async function saveRetry(entry: RetryEntry, store: RetryStore) {
	const key = randomBytes(9).toString("hex")
	await store.set(storeKey(key), JSON.stringify(entry), RETRY_TTL)
	return key
}

export async function loadRetry(
	key: string,
	store: RetryStore,
): Promise<RetryEntry | null> {
	if (!KEY.test(key)) return null
	const raw = await store.get(storeKey(key))
	if (!raw) return null
	try {
		const parsed = entrySchema.safeParse(JSON.parse(raw))
		return parsed.success ? parsed.data : null
	} catch {
		return null
	}
}

/** Valkey with the shared command deadline; throws when this process has none, so no button is offered. */
export async function valkeyRetryStore(): Promise<RetryStore> {
	if (!process.env.REDIS_HOST) throw new Error("Retry storage unavailable")
	const { getRedisCluster, withRedisDeadline } = await import(
		"../../utils/cache"
	)
	const redis = getRedisCluster()
	if (!redis) throw new Error("Retry storage unavailable")
	return {
		get: (key) => withRedisDeadline(redis.get(key)),
		set: async (key, value, ttl) => {
			await withRedisDeadline(redis.set(key, value, "EX", ttl))
		},
	}
}
