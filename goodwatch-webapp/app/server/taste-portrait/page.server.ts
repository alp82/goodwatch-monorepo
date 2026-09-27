// The Taste page's loaders: one tab's view for a signed-in member, rendered on the server. A guest's taste lives in
// their browser, so a guest's page asks /api/taste/portrait with the guest progress instead (view: null here).
// Not found while REC_TASTE_PAGE hides the page from the viewer.
import { json } from "@remix-run/node"
import { isEnabled } from "~/server/features.server"
import { getUserIdFromRequest } from "~/utils/auth"
import {
	type PortraitTab,
	type PortraitViewOf,
	getTastePortrait,
	portraitViewer,
} from "./index.server"

export interface TasteTabData<T extends PortraitTab> {
	kind: "tabs"
	/** The member's view; null for a guest, whose browser fetches it. */
	view: PortraitViewOf<T> | null
}

/** Whether the viewer sees the new Taste page, and who they are. */
export async function tastePageViewer(request: Request) {
	const userId = (await getUserIdFromRequest({ request })) ?? null
	return { userId, enabled: isEnabled("tastePage", { userId }) }
}

export async function loadTasteTab<T extends PortraitTab>(
	request: Request,
	tab: T,
	userId: string | null,
) {
	const view = userId
		? await getTastePortrait(
				await portraitViewer(request, undefined, userId),
				tab,
			)
		: null
	// A member's page is theirs alone; a guest's page carries nothing personal.
	return json<TasteTabData<T>>(
		{ kind: "tabs", view },
		userId ? { headers: { "Cache-Control": "private, no-store" } } : undefined,
	)
}

export function notFound(): never {
	throw new Response("Not found", { status: 404 })
}
