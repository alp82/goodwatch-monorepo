// The start page's loader (docs/implementation/start-page-redesign.md).
//
// A guest gets the start titles, which fill the room's shelf: nothing personal, so the HTML is the same for every
// guest and the page is stored under the shared cache policy (`livingRoomAuth`). Without start titles (the snapshot is
// still loading, or they couldn't be read) the page is incomplete and no cache keeps it. A member's page is never
// stored; a member gets the same start titles for the shelf, and their own start (a later step) beside them.
//
// Searches never run here: they cost money and write history. The browser asks for them when the guest searches.
import { json } from "@remix-run/node"
import { INCOMPLETE_PAGE_HEADERS } from "~/server/incomplete-page"
import { livingRoomAuth } from "~/server/living-room/data.server"
import { loadStartTitles } from "~/server/living-room/start-titles.server"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { getDisplayFields } from "~/server/title-cards.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import type { StartTitle } from "~/ui/living-room/living-room-data"

export type StartPageData =
	| { member: false; titles: StartTitle[] }
	| {
			member: true
			titles: StartTitle[]
	  }

export async function loadStartPage(
	request: Request,
): Promise<{ data: StartPageData; headers: Headers }> {
	const { user, headers } = await livingRoomAuth(request)
	const titles = await loadStartTitles(getTitleSnapshot(), getDisplayFields)
	if (!user) {
		if (!titles.length)
			headers.set("Cache-Control", INCOMPLETE_PAGE_HEADERS["Cache-Control"])
		return { data: { member: false, titles }, headers }
	}
	return { data: { member: true, titles }, headers }
}

async function canonicalStartLoader({ request }: { request: Request }) {
	const { data, headers } = await loadStartPage(request)
	return json(data, { headers })
}

export const startPageLoader = presentCatalogLoader(canonicalStartLoader, {
	live: true,
})
