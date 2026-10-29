// The start page's loader (docs/implementation/start-page-redesign.md).
//
// A guest gets the start titles, which fill the room's shelf: nothing personal, so the HTML is the same for every
// guest and the page is stored under the shared cache policy (`livingRoomAuth`). Without start titles (the snapshot is
// still loading, or they couldn't be read) the page is incomplete and no cache keeps it. A member's page is never
// stored; a member gets the same start titles for the shelf, and their own start (member.server.ts), read alongside.
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
import {
	type MemberStartData,
	UNREAD_MEMBER,
} from "~/ui/start/member/member-data"
import { loadMemberStart } from "./member.server"

export type StartPageData =
	| { member: false; titles: StartTitle[] }
	| {
			member: true
			titles: StartTitle[]
			start: MemberStartData
	  }

export async function loadStartPage(
	request: Request,
): Promise<{ data: StartPageData; headers: Headers }> {
	const { user, headers } = await livingRoomAuth(request)
	const shelf = loadStartTitles(getTitleSnapshot(), getDisplayFields)
	if (!user) {
		const titles = await shelf
		if (!titles.length)
			headers.set("Cache-Control", INCOMPLETE_PAGE_HEADERS["Cache-Control"])
		return { data: { member: false, titles }, headers }
	}
	// The member's own start never fails the page: without it they get the search and the first steps.
	const [titles, start] = await Promise.all([
		shelf,
		loadMemberStart(request, user.id).catch((error) => {
			console.error("Member start: reading the member failed", error)
			return UNREAD_MEMBER
		}),
	])
	return { data: { member: true, titles, start }, headers }
}

async function canonicalStartLoader({ request }: { request: Request }) {
	const { data, headers } = await loadStartPage(request)
	return json(data, { headers })
}

export const startPageLoader = presentCatalogLoader(canonicalStartLoader, {
	live: true,
})
