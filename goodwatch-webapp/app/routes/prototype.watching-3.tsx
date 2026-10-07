// PROTOTYPE - throwaway. Round 3 of "where do the shows a member is watching live?" (#371, map #365).
// The owner's verdict on round 2 (/prototype/watching-2): "home A. shows C (watched button is too invasive here, whole
// row should go to title page instead). films A (should be "movies" not films). wishlist A but i would like to see
// variants where it is possible to switch between the wishlist and what i watched already".
// Fixed here: home with the three doors, My shows as one list whose rows open the show, My movies as hero and tiers
// with "How long have you got?" in its strip. Open, as four variants: the Wishlist with a way to what the member has
// already watched.
//   /prototype/watching-3?surface=home|shows|movies|wishlist
//     &wishlist=switch|diary|library|page   the open piece
//     &side=want|seen|unrated               which half shows (C also: watching|onhold|dropped)
//     &seen=30|1500|0                       the sample member's Seen history
//     &member=six|one|many|none             the sample member's shows, as in round 2
//     &tick=on                              a quiet tick at the end of a row of the shows list
//     &chrome=off
// The pill (or the left and right arrow keys) switches the Wishlist variant. Sample titles come from TMDB through the
// loader (the key stays on the server); what the sample members watched, when, and their scores are made up. Every
// action stays in React state. Nothing is written, and no mutation endpoint is called.
// Notes and screenshots: docs/prototypes/watching-3/README.md.
import { type LinksFunction, json } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData, useSearchParams } from "@remix-run/react"
import { useMemo, useState } from "react"
import { getWatchingFixture3 } from "~/server/prototype-watching-3.server"
import livingRoomCss from "~/ui/living-room/living-room.css?url"
import { Toast } from "~/ui/prototype-watching/kit"
import { type MemberKey, useWatching } from "~/ui/prototype-watching/model"
import { pickLine, picksOf } from "~/ui/prototype-watching-2/model"
import { Room } from "~/ui/prototype-watching-2/room"
import { Controls, SiteChrome } from "~/ui/prototype-watching-3/chrome"
import { HomeScreen, homeItems } from "~/ui/prototype-watching-3/home"
import { type Fixture3, type Go, type Nav, SEEN_SIZES, SIDES, SURFACES, type SeenSize, type Side, type Surface, WISHLISTS, type WishlistKey, seenHistory, seenOf } from "~/ui/prototype-watching-3/model"
import { MoviesPage } from "~/ui/prototype-watching-3/movies"
import { RateBar } from "~/ui/prototype-watching-3/seen"
import { ShowsPage, TitleStub } from "~/ui/prototype-watching-3/shows"
import { WishlistPage } from "~/ui/prototype-watching-3/wishlist"

export async function loader() {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return json(await getWatchingFixture3())
}

export const links: LinksFunction = () => [{ rel: "stylesheet", href: livingRoomCss }]
export const meta = () => [{ title: "Watching prototype, round 3 · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]
export const shouldRevalidate: ShouldRevalidateFunction = () => false

const MEMBERS: MemberKey[] = ["six", "one", "many", "none"]

export default function WatchingPrototype3() {
	const fixture = useLoaderData<typeof loader>() as unknown as Fixture3
	const [params, setParams] = useSearchParams()
	const member = (MEMBERS.includes(params.get("member") as MemberKey) ? params.get("member") : "six") as MemberKey
	const seenSize = ((params.get("seen") ?? "") in SEEN_SIZES ? params.get("seen") : "30") as SeenSize
	const [run, setRun] = useState(0)
	// An empty value takes the parameter away.
	const set = (next: Record<string, string>) => {
		const p = new URLSearchParams(params)
		for (const [k, v] of Object.entries(next)) v === "" ? p.delete(k) : p.set(k, v)
		setParams(p, { replace: true, preventScrollReset: !("surface" in next) })
	}
	// A different sample member or Seen history, or Reset, starts the in-memory state over.
	return <Page key={`${member}:${seenSize}:${run}`} fixture={fixture} params={params} member={member} seenSize={seenSize} set={set} reset={() => setRun((n) => n + 1)} />
}

function Page({
	fixture,
	params,
	member,
	seenSize,
	set,
	reset,
}: { fixture: Fixture3; params: URLSearchParams; member: MemberKey; seenSize: SeenSize; set: (next: Record<string, string>) => void; reset: () => void }) {
	const store = useWatching(fixture, fixture.members[member])
	const { facts } = fixture
	const variant = ((params.get("wishlist") ?? "") in WISHLISTS ? params.get("wishlist") : "switch") as WishlistKey
	const asked = params.get("surface") ?? ""
	const surface = (asked === "title" || asked in SURFACES ? asked : "home") as Surface
	const rawSide = ((params.get("side") ?? "") in SIDES ? params.get("side") : "want") as Side
	// Only My library has a chip per show status; elsewhere those fall back to Seen.
	const side: Side = variant === "library" || rawSide === "want" || rawSide === "unrated" ? rawSide : "seen"
	const tick = params.get("tick") === "on"

	// What happens during the visit and is not in round 1's store: movies marked watched, scores, the open rating bar.
	const [finished, setFinished] = useState<string[]>([])
	const [ratings, setRatings] = useState<Record<string, number | null>>({})
	const [asking, setAsking] = useState<string | null>(null)
	const history = useMemo(() => seenHistory(fixture.pool, seenSize), [fixture.pool, seenSize])
	const { entries, titles } = store
	// Undo puts a movie back on the Wishlist; then it is not Seen. The store builds its Wishlist anew on every render, so the keys stand in for it.
	const wantedKeys = store.wishlist.map((t) => t.key).join("|")
	const seen = useMemo(() => {
		const wanted = new Set(wantedKeys.split("|"))
		return seenOf(
			history,
			entries,
			titles,
			finished.filter((key) => !wanted.has(key)),
			ratings,
		)
	}, [history, entries, titles, wantedKeys, finished, ratings])
	const finish = (key: string) => {
		store.finishTitle(key)
		setFinished((list) => [key, ...list.filter((k) => k !== key)])
	}

	const go: Go = (to, extra) => {
		set({ surface: to, at: "", show: "", ...extra })
		window.scrollTo({ top: 0 })
	}
	const nav: Nav = { store, facts, variant, surface, side, go, setSide: (next) => set({ side: next }), seen, askRate: (item) => setAsking(item.id), tick }

	// The home's focus: the Remote's wheel moves it, OK opens it.
	const items = homeItems(store, facts, go)
	const [focusId, setFocus] = useState("")
	const focus = items.find((i) => i.id === focusId) ?? items[0]
	const step = (by: 1 | -1) => setFocus(items[(items.indexOf(focus) + by + items.length) % items.length].id)
	const home = { store, facts, go, focus: focus.id, setFocus }

	return (
		<>
			<SiteChrome nav={nav} />
			{surface === "home" ? (
				<Room desktop={<HomeScreen {...home} />} phone={<HomeScreen {...home} phone />} lcd={focusId ? focus.lcd : ["TONIGHT", pickLine(picksOf(store, facts).tonight)]} onStep={step} onOk={focus.open} />
			) : surface === "shows" ? (
				<ShowsPage nav={nav} at={params.get("at")} />
			) : surface === "title" ? (
				<TitleStub nav={nav} showKey={params.get("show") ?? ""} />
			) : surface === "movies" ? (
				<MoviesPage nav={nav} finish={finish} />
			) : (
				<WishlistPage key={variant} nav={nav} />
			)}
			<RateBar item={seen.find((s) => s.id === asking) ?? null} rate={(id, score) => setRatings((r) => ({ ...r, [id]: score }))} close={() => setAsking(null)} />
			<Toast store={store} />
			<Controls nav={nav} member={member} members={MEMBERS.map((key) => ({ key, label: fixture.members[key].label }))} seenSize={seenSize} set={set} reset={reset} hidden={params.get("chrome") === "off"} />
		</>
	)
}
