import { query } from "~/utils/crate"

export const IMAGE_SQL = `SELECT i.data FROM doc.social_image i
JOIN doc.social_post p ON p.post_id = i.post_id
WHERE i.post_id = ? AND p.post_id = ? AND i.status = 'ok'
AND p.deleted_at IS NULL AND p.text IS NOT NULL AND p.url IS NOT NULL
AND p.published_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'`

export async function imageResponse(
	postId: string | undefined,
	read = (id: string) => query<{ data: string }>(IMAGE_SQL, [id, id], { timeoutMs: 1_000 }),
): Promise<Response> {
	const missing = () => new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } })
	if (!postId || !/^[a-f0-9]{64}$/.test(postId)) return missing()
	const start = performance.now()
	const timing = () => `social_image;dur=${(performance.now() - start).toFixed(1)}`
	let row: { data: string } | undefined
	try {
		row = (await read(postId))[0]
	} catch {
		return new Response(null, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "5", "Server-Timing": timing() } })
	}
	if (!row?.data) return missing()
	return new Response(Buffer.from(row.data, "base64"), {
		headers: {
			"Content-Type": "image/jpeg",
			"Server-Timing": timing(),
			"Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
			"X-Content-Type-Options": "nosniff",
		},
	})
}
