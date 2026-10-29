// A profile owner's portrait, with a separate summary cache for Stats and member comparisons.
// Other callers use the full /taste portrait cache, built for the owner by id.
//
// The portrait is built for its subject: unseen titles carry the owner's match, reasons and services, and the sides
// carry suggestions from the owner's services. A public view drops all of that (it would tell visitors which services
// the owner pays for), keeping what the Taste tab shows: viewer type, fingerprint, sides with the titles the owner
// loves there, and the crowd comparison. With the owner's scores hidden from the viewer, the scores go too.
import {
	type PortraitTab,
	type PortraitViewOf,
	type PortraitViewer,
	getTastePortrait,
	getStatsPortrait,
} from "~/server/taste-portrait/index.server"
import { getMemberViewerContext } from "~/server/viewer.server"
import { publicView } from "./portrait-public"

export interface ProfilePortraitOptions {
	/** "owner": the view as /taste has it. "public": without the owner's suggestions and services. */
	audience?: "owner" | "public"
	/** Stats and comparisons use the public summary without discarded suggestion and service reads. */
	summary?: boolean
	/** Whether the viewer may see the owner's scores; without, titles carry no score and the crowd rows go. */
	scores?: boolean
	/** Attribute the portrait cache lookup to this request without retaining it in the cached view. */
	request?: Request
}

/** The owner's portrait for one tab. The country only matters for suggestions, which a public view drops. */
export async function getProfilePortrait<T extends PortraitTab>(
	ownerId: string,
	tab: T,
	options: ProfilePortraitOptions = {},
): Promise<PortraitViewOf<T>> {
	const who: PortraitViewer = {
		viewer: { kind: "member", userId: ownerId },
		context: () => getMemberViewerContext(ownerId, "US"),
	}
	const view = options.summary
		? await getStatsPortrait(who, tab, options.request)
		: await getTastePortrait(who, tab, options.request)
	if ((options.audience ?? "public") === "owner") return view
	return publicView(view, options.scores ?? true) as PortraitViewOf<T>
}
