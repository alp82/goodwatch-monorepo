// POST /api/social/wrong-title (contract: #556's design comment, docs/implementation/talked-about-now/social.md on
// its branch). A visitor says a post isn't about the title it is shown on; the link is hidden at once and the report
// waits for review. The report row is the only thing the webapp writes to the social tables.
//
// - Same origin only: the Origin header must be the site's, and a browser's Sec-Fetch-Site must say same-origin.
// - At most 2 KB of JSON: { media_type: "movie" | "tv", media_tmdb_id, post_id: 64 hex, reason?: up to 500 chars }.
// - Rate limited per address in this process.
// - Idempotent: the report id is a hash of the title and the post, so a retry updates the same row.
// - 200 { report_id, hidden: true } only after the report is visible to the read and the title's cache is reset;
//   400 invalid, 403 cross-origin, 404 unknown link (or the section is off for the viewer), 413, 415, 429, 503.
import { z } from "zod"
import { createRateLimit, clientAddress } from "./rate-limit.server"
import { MAX_REASON, POST_ID, type SocialStore } from "./social-store.server"
import { reportWrongTitle } from "./title-social.server"
import type { Env } from "./flags.server"

const MAX_BODY_BYTES = 2048

const payloadSchema = z
	.object({
		media_type: z.enum(["movie", "tv"]),
		media_tmdb_id: z.number().int().positive().max(2_147_483_647),
		post_id: z.string().regex(POST_ID),
		reason: z.string().max(MAX_REASON).optional(),
	})
	.strict()

export const reportLimit = createRateLimit({ limit: 20, windowMs: 10 * 60_000 })

const NO_STORE = { "Cache-Control": "private, no-store" }
const answer = (status: number, body: unknown = null, headers: Record<string, string> = {}) =>
	body === null
		? new Response(null, { status, headers: { ...NO_STORE, ...headers } })
		: new Response(JSON.stringify(body), { status, headers: { ...NO_STORE, "Content-Type": "application/json", ...headers } })

/**
 * The site's own origin. Production names it (APP_ORIGIN, else goodwatch.app) instead of trusting the request's
 * Host, which sits behind TLS termination. A dev server answers on whatever host it was opened on.
 */
export function expectedOrigin(request: Request, env: Env = process.env): string {
	if (env.APP_ORIGIN) return env.APP_ORIGIN
	if (env.NODE_ENV === "production") return "https://goodwatch.app"
	return new URL(request.url).origin
}

async function readBody(request: Request): Promise<string | null> {
	const reader = request.body?.getReader()
	if (!reader) return ""
	const chunks: Uint8Array[] = []
	let size = 0
	while (true) {
		const { done, value } = await reader.read()
		if (done) break
		size += value.byteLength
		if (size > MAX_BODY_BYTES) {
			await reader.cancel()
			return null
		}
		chunks.push(value)
	}
	return Buffer.concat(chunks).toString("utf8")
}

export async function handleWrongTitle(
	request: Request,
	{
		store,
		enabled,
		limit = reportLimit,
		env = process.env,
	}: {
		store: () => SocialStore
		/** Whether the section is on for this viewer. */
		enabled: () => Promise<boolean>
		limit?: { take(client: string): boolean }
		env?: Env
	},
): Promise<Response> {
	if (request.method !== "POST") return answer(405, null, { Allow: "POST" })
	if (request.headers.get("origin") !== expectedOrigin(request, env)) return answer(403)
	const site = request.headers.get("sec-fetch-site")
	if (site && site !== "same-origin") return answer(403)
	if (!request.headers.get("content-type")?.startsWith("application/json")) return answer(415)
	if (!limit.take(clientAddress(request))) return answer(429, null, { "Retry-After": "600" })

	const body = await readBody(request)
	if (body === null) return answer(413)
	let parsed: ReturnType<typeof payloadSchema.safeParse>
	try {
		parsed = payloadSchema.safeParse(JSON.parse(body))
	} catch {
		return answer(400)
	}
	if (!parsed.success) return answer(400)
	if (!(await enabled())) return answer(404)

	const { media_type, media_tmdb_id, post_id, reason } = parsed.data
	try {
		const outcome = await reportWrongTitle(store(), { mediaType: media_type, tmdbId: media_tmdb_id }, post_id, reason?.trim() ?? "")
		if (outcome.status === "unknown-link") return answer(404)
		return answer(200, { report_id: outcome.reportId, hidden: true })
	} catch (error) {
		console.error("Talked about now: wrong-title report failed", error)
		return answer(503)
	}
}
