// The Taste page's loader. A member with a taste gets their whole taste in one shape (the profile's ProfileTaste: viewer
// type, fingerprint with each attribute's defining titles, taste groups, you vs everyone). A member who is starting
// their taste, or whose taste is still being prepared, gets the taste groups view, whose frame shows the start or the
// notice. A guest's taste lives in their browser, so a guest's page asks /api/taste/portrait with the guest progress
// instead (view: null here).
import { json } from "@remix-run/node"
import type { TasteTag } from "~/domain/profile-taste"
import { publicView } from "~/server/profile/portrait-public"
import { getTasteStats } from "~/server/profile/taste-stats.server"
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
	/** The member's handle; null before they pick one, and for a guest. */
	handle?: string | null
}

export interface TastePortraitData {
	kind: "portrait"
	taste: ProfileTaste
	/** The member's handle, for sharing and their profile's tabs; null before they pick one. */
	handle: string | null
	/** The average release year of their rated titles with a title analysis. */
	averageYear: number | null
	/** Their essence tags (the profile's stats, cached with the Stats tab); null when those fail to load. */
	tags: TasteTag[] | null
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
	return json(await readTastePage(request, userId), PRIVATE)
}

/** A member's Taste page data: /taste, and the owner's Taste profile tab (/u/:handle). Personal: never shared. */
export async function readTastePage(
	request: Request,
	userId: string,
): Promise<TastePageData> {
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
	// Started with the views; only the portrait waits for it.
	const statsLoad = getTasteStats(userId).catch(() => null)
	const [sides, fingerprint, everyone, profile] = await Promise.all([
		getTastePortrait(who, "sides"),
		getTastePortrait(who, "fingerprint"),
		getTastePortrait(who, "everyone"),
		getCachedProfileByUserId(userId).catch(() => null),
	])
	if (sides.status !== "ready" || fingerprint.status !== "ready")
		return { kind: "groups", view: sides, handle: profile?.handle ?? null }
	const stats = await statsLoad
	// The groups and the crowd without the suggestions and services the page doesn't show.
	const taste = buildProfileTaste(
		fingerprint,
		publicView(sides, true),
		publicView(everyone, true),
	)
	return {
		kind: "portrait",
		taste,
		handle: profile?.handle ?? null,
		averageYear: fingerprint.averageYear,
		tags:
			stats?.tags.essence.map(({ name, count }) => ({ name, count })) ?? null,
	}
}
