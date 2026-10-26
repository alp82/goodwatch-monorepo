import { canonicalTitleId } from "../utils/title-identity.ts"
import { createHash } from "node:crypto"
import { z } from "zod"

export const payloadSchema = z.object({
	visitorId: z.string().uuid(),
	items: z.array(z.object({
		media_type: z.enum(["movie", "show"]),
		tmdb_id: z.number().int().positive().max(2_147_483_647),
		source_kind: z.enum(["poster", "opened"]).default("poster"),
	}).strict()).min(1).max(50),
}).strict()

interface Dependencies {
	hasSiteOrigin: (request: Request) => boolean
	getRedisCluster: () => { set: (key: string, value: string, expiry: "EX", seconds: number, mode: "NX") => Promise<unknown> } | null | undefined
	rateLimiter: { take: (namespace: string, key: string, windows: { limit: number; seconds: number }[]) => Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }> }
	query: (sql: string, ids: number[]) => Promise<{ tmdb_id: number }[]>
	increasePriority: (items: { media_type: "movie" | "show"; tmdb_id: number; source_kind: "poster" | "opened" }[]) => Promise<unknown>
}

export async function recordTitleDemand(request: Request, { hasSiteOrigin, getRedisCluster, rateLimiter, query, increasePriority }: Dependencies) {
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
		const unique = [...new Map(parsed.data.items.map(item => ({ ...item, tmdb_id: canonicalTitleId(item.media_type, item.tmdb_id) })).map(item => [`${item.source_kind}:${item.media_type}:${item.tmdb_id}`, item])).values()]
		const accepted = []
		for (const mediaType of ["movie", "show"] as const) {
			const candidates = unique.filter(item => item.media_type === mediaType)
			const ids = [...new Set(candidates.map(item => item.tmdb_id))]
			if (!ids.length) continue
			// Only known catalog entries can create queue records.
			const existing = await query(`SELECT tmdb_id FROM ${mediaType} WHERE tmdb_id IN (${ids.map(() => "?").join(", ")})`, ids)
			const known = new Set(existing.map(item => item.tmdb_id))
			for (const item of candidates) {
				if (!known.has(item.tmdb_id)) continue
				// Keep the legacy poster key so omitted source kinds retain their existing window.
				const prefix = item.source_kind === "poster" ? "poster-seen" : "opened-seen"
				const key = `${prefix}:${parsed.data.visitorId}:${mediaType}:${item.tmdb_id}`
				if (await redis.set(key, "1", "EX", 1800, "NX")) accepted.push(item)
			}
		}
		await increasePriority(accepted)
		return new Response(null, { status: 204 })
	} catch (error) {
		console.error("Poster impression recording failed", error)
		return new Response(null, { status: 503 })
	}
}
