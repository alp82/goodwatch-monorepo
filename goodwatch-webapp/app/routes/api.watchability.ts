import { json, type ActionFunctionArgs } from "@remix-run/node"
import { z } from "zod"
import { getAvailabilityEvidenceBatch } from "~/server/availability.server"
import { evaluateAvailability } from "~/utils/availability-evidence"
import { canonicalTitleId } from "~/utils/title-identity"
const input = z.object({
	country: z.string().regex(/^[A-Z]{2}$/),
	serviceIds: z.array(z.number().int().positive()).max(500),
	includePaid: z.boolean().default(false),
	titles: z
		.array(
			z.object({
				mediaType: z.enum(["movie", "show"]),
				tmdbId: z.number().int().positive(),
			}),
		)
		.max(100),
})
export async function action({ request }: ActionFunctionArgs) {
	const parsed = input.safeParse(await request.json().catch(() => null))
	if (!parsed.success)
		return json({ error: "Invalid availability input" }, { status: 400 })
	const { titles, ...selection } = parsed.data
	const scopes = titles.map((title) => ({
		...title,
		tmdbId: canonicalTitleId(title.mediaType, title.tmdbId),
		country: selection.country,
	}))
	// Only this explicitly requested batch is checked, in one query per media type.
	const evidenceByKey = await getAvailabilityEvidenceBatch(scopes)
	const results = titles.map((title, index) => {
		const scope = scopes[index]
		const evidence =
			evidenceByKey.get(`${scope.mediaType}-${scope.tmdbId}`) ?? null
		return {
			key: `${title.mediaType}-${title.tmdbId}`,
			evidence,
			result: evaluateAvailability(evidence, { ...selection, ...scope }),
		}
	})
	return json(
		{ results },
		{ headers: { "Cache-Control": "private, no-store" } },
	)
}
