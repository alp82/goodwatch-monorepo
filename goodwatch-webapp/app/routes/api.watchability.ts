import { json, type ActionFunctionArgs } from "@remix-run/node"
import { z } from "zod"
import { getAvailabilityEvidence } from "~/server/availability.server"
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
	const results = []
	// Bound database concurrency; only this explicitly requested batch is checked.
	for (let index = 0; index < titles.length; index += 8) {
		results.push(
			...(await Promise.all(
				titles.slice(index, index + 8).map(async (title) => {
					const scope = {
						...title,
						tmdbId: canonicalTitleId(title.mediaType, title.tmdbId),
						country: selection.country,
					}
					const evidence = await getAvailabilityEvidence(scope)
					return {
						key: `${title.mediaType}-${title.tmdbId}`,
						evidence,
						result: evaluateAvailability(evidence, { ...selection, ...scope }),
					}
				}),
			)),
		)
	}
	return json(
		{ results },
		{ headers: { "Cache-Control": "private, no-store" } },
	)
}
