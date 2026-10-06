// PROTOTYPE - throwaway. Where do the shows a member is watching live? (#371, map #365)
// Three variants of home (the living room's member screen) and of the Wishlist area (today's /watch-next page):
//   /prototype/watching?variant=section|merged|view|mix&surface=home|wishlist&member=six|one|many|none&tab=watching|wishlist
//   section  A: Watching is its own section; Watch next stays a view of the Wishlist.
//   merged   B: Watch next includes Next episodes ahead of Wishlist titles; Tonight's pick can be an episode.
//   view     C: Watching is a view beside the Wishlist; home shows one Next episode line.
//   mix      D: the recommendation. A's section beside the Wishlist, C's line on home, and Tonight's pick can be
//               a Next episode while Watch next stays a view of the Wishlist.
// Sample data comes from TMDB through the loader (the key stays on the server); what each sample member watched is
// made up. Every action stays in React state. Nothing is written, and no mutation endpoint is called.
// Notes and screenshots: docs/prototypes/watching/README.md.
import { type LinksFunction, json } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData, useSearchParams } from "@remix-run/react"
import { useState } from "react"
import { getWatchingFixture } from "~/server/prototype-watching.server"
import livingRoomCss from "~/ui/living-room/living-room.css?url"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { type Go, HomeScreen } from "~/ui/prototype-watching/home"
import { StatePanel, Toast, TonightPreview, slotLine } from "~/ui/prototype-watching/kit"
import { type Fixture, type MemberKey, VARIANTS, type VariantKey, tonightsPick, useWatching } from "~/ui/prototype-watching/model"
import { Room } from "~/ui/prototype-watching/room"
import { WishlistArea } from "~/ui/prototype-watching/wishlist"

export async function loader() {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return json(await getWatchingFixture())
}

export const links: LinksFunction = () => [{ rel: "stylesheet", href: livingRoomCss }]
export const meta = () => [{ title: "Watching prototype · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]
export const shouldRevalidate: ShouldRevalidateFunction = () => false

const MEMBERS: MemberKey[] = ["six", "one", "many", "none"]

export default function WatchingPrototype() {
	const fixture = useLoaderData<typeof loader>() as unknown as Fixture
	const [params, setParams] = useSearchParams()
	const variant = ((params.get("variant") ?? "") in VARIANTS ? params.get("variant") : "section") as VariantKey
	const surface = params.get("surface") === "wishlist" ? "wishlist" : "home"
	const member = (MEMBERS.includes(params.get("member") as MemberKey) ? params.get("member") : "six") as MemberKey
	const tab = params.get("tab") === "wishlist" ? "wishlist" : "watching"
	const [run, setRun] = useState(0)
	const set = (next: Record<string, string>) => {
		const p = new URLSearchParams(params)
		for (const [k, v] of Object.entries(next)) p.set(k, v)
		setParams(p, { replace: true })
	}
	return (
		<Page
			// A different sample member, or Reset, starts the in-memory state over.
			key={`${member}:${run}`}
			fixture={fixture}
			variant={variant}
			surface={surface}
			member={member}
			tab={tab}
			set={set}
			reset={() => setRun((n) => n + 1)}
		/>
	)
}

function Page({
	fixture,
	variant,
	surface,
	member,
	tab,
	set,
	reset,
}: {
	fixture: Fixture
	variant: VariantKey
	surface: "home" | "wishlist"
	member: MemberKey
	tab: "wishlist" | "watching"
	set: (next: Record<string, string>) => void
	reset: () => void
}) {
	const store = useWatching(fixture, fixture.members[member])
	const [showState, setShowState] = useState(false)
	const go: Go = (to, toTab) => set(toTab ? { surface: to, tab: toTab } : { surface: to })
	const pick = tonightsPick(store, variant)
	const select = "h-9 cursor-pointer rounded-lg bg-white px-2 text-xs font-semibold text-black"
	return (
		<>
			{surface === "home" ? (
				<Room
					desktop={<HomeScreen store={store} variant={variant} go={go} />}
					phone={<HomeScreen store={store} variant={variant} go={go} phone />}
					lcd={["TONIGHT", pick ? slotLine(pick) : "Nothing yet"]}
				/>
			) : (
				<WishlistArea store={store} variant={variant} tab={tab} setTab={(t) => set({ tab: t })} />
			)}
			<Toast store={store} />

			{/* Prototype chrome: not part of any design. */}
			<div className="fixed inset-x-2 bottom-[4.75rem] z-[60] flex flex-wrap items-center gap-1.5 lg:inset-x-auto lg:bottom-4 lg:left-4" data-chrome>
				{showState && (
					<div className="absolute bottom-full left-0 mb-2">
						<StatePanel store={store} variant={variant} />
					</div>
				)}
				<TonightPreview store={store} variant={variant} />
				<select aria-label="Surface" value={surface} onChange={(e) => set({ surface: e.target.value })} className={select}>
					<option value="home">Home</option>
					<option value="wishlist">Wishlist area</option>
				</select>
				<select aria-label="Sample member" value={member} onChange={(e) => set({ member: e.target.value })} className={select}>
					{MEMBERS.map((m) => (
						<option key={m} value={m}>
							{fixture.members[m].label}
						</option>
					))}
				</select>
				<button type="button" onClick={() => setShowState((s) => !s)} className={`${select} ${showState ? "!bg-fuchsia-200" : ""}`} data-state-toggle>
					State
				</button>
				<button type="button" onClick={reset} className={select}>
					Reset
				</button>
			</div>
			<PrototypeSwitcher
				variants={VARIANTS}
				position="bottom-[10.5rem] left-1/2 -translate-x-1/2 scale-[0.8] whitespace-nowrap lg:bottom-4 lg:left-auto lg:right-4 lg:translate-x-0 lg:scale-100"
			/>
		</>
	)
}
