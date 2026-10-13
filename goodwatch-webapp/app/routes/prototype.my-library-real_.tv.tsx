// DEVELOPMENT HARNESS, not a prototype of a design: the start page with the NEW TV as a member sees it
// (docs/implementation/tv-screen-revamp), mounted with a member who does not exist. It is the harness of
// /prototype/my-library-real (issue #385) with one more page: the loader runs the TV's own member read
// (`loadMemberHome`, server/living-room/tv-loader.server.ts) against that harness's in-memory Crate, so a member's
// home can be driven in a headless browser without a signed-in session or a database.
// Start the dev server without .env and with the flags on (a server with CRATE_HOSTS is refused):
//   REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on REC_NAVIGATION=on \
//   REC_AGE_FILTER=on REC_TRACKING=on node_modules/.bin/remix vite:dev --port 3174
//   /prototype/my-library-real/tv?member=six|one|many|none|empty|new&seen=30|1500|0&landed=...
// What is made up here and not by the TV: the harness's catalog has posters that lead nowhere, so the pictures
// are painted in from a fixed table of real TMDB paths, and the titles below the room are a fixed list. The site's
// header above the room sees a guest. The pool answers 503 here (no title snapshot), so the home keeps what the
// loader gave it.
// A production build leaves the route out (PROTOTYPES in vite.config.js: `prototype.my-library*`).
import {
	type LinksFunction,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData } from "@remix-run/react"
import { loadMemberHome } from "~/server/living-room/tv-loader.server"
import {
	HARNESS_TASTE,
	harness,
	installHarnessMember,
} from "~/server/prototype-my-library.server"
import { getMemberViewerContext } from "~/server/viewer.server"
import livingRoomCss from "~/ui/living-room/living-room.css?url"
import type { StartTitle } from "~/ui/living-room/living-room-data"
import { TvLivingRoom } from "~/ui/living-room/tv/TvLivingRoom"
import type { TvHomeData } from "~/ui/living-room/tv/tv-home"
import { isTvOnlyChange } from "~/ui/living-room/tv/tv-machine"
import tvCss from "~/ui/living-room/tv/tv.css?url"
import {
	HARNESS_MEMBER,
	landedOf,
	memberOf,
	seenOf,
} from "~/ui/prototype-my-library/setup"

type Art = { poster_path: string; backdrop_path: string }

/** Real pictures for the harness's titles, by name; a title without one takes a picture of the list in turn. */
const ART: Record<string, Art> = {
	"Slow Horses": {
		poster_path: "/AdYr4DjOgXvDUMwu6vEhZy1Rnxk.jpg",
		backdrop_path: "/gPQppUnLx9vqPDLz3WwZ2HJsNbt.jpg",
	},
	Severance: {
		poster_path: "/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg",
		backdrop_path: "/ixgFmf1X59PUZam2qbAfskx2gQr.jpg",
	},
	"The Bear": {
		poster_path: "/eKfVzzEazSIjJMrw9ADa2x8ksLz.jpg",
		backdrop_path: "/aJtG4txtmiRHwAAqENQHZvBs6kY.jpg",
	},
	Andor: {
		poster_path: "/khZqmwHQicTYoS7Flreb9EddFZC.jpg",
		backdrop_path: "/quCeAmVQHfsdcYkicbxZWVauCVb.jpg",
	},
	"Only Murders in the Building": {
		poster_path: "/1yjFVQZuW8aofZ5Cgol8iImsVFp.jpg",
		backdrop_path: "/WCnEPf4ZNPjszndmrFlDxZ5Uvd.jpg",
	},
}
const OTHER_ART: Art[] = [
	{
		poster_path: "/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
		backdrop_path: "/6oaL4DP75yABrd5EbC4H2zq5ghc.jpg",
	},
	{
		poster_path: "/gnAfqiV7yO3Jq9IntTmwkcaICqc.jpg",
		backdrop_path: "/d7JUXVvjvVCXWs1mlpyO5ESdWdT.jpg",
	},
	{
		poster_path: "/1ju4vQ1EwlIkQxEgWiYmxOs3iBG.jpg",
		backdrop_path: "/5TgMzFqbOEcEo99uhIo8DmiENOx.jpg",
	},
	{
		poster_path: "/5BHuvQ6p9kfc091Z8RiFNhCwL4b.jpg",
		backdrop_path: "/lzMS0CI3FLQYC5EgJoWeIaEt0lm.jpg",
	},
]
const paint = <T extends { title: string }>(title: T, id: number): T & Art => ({
	...title,
	...(ART[title.title] ?? OTHER_ART[id % OTHER_ART.length]),
})

/** The titles below the room: on the real page the 16 start titles. Four are enough for the Discover tile. */
const START_TITLES: StartTitle[] = [
	{
		media_type: "movie",
		tmdb_id: 546554,
		title: "Knives Out",
		release_year: 2019,
		poster_path: "/pThyQovXQrw2m0s9x82twj48Jq4.jpg",
	},
	{
		media_type: "movie",
		tmdb_id: 329865,
		title: "Arrival",
		release_year: 2016,
		poster_path: "/pEzNVQfdzYDzVK0XqxERIw2x2se.jpg",
	},
	{
		media_type: "movie",
		tmdb_id: 346648,
		title: "Paddington 2",
		release_year: 2017,
		poster_path: "/1OJ9vkD5xPt3skC6KguyXAgagRZ.jpg",
	},
	{
		media_type: "movie",
		tmdb_id: 157336,
		title: "Interstellar",
		release_year: 2014,
		poster_path: "/yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg",
	},
]

export async function loader({ request }: LoaderFunctionArgs) {
	const params = new URL(request.url).searchParams
	const now = installHarnessMember(
		memberOf(params.get("member")),
		seenOf(params.get("seen")),
		landedOf(params.get("landed")),
		params.get("reset") === "1",
	)
	await harness.ready()
	const home = await loadMemberHome(
		await getMemberViewerContext(HARNESS_MEMBER, "US"),
		HARNESS_TASTE,
		now,
	)
	return json<TvHomeData>({
		member: true,
		startTitles: START_TITLES,
		picture: null,
		tonight: home.tonight.map((pick) => ({
			...pick,
			card: paint(pick.card, pick.card.tmdb_id),
		})),
		shows: home.shows && {
			next: home.shows.next.map((show) => paint(show, show.id)),
			start: home.shows.start.map((show) => paint(show, show.id)),
		},
	})
}

export const meta = () => [
	{ title: "The new TV, a member's (harness) · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]
export const links: LinksFunction = () => [
	{ rel: "stylesheet", href: livingRoomCss },
	{ rel: "stylesheet", href: tvCss },
]
// The loader runs again for another sample member, not for a TV screen.
export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	defaultShouldRevalidate,
}) => (isTvOnlyChange(currentUrl, nextUrl) ? false : defaultShouldRevalidate)

export default function TvHarness() {
	const data = useLoaderData<typeof loader>() as unknown as TvHomeData
	return <TvLivingRoom data={data} />
}
