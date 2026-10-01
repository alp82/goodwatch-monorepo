// The `/api/explorer/*` endpoints share this: members send GET and are read from the session; guests send POST with
// the guest progress their browser holds ({ guest: { interactions, country, services } }), and a signed-in member's
// POST ignores it. Served while REC_EXPLORER lets the viewer see Explorer; not found otherwise.
import { json } from "@remix-run/node"
import { z } from "zod"
import { getFeatureMode, isEnabled } from "~/server/features.server"
import {
	type GuestProgress,
	type ViewerContext,
	getViewerContext,
} from "~/server/viewer.server"
import type { TasteInteraction } from "~/ui/taste/types"
import { ExplorerUnavailable } from "./index.server"

const MAX_BODY_CHARS = 256 * 1024
const headers = { "Cache-Control": "private, no-store" }

const bodySchema = z.object({
	guest: z
		.object({
			interactions: z.array(z.unknown()).max(5000),
			country: z.string().nullish(),
			services: z.union([z.string(), z.array(z.number())]).nullish(),
		})
		.optional(),
})

const fail = (status: number, error: string) =>
	json({ error }, { status, headers })

/**
 * Answers one Explorer request: resolves the viewer, runs `answer` with the viewer context and the query string, and
 * returns its result as JSON (null is not found), with the time taken in a Server-Timing header.
 */
export async function explorerResponse(
	request: Request,
	answer: (ctx: ViewerContext, params: URLSearchParams) => Promise<unknown>,
): Promise<Response> {
	const startedAt = performance.now()
	if (getFeatureMode("explorer") === "off") return fail(404, "Not found")
	let guest: GuestProgress | undefined
	if (request.method === "POST") {
		const text = await request.text()
		if (text.length > MAX_BODY_CHARS) return fail(400, "Request too large")
		try {
			const body = bodySchema.parse(text ? JSON.parse(text) : {})
			// getViewerContext drops anything that isn't a valid interaction.
			if (body.guest)
				guest = {
					...body.guest,
					interactions: body.guest.interactions as TasteInteraction[],
				}
		} catch {
			return fail(400, "Send { guest: { interactions, country, services } }")
		}
	} else if (request.method !== "GET") {
		return fail(405, "Method not allowed")
	}

	try {
		const ctx = await getViewerContext(request, guest)
		const userId = ctx.viewer.kind === "member" ? ctx.viewer.userId : null
		if (!isEnabled("explorer", { userId })) return fail(404, "Not found")
		const viewerMs = performance.now() - startedAt
		const result = await answer(ctx, new URL(request.url).searchParams)
		if (result === null) return fail(404, "Not found")
		const totalMs = performance.now() - startedAt
		return json(result, {
			headers: {
				...headers,
				"Server-Timing": `viewer;dur=${viewerMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`,
			},
		})
	} catch (error) {
		if (error instanceof ExplorerUnavailable)
			return json(
				{ error: error.message },
				{ status: 503, headers: { ...headers, "Retry-After": "5" } },
			)
		throw error
	}
}

/** "6,2,2": children per title in each generation after the first posters (1 to 8 each, at most 4 generations). */
export function branchingOf(value: string | null): number[] | undefined {
	if (!value) return undefined
	const levels = value
		.split(",")
		.slice(0, 4)
		.map(Number)
		.filter((n) => Number.isInteger(n) && n >= 1 && n <= 8)
	return levels.length ? levels : undefined
}

/** The query every Explorer endpoint shares: grouping and filters. */
export const explorerQueryOf = (params: URLSearchParams) => ({
	grouping: params.get("grouping"),
	services: params.get("services"),
	unseen: params.get("unseen"),
	type: params.get("type"),
})
