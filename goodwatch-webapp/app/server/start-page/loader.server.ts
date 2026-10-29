// The start page's loader (docs/implementation/start-page-redesign.md).
//
// A guest gets the start titles, which fill the room's shelf: nothing personal, so the HTML is the same for every
// guest and the page is stored under the shared cache policy (`livingRoomAuth`). Without start titles (the snapshot is
// still loading, or they couldn't be read) the page is incomplete and no cache keeps it. A member's page is never
// stored; a member gets the same start titles for the shelf, and their own start (a later step) beside them.
//
// A guest's page also has the Where to start section (browse.server.ts), the same for every guest of a country, the
// country the page cache keys on. Without one of its rails the page is incomplete too.
//
// Searches never run here: they cost money and write history. The browser asks for them when the guest searches.
import { json } from "@remix-run/node"
import { cacheIdentity } from "~/server/cache-identity.server"
import { INCOMPLETE_PAGE_HEADERS } from "~/server/incomplete-page"
import { livingRoomAuth } from "~/server/living-room/data.server"
import { loadStartTitles } from "~/server/living-room/start-titles.server"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { getDisplayFields } from "~/server/title-cards.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import type { StartTitle } from "~/ui/living-room/living-room-data"
import type { StartBrowseData } from "~/ui/start/browse/browse-data"
import { loadStartBrowse } from "./browse.server"

export type StartPageData =
	| { member: false; titles: StartTitle[]; browse: StartBrowseData }
	| {
			member: true
			titles: StartTitle[]
	  }

export async function loadStartPage(
	request: Request,
): Promise<{ data: StartPageData; headers: Headers }> {
	const { user, headers } = await livingRoomAuth(request)
	const [titles, browse] = await Promise.all([
		loadStartTitles(getTitleSnapshot(), getDisplayFields),
		user ? null : loadStartBrowse(cacheIdentity(request).country),
	])
	if (user || !browse) return { data: { member: true, titles }, headers }
	if (!titles.length || !browse.complete)
		headers.set("Cache-Control", INCOMPLETE_PAGE_HEADERS["Cache-Control"])
	return { data: { member: false, titles, browse: browse.value }, headers }
}

async function canonicalStartLoader({ request }: { request: Request }) {
	const { data, headers } = await loadStartPage(request)
	return json(data, { headers })
}

export const startPageLoader = presentCatalogLoader(canonicalStartLoader, {
	live: true,
})
