// PROTOTYPE - throwaway. Round 2 of "where do the shows a member is watching live?" (#371, map #365).
// Round 1 (/prototype/watching) put Watching on home and beside the Wishlist. The owner found the extra home row too
// much and the combined Wishlist pages not working, and asked for paths to a page for shows and a page for films: a
// person usually knows whether they want to continue a show, start one, or watch a film.
// Four pieces, each with its own variants, on one route:
//   /prototype/watching-2?surface=home|shows|films|wishlist
//     &home=doors|rail|nav            how the living room offers the paths, with no extra row
//     &shows=lead|switch|ranked       My shows: how continue and start relate
//     &films=hero|time|compare        My films: how a film for tonight is picked
//     &wishlist=behind|dissolved      whether the Wishlist stays a page
//     &member=six|one|many|none&mode=continue|start&chrome=off
// The pill (or the left and right arrow keys) switches the variant of the surface on screen. Sample data comes from
// TMDB through the loader (the key stays on the server); what each sample member watched is made up. Every action
// stays in React state. Nothing is written, and no mutation endpoint is called.
// Notes and screenshots: docs/prototypes/watching-2/README.md.
import { type LinksFunction, json } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData, useSearchParams } from "@remix-run/react"
import { useState } from "react"
import { getWatchingFixture2 } from "~/server/prototype-watching-2.server"
import livingRoomCss from "~/ui/living-room/living-room.css?url"
import { Toast } from "~/ui/prototype-watching/kit"
import { type MemberKey, useWatching } from "~/ui/prototype-watching/model"
import { Controls, SiteChrome } from "~/ui/prototype-watching-2/chrome"
import { FilmsPage } from "~/ui/prototype-watching-2/films"
import { HomeScreen, homeItems } from "~/ui/prototype-watching-2/home"
import { type Fixture2, type Go, SURFACES, type Surface, choiceOf, pickLine, picksOf } from "~/ui/prototype-watching-2/model"
import { Room, WellKey } from "~/ui/prototype-watching-2/room"
import { ShowsPage } from "~/ui/prototype-watching-2/shows"
import { WishlistPage } from "~/ui/prototype-watching-2/wishlist"

export async function loader() {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return json(await getWatchingFixture2())
}

export const links: LinksFunction = () => [{ rel: "stylesheet", href: livingRoomCss }]
export const meta = () => [{ title: "Watching prototype, round 2 · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]
export const shouldRevalidate: ShouldRevalidateFunction = () => false

const MEMBERS: MemberKey[] = ["six", "one", "many", "none"]

export default function WatchingPrototype2() {
	const fixture = useLoaderData<typeof loader>() as unknown as Fixture2
	const [params, setParams] = useSearchParams()
	const member = (MEMBERS.includes(params.get("member") as MemberKey) ? params.get("member") : "six") as MemberKey
	const [run, setRun] = useState(0)
	const set = (next: Record<string, string>) => {
		const p = new URLSearchParams(params)
		for (const [k, v] of Object.entries(next)) p.set(k, v)
		setParams(p, { replace: true, preventScrollReset: !("surface" in next) })
	}
	// A different sample member, or Reset, starts the in-memory state over.
	return <Page key={`${member}:${run}`} fixture={fixture} params={params} member={member} set={set} reset={() => setRun((n) => n + 1)} />
}

function Page({
	fixture,
	params,
	member,
	set,
	reset,
}: { fixture: Fixture2; params: URLSearchParams; member: MemberKey; set: (next: Record<string, string>) => void; reset: () => void }) {
	const store = useWatching(fixture, fixture.members[member])
	const { facts } = fixture
	const choice = choiceOf(params)
	const surface = ((params.get("surface") ?? "") in SURFACES ? params.get("surface") : "home") as Surface
	const mode = params.get("mode") === "start" ? "start" : "continue"
	const go: Go = (to, extra) => {
		set({ surface: to, ...extra })
		window.scrollTo({ top: 0 })
	}
	const nav = { store, facts, choice, surface, go }

	// The home's focus: the Remote's wheel moves it, OK opens it.
	const items = homeItems(store, facts, choice, go)
	const [focusId, setFocus] = useState("")
	const focus = items.find((i) => i.id === focusId) ?? items[0]
	const step = (by: 1 | -1) => setFocus(items[(items.indexOf(focus) + by + items.length) % items.length].id)
	const picks = picksOf(store, facts)
	const home = { store, facts, choice, go, focus: focus.id, setFocus }

	return (
		<>
			<SiteChrome {...nav} />
			{surface === "home" ? (
				<Room
					desktop={<HomeScreen {...home} />}
					phone={<HomeScreen {...home} phone />}
					lcd={focusId ? focus.lcd : ["TONIGHT", pickLine(picks.tonight)]}
					onStep={step}
					onOk={focus.open}
					well={
						choice.home === "nav" ? (
							<>
								<WellKey label="Shows" d="M4 6h16v11H4zM9 21h6M12 17v4" onClick={() => go("shows")} />
								<WellKey label="Films" d="M4 5h16v14H4zM8 5v14M16 5v14M4 9.5h4M4 14.5h4M16 9.5h4M16 14.5h4" onClick={() => go("films")} />
							</>
						) : undefined
					}
				/>
			) : surface === "shows" ? (
				<ShowsPage {...nav} mode={mode} setMode={(m) => set({ mode: m })} />
			) : surface === "films" ? (
				<FilmsPage {...nav} />
			) : (
				<WishlistPage {...nav} />
			)}
			<Toast store={store} />
			<Controls nav={nav} member={member} members={MEMBERS.map((key) => ({ key, label: fixture.members[key].label }))} set={set} reset={reset} hidden={params.get("chrome") === "off"} />
		</>
	)
}
