// HARNESS - development only (#384). The REAL episode tracking components of the show page (ui/tracking), mounted
// with a stand-in member and a stand-in server that lives in this browser tab, so every flow can be driven without
// a signed-in session, a database or TMDB. Start the dev server with REC_TRACKING=on.
//   /prototype/episode-tracking-real?show=supernatural|chernobyl|slow-horses|sherlock
//   optional: &scenario=fresh|watching|on_hold|dropped|all|seen_new|seen_old|seen_ticked|rated|wanted
//             &today=2026-10-08  &imdb=differs (IMDb numbers the first season differently)
//             &list=none (the show has no episode list yet)  &overviews=1 (send the fixtures' descriptions)
//             &latency=150 (milliseconds an answer takes)  &guest=1 (no member: the page as a visitor gets it)
//             &providers=one|many|none (how many services stream it, for the hero's where-to-watch block)
// The stand-in server (ui/prototype-episode-tracking/fake-server.ts) runs the real state machine and the real
// mapping to rows. Episodes are the prototypes' TMDB snapshots; TMDB's votes stand in for IMDb's ratings. Nothing is
// stored and nothing leaves the page. The route is not in a production build.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { Link, type ShouldRevalidateFunction, useLoaderData, useSearchParams } from "@remix-run/react"
import type { User } from "@supabase/supabase-js"
import { startTransition, useContext, useEffect, useMemo, useState } from "react"
import { useFeature } from "~/hooks/useFeature"
import type { ShowResult } from "~/server/types/details-types"
import { BelowFoldProvider } from "~/ui/details/below-fold"
import EpisodeGrid from "~/ui/details/episode-grid/EpisodeGrid"
import DetailsHero from "~/ui/details/hero/DetailsHero"
import { imdbGrid } from "~/ui/prototype-episode-list-2/shared"
import chernobyl from "~/ui/prototype-episode-list/fixtures/chernobyl.json"
import sherlock from "~/ui/prototype-episode-list/fixtures/sherlock.json"
import slowHorses from "~/ui/prototype-episode-list/fixtures/slow-horses.json"
import supernatural from "~/ui/prototype-episode-list/fixtures/supernatural.json"
import type { Show } from "~/ui/prototype-episode-list/model"
import { FakeServer, SCENARIOS, type Scenario } from "~/ui/prototype-episode-tracking/fake-server"
import { type HeroProviders, heroParts, withMemberSettings } from "~/ui/prototype-episode-tracking/hero-fixture"
import { TrackedEpisodes, useEpisodeTracking } from "~/ui/tracking/gate"
import { deviceClock } from "~/ui/tracking/store"
import { AuthContext } from "~/utils/auth"

const FIXTURES: Record<string, unknown> = { supernatural, chernobyl, "slow-horses": slowHorses, sherlock }
const SHOWS = {
	supernatural: "Supernatural: 15 seasons, ended",
	chernobyl: "Chernobyl: limited series",
	"slow-horses": "Slow Horses: a season airing weekly",
	sherlock: "Sherlock: short seasons and specials",
} as const
const TMDB = "https://image.tmdb.org/t/p"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	const params = new URL(request.url).searchParams
	const key = params.get("show") ?? ""
	const showKey = key in FIXTURES ? key : "supernatural"
	const asked = params.get("today") ?? ""
	const today = /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : new Date().toISOString().slice(0, 10)
	return json({ showKey, show: FIXTURES[showKey] as Show, today })
}

export const meta = () => [{ title: "Episode tracking, the real components · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]
export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) => currentUrl.search !== nextUrl.search

declare global {
	interface Window {
		/** For the scripted checks: the stand-in server of the page. */
		__gwHarness?: FakeServer
	}
}

const PILL = "rounded-full px-2.5 py-1 font-semibold"
let members = 0

export default function EpisodeTrackingHarness() {
	const { showKey, show, today } = useLoaderData<typeof loader>() as unknown as { showKey: keyof typeof SHOWS; show: Show; today: string }
	const [params] = useSearchParams()
	const key = params.toString()
	// The stand-in server replaces `fetch`, so the page renders in the browser only, and anew for every setup.
	const [mounted, setMounted] = useState("")
	// A transition, because the page around it may still be hydrating.
	useEffect(() => startTransition(() => setMounted(key)), [key])
	if (mounted !== key) return <p className="p-8 text-gray-400">Loading the harness…</p>
	return <Harness key={key} showKey={showKey} show={show} today={today} />
}

function Harness({ showKey, show, today }: { showKey: keyof typeof SHOWS; show: Show; today: string }) {
	const [params] = useSearchParams()
	const outer = useContext(AuthContext)
	const flag = useFeature("tracking")
	const asked = params.get("scenario") ?? ""
	const scenario = (asked in SCENARIOS ? asked : "fresh") as Scenario
	const guest = params.get("guest") === "1"
	const differs = params.get("imdb") === "differs"
	const noList = params.get("list") === "none"
	const grid = useMemo(() => imdbGrid(show, differs), [show, differs])
	const [ready, setReady] = useState(false)
	const [, refresh] = useState(0)

	const server = useMemo(
		() =>
			new FakeServer({
				show,
				grid,
				today,
				scenario,
				noList,
				overviews: params.get("overviews") === "1",
				latency: Number(params.get("latency") ?? 120) || 0,
			}),
		// One server per setup; the component is keyed by the setup.
		[],
	)
	useEffect(() => {
		const original = window.fetch
		const clock = { now: deviceClock.now }
		window.fetch = withMemberSettings(server.fetch(original.bind(window)))
		window.__gwHarness = server
		// The device's date is the harness's date.
		deviceClock.now = () => server.now()
		setReady(true)
		const timer = setInterval(() => refresh((n) => n + 1), 400)
		return () => {
			window.fetch = original
			deviceClock.now = clock.now
			window.__gwHarness = undefined
			clearInterval(timer)
		}
	}, [server])

	// A member of its own per setup, so that nothing cached for an earlier setup is read.
	const user = useMemo(() => (guest ? null : ({ id: `harness-member-${++members}`, email: "member@example.com" } as User)), [guest])
	const asProviders = params.get("providers") ?? ""
	const providers = (["one", "many", "none"].includes(asProviders) ? asProviders : "one") as HeroProviders
	const media = useMemo(() => {
		const parts = heroParts(providers, show)
		return {
			mediaType: "show",
			...parts,
			details: { ...parts.details, tmdb_id: show.id, title: show.name, in_production: !["Ended", "Canceled"].includes(show.status) },
		} as unknown as ShowResult
	}, [show, providers])
	const link = (change: Record<string, string | null>) => {
		const p = new URLSearchParams(params)
		for (const [name, value] of Object.entries(change)) value == null ? p.delete(name) : p.set(name, value)
		return `?${p}`
	}
	const stored = server.stored()
	const overlapping = overlaps(server)
	if (!ready) return <p className="p-8 text-gray-400">Loading the harness…</p>
	return (
		<AuthContext.Provider value={{ ...outer, user, loading: false }}>
			<div className="mx-auto max-w-7xl overflow-x-clip px-4 pb-40 pt-6 text-white sm:px-6 lg:px-8" data-harness>
				<details className="rounded-xl bg-white p-3 text-xs text-black ring-2 ring-fuchsia-500" data-harness-panel>
					<summary className="cursor-pointer text-sm font-bold">Harness: the real components, a stand-in member and server (not part of the page)</summary>
					{!flag && <p className="mt-2 rounded bg-red-100 p-2 font-bold text-red-700">REC_TRACKING is off: start the dev server with REC_TRACKING=on. The page below is what a member gets with the flag off.</p>}
					<div className="mt-2 flex flex-wrap gap-1.5">
						{Object.entries(SHOWS).map(([name, label]) => (
							<Link key={name} to={link({ show: name })} title={label} className={`${PILL} ${name === showKey ? "bg-black text-white" : "bg-neutral-200 hover:bg-neutral-300"}`}>
								{label.split(":")[0]}
							</Link>
						))}
					</div>
					<div className="mt-2 flex flex-wrap items-center gap-1.5">
						<span className="font-semibold">Start from:</span>
						{(Object.keys(SCENARIOS) as Scenario[]).map((name) => (
							<Link key={name} to={link({ scenario: name })} className={`${PILL} ${name === scenario ? "bg-black text-white" : "bg-neutral-200 hover:bg-neutral-300"}`}>
								{SCENARIOS[name]}
							</Link>
						))}
					</div>
					<div className="mt-2 flex flex-wrap items-center gap-1.5">
						<Link to={link({ list: noList ? null : "none" })} className={`${PILL} ${noList ? "bg-black text-white" : "bg-neutral-200"}`}>
							Episode list: {noList ? "none yet" : "there"}
						</Link>
						<Link to={link({ imdb: differs ? null : "differs" })} className={`${PILL} ${differs ? "bg-amber-300" : "bg-neutral-200"}`}>
							IMDb numbers season 1 differently: {differs ? "on" : "off"}
						</Link>
						<Link to={link({ guest: guest ? null : "1" })} className={`${PILL} ${guest ? "bg-black text-white" : "bg-neutral-200"}`}>
							Viewer: {guest ? "a visitor" : "a member"}
						</Link>
						<button
							type="button"
							data-fail-next
							onClick={() => {
								server.failNext = 500
							}}
							className={`${PILL} cursor-pointer bg-red-200 hover:bg-red-300`}
						>
							Fail the next tracking request
						</button>
						<span>today is {today}</span>
					</div>
					<div className="mt-2 rounded-lg bg-neutral-100 p-2 font-mono leading-relaxed" data-stored>
						<p>
							state: <b>{stored.state?.state ?? "no row"}</b> · pass: <b>{stored.state?.pass ?? 1}</b> · press: <b>{stored.state?.seen_press_group ? `from ${stored.state.seen_press_from}` : "none"}</b> · question:{" "}
							<b>{stored.state?.seen_question ?? "not asked"}</b> · rate prompt dismissed: <b>{String(stored.state?.rate_prompt_dismissed_at != null)}</b>
						</p>
						<p>
							log rows: <b>{stored.log.length}</b> · score: <b>{stored.score ?? "none"}</b> · want to see: <b>{String(stored.wantToSee)}</b> · not interested: <b>{String(stored.notInterested)}</b> · requests: <b>{server.requests.length}</b> · overlapping tracking requests:{" "}
							<b>{overlapping}</b>
						</p>
					</div>
				</details>

				{/* The real hero of the title page, and under it the real episodes section. The page's header, with the title, is not here. */}
				<BelowFoldProvider titleKey={`show-${show.id}`}>
					<h1 className="mb-1 mt-6 min-w-0 truncate text-xl font-bold text-white">
						{show.name} <span className="font-normal text-gray-400">({show.year})</span>
					</h1>
					<div className="-mx-4 sm:-mx-6 lg:-mx-8" data-hero>
						<DetailsHero media={media} country="DE" episodeGrid={grid.seasons.length ? grid : null} sectionProps={{ overview: {} } as never} navigateToSection={() => {}} />
					</div>
					<div className="mt-12 flex flex-col gap-12">
						<Episodes media={media} grid={grid.seasons.length ? <EpisodeGrid grid={grid} /> : null} />
						<div className="h-40 rounded-xl border border-dashed border-white/10 p-4 text-sm text-gray-500">The rest of the show page.</div>
					</div>
				</BelowFoldProvider>
			</div>
		</AuthContext.Provider>
	)
}

/** The episodes section as ui/details/DetailsContent.tsx renders it. */
function Episodes({ media, grid }: { media: ShowResult; grid: React.ReactNode }) {
	const tracking = useEpisodeTracking(media)
	if (!tracking) return grid ? <div>{grid}</div> : null
	return (
		<TrackedEpisodes media={media} wrapper={{}}>
			{grid}
		</TrackedEpisodes>
	)
}

/** How many requests to the tracking endpoint started while another POST to it was still unanswered. */
function overlaps(server: FakeServer): number {
	const posts = server.requests.filter((r) => r.path === "/api/tracking/show" && r.method === "POST")
	let count = 0
	for (let i = 1; i < posts.length; i++) {
		const before = posts[i - 1]
		if (before.endedAt === null || posts[i].startedAt < before.endedAt) count += 1
	}
	return count
}
