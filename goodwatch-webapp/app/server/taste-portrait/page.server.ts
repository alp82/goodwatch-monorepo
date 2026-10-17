// The Taste page's loaders: one tab's view for a signed-in member, rendered on the server. A guest's taste lives in
// their browser, so a guest's page asks /api/taste/portrait with the guest progress instead (view: null here).
import { json } from "@remix-run/node"
import { protoMemberId } from "~/server/prototype-forming-hint/index.server"
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

/** Who views the Taste page: a member's id, or null for a guest. */
export async function tastePageViewer(request: Request) {
	// PROTOTYPE (#662): in development, `?as=m1`..`m5` shows that member's Taste page.
	const as = process.env.NODE_ENV !== "production" ? await protoMemberId(request) : null
	if (as) return { userId: as }
	return { userId: (await getUserIdFromRequest({ request })) ?? null }
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
