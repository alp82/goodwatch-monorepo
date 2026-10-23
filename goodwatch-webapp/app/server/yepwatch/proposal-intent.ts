import { z } from "zod"
import { RoomError } from "./errors.ts"
import type { ProposalRoom } from "./proposal-types.ts"
export const roomIntentSchema = z
	.object({
		prompt: z.string().trim().min(2).max(1000),
		attributes: z
			.array(
				z
					.object({
						text: z.string().min(1).max(200),
						kind: z.enum(["attribute", "excluded", "want", "avoid", "phrase"]),
						key: z.string().max(100).optional(),
					})
					.strict()
			)
			.max(100),
		rankedKeys: z.array(z.number().int().positive().safe()).max(2000),
		interpretedAt: z.number().int().nonnegative(),
	})
	.strict()
export type InterpretRoom = (
	prompt: string,
	country: string,
	serviceIds: number[]
) => Promise<NonNullable<ProposalRoom["intent"]>>
/** Dedicated authenticated search-role endpoint; never impersonates a browser Origin or shares account credentials. */
export function roomSearch(
	env: Record<string, string | undefined>,
	transport: typeof fetch = fetch
): InterpretRoom | undefined {
	if (!env.YEPWATCH_SEARCH_SECRET) return
	if (env.YEPWATCH_SEARCH_SECRET.length < 32)
		throw new Error("Search service secret must be at least 32 characters")
	const endpoint = new URL(
		env.YEPWATCH_SEARCH_URL ?? "https://goodwatch.app/api/combined-search"
	)
	if (
		endpoint.protocol !== "https:" &&
		!["127.0.0.1", "localhost"].includes(endpoint.hostname)
	)
		throw new Error("Search requires HTTPS")
	return async (prompt, country, serviceIds) => {
		let response: Response
		try {
			response = await transport(endpoint, {
				method: "POST",
				redirect: "error",
				headers: {
					authorization: `Bearer ${env.YEPWATCH_SEARCH_SECRET}`,
					"content-type": "application/json",
					"x-goodwatch-consumer": "yepwatch",
				},
				body: JSON.stringify({ prompt, country, serviceIds }),
				signal: AbortSignal.timeout(12000),
			})
		} catch {
			throw new RoomError(
				"busy",
				"GoodWatch could not interpret this prompt. Your previous room description is kept.",
				503,
				true
			)
		}
		if (!response.ok)
			throw new RoomError(
				"busy",
				"GoodWatch search is unavailable. Retry this prompt shortly.",
				503,
				true
			)
		let intent: NonNullable<ProposalRoom["intent"]>
		try {
			intent = roomIntentSchema.parse(await response.json())
		} catch {
			throw new RoomError(
				"busy",
				"GoodWatch returned an incomplete interpretation. Retry this prompt shortly.",
				503,
				true
			)
		}
		if (intent.prompt !== prompt)
			throw new RoomError(
				"busy",
				"The search response did not match your prompt",
				503,
				true
			)
		return intent
	}
}

/** Jev candidates are a bounded ordered subset of currently eligible catalog titles. */
export function roomIntentKeys(
	room: Pick<ProposalRoom, "intent">,
	base: number[]
) {
	if (!room.intent) return base
	const eligible = new Set(base)
	return [...new Set(room.intent.rankedKeys)].filter((key) => eligible.has(key))
}
