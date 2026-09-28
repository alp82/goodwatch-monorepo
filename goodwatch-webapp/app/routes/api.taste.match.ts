import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { z } from "zod"
import { getFeatureMode } from "~/server/features.server"
import { type Taste, loadTaste } from "~/server/taste/index.server"
import type { Viewer } from "~/server/viewer.server"
import type { TasteInteraction } from "~/ui/taste/types"
import { getUserIdFromRequest } from "~/utils/auth"
import type { TitleKey } from "~/utils/title-key"

// Taste match and reasons for up to 100 titles, by title key (movie 1e12 + tmdb_id, show 2e12 + tmdb_id).
// - Members: GET /api/taste/match?keys=1000000000550,2000000001399
// - Guests: POST /api/taste/match with { keys: [...], guest: { interactions: [...] } }, the guest progress their
//   browser holds. A signed-in member's POST reads the member's taste and ignores `guest`.
// Served while REC_TASTE_MATCH is shadow or on; not found while it's off.

const MAX_KEYS = 100
const MAX_BODY_CHARS = 256 * 1024
const REASONS = 2

export interface TasteMatchResponse {
	signal: "none" | "some"
	ratings: number
	liked: number
	titles: { key: TitleKey; match: number | null; reasons: string[] }[]
}

const keySchema = z.number().int().positive().max(3e12)
const bodySchema = z.object({
	keys: z.array(keySchema).max(MAX_KEYS),
	guest: z
		.object({
			interactions: z.array(z.unknown()).max(5000),
			country: z.string().nullish(),
			services: z.union([z.string(), z.array(z.number())]).nullish(),
		})
		.optional(),
})

const headers = { "Cache-Control": "private, no-store" }

function respond(taste: Taste, keys: TitleKey[]) {
	const matches = taste.match(keys)
	return json<TasteMatchResponse>(
		{
			signal: taste.signal,
			ratings: taste.ratings,
			liked: taste.liked,
			titles: keys.map((key, i) => ({
				key,
				match: matches[i],
				reasons: matches[i] === null ? [] : taste.reasons(key, REASONS),
			})),
		},
		{ headers },
	)
}

const notFound = () => json({ error: "Not found" }, { status: 404, headers })
const invalid = (error: string) => json({ error }, { status: 400, headers })

export async function loader({ request }: LoaderFunctionArgs) {
	if (getFeatureMode("tasteMatch") === "off") return notFound()
	const raw = new URL(request.url).searchParams.get("keys") ?? ""
	const keys = raw ? raw.split(",").map(Number) : []
	if (!z.array(keySchema).max(MAX_KEYS).safeParse(keys).success)
		return invalid(`Pass up to ${MAX_KEYS} title keys as keys=1,2,3`)
	const userId = await getUserIdFromRequest({ request })
	const viewer: Viewer = userId
		? { kind: "member", userId }
		: { kind: "guest", progress: { interactions: [] } }
	return respond(await loadTaste(viewer), keys)
}

export async function action({ request }: ActionFunctionArgs) {
	if (getFeatureMode("tasteMatch") === "off") return notFound()
	if (request.method !== "POST")
		return json({ error: "Method not allowed" }, { status: 405, headers })
	const text = await request.text()
	if (text.length > MAX_BODY_CHARS) return invalid("Request too large")
	let body: z.infer<typeof bodySchema>
	try {
		body = bodySchema.parse(JSON.parse(text))
	} catch {
		return invalid(`Send { keys: up to ${MAX_KEYS} title keys, guest }`)
	}
	const userId = await getUserIdFromRequest({ request })
	const viewer: Viewer = userId
		? { kind: "member", userId }
		: {
				kind: "guest",
				progress: {
					...body.guest,
					// normalizeGuestInteractions drops anything that isn't a valid interaction.
					interactions: (body.guest?.interactions ?? []) as TasteInteraction[],
				},
			}
	return respond(await loadTaste(viewer), body.keys)
}
