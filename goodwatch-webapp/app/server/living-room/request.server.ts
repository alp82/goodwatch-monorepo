import { json } from "@remix-run/node"
import { z } from "zod"
import { getViewerContext } from "~/server/viewer.server"
import type { TasteInteraction } from "~/ui/taste/types"
import { applyCachePolicy } from "../cache-identity.server"
import { PRIVATE_CACHE_CONTROL, livingRoomAuth } from "./data.server"
import { LivingRoomUnavailable } from "./picks.server"
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
		applyCachePolicy(request, status, headers)
		return json({ error }, { status, headers })
	}
	if (request.method !== "GET" && request.method !== "POST") {
		headers.set("Allow", "GET, POST")
		return failure("Method not allowed", 405)
	}
	const params = new URL(request.url).searchParams
	// The pool is the route's one answer. The old TV's picks for a night (`?mood=&from=&service=`) are gone.
	if (params.get("view") !== "pool") return failure("Not found", 404)
	const country = params.get("country")?.toUpperCase()
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
		const result = await getLivingRoomPool(viewer)
		applyCachePolicy(request, 200, headers)
		return json(result, { headers })
	} catch (error) {
		if (error instanceof LivingRoomUnavailable) {
			headers.set("Retry-After", "2")
			return failure(error.message, 503)
		}
		if (error instanceof RangeError) return failure(error.message)
		console.error("Living room: loading the pool failed", error)
		return failure("Unable to load the pool", 503)
	}
}
