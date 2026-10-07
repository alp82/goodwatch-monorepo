import { type ActionFunctionArgs, json } from "@remix-run/node"
import { z } from "zod"
import { getFeatureMode, isEnabled } from "~/server/features.server"
import {
	type FinishUndo,
	finishTitle,
	undoFinishTitle,
} from "~/server/finish-title.server"
import { headers, invalid, notFound } from "~/server/watch-next-request.server"
import { getUserIdFromRequest } from "~/utils/auth"

// "I watched it" from Watch next, for members:
// - POST { key } records the watch, removes the title from Want to See, and returns { undo }.
// - POST { undo } with that value removes the watch again and restores Want to See with its original added-at time.
// Guests keep their Wishlist in the browser and don't call this.

const keySchema = z.number().int().positive().max(3e12)
const isoSchema = z.string().datetime().nullable()
const bodySchema = z.union([
	z.object({ key: keySchema }),
	z.object({
		undo: z.object({
			key: keySchema,
			addedAt: isoSchema,
			// The id of the watch that was recorded. A page loaded from the build before the watch log sends
			// `watchedAt` instead, which names a row of the retired table: its Undo restores Want to See only.
			watchId: z.string().max(80).nullable().optional(),
			watchedAt: isoSchema.optional(),
		}),
	}),
])

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST")
		return json({ error: "Method not allowed" }, { status: 405, headers })
	if (getFeatureMode("watchNext") === "off") return notFound()
	const userId = await getUserIdFromRequest({ request })
	if (!userId || !isEnabled("watchNext", { userId })) return notFound()
	let body: z.infer<typeof bodySchema>
	try {
		body = bodySchema.parse(await request.json())
	} catch {
		return invalid("Send { key } or { undo }")
	}
	if ("key" in body)
		return json<{ undo: FinishUndo }>(
			{ undo: await finishTitle(userId, body.key) },
			{ headers },
		)
	await undoFinishTitle(userId, body.undo)
	return json({ ok: true }, { headers })
}
