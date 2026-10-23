import { json } from "@remix-run/node"
import { z } from "zod"
import { equal } from "~/server/yepwatch/crypto.server"
import {
	combinedSearch,
	type SearchBatch,
} from "~/server/combined-search/search.server"
import { searchAdmission } from "~/server/search-runtime/admission.server"
import { runsSearch } from "~/server/role.server"
import { RESULT_LENGTH } from "~/server/search-ranking/ranking.server"
import { titlePointId } from "~/server/combined-search/search-filters"

/** Search stays in the existing search role with its Jev cache, spending bounds and ranker. */
export async function searchYepWatchRoom(request: Request) {
	const headers = { "cache-control": "private, no-store" }
	const secret = process.env.YEPWATCH_SEARCH_SECRET
	if (
		request.method !== "POST" ||
		!secret ||
		secret.length < 32 ||
		!equal(request.headers.get("authorization") ?? "", `Bearer ${secret}`)
	)
		return json({ error: "unavailable" }, { status: 403, headers })
	if (!runsSearch())
		return json({ error: "search_role_required" }, { status: 503, headers })
	const release = searchAdmission.enter()
	if (!release) return json({ error: "busy" }, { status: 503, headers })
	try {
		const reader = request.body?.getReader()
		if (!reader) throw new Error("Body required")
		const chunks: Uint8Array[] = []
		let size = 0
		for (;;) {
			const { done, value } = await reader.read()
			if (done) break
			size += value.length
			if (size > 8192) {
				await reader.cancel()
				throw new Error("Body too large")
			}
			chunks.push(value)
		}
		const input = z
			.object({
				prompt: z.string().trim().min(2).max(1000),
				country: z.string().regex(/^[A-Z]{2}$/),
				serviceIds: z.array(z.number().int().positive()).max(100),
			})
			.strict()
			.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")))
		let complete: SearchBatch | undefined
		const result = await combinedSearch(
			input.prompt,
			{
				includeAdult: false,
				lesserKnown: false,
				filters: {
					...(input.serviceIds.length ? { streaming: { country: input.country, providerIds: input.serviceIds } } : {}),
				},
			},
			{ accountId: null, networkIdentity: "yepwatch-room-prompts" },
			request.signal,
			undefined,
			{
				rows: Math.min(2000, RESULT_LENGTH),
				onComplete: async (batch) => {
					complete = batch
					return true
				},
			}
		)
		const batch = complete ?? result
		// A lexical/basic fallback must not be presented as an interpreted room prompt.
		if (!batch || batch.errors.length || batch.pendingRanking)
			return json(
				{ error: "interpretation_unavailable" },
				{ status: 503, headers }
			)
		return json(
			{
				prompt: input.prompt,
				attributes: batch.reading,
				rankedKeys: [
					...new Set(batch.rows.map((row) => titlePointId(row.key))),
				].slice(0, 2000),
				interpretedAt: Date.now(),
			},
			{ headers }
		)
	} catch {
		return json(
			{ error: "interpretation_unavailable" },
			{ status: 503, headers }
		)
	} finally {
		release()
	}
}
