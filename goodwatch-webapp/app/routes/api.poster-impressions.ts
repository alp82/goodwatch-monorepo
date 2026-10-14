import { canonicalTitleId } from "~/utils/title-identity"
import { createHash } from "node:crypto"
import type { ActionFunctionArgs } from "@remix-run/node"
import { z } from "zod"
import { rateLimiter } from "~/server/rate-limit.server"
import { hasSiteOrigin } from "~/server/site-origin.server"
import { increasePriority } from "~/server/utils/priority"
import { getRedisCluster } from "~/utils/cache"
import { query } from "~/utils/crate"

const payloadSchema = z.object({
	visitorId: z.string().uuid(),
	items: z.array(z.object({
		media_type: z.enum(["movie", "show"]),
		tmdb_id: z.number().int().positive().max(2_147_483_647),
	}).strict()).min(1).max(50),
}).strict()

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") return new Response(null, { status: 405 })
	if (!hasSiteOrigin(request)) return new Response(null, { status: 403 })
	if (!request.headers.get("content-type")?.startsWith("application/json")) return new Response(null, { status: 415 })
	// Bound actual streamed bytes, including requests without Content-Length.
	const reader = request.body?.getReader()
	if (!reader) return new Response(null, { status: 400 })
	const chunks: Uint8Array[] = []
	let size = 0
	while (true) {
		const { done, value } = await reader.read()
		if (done) break
		size += value.byteLength
		if (size > 8192) {
			await reader.cancel()
			return new Response(null, { status: 413 })
		}
		chunks.push(value)
	}
	let parsed: ReturnType<typeof payloadSchema.safeParse>
	try {
		parsed = payloadSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")))
	} catch {
		return new Response(null, { status: 400 })
	}
	if (!parsed.success) return new Response(null, { status: 400 })
	const redis = getRedisCluster()
	if (!redis) return new Response(null, { status: 503 })
	try {
		// The ingress must overwrite X-Forwarded-For; raw addresses are never stored.
		const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
		const clientKey = createHash("sha256").update(address).digest("hex")
		const verdict = await rateLimiter.take("poster-rate", clientKey, [{ limit: 60, seconds: 60 }])
		if (!verdict.allowed) return new Response(null, { status: 429, headers: { "Retry-After": String(verdict.retryAfterSeconds) } })
		const unique = [...new Map(parsed.data.items.map(item => ({ ...item, tmdb_id: canonicalTitleId(item.media_type, item.tmdb_id) })).map(item => [`${item.media_type}:${item.tmdb_id}`, item])).values()]
		const accepted = []
		for (const mediaType of ["movie", "show"] as const) {
			const ids = unique.filter(item => item.media_type === mediaType).map(item => item.tmdb_id)
			if (!ids.length) continue
			// Only known catalog entries can create queue records.
			const existing = await query<{ tmdb_id: number }>(`SELECT tmdb_id FROM ${mediaType} WHERE tmdb_id IN (${ids.map(() => "?").join(", ")})`, ids)
			for (const item of existing) {
				const key = `poster-seen:${parsed.data.visitorId}:${mediaType}:${item.tmdb_id}`
				if (await redis.set(key, "1", "EX", 1800, "NX")) accepted.push({ media_type: mediaType, tmdb_id: item.tmdb_id })
			}
		}
		await increasePriority(accepted)
		return new Response(null, { status: 204 })
	} catch (error) {
		console.error("Poster impression recording failed", error)
		return new Response(null, { status: 503 })
	}
}
