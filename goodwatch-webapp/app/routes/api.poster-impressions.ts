import { createHash } from "node:crypto"
import type { ActionFunctionArgs } from "@remix-run/node"
import { z } from "zod"
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

const rateLimitScript = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], 60) end
return count
`

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") return new Response(null, { status: 405 })
	// remix-serve sees HTTP behind TLS termination. Use the public origin without
	// trusting forwarded headers supplied by the caller.
	const expectedOrigin = process.env.APP_ORIGIN || (
		process.env.NODE_ENV === "production" ? "https://goodwatch.app" : "http://localhost:3003"
	)
	if (request.headers.get("origin") !== expectedOrigin) return new Response(null, { status: 403 })
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
		const count = Number(await redis.eval(rateLimitScript, 1, `poster-rate:${clientKey}`))
		if (count > 60) return new Response(null, { status: 429, headers: { "Retry-After": "60" } })
		const unique = [...new Map(parsed.data.items.map(item => [`${item.media_type}:${item.tmdb_id}`, item])).values()]
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
