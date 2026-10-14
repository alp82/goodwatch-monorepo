// DEVELOPMENT HARNESS (issue #385), not a prototype of a design: the REAL My shows, My movies and My library pages,
// mounted with a member who does not exist. The start page's TV for that member is the route next to it,
// /prototype/my-library-real/tv (the "Home" link). The loader and the harness's API run the app's own
// server reads against an in-memory Crate (server/prototype-my-library.server.ts), and the page sends the member's
// requests there. It is how the pages are driven in a headless browser without a signed-in session or a database.
// Start the dev server without .env:
//   node_modules/.bin/remix vite:dev --port 3107
//   /prototype/my-library-real?page=library|shows|movies&member=six|one|many|none|empty&seen=30|1500|0
// `reset=1` starts the sample member over, `chrome=off` hides the harness's own controls. The library's own
// parameters (`status`, `sort`, `type`, `q`) work as on /my-library.
// The member `new` (#442) opened My shows five days ago: shows have returned since and others are waiting. The site's
// header, dock and hub are mounted a second time for the member, over the ones a guest sees, so that the signal on
// them can be looked at; `hub=open` starts with the hub open.
// `landed=movie|show|several|episode|old|gone` (#456, #489) puts titles of the member on their services, 1 to 15 days
// ago, for any member: the signal counts them until the page is opened, and for 14 days My movies and My shows list
// and mark them and the TV's Tonight leads with them (ui/prototype-my-library/setup.ts).
// A production build leaves the route out (PROTOTYPES in vite.config.js).
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import {
	Link,
	type ShouldRevalidateFunction,
	useLoaderData,
	useSearchParams,
} from "@remix-run/react"
import { startTransition, useEffect, useMemo, useState } from "react"
import { libraryChoiceOf } from "~/domain/my-library"
import type { Arrival } from "~/domain/new-episodes"
import type { LandedTitle } from "~/domain/newly-available-words"
import type { LibraryPage } from "~/server/my-library.server"
import type { MyShows } from "~/server/my-shows.server"
import {
	harness,
	installHarnessMember,
} from "~/server/prototype-my-library.server"
import type { WatchNext } from "~/server/watch-next.server"
import { MyLibraryPage } from "~/ui/my-library/MyLibraryPage"
import { MyMoviesPage } from "~/ui/my-movies/MyMoviesPage"
import { MyShowsPage } from "~/ui/my-shows/MyShowsPage"
import {
	HubDialog,
	MobileDock,
	NavigationProvider,
	SiteHeader,
} from "~/ui/navigation"
import { useNavigation } from "~/ui/navigation/NavigationContext"
import { TonightsPickThumb } from "~/ui/navigation/bits"
import {
	HARNESS_MEMBER,
	LANDED,
	MEMBERS,
	SEEN_SIZES,
	landedOf,
	memberOf,
	seenOf,
} from "~/ui/prototype-my-library/setup"
import { apiQuery, pageChoiceOf } from "~/ui/watch-next/useWatchNext"
import { AuthContext } from "~/utils/auth"

const PAGES = ["library", "shows", "movies"] as const
type PageKey = (typeof PAGES)[number]
const PAGE_NAME: Record<PageKey, string> = {
	library: "My library",
	shows: "My shows",
	movies: "My movies",
}
const pageOf = (value: string | null): PageKey =>
	(PAGES as readonly string[]).includes(value ?? "")
		? (value as PageKey)
		: "library"
const API = "/prototype/my-library-real/api"

type Loaded =
	| { page: "library"; now: number; library: LibraryPage }
	| {
			page: "shows"
			now: number
			shows: MyShows
			arrival: Arrival
			landed: LandedTitle[]
	  }
	| {
			page: "movies"
			now: number
			movies: { query: string; data: WatchNext }
			landed: LandedTitle[]
	  }

export async function loader({ request }: LoaderFunctionArgs) {
	const params = new URL(request.url).searchParams
	const now = installHarnessMember(
		memberOf(params.get("member")),
		seenOf(params.get("seen")),
		landedOf(params.get("landed")),
		params.get("reset") === "1",
	)
	await harness.ready()
	const page = pageOf(params.get("page"))
	if (page === "library")
		return json<Loaded>({
			page,
			now,
			library: await harness.library(libraryChoiceOf(params)),
		})
	if (page === "shows") {
		const [shows, fresh, landed] = await Promise.all([
			harness.shows(now),
			harness.newShows(now),
			harness.recent(now),
		])
		return json<Loaded>({
			page,
			now,
			shows,
			arrival: {
				since: fresh.since,
				titles: fresh.shows.map((show) => show.title),
			},
			landed: landed.shows,
		})
	}
	const choice = pageChoiceOf(params, true)
	return json<Loaded>({
		page,
		now,
		movies: { query: apiQuery(choice), data: await harness.movies(choice) },
		landed: (await harness.recent(now)).movies,
	})
}

export const meta = () => [
	{ title: "My library, the real pages · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]
// The loader runs again for another page or sample member, not for a page's own choices.
export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
}) =>
	["page", "member", "seen", "landed", "reset"].some(
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
			"/api/new-episodes": "new-episodes",
			"/api/newly-available": "newly-available",
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
			<Link
				to={`/prototype/my-library-real/tv?member=${memberOf(params.get("member"))}&seen=${seenOf(params.get("seen"))}&landed=${landedOf(params.get("landed"))}`}
				className={`${PILL} bg-white text-black`}
			>
				Home
			</Link>
			<span className="mx-1">member</span>
			{MEMBERS.map((key) => link("member", key, key))}
			<span className="mx-1">Seen</span>
			{SEEN_SIZES.map((key) => link("seen", key, key))}
			<span className="mx-1">landed</span>
			{LANDED.map((key) => link("landed", key, key))}
			<span className="basis-full">
				The pages are the app's own; the member and the catalog are made up and
				live in the dev server. Showing {PAGE_NAME[page]}.
			</span>
			{/* The site's header and dock above see a guest. This is Tonight's pick as the member's would show it. */}
			<span
				data-harness-pick
				className="flex items-center gap-2 rounded-xl bg-gray-950 pr-3 ring-1 ring-fuchsia-400/60"
			>
				<TonightsPickThumb />
			</span>
		</div>
	)
}

/** Opens the member's hub once, for a screenshot of it. */
function OpenHub() {
	const { setHubOpen } = useNavigation()
	useEffect(() => setHubOpen(true), [setHubOpen])
	return null
}

/**
 * The site's header, dock and hub as the member sees them, over the ones the page's own shell draws for a guest.
 * They have a navigation state of their own, so the member's hub opens from the member's keys only.
 */
function MemberNavigation({ hub }: { hub: boolean }) {
	return (
		<NavigationProvider>
			{/* Above the shell's own header and dock, below the hub's dialog. */}
			<div data-harness-navigation className="relative z-[1001]">
				<SiteHeader />
				<MobileDock />
				<HubDialog />
				{hub && <OpenHub />}
			</div>
		</NavigationProvider>
	)
}

export default function MyLibraryHarness() {
	const loaded = useLoaderData<typeof loader>() as unknown as Loaded
	const [params] = useSearchParams()
	const setup = `member=${memberOf(params.get("member"))}&seen=${seenOf(params.get("seen"))}&landed=${landedOf(params.get("landed"))}`
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
	const chrome = params.get("chrome") !== "off" && <Chrome page={loaded.page} />
	const navigation = ready === setup && (
		<MemberNavigation hub={params.get("hub") === "open"} />
	)
	if (ready !== setup)
		return <p className="p-8 text-gray-400">Starting the harness.</p>
	return (
		<AuthContext.Provider value={auth}>
			{navigation}
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
					<MyShowsPage
						key={setup}
						data={loaded.shows}
						now={loaded.now}
						arrival={loaded.arrival}
						landed={loaded.landed}
					/>
				) : (
					<MyMoviesPage
						key={setup}
						initial={loaded.movies}
						landed={loaded.landed}
					/>
				)}
			</div>
		</AuthContext.Provider>
	)
}
