// PROTOTYPE - throwaway. "New episodes for the shows you watch", in the app only (map #365).
// Two gaps of My shows as it is built, and what closing them looks like:
//   1. The "Waiting for episodes" group says when each show's next episode airs, soonest first. Open: where the day
//      sits in a row. Three layouts.
//   2. Outside My shows, its entry in the navigation and the Continue door on home say that something new aired.
//      Open: what is counted (a dot, shows, episodes) and when the signal clears.
//   /prototype/new-episodes?surface=home|shows
//     &signal=dot|shows|episodes   what the signal shows
//     &clears=open|watched         when it clears: on opening My shows, or only by watching (seven days at most)
//     &row=line|column|chip        where the day sits in a waiting row
//     &member=mixed|none|one|season|many   the sample member
//     &hub=open                    the hub sheet (phone) or Browse panel (desktop) starts open
//     &chrome=off                  hides the prototype's own controls
// The pill (or the left and right arrow keys) switches the piece that is open on the surface on screen. Every show's
// episodes, dates and watches are made up and live in the browser: no loader, no service, nothing written.
// Notes and screenshots: docs/prototypes/new-episodes/README.md.
import type { LinksFunction } from "@remix-run/node"
import { useSearchParams } from "@remix-run/react"
import { useEffect, useMemo, useState } from "react"
import livingRoomCss from "~/ui/living-room/living-room.css?url"
import {
	CLEARS,
	Controls,
	LOOKS,
	type Nav,
	SiteChrome,
	type Surface,
} from "~/ui/prototype-new-episodes/chrome"
import {
	type DoorKey,
	HomeScreen,
	continueDoorOf,
} from "~/ui/prototype-new-episodes/home"
import {
	type Clears,
	type Look,
	MEMBERS,
	type MemberKey,
	START_DAY,
	addDays,
	planOf,
	showsOf,
	signalOf,
	signalWords,
	sinceOf,
} from "~/ui/prototype-new-episodes/model"
import { ROWS, type RowKey, ShowsPage } from "~/ui/prototype-new-episodes/shows"
import { Room } from "~/ui/prototype-watching-2/room"
import { assetUrl } from "~/utils/asset-url"

export async function loader() {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	return null
}

export const links: LinksFunction = () => [
	{ rel: "stylesheet", href: assetUrl(livingRoomCss) },
]
export const meta = () => [
	{ title: "New episodes prototype · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

const pick = <K extends string>(
	choices: Record<K, unknown>,
	value: string | null,
	fallback: K,
): K => (value !== null && value in choices ? (value as K) : fallback)

export default function NewEpisodesPrototype() {
	const [params, setParams] = useSearchParams()
	const member = pick<MemberKey>(MEMBERS, params.get("member"), "mixed")
	const [run, setRun] = useState(0)
	// An empty value takes the parameter away.
	const set = (next: Record<string, string>) =>
		setParams(
			(now) => {
				const p = new URLSearchParams(now)
				for (const [k, v] of Object.entries(next))
					v === "" ? p.delete(k) : p.set(k, v)
				return p
			},
			{ replace: true, preventScrollReset: !("surface" in next) },
		)
	// A different sample member, or Reset, starts the in-memory state over.
	return (
		<Page
			key={`${member}:${run}`}
			params={params}
			member={member}
			set={set}
			reset={() => setRun((n) => n + 1)}
		/>
	)
}

function Page({
	params,
	member,
	set,
	reset,
}: {
	params: URLSearchParams
	member: MemberKey
	set: (next: Record<string, string>) => void
	reset: () => void
}) {
	const look = pick<Look>(LOOKS, params.get("signal"), "shows")
	const clears = pick<Clears>(CLEARS, params.get("clears"), "open")
	const row = pick<RowKey>(ROWS, params.get("row"), "line")
	const surface: Surface = params.get("surface") === "shows" ? "shows" : "home"

	// Everything that happens during the visit: the day, the last opening of My shows, and the episodes watched.
	const [today, setToday] = useState(START_DAY)
	const [lastOpened, setLastOpened] = useState<string>(
		MEMBERS[member].lastOpened,
	)
	const [watchedMore, setWatchedMore] = useState<Record<string, number>>({})
	const [hub, setHub] = useState(params.get("hub") === "open")

	const shows = useMemo(
		() =>
			showsOf(member).map((show) => ({
				...show,
				watched: show.watched + (watchedMore[show.key] ?? 0),
				lastWatch: watchedMore[show.key] ? today : show.lastWatch,
			})),
		[member, watchedMore, today],
	)
	const plan = useMemo(() => planOf(shows, today), [shows, today])
	const since = sinceOf(clears, today, lastOpened)
	const signal = useMemo(
		() => signalOf(shows, today, since),
		[shows, today, since],
	)

	// What the signal held when My shows was opened: the page says it once. Opening the page is the visit.
	const [arrived, setArrived] = useState(signal)
	useEffect(() => {
		if (surface !== "shows") return
		setArrived(signal)
		setLastOpened(today)
		// Only the opening of the page counts, not what changes while it is open.
	}, [surface])

	const go = (to: Surface) => {
		set({ surface: to === "home" ? "" : to })
		window.scrollTo({ top: 0 })
	}
	const nav: Nav = {
		surface,
		go,
		look,
		clears,
		row,
		member,
		shows,
		plan,
		today,
		lastOpened,
		signal,
		words: signalWords(signal, look),
		watch: (key) => setWatchedMore((m) => ({ ...m, [key]: (m[key] ?? 0) + 1 })),
		nextDay: () => setToday((day) => addDays(day, 1)),
	}

	const [focus, setFocus] = useState<DoorKey>("continue")
	const doors: DoorKey[] = plan.continue.length
		? ["continue", "start", "movie"]
		: ["start", "movie"]
	const focused = doors.includes(focus) ? focus : doors[0]
	const open = (door: DoorKey) => door !== "movie" && go("shows")
	const next = continueDoorOf(plan, today)
	const home = { plan, today, words: nav.words, focus: focused, setFocus, open }
	const lcd: [string, string] =
		focused === "continue" && next
			? ["CONTINUE", [next.title, next.episode].filter(Boolean).join(" · ")]
			: focused === "start"
				? ["START A SHOW", "3 you want to see"]
				: ["A MOVIE", "Dune: Part Two · 2h 47m"]

	return (
		<>
			<SiteChrome nav={nav} hub={hub} setHub={setHub} />
			{surface === "home" ? (
				<Room
					desktop={<HomeScreen {...home} />}
					phone={<HomeScreen {...home} phone />}
					lcd={lcd}
					onStep={(by) =>
						setFocus(
							doors[
								(doors.indexOf(focused) + by + doors.length) % doors.length
							],
						)
					}
					onOk={() => open(focused)}
				/>
			) : (
				<ShowsPage
					plan={plan}
					today={today}
					row={row}
					arrived={clears === "open" ? arrived : signal}
				/>
			)}
			<Controls
				nav={nav}
				set={set}
				reset={reset}
				hidden={params.get("chrome") === "off"}
			/>
		</>
	)
}
