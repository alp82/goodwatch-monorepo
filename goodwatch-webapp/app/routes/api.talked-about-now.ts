// The "Talked about now" row's data (#557), asked for by the start page once the visitor goes below the room
// (ui/talked-about-now/start-row). The same for every visitor: with the feature on, any cache may keep it for a few
// minutes; in preview it answers only the members in TALKED_ABOUT_NOW_PREVIEW_USERS, and nothing keeps it.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import type { TalkedRow } from "~/domain/talked-about-now"
import { presentCatalogLoader } from "~/server/media-payload.server"
import {
	talkedAboutNowEnabled,
	talkedAboutNowMode,
} from "~/server/talked-about-now/flags.server"

export type TalkedAnswer = { row: TalkedRow | null }

// A reported link must leave the row soon: a shared cache keeps it 5 minutes, and 5 more while it asks again.
// (applyCachePolicy keeps this only when a front cache named the cache identity; else it is `private, max-age=0`.)
const PUBLIC = "public, max-age=300, s-maxage=300, stale-while-revalidate=300"
const PRIVATE = "private, no-store"

async function canonicalLoader({ request }: LoaderFunctionArgs) {
	const mode = talkedAboutNowMode("row")
	const open = mode === "on"
	// Only a preview asks who sent the request: off and on are the same for everyone.
	const enabled =
		mode === "preview"
			? talkedAboutNowEnabled(
					"row",
					await (await import("~/utils/auth")).getUserIdFromRequest({
						request,
					}),
				)
			: open
	if (!enabled)
		throw new Response("Not found", {
			status: 404,
			headers: { "Cache-Control": PRIVATE },
		})
	const { getTalkedAboutNow } = await import(
		"~/server/talked-about-now/start-row.server"
	)
	const row = await getTalkedAboutNow()
	return json<TalkedAnswer>(
		{ row },
		// Without a ranking the answer isn't kept: the next one may have it.
		{ headers: { "Cache-Control": open && row ? PUBLIC : PRIVATE } },
	)
}

export const loader = presentCatalogLoader(canonicalLoader)
