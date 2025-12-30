import type { ActionFunction } from "@remix-run/node"
import { json } from "@remix-run/node"
import { getUserIdFromRequest } from "~/utils/auth"
import { upsert } from "~/utils/crate"
import type { GuestInteraction } from "~/ui/taste/types"

export const action: ActionFunction = async ({ request }) => {
	const userId = await getUserIdFromRequest({ request })

	if (!userId) {
		return json({ error: "Unauthorized" }, { status: 401 })
	}

	const body = (await request.json()) as { interactions: GuestInteraction[] }

	if (!body || !body.interactions) {
		return json({ error: "Invalid interactions data" }, { status: 400 })
	}

	const interactions: GuestInteraction[] = body.interactions

	if (!Array.isArray(interactions) || interactions.length === 0) {
		return json({ error: "Invalid interactions data" }, { status: 400 })
	}

	try {
		const scores = interactions
			.filter((i) => i.type === "score" && i.score)
			.map((i) => ({
				user_id: userId,
				tmdb_id: i.tmdb_id,
				media_type: i.media_type,
				score: i.score,
			}))

		const wishlistItems = interactions
			.filter((i) => i.type === "plan")
			.map((i) => ({
				user_id: userId,
				tmdb_id: i.tmdb_id,
				media_type: i.media_type,
			}))

		const skippedItems = interactions
			.filter((i) => i.type === "skip")
			.map((i) => ({
				user_id: userId,
				tmdb_id: i.tmdb_id,
				media_type: i.media_type,
			}))

		const upsertPromises: Promise<unknown>[] = []

		if (scores.length > 0) {
			upsertPromises.push(
				upsert({
					table: "user_score",
					data: scores,
					conflictColumns: ["user_id", "tmdb_id", "media_type"],
				})
			)
		}

		if (wishlistItems.length > 0) {
			upsertPromises.push(
				upsert({
					table: "user_wishlist",
					data: wishlistItems,
					conflictColumns: ["user_id", "tmdb_id", "media_type"],
				})
			)
		}

		if (skippedItems.length > 0) {
			upsertPromises.push(
				upsert({
					table: "user_skipped",
					data: skippedItems,
					conflictColumns: ["user_id", "tmdb_id", "media_type"],
				})
			)
		}

		await Promise.all(upsertPromises)

		return json({
			success: true,
			imported: {
				scores: scores.length,
				wishlist: wishlistItems.length,
				skipped: skippedItems.length,
			},
		})
	} catch (error) {
		console.error("Failed to import guest interactions:", error)
		return json(
			{ error: "Failed to import interactions" },
			{ status: 500 },
		)
	}
}
