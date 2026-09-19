import { json, type ActionFunctionArgs } from "@remix-run/node"
import { z } from "zod"
import { getUserIdFromRequest } from "~/utils/auth"
import { getUserData } from "~/server/userData.server"
import { getInterestDiscovery } from "~/server/interest-discovery.server"
import { guestUserData } from "~/utils/guest-progress"

const input = z.object({
	genre: z.string().max(50).default(""),
	interactions: z
		.array(
			z
				.object({
					tmdb_id: z.number().int().positive(),
					media_type: z.enum(["movie", "show"]),
					type: z.enum(["score", "skip", "plan"]),
					score: z
						.union([
							z.literal(1),
							z.literal(2),
							z.literal(3),
							z.literal(4),
							z.literal(5),
							z.literal(6),
							z.literal(7),
							z.literal(8),
							z.literal(9),
							z.literal(10),
						])
						.optional(),
					timestamp: z.number(),
				})
				.refine(
					(item) => item.type !== "score" || item.score !== undefined,
					"A rating requires a score",
				),
		)
		.max(2000)
		.default([]),
})
export async function action({ request }: ActionFunctionArgs) {
	const parsed = input.safeParse(await request.json().catch(() => null))
	if (!parsed.success)
		return json({ error: "Invalid discovery input" }, { status: 400 })
	const userId = await getUserIdFromRequest({ request })
	const history = userId
		? await getUserData({ user_id: userId })
		: guestUserData(parsed.data.interactions)
	return json(await getInterestDiscovery(history, parsed.data.genre), {
		headers: { "Cache-Control": "private, no-store" },
	})
}
