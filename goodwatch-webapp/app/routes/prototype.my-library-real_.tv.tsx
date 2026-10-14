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
// `&session=on` (slice 8; slice 9's scripts say `session=member`, which is the same) also gives the page the
// sample member's session, as the harness's own pages have it: the browser then knows a member, and the requests
// for the member's own data go to the harness's API, which answers from the dev server's memory with the app's
// own server functions. Their marks, Tonight's pick and what is new for their shows are read there; a score goes
// through `updateScores`; a show's tracking is read and its actions applied as /api/tracking/show does (slice 9:
// Seen it on a show midway through marks its Next episode). That is a member's rating and a member's watch on the
// TV, written and read back, without an account and without a database. Without it the page has no session, as
// before.
// A production build leaves the route out (PROTOTYPES in vite.config.js: `prototype.my-library*`).
import {
	type LinksFunction,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import {
	type ShouldRevalidateFunction,
	useLoaderData,
	useSearchParams,
} from "@remix-run/react"
import {
	type ReactNode,
	startTransition,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react"
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
import { AuthContext } from "~/utils/auth"

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
	const viewer = await getMemberViewerContext(HARNESS_MEMBER, "US")
	const home = await loadMemberHome(viewer, HARNESS_TASTE, now)
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
		// The member's country and saved services, as the TV's own loader gives them to its search (slice 10).
		scope: { country: viewer.country, services: viewer.services },
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
// The loader runs again for another sample member and when the page asks again for its own address (routes/
// home-preview.tsx does the same), not for a TV screen.
export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	defaultShouldRevalidate,
}) =>
	currentUrl.href !== nextUrl.href && isTvOnlyChange(currentUrl, nextUrl)
		? false
		: defaultShouldRevalidate

const API = "/prototype/my-library-real/api"
/**
 * The member's requests the harness answers for the sample member: their marks and a score (slice 8); Tonight's
 * pick, what is new for their shows, and a show's tracking with its actions (slice 9).
 */
const HARNESS_ROUTES: Record<string, string> = {
	"/api/user-data": "user-data",
	"/api/update-scores": "rate",
	"/api/tonight": "tonight",
	"/api/new-episodes": "new-episodes",
	"/api/tracking/show": "tracking-show",
}

/** Sends the member's requests to the harness's API (prototype.my-library-real_.api.ts), with what they ask for. */
function installFetch(setup: string) {
	const real = window.fetch
	window.fetch = (input, init) => {
		const url = new URL(
			typeof input === "string" || input instanceof URL ? input : input.url,
			location.origin,
		)
		const what =
			url.origin === location.origin ? HARNESS_ROUTES[url.pathname] : undefined
		if (!what) return real(input, init)
		// A request's own query goes along: a show's tracking is asked for by the show's id.
		const search = url.search.replace(/^\?/, "")
		return real(
			`${API}?what=${what}&${setup}${search ? `&${search}` : ""}`,
			init,
		)
	}
	return () => {
		window.fetch = real
	}
}

/** The sample member's session around the TV, once their requests go to the harness. */
function MemberSession({
	setup,
	children,
}: { setup: string; children: ReactNode }) {
	const [ready, setReady] = useState("")
	useEffect(() => {
		const remove = installFetch(setup)
		startTransition(() => setReady(setup))
		return remove
	}, [setup])
	const auth = useMemo(
		() => ({
			supabase: undefined,
			getSupabase: () =>
				Promise.reject(new Error("The harness has no sign-in")),
			// biome-ignore lint/suspicious/noExplicitAny: a member who does not exist; only the id is read.
			user: { id: HARNESS_MEMBER } as any,
			loading: false,
		}),
		[],
	)
	// The page is drawn on the server without a session, and hydrates so; the member is there right after.
	const guest = useContext(AuthContext)
	return (
		<AuthContext.Provider value={ready === setup ? auth : guest}>
			{children}
		</AuthContext.Provider>
	)
}

export default function TvHarness() {
	const data = useLoaderData<typeof loader>() as unknown as TvHomeData
	const [params] = useSearchParams()
	const tv = <TvLivingRoom data={data} />
	const session = params.get("session")
	if (session !== "on" && session !== "member") return tv
	const setup = `member=${memberOf(params.get("member"))}&seen=${seenOf(params.get("seen"))}&landed=${landedOf(params.get("landed"))}`
	return <MemberSession setup={setup}>{tv}</MemberSession>
}
