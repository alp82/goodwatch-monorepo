// DEVELOPMENT HARNESS (issue #385), not a prototype of a design: the REAL My shows, My movies and My library pages
// and home's doors, mounted with a member who does not exist. The loader and the harness's API run the app's own
// server reads against an in-memory Crate (server/prototype-my-library.server.ts), and the page sends the member's
// requests there. It is how the pages are driven in a headless browser without a signed-in session or a database.
// Start the dev server without .env and with the flags on:
//   REC_TRACKING=on REC_WATCH_NEXT=on REC_NAVIGATION=on REC_TASTE_MATCH=on node_modules/.bin/remix vite:dev --port 3107
//   /prototype/my-library-real?page=library|shows|movies|home&member=six|one|many|none|empty&seen=30|1500|0
// `reset=1` starts the sample member over, `chrome=off` hides the harness's own controls. The library's own
// parameters (`status`, `sort`, `type`, `q`) work as on /my-library.
// A production build leaves the route out (PROTOTYPES in vite.config.js).
import {
	type LinksFunction,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import {
	Link,
	type ShouldRevalidateFunction,
	useLoaderData,
	useNavigate,
	useSearchParams,
} from "@remix-run/react"
import { startTransition, useEffect, useMemo, useState } from "react"
import { libraryChoiceOf } from "~/domain/my-library"
import type { LibraryPage } from "~/server/my-library.server"
import type { MyShows } from "~/server/my-shows.server"
import {
	harness,
	installHarnessMember,
} from "~/server/prototype-my-library.server"
import type { WatchNext } from "~/server/watch-next.server"
import { LivingRoom } from "~/ui/living-room/LivingRoom"
import type { LivingRoomData } from "~/ui/living-room/living-room-data"
import livingRoomCss from "~/ui/living-room/living-room.css?url"
import type { TvEffect } from "~/ui/living-room/tv-flow"
import { MyLibraryPage } from "~/ui/my-library/MyLibraryPage"
import { MOVIES_PAGE } from "~/ui/my-movies/parts"
import { MyShowsPage } from "~/ui/my-shows/MyShowsPage"
import { TonightsPickThumb } from "~/ui/navigation/bits"
import {
	HARNESS_MEMBER,
	MEMBERS,
	SEEN_SIZES,
	memberOf,
	seenOf,
} from "~/ui/prototype-my-library/setup"
import { WatchNextPage } from "~/ui/watch-next/WatchNextPage"
import { apiQuery, pageChoiceOf } from "~/ui/watch-next/useWatchNext"
import { AuthContext } from "~/utils/auth"

const PAGES = ["library", "shows", "movies", "home"] as const
type PageKey = (typeof PAGES)[number]
const PAGE_NAME: Record<PageKey, string> = {
	library: "My library",
	shows: "My shows",
	movies: "My movies",
	home: "Home",
}
const pageOf = (value: string | null): PageKey =>
	(PAGES as readonly string[]).includes(value ?? "")
		? (value as PageKey)
		: "library"
const API = "/prototype/my-library-real/api"

type Loaded =
	| { page: "library"; now: number; library: LibraryPage }
	| { page: "shows"; now: number; shows: MyShows }
	| { page: "movies"; now: number; movies: { query: string; data: WatchNext } }
	| { page: "home"; now: number; room: LivingRoomData }

export async function loader({ request }: LoaderFunctionArgs) {
	const params = new URL(request.url).searchParams
	const now = installHarnessMember(
		memberOf(params.get("member")),
		seenOf(params.get("seen")),
		params.get("reset") === "1",
	)
	const page = pageOf(params.get("page"))
	if (page === "library")
		return json<Loaded>({
			page,
			now,
			library: await harness.library(libraryChoiceOf(params)),
		})
	if (page === "shows")
		return json<Loaded>({ page, now, shows: await harness.shows(now) })
	if (page === "movies") {
		const choice = pageChoiceOf(params, true)
		return json<Loaded>({
			page,
			now,
			movies: { query: apiQuery(choice), data: await harness.movies(choice) },
		})
	}
	return json<Loaded>({
		page,
		now,
		room: {
			member: true,
			suggestions: [],
			wishlist: [],
			catalog: [],
			savedServices: [],
			pairs: [],
			doors: await harness.doors(now),
		},
	})
}

export const meta = () => [
	{ title: "My library, the real pages · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]
export const links: LinksFunction = () => [
	{ rel: "stylesheet", href: livingRoomCss },
]
// The loader runs again for another page or sample member, not for a page's own choices.
export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
}) =>
	["page", "member", "seen", "reset"].some(
		(key) => currentUrl.searchParams.get(key) !== nextUrl.searchParams.get(key),
	)

/** Sends the member's requests to the harness's API, which answers for the sample member. */
function installFetch(setup: string) {
	const real = window.fetch
	const to = (what: string, search = "") =>
		`${API}?what=${what}&${setup}${search ? `&${search.replace(/^\?/, "")}` : ""}`
	window.fetch = (input, init) => {
		const url = new URL(
			typeof input === "string" || input instanceof URL ? input : input.url,
			location.origin,
		)
		const route: Record<string, string> = {
			"/api/my-library": "library",
			"/api/watch-next": "movies",
			"/api/watch-next/cards": "cards",
			"/api/user-data": "user-data",
			"/api/tonight": "tonight",
			"/api/update-scores": "rate",
		}
		const what =
			url.origin === location.origin ? route[url.pathname] : undefined
		return what ? real(to(what, url.search), init) : real(input, init)
	}
	return () => {
		window.fetch = real
	}
}

const PILL =
	"rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-fuchsia-400/60"

function Chrome({ page }: { page: PageKey }) {
	const [params] = useSearchParams()
	const link = (key: string, value: string, label: string) => {
		const next = new URLSearchParams(params)
		next.set(key, value)
		for (const own of ["status", "sort", "type", "q", "time", "moods", "reset"])
			next.delete(own)
		const on = (params.get(key) ?? "") === value
		return (
			<Link
				key={value}
				to={`?${next}`}
				className={`${PILL} ${on ? "bg-fuchsia-500 text-white" : "bg-white text-black"}`}
			>
				{label}
			</Link>
		)
	}
	return (
		<div
			data-harness-chrome
			className="mx-auto flex max-w-7xl flex-wrap items-center gap-1.5 px-4 pt-3 text-xs text-gray-400"
		>
			<b className="text-fuchsia-300">Harness #385</b>
			{PAGES.map((key) => link("page", key, PAGE_NAME[key]))}
			<span className="mx-1">member</span>
			{MEMBERS.map((key) => link("member", key, key))}
			<span className="mx-1">Seen</span>
			{SEEN_SIZES.map((key) => link("seen", key, key))}
			<span className="basis-full">
				The pages are the app's own; the member and the catalog are made up and
				live in the dev server. Showing {PAGE_NAME[page]}.
			</span>
			{/* The site's header and dock above see a guest. This is Tonight's pick as the member's would show it. */}
			{page !== "home" && (
				<span
					data-harness-pick
					className="flex items-center gap-2 rounded-xl bg-gray-950 pr-3 ring-1 ring-fuchsia-400/60"
				>
					<TonightsPickThumb />
				</span>
			)}
		</div>
	)
}

export default function MyLibraryHarness() {
	const loaded = useLoaderData<typeof loader>() as unknown as Loaded
	const [params] = useSearchParams()
	const navigate = useNavigate()
	const setup = `member=${memberOf(params.get("member"))}&seen=${seenOf(params.get("seen"))}`
	// The member's requests go to the harness before any page below asks for anything.
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
	// A door leaves for its page: here, for the harness's copy of it.
	const onEffect = (effect: TvEffect) => {
		if (effect.type !== "leave" || effect.to.kind !== "page") return
		const [path, hash] = effect.to.href.split("#")
		const next = new URLSearchParams(params)
		next.set("page", path === "/my-movies" ? "movies" : "shows")
		navigate(`?${next}${hash ? `#${hash}` : ""}`)
	}
	const chrome = params.get("chrome") !== "off" && <Chrome page={loaded.page} />
	// Home asks for nothing of the member's, so it is rendered on the server too, as the real home is.
	if (loaded.page === "home")
		return (
			<div data-harness="home">
				{chrome}
				<LivingRoom data={loaded.room} onEffect={onEffect} onRate={() => {}} />
			</div>
		)
	if (ready !== setup)
		return <p className="p-8 text-gray-400">Starting the harness.</p>
	return (
		<AuthContext.Provider value={auth}>
			<div data-harness={loaded.page}>
				{chrome}
				{loaded.page === "library" ? (
					<MyLibraryPage
						key={setup}
						initial={loaded.library}
						now={loaded.now}
						viewer={`${HARNESS_MEMBER}-${setup}`}
					/>
				) : loaded.page === "shows" ? (
					<MyShowsPage data={loaded.shows} now={loaded.now} />
				) : (
					<WatchNextPage
						key={setup}
						initial={loaded.movies}
						movies={MOVIES_PAGE}
					/>
				)}
			</div>
		</AuthContext.Provider>
	)
}
