import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { z } from "zod"
import { loadForYouGuest } from "~/server/for-you-page/page.server"
import { presentCatalogLoader } from "~/server/media-payload.server"
import type { GuestProgress } from "~/server/viewer.server"
import type { TasteInteraction } from "~/ui/taste/types"
import { getUserIdFromRequest } from "~/utils/auth"

const headers = { "Cache-Control": "private, no-store" }
const invalid = (error: string) => json({ error }, { status: 400, headers })
const bodySchema = z.object({
	guest: z
		.object({
			interactions: z.array(z.unknown()).max(5000),
			country: z.string().nullish(),
			services: z.union([z.string(), z.array(z.number())]).nullish(),
		})
		.optional(),
})

async function load({ request }: LoaderFunctionArgs) {
	if (!(await getUserIdFromRequest({ request })))
		return json({ error: "Sign in required" }, { status: 401, headers })
	return json(await loadForYouGuest(request), { headers })
}

async function post({ request }: ActionFunctionArgs) {
	if (request.method !== "POST")
		return json({ error: "Method not allowed" }, { status: 405, headers })
	const text = await request.text()
	if (new TextEncoder().encode(text).byteLength > 256 * 1024)
		return invalid("Request too large")
	let guest: GuestProgress | undefined
	try {
		const body = bodySchema.parse(text ? JSON.parse(text) : {})
		guest = body.guest && {
			...body.guest,
			interactions: body.guest.interactions as TasteInteraction[],
		}
	} catch {
		return invalid("Send { guest: { interactions, country, services } }")
	}
	return json(await loadForYouGuest(request, guest), { headers })
}
export const loader = presentCatalogLoader(load, { live: true })
export const action = presentCatalogLoader(post, { live: true })
