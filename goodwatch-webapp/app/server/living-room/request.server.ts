import { json } from "@remix-run/node"
import { z } from "zod"
import { isMoodKey } from "~/domain/moods"
import { getViewerContext } from "~/server/viewer.server"
import type { TasteInteraction } from "~/ui/taste/types"
import { PRIVATE_CACHE_CONTROL, livingRoomAuth } from "./data.server"
import { LivingRoomUnavailable, getLivingRoomPicks } from "./picks.server"
import { getLivingRoomPool } from "./pool.server"

const guestSchema = z.object({
	interactions: z.array(z.unknown()).max(5000).default([]),
	country: z
		.string()
		.regex(/^[A-Za-z]{2}$/)
		.nullish(),
	services: z
		.union([
			z
				.string()
				.max(1000)
				.regex(/^(?:\d+(?:,\d+)*)?$/),
			z.array(z.number().int().positive()).max(100),
		])
		.nullish(),
})
const bodySchema = z.object({ guest: guestSchema.optional() })
const MAX_BODY_BYTES = 512 * 1024

async function readBody(request: Request) {
	const reader = request.body?.getReader()
	if (!reader) return {}
	const chunks: Uint8Array[] = []
	let length = 0
	try {
		while (true) {
			const { done, value } = await reader.read()
			if (done) break
			length += value.byteLength
			if (length > MAX_BODY_BYTES) {
				await reader.cancel()
				throw new RangeError("Request too large")
			}
			chunks.push(value)
		}
	} finally {
		reader.releaseLock()
	}
	return JSON.parse(Buffer.concat(chunks).toString() || "{}")
}

export async function livingRoomPicksResponse(request: Request) {
	const { user, headers } = await livingRoomAuth(request)
	// Guest POSTs carry browser-owned progress; never cache them.
	if (request.method !== "GET")
		headers.set("Cache-Control", PRIVATE_CACHE_CONTROL)
	const failure = (error: string, status = 400) => {
		headers.set("Cache-Control", PRIVATE_CACHE_CONTROL)
		return json({ error }, { status, headers })
	}
	if (request.method !== "GET" && request.method !== "POST") {
		headers.set("Allow", "GET, POST")
		return failure("Method not allowed", 405)
	}
	const params = new URL(request.url).searchParams
	const mood = params.get("mood") || null
	const source = params.get("from") || "auto"
	const service = params.get("service") || null
	const country = params.get("country")?.toUpperCase()
	if (mood && !isMoodKey(mood)) return failure("Unknown mood")
	if (source !== "auto" && source !== "wishlist" && source !== "new")
		return failure("Unknown picks source")
	if (service && service.length > 100) return failure("Invalid service")
	if (country && !/^[A-Z]{2}$/.test(country)) return failure("Invalid country")
	let guest: z.infer<typeof guestSchema> | undefined
	if (request.method === "POST") {
		try {
			guest = bodySchema.parse(await readBody(request)).guest
		} catch (error) {
			return failure(
				"Invalid guest progress",
				error instanceof RangeError ? 413 : 400,
			)
		}
	}
	try {
		const viewer = await getViewerContext(
			request,
			{
				interactions: (guest?.interactions ?? []) as TasteInteraction[],
				country: guest?.country ?? country,
				services: guest?.services,
			},
			user?.id ?? null,
		)
		const result =
			params.get("view") === "pool"
				? await getLivingRoomPool(viewer)
				: await getLivingRoomPicks(viewer, { mood, source, service })
		return json(result, { headers })
	} catch (error) {
		if (error instanceof LivingRoomUnavailable) {
			headers.set("Retry-After", "2")
			return failure(error.message, 503)
		}
		if (error instanceof RangeError) return failure(error.message)
		console.error("Living room: loading picks failed", error)
		return failure("Unable to load picks", 503)
	}
}
