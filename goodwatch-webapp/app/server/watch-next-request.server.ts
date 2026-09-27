// Request handling shared by the Watch next and Tonight's pick endpoints: the feature flag, the viewer (a member from
// the session; a guest from the guest progress in a POST body), and the options in the URL.
import { json } from "@remix-run/node"
import { z } from "zod"
import { parseMoods } from "~/domain/moods"
import { isWatchNextSort } from "~/domain/watch-next"
import { getFeatureMode, isEnabled } from "~/server/features.server"
import {
	type GuestProgress,
	type ViewerContext,
	getViewerContext,
} from "~/server/viewer.server"
import type { WatchNextOptions } from "~/server/watch-next.server"
import type { TasteInteraction } from "~/ui/taste/types"
import type { TitleKey } from "~/utils/title-key"

const MAX_BODY_CHARS = 512 * 1024
const MAX_KEYS = 100

export const headers = { "Cache-Control": "private, no-store" }

export const notFound = () =>
	json({ error: "Not found" }, { status: 404, headers })
export const invalid = (error: string) =>
	json({ error }, { status: 400, headers })

const keySchema = z.number().int().positive().max(3e12)
const guestSchema = z.object({
	interactions: z.array(z.unknown()).max(5000),
	country: z.string().nullish(),
	services: z.union([z.string(), z.array(z.number())]).nullish(),
})
const bodySchema = z.object({ guest: guestSchema.optional() }).passthrough()

/** Title keys from a comma-separated parameter; null when any is invalid. */
export function parseKeys(value: string | null): TitleKey[] | null {
	const keys = value ? value.split(",").map(Number) : []
	return z.array(keySchema).max(MAX_KEYS).safeParse(keys).success ? keys : null
}

/** Sort, moods, services, and passed-over titles from the URL: `sort=waiting&moods=funny,scary&services=all`. */
export function parseWatchNextOptions(url: URL): WatchNextOptions | null {
	const params = url.searchParams
	const sort = params.get("sort")
	const notTonight = parseKeys(params.get("notTonight"))
	if (!notTonight) return null
	return {
		sort: sort && isWatchNextSort(sort) ? sort : null,
		moods: parseMoods(params.get("moods")),
		onMyServices: params.get("services") !== "all",
		notTonight,
	}
}

/**
 * The viewer of a Watch next request, or a response to send instead: not found while REC_WATCH_NEXT hides the
 * feature from this viewer, bad request for an unreadable body. A POST carries a guest's progress as
 * `{ guest: { interactions, country, services } }`; a signed-in member's POST ignores it.
 */
export async function watchNextViewer(
	request: Request,
): Promise<
	{ ctx: ViewerContext; body: Record<string, unknown> } | { response: Response }
> {
	if (getFeatureMode("watchNext") === "off") return { response: notFound() }
	let body: Record<string, unknown> = {}
	let guest: GuestProgress | undefined
	if (request.method === "POST") {
		const text = await request.text()
		if (text.length > MAX_BODY_CHARS)
			return { response: invalid("Request too large") }
		try {
			const parsed = bodySchema.parse(text ? JSON.parse(text) : {})
			body = parsed
			if (parsed.guest)
				guest = {
					...parsed.guest,
					// normalizeGuestInteractions drops anything that isn't a valid interaction.
					interactions: parsed.guest.interactions as TasteInteraction[],
				}
		} catch {
			return {
				response: invalid(
					"Send { guest: { interactions, country, services } }",
				),
			}
		}
	}
	const ctx = await getViewerContext(request, guest)
	const userId = ctx.viewer.kind === "member" ? ctx.viewer.userId : null
	if (!isEnabled("watchNext", { userId })) return { response: notFound() }
	return { ctx, body }
}
