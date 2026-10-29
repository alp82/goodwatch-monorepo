// The start page's loader (docs/implementation/start-page-redesign.md).
//
// A guest gets the start titles, which fill the room's shelf: nothing personal, so the HTML is the same for every
// guest and the page is stored under the shared cache policy (`livingRoomAuth`). Without start titles (the snapshot is
// still loading, or they couldn't be read) the page is incomplete and no cache keeps it. A member's page is never
// stored; a member gets the same start titles for the shelf, and their own start (member.server.ts), read alongside.
// A member's slower lists (For you, Hot on socials) come later in the same response, through Remix's `defer`: the
// HTML doesn't wait for them, and their titles are shown in the member's language like the rest of the page.
//
// A guest's page also has the Where to start section (browse.server.ts), the same for every guest of a country, the
// country the page cache keys on. Without one of its rails the page is incomplete too.
//
// Searches never run here: they cost money and write history. The browser asks for them when the guest searches.
import { type TypedResponse, defer, json } from "@remix-run/node"
import { isbot } from "isbot"
import { cacheIdentity } from "~/server/cache-identity.server"
import { INCOMPLETE_PAGE_HEADERS } from "~/server/incomplete-page"
import { livingRoomAuth } from "~/server/living-room/data.server"
import { loadStartTitles } from "~/server/living-room/start-titles.server"
import {
	liveMediaLanguage,
	localizeTitlePayload,
	presentCatalogLoader,
} from "~/server/media-payload.server"
import { getDisplayFields } from "~/server/title-cards.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import type { StartTitle } from "~/ui/living-room/living-room-data"
import type { StartBrowseData } from "~/ui/start/browse/browse-data"
import {
	type MemberStartData,
	type MemberStartLater,
	UNREAD_MEMBER,
} from "~/ui/start/member/member-data"
import { loadStartBrowse } from "./browse.server"
import { loadMemberStart } from "./member.server"

export type StartPageData =
	| { member: false; titles: StartTitle[]; browse: StartBrowseData }
	| {
			member: true
			titles: StartTitle[]
			start: MemberStartData
	  }

export async function loadStartPage(request: Request): Promise<{
	data: StartPageData
	headers: Headers
	later?: { userId: string; lists: MemberStartLater }
}> {
	const { user, headers } = await livingRoomAuth(request)
	const shelf = loadStartTitles(getTitleSnapshot(), getDisplayFields)
	if (!user) {
		const [titles, browse] = await Promise.all([
			shelf,
			loadStartBrowse(cacheIdentity(request).country),
		])
		if (!titles.length || !browse.complete)
			headers.set("Cache-Control", INCOMPLETE_PAGE_HEADERS["Cache-Control"])
		return { data: { member: false, titles, browse: browse.value }, headers }
	}
	// The member's own start never fails the page: without it they get the search and the first steps.
	const [titles, start] = await Promise.all([
		shelf,
		loadMemberStart(request, user.id).catch((error) => {
			console.error("Member start: reading the member failed", error)
			return { data: UNREAD_MEMBER, later: {} }
		}),
	])
	return {
		data: { member: true, titles, start: start.data },
		headers,
		later: { userId: user.id, lists: start.later },
	}
}

/** The lists that come later, kept for the request until the page's data has been presented. */
const laterOf = new WeakMap<
	Request,
	{ userId: string; lists: MemberStartLater }
>()

async function canonicalStartLoader({ request }: { request: Request }) {
	const { data, headers, later } = await loadStartPage(request)
	if (later) laterOf.set(request, later)
	return json(data, { headers })
}

const presentStart = presentCatalogLoader(canonicalStartLoader, {
	live: true,
})

/** A list that comes later, in the member's language like the page (presentCatalogLoader does it for the rest). */
function presented<T>(list: Promise<T>, language: Promise<string | null>) {
	return Promise.all([list, language]).then(([value, lang]) =>
		value && lang
			? localizeTitlePayload(value, lang).catch((error) => {
					console.error("Member start: presenting a list failed", error)
					return value
				})
			: value,
	)
}

/**
 * The page's data. A guest's is presentCatalogLoader's JSON as it is. A member's is the same data with the lists that
 * come later as promises at its top level (`forYouLater`, `hotLater`; `defer` streams top-level promises only).
 */
export async function startPageLoader(args: { request: Request }): Promise<
	| TypedResponse<StartPageData>
	| ReturnType<
			typeof defer<
				Extract<StartPageData, { member: true }> & {
					forYouLater?: NonNullable<MemberStartLater["forYou"]>
					hotLater?: NonNullable<MemberStartLater["hot"]>
				}
			>
	  >
> {
	const response = await presentStart(args)
	const later = laterOf.get(args.request)
	laterOf.delete(args.request)
	const { forYou, hot } = later?.lists ?? {}
	if (!later || (!forYou && !hot) || response.status !== 200) return response
	const data = (await response.json()) as Extract<
		StartPageData,
		{ member: true }
	>
	const headers = new Headers(response.headers)
	headers.delete("Content-Type")
	headers.delete("Content-Length")
	const language = isbot(args.request.headers.get("user-agent"))
		? Promise.resolve(null)
		: liveMediaLanguage(args.request, later.userId).catch(() => null)
	return defer(
		{
			...data,
			...(forYou ? { forYouLater: presented(forYou, language) } : {}),
			...(hot ? { hotLater: presented(hot, language) } : {}),
		},
		{ headers },
	)
}
