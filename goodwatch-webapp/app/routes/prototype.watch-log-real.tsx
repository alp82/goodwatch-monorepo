// DEVELOPMENT HARNESS (issue #383), not a prototype of a design: the REAL title actions, poster card actions, watch
// log and Watch next dialog, mounted with a member who does not exist and a server that lives in this tab
// (ui/prototype-watch-log/harness-server.ts). It is how the movie watch log is driven in a headless browser without
// a signed-in session or a database. Start the dev server with REC_TRACKING=on to see the log, without it to see
// today's toggle.
//   /prototype/watch-log-real            a member
//   /prototype/watch-log-real?guest=1    a guest: Seen asks to sign in
//   &hero=693134|680|157336  also the REAL hero of the title page for that movie (Dune: Part Two, not seen;
//                            Pulp Fiction, Seen through its score; Interstellar, three watches), &providers=one|many|none
// A production build leaves the route out (PROTOTYPES in vite.config.js).
import { type ShouldRevalidateFunction, useSearchParams } from "@remix-run/react"
import { useQueryClient } from "@tanstack/react-query"
import { startTransition, useEffect, useMemo, useReducer, useState } from "react"
import { useFeature } from "~/hooks/useFeature"
import type { MovieResult } from "~/server/types/details-types"
import type { WatchNextTitle } from "~/server/watch-next.server"
import { BelowFoldProvider } from "~/ui/details/below-fold"
import DetailsHero from "~/ui/details/hero/DetailsHero"
import ListActions from "~/ui/details/hero/ListActions"
import OwnScore from "~/ui/details/hero/OwnScore"
import { type HeroProviders, heroParts, withMemberSettings } from "~/ui/prototype-episode-tracking/hero-fixture"
import { HARNESS_MEMBER, NEXT, SAMPLES, type Sample, createHarnessServer } from "~/ui/prototype-watch-log/harness-server"
import { TitleActionsFrame } from "~/ui/title-actions/TitleActionsFrame"
import { WatchLogHost } from "~/ui/watch-log/WatchLogHost"
import { FinishPrompt, FinishToast } from "~/ui/watch-next/FinishPrompt"
import { useFinish } from "~/ui/watch-next/useFinish"
import { AuthContext } from "~/utils/auth"
import { titleKey } from "~/utils/title-key"

export async function loader() {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return null
}

export const meta = () => [{ title: "Watch log harness · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]
export const shouldRevalidate: ShouldRevalidateFunction = () => false

const TMDB = "https://image.tmdb.org/t/p"
const media = (sample: Sample) => ({ mediaType: sample.mediaType, details: { tmdb_id: sample.tmdbId, title: sample.title } })
/** The backdrops of the movies the real hero can be shown for. */
const BACKDROPS: Record<number, string> = { 693134: "/eZ239CUp1d6OryZEBPnO2n87gMG.jpg", 680: "/suaEOtk1N1sgg2MTM7oZd2cfVp3.jpg", 157336: "/8sNiAPPYU14PUepFNeSNGUTiHW.jpg" }

export default function WatchLogHarness() {
	const [params] = useSearchParams()
	const guest = params.get("guest") === "1"
	const client = useQueryClient()
	const server = useMemo(createHarnessServer, [])
	const [, changed] = useReducer((n: number) => n + 1, 0)
	// The stand-in server takes the place of `fetch` before anything below asks for the member's data.
	const [ready, setReady] = useState(false)
	useEffect(() => {
		const remove = server.install(() => startTransition(changed))
		// The member's settings, over the stand-in server: Germany, and Netflix as their one service.
		const installed = window.fetch
		window.fetch = withMemberSettings(installed)
		// For a script that drives the page: what the stand-in holds, without waiting for the panel to draw it.
		;(window as unknown as { harnessServer: typeof server }).harnessServer = server
		// As a transition, so it does not interrupt the shell's hydration.
		startTransition(() => setReady(true))
		return () => {
			window.fetch = installed
			remove()
		}
	}, [server])
	// What a page such as Watch next listens to, to reload its list after a mark: a mutation that succeeded.
	const [marks, heard] = useReducer((n: number) => n + 1, 0)
	useEffect(
		() =>
			client.getMutationCache().subscribe((event) => {
				if (event.type === "updated" && event.action.type === "success") heard()
			}),
		[client],
	)
	const auth = useMemo(
		() => ({
			supabase: undefined,
			getSupabase: () => Promise.reject(new Error("The harness has no sign-in")),
			// biome-ignore lint/suspicious/noExplicitAny: a member who does not exist; only the id is read.
			user: guest ? null : ({ id: HARNESS_MEMBER } as any),
			loading: false,
		}),
		[guest],
	)
	if (!ready) return <p className="p-8 text-gray-400">Starting the watch log harness.</p>
	return (
		<AuthContext.Provider value={auth}>
			<div className="mx-auto max-w-7xl overflow-x-clip px-4 pb-64 pt-6 text-white sm:px-6 lg:px-8" data-harness>
				<h1 className="text-2xl font-bold">Movie watch log: the real components</h1>
				<p className="mt-1 max-w-3xl text-sm text-gray-400">
					Issue #383. The buttons, the log, the toast and the dialog are the app's own. The member and the server are stand-ins that live in this tab; nothing is
					saved anywhere. <FlagNote /> Marks the page heard of through the mutation cache: <b data-marks>{marks}</b>.
				</p>
				<RealHero />
				<div className="mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8">
					<div className="lg:sticky lg:top-24 lg:order-2">
						<ServerPanel
							server={server}
							onReset={() => {
								server.reset()
								// The logs this tab has read are of the samples before.
								client.removeQueries({ queryKey: ["watch-log"] })
								void client.invalidateQueries()
								changed()
							}}
						/>
					</div>
					<div className="min-w-0">
						<Section title="1. Title page: the action set">
							<div className="grid gap-4 md:grid-cols-2">
								{SAMPLES.map((sample) => (
									<div key={sample.tmdbId} className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10" data-hero={sample.tmdbId}>
										<h3 className="font-bold">{sample.title}</h3>
										<p className="mb-3 text-xs text-gray-400">{sample.starts}</p>
										{/* The hero's two parts for a movie: the score rectangle of its ratings, and the action row. */}
										<div className="mb-3 flex">
											<OwnScore media={media(sample)} />
										</div>
										<ListActions media={media(sample) as unknown as MovieResult} />
									</div>
								))}
							</div>
						</Section>
						<Section title="2. Poster cards: hover for the row of actions, or the more button on touch">
							<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
								{SAMPLES.map((sample) => (
									<TitleActionsFrame key={sample.tmdbId} media={media(sample)} className="w-full">
										<a href={`#card-${sample.tmdbId}`} className="block overflow-hidden rounded-lg bg-gray-800" data-card={sample.tmdbId}>
											<img src={`${TMDB}/w342${sample.poster}`} alt={sample.title} className="aspect-[2/3] w-full object-cover" />
										</a>
									</TitleActionsFrame>
								))}
							</div>
						</Section>
						<Section title="3. Watch next: I watched it">
							<WatchNext />
						</Section>
					</div>
				</div>
			</div>
			{/* Inside the stand-in member, so it answers in place of the app shell's host. */}
			<WatchLogHost />
		</AuthContext.Provider>
	)
}

function FlagNote() {
	const tracking = useFeature("tracking")
	return (
		<span data-flag={tracking ? "on" : "off"}>
			REC_TRACKING is <b>{tracking ? "on" : "off"}</b> for this dev server.
		</span>
	)
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<section className="mt-8">
			<h2 className="mb-3 text-lg font-bold">{title}</h2>
			{children}
		</section>
	)
}

function WatchNext() {
	const finishing = useFinish()
	const title = {
		key: titleKey("movie", NEXT.tmdbId),
		media_type: "movie",
		tmdb_id: NEXT.tmdbId,
		title: NEXT.title,
		poster_path: NEXT.poster,
	} as unknown as WatchNextTitle
	return (
		<div className="flex items-center gap-4 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
			<img src={`${TMDB}/w154${NEXT.poster}`} alt="" className="h-36 w-24 shrink-0 rounded-md object-cover" />
			<div>
				<h3 className="font-bold">{NEXT.title}</h3>
				<p className="mb-3 text-xs text-gray-400">{NEXT.starts}</p>
				<button type="button" onClick={() => finishing.finish(title)} className="h-11 cursor-pointer rounded-lg bg-green-500 px-4 text-sm font-bold text-black hover:bg-green-400" data-finish>
					I watched it
				</button>
			</div>
			<FinishPrompt finished={finishing.prompt} onClose={finishing.closePrompt} />
			<FinishToast toast={finishing.toast} data={null} onUndo={finishing.undo} onDismiss={finishing.dismissToast} />
		</div>
	)
}

function ServerPanel({ server, onReset }: { server: ReturnType<typeof createHarnessServer>; onReset: () => void }) {
	const [, redraw] = useReducer((n: number) => n + 1, 0)
	const state = server.state()
	return (
		<aside className="rounded-2xl bg-black/40 p-4 text-xs ring-1 ring-white/10">
			<h2 className="text-sm font-bold">The stand-in server</h2>
			<div className="mt-2 flex flex-wrap gap-2">
				<button type="button" onClick={onReset} className="h-8 cursor-pointer rounded-lg bg-white/10 px-3 font-semibold hover:bg-white/20" data-reset>
					Reset the samples
				</button>
				<label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3">
					<input
						type="checkbox"
						checked={server.controls.failNext}
						onChange={(event) => {
							server.controls.failNext = event.target.checked
							redraw()
						}}
						data-fail-next
					/>
					Fail the next log write
				</label>
				<label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3">
					<input
						type="checkbox"
						checked={server.controls.delay > 0}
						onChange={(event) => {
							server.controls.delay = event.target.checked ? 1500 : 0
							redraw()
						}}
						data-slow
					/>
					Answer after 1.5 s
				</label>
			</div>
			<h3 className="mt-3 font-bold text-gray-300">What it holds</h3>
			<pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap break-all text-[11px] leading-snug text-gray-400" data-server-state>
				{JSON.stringify(state)}
			</pre>
			<h3 className="mt-3 font-bold text-gray-300">Requests it answered ({server.requests.length})</h3>
			<ol className="mt-1 max-h-56 overflow-auto text-[11px] leading-snug text-gray-400" data-requests>
				{server.requests.slice(-12).map((request, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: a log that only grows.
					<li key={index} className="break-all">
						{request.status} {request.method} {request.url} {request.body ? JSON.stringify(request.body) : ""}
					</li>
				))}
			</ol>
		</aside>
	)
}

/** The real hero of the title page for one of the sample movies, as `?hero=` asks. */
function RealHero() {
	const [params] = useSearchParams()
	const sample = SAMPLES.find((s) => String(s.tmdbId) === params.get("hero") && s.mediaType === "movie")
	const asked = params.get("providers") ?? ""
	const providers = (["one", "many", "none"].includes(asked) ? asked : "one") as HeroProviders
	const movie = useMemo(() => {
		if (!sample) return null
		const parts = heroParts(providers, { poster_path: sample.poster, backdrop_path: BACKDROPS[sample.tmdbId] })
		return { mediaType: "movie", ...parts, details: { ...parts.details, tmdb_id: sample.tmdbId, title: sample.title } } as unknown as MovieResult
	}, [sample, providers])
	if (!movie || !sample) return null
	return (
		<BelowFoldProvider titleKey={`movie-${sample.tmdbId}`}>
			<div className="-mx-4 mt-4 sm:-mx-6 lg:-mx-8" data-real-hero>
				<DetailsHero media={movie} country="DE" sectionProps={{ overview: {} } as never} navigateToSection={() => {}} />
			</div>
		</BelowFoldProvider>
	)
}
