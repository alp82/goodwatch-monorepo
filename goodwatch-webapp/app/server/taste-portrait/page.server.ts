// The Taste page's loader. A member with a taste gets their whole taste in one shape (the profile's ProfileTaste: viewer
// type, fingerprint with each attribute's defining titles, taste groups, you vs everyone). A member who is starting
// their taste, or whose taste is still being prepared, gets the taste groups view, whose frame shows the start or the
// notice. A guest's taste lives in their browser, so a guest's page asks /api/taste/portrait with the guest progress
// instead (view: null here).
import { json } from "@remix-run/node"
import { publicView } from "~/server/profile/portrait-public"
import { getCachedProfileByUserId } from "~/server/share-lists/view.server"
import type { ViewerContext } from "~/server/viewer.server"
import { type ProfileTaste, buildProfileTaste } from "~/ui/profile/taste/model"
import { getUserIdFromRequest } from "~/utils/auth"
import {
	type PortraitViewOf,
	type PortraitViewer,
	getTastePortrait,
	portraitViewer,
} from "./index.server"

export interface TasteGroupsData {
	kind: "groups"
	/** The member's taste groups view; null for a guest, whose browser fetches it. */
	view: PortraitViewOf<"sides"> | null
}

export interface TastePortraitData {
	kind: "portrait"
	taste: ProfileTaste
	/** The member's handle, for sharing and their profile's tabs; null before they pick one. */
	handle: string | null
	/** The average release year of their rated titles with a title analysis. */
	averageYear: number | null
}

export type TastePageData = TasteGroupsData | TastePortraitData

/** Who views the Taste page: a member's id, or null for a guest. */
export async function tastePageViewer(request: Request) {
	return { userId: (await getUserIdFromRequest({ request })) ?? null }
}

const PRIVATE = { headers: { "Cache-Control": "private, no-store" } }

/** The Taste page for the request's viewer. */
export async function loadTastePage(request: Request, userId: string | null) {
	// A guest's page carries nothing personal.
	if (!userId) return json<TastePageData>({ kind: "groups", view: null })
	const base = await portraitViewer(request, undefined, userId)
	// The three views read the member's rows once.
	let context: Promise<ViewerContext> | undefined
	const who: PortraitViewer = {
		viewer: base.viewer,
		context: () => {
			context ??= base.context()
			return context
		},
	}
	const [sides, fingerprint, everyone, profile] = await Promise.all([
		getTastePortrait(who, "sides"),
		getTastePortrait(who, "fingerprint"),
		getTastePortrait(who, "everyone"),
		getCachedProfileByUserId(userId).catch(() => null),
	])
	if (sides.status !== "ready" || fingerprint.status !== "ready")
		return json<TastePageData>({ kind: "groups", view: sides }, PRIVATE)
	// The groups and the crowd without the suggestions and services the page doesn't show.
	const taste = buildProfileTaste(
		fingerprint,
		publicView(sides, true),
		publicView(everyone, true),
	)
	return json<TastePageData>(
		{
			kind: "portrait",
			taste,
			handle: profile?.handle ?? null,
			averageYear: fingerprint.averageYear,
		},
		PRIVATE,
	)
}
