import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { z } from "zod"
import { isEnabled } from "~/server/features.server"
import {
	type PortraitTab,
	getTastePortrait,
	isPortraitTab,
	portraitViewer,
} from "~/server/taste-portrait/index.server"
import type { GuestProgress } from "~/server/viewer.server"
import type { TasteInteraction } from "~/ui/taste/types"

// One Taste page tab's view model: ?tab=sides (Sides of you, the default), everyone (You vs everyone), or fingerprint.
// - Members: GET /api/taste/portrait?tab=sides
// - Guests: POST /api/taste/portrait?tab=sides with { guest: { interactions, country, services } }, the guest
//   progress their browser holds. With fewer than 5 guest ratings, the view is the sample taste. A signed-in member's
//   POST reads the member's own ratings and ignores `guest`.
// Served while REC_TASTE_PAGE lets the viewer see the Taste page; not found otherwise.

const MAX_BODY_CHARS = 256 * 1024

const bodySchema = z.object({
	guest: z
		.object({
			interactions: z.array(z.unknown()).max(5000),
			country: z.string().nullish(),
			services: z.union([z.string(), z.array(z.number())]).nullish(),
		})
		.optional(),
})

const headers = { "Cache-Control": "private, no-store" }
const notFound = () => json({ error: "Not found" }, { status: 404, headers })
const invalid = (error: string) => json({ error }, { status: 400, headers })

function tabOf(request: Request): PortraitTab | null {
	const tab = new URL(request.url).searchParams.get("tab") ?? "sides"
	return isPortraitTab(tab) ? tab : null
}

async function respond(request: Request, guest?: GuestProgress) {
	const tab = tabOf(request)
	if (!tab) return invalid("Pass tab=sides, tab=everyone, or tab=fingerprint")
	const who = await portraitViewer(request, guest)
	const userId = who.viewer.kind === "member" ? who.viewer.userId : null
	if (!isEnabled("tastePage", { userId })) return notFound()
	return json(await getTastePortrait(who, tab), { headers })
}

export async function loader({ request }: LoaderFunctionArgs) {
	return respond(request)
}

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST")
		return json({ error: "Method not allowed" }, { status: 405, headers })
	const text = await request.text()
	if (text.length > MAX_BODY_CHARS) return invalid("Request too large")
	let body: z.infer<typeof bodySchema>
	try {
		body = bodySchema.parse(text ? JSON.parse(text) : {})
	} catch {
		return invalid("Send { guest: { interactions, country, services } }")
	}
	return respond(
		request,
		body.guest && {
			...body.guest,
			// normalizeGuestInteractions drops anything that isn't a valid interaction.
			interactions: body.guest.interactions as TasteInteraction[],
		},
	)
}
