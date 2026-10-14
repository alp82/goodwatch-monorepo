// Request handling of `/api/title-cards` (routes/api.title-cards.ts): the cards of some titles by key, for the
// viewer. The new TV's title screen asks it for a title no list on the page holds a card for (an island's title, a
// search result, a deep link).
// - Members: GET /api/title-cards?keys=1000000000603,2000000001399
// - Guests: POST to the same address with { guest: { interactions, country, services } }, the guest progress their
//   browser holds; a signed-in member's POST ignores it.
// The answer is personal (taste match, the viewer's services, Seen, Want to See) and never stored by a cache.
//
// What reads the cards is passed in, so this module needs no Crate and no Redis.
import { json } from "@remix-run/node"
import { z } from "zod"
import type { CardService, TitleCard } from "~/server/title-cards.server"
import type { GuestProgress } from "~/server/viewer.server"
import type { TasteInteraction } from "~/ui/taste/types"
import type { TitleKey } from "~/utils/title-key"

const MAX_BODY_CHARS = 256 * 1024
const headers = { "Cache-Control": "private, no-store" }

/** What `/api/title-cards` answers. */
export interface TitleCardsAnswer {
	/** In the order of `keys`; a title the catalog lacks is left out. */
	cards: TitleCard[]
	/** The viewer's own services, one per name: a card's service among them is theirs. */
	services: CardService[]
}

export interface TitleCardsRequest {
	/** The most keys one request may name (`MAX_KEYS` of title-cards.server.ts). */
	max: number
	/** Reads the cards for the request's viewer: a member from the session, else the guest the body describes. */
	read: (
		request: Request,
		guest: GuestProgress | undefined,
		keys: TitleKey[],
	) => Promise<TitleCardsAnswer>
}

const keySchema = z.number().int().positive().max(3e12)
const bodySchema = z.object({
	guest: z
		.object({
			interactions: z.array(z.unknown()).max(5000),
			country: z.string().nullish(),
			services: z.union([z.string(), z.array(z.number())]).nullish(),
		})
		.optional(),
})

const fail = (status: number, error: string) =>
	json({ error }, { status, headers })

/**
 * Title keys from `keys=1,2,3`, without repeats, in their order; null when there is none, more than `max`, or one
 * that is no key.
 */
export function parseCardKeys(
	value: string | null,
	max: number,
): TitleKey[] | null {
	if (!value) return null
	const keys = [...new Set(value.split(",").map(Number))]
	return keys.length <= max && z.array(keySchema).safeParse(keys).success
		? keys
		: null
}

export async function titleCardsResponse(
	request: Request,
	{ max, read }: TitleCardsRequest,
): Promise<Response> {
	if (request.method !== "GET" && request.method !== "POST")
		return fail(405, "Method not allowed")
	const keys = parseCardKeys(new URL(request.url).searchParams.get("keys"), max)
	if (!keys) return fail(400, `Pass up to ${max} title keys as keys=1,2,3`)
	let guest: GuestProgress | undefined
	if (request.method === "POST") {
		const text = await request.text()
		if (text.length > MAX_BODY_CHARS) return fail(400, "Request too large")
		try {
			const body = bodySchema.parse(text ? JSON.parse(text) : {})
			// The viewer context drops anything that isn't a valid interaction.
			if (body.guest)
				guest = {
					...body.guest,
					interactions: body.guest.interactions as TasteInteraction[],
				}
		} catch {
			return fail(400, "Send { guest: { interactions, country, services } }")
		}
	}
	return json<TitleCardsAnswer>(await read(request, guest, keys), { headers })
}
