// PROTOTYPE - throwaway. What should /taste show a member who just signed up and has rated nothing?
// Four takes on the real /taste route, switched by ?variant=now|A|B|C:
//   now  today's fresh-member page (tabs, "Your taste is from 0 ratings", "Rate a few more titles"), for comparison
//   A    Shelf: no tabs; pick titles you know from a poster wall, rate inline; your taste appears in place at 5 liked
//   B    Sample first: the real sample taste with a member banner, "Start rating" goes to the quiz
//   C    One at a time, on the page: the quiz's first step inline (best-known titles first); taste appears in place at 5
// Ratings live in memory only (reload = fresh member). The reveal is the real portrait API fed those in-memory ratings
// as guest progress, so view it signed out. The title list uses the recognition order (smart-titles.server.ts).
import { Link, useNavigate, useSearchParams } from "@remix-run/react"
import { type ReactNode, useEffect, useMemo, useState } from "react"
import type { Score } from "~/server/scores.server"
import type { SidesView } from "~/server/taste-portrait/view"
import type { ScoringMedia } from "~/ui/scoring/types"
import { openingSide } from "~/ui/taste/side-address"
import { SidesOfYou } from "~/ui/taste/tabs/SidesOfYou"
import { QUIZ_PATH, RatingDots } from "~/ui/taste-quiz/TasteQuizPage"
import { ScoreControl } from "~/ui/title-actions/ScoreControl"

export const FRESH_VARIANTS = ["now", "A", "B", "C"] as const
export type FreshVariant = (typeof FRESH_VARIANTS)[number]
const NAMES: Record<FreshVariant, string> = {
	now: "Today",
	A: "Shelf",
	B: "Sample first",
	C: "One at a time",
}
/** Liked titles (7+) before the taste shows. */
const GOAL = 5

export const freshVariant = (params: URLSearchParams): FreshVariant | null => {
	const v = params.get("variant")
	return (FRESH_VARIANTS as readonly string[]).includes(v ?? "")
		? (v as FreshVariant)
		: null
}

type Rated = { title: ScoringMedia; score: Score }
const key = (t: { media_type: string; tmdb_id: number }) =>
	`${t.media_type}-${t.tmdb_id}`
const poster = (path: string | undefined, size = "w342") =>
	path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined

const amber =
	"inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-linear-to-b from-amber-400 to-amber-600 px-5 font-black text-gray-950 hover:brightness-110 md:min-h-10"
const ghost =
	"inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-gray-700 px-5 font-semibold text-gray-200 hover:border-gray-500 md:min-h-10"

export function FreshTastePrototype({
	variant,
	shelf,
}: { variant: FreshVariant; shelf: ScoringMedia[] }) {
	const [rated, setRated] = useState<Rated[]>([])
	const [skipped, setSkipped] = useState<string[]>([])
	// A new variant starts a new member.
	useEffect(() => {
		setRated([])
		setSkipped([])
	}, [variant])
	const rate = (title: ScoringMedia, score: Score) =>
		setRated((r) => [...r.filter((x) => key(x.title) !== key(title)), { title, score }])
	const unrate = (title: ScoringMedia) =>
		setRated((r) => r.filter((x) => key(x.title) !== key(title)))
	const liked = rated.filter((r) => r.score >= 7).length
	const taste = usePortrait(rated, liked >= GOAL || variant === "B")

	return (
		<div className="pb-32 text-white">
			{variant === "now" && <Today />}
			{variant === "A" && (
				<Shelf shelf={shelf} rated={rated} liked={liked} rate={rate} unrate={unrate} taste={taste} />
			)}
			{variant === "B" && <SampleFirst taste={taste} />}
			{variant === "C" && (
				<OneAtATime
					shelf={shelf}
					rated={rated}
					skipped={skipped}
					liked={liked}
					rate={rate}
					skip={(t) => setSkipped((s) => [...s, key(t)])}
					undo={() => setRated((r) => r.slice(0, -1))}
					taste={taste}
				/>
			)}
			<Switcher variant={variant} rated={rated} liked={liked} skipped={skipped.length} />
		</div>
	)
}

// ------------------------------------------------------------- the real portrait, from in-memory ratings

function usePortrait(rated: Rated[], enabled: boolean) {
	const [view, setView] = useState<SidesView | null>(null)
	const body = useMemo(
		() =>
			JSON.stringify({
				guest: {
					interactions: rated.map((r) => ({
						tmdb_id: r.title.tmdb_id,
						media_type: r.title.media_type,
						type: "score",
						score: r.score,
						updatedAt: Date.now(),
					})),
					country: "DE",
					services: [],
				},
			}),
		[rated],
	)
	useEffect(() => {
		if (!enabled) return setView(null)
		let live = true
		fetch("/api/taste/portrait?tab=sides", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body,
		})
			.then((r) => r.json())
			.then((v) => live && setView(v as SidesView))
			.catch(() => {})
		return () => {
			live = false
		}
	}, [enabled, body])
	return view
}

function Reveal({ view, from }: { view: SidesView | null; from: number }) {
	if (!view)
		return <p className="mx-auto max-w-7xl animate-pulse px-4 py-10 text-gray-400 md:px-8">Finding what your titles share…</p>
	if (view.status !== "ready")
		return <p className="mx-auto max-w-7xl px-4 py-10 text-gray-400 md:px-8">Taste status: {view.status} (title snapshot not loaded on this server?)</p>
	return (
		<div>
			<div className="mx-auto max-w-7xl px-4 pt-8 md:px-8">
				<span className="rounded-full bg-emerald-400 px-2.5 py-0.5 text-xs font-black uppercase tracking-wide text-gray-950">
					Your taste
				</span>
				<span className="ml-3 text-sm text-gray-300">From {from} ratings. Every rating sharpens it.</span>
			</div>
			<SidesOfYou view={view} opening={openingSide(view.sides, null, view.openFirst)} />
		</div>
	)
}

// ------------------------------------------------------------- now: today's page for a member with 0 ratings

function Today() {
	return (
		<>
			<section aria-label="Rate more" className="border-b border-white/10 bg-gray-900/60">
				<div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 md:px-8">
					<p className="text-sm text-gray-300">Your taste is from 0 ratings. A few more and it gets sharper.</p>
					<Link to={QUIZ_PATH} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-linear-to-b from-amber-400 to-amber-600 px-5 text-sm font-black text-gray-950 md:min-h-9">
						Rate more →
					</Link>
				</div>
			</section>
			<div className="mx-auto flex max-w-7xl flex-col items-start gap-5 px-4 py-16 md:px-8">
				<p className="max-w-2xl text-lg text-gray-300">Rate a few more titles you love to see what they have in common.</p>
				<Link to={QUIZ_PATH} className="inline-flex min-h-11 items-center rounded-full bg-linear-to-b from-amber-400 to-amber-600 px-5 text-base font-black text-gray-950 md:min-h-9">
					Rate titles
				</Link>
			</div>
		</>
	)
}

// ------------------------------------------------------------- shared header

function Intro({ liked, right }: { liked: number; right?: ReactNode }) {
	const done = liked >= GOAL
	return (
		<div className="mx-auto max-w-7xl px-4 pt-8 md:px-8 md:pt-12">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div className="max-w-2xl">
					<div className="mb-1 text-xs font-bold uppercase tracking-wider text-amber-400/90">Your taste</div>
					<h1 className="text-2xl font-extrabold md:text-4xl">
						{done ? "Here's your taste." : liked === 0 ? "What have you loved watching?" : `${GOAL - liked} more you liked.`}
					</h1>
					<p className="mt-2 text-gray-300">
						{done
							? "Keep rating anything you've seen. It gets sharper."
							: `Rate ${GOAL} titles you liked. GoodWatch groups what they share and finds more like them.`}
					</p>
				</div>
				{right}
			</div>
			<div className="mt-4 flex items-center gap-3 text-sm text-gray-400">
				<RatingDots at={liked} of={GOAL} />
				{Math.min(liked, GOAL)} of {GOAL} liked
			</div>
		</div>
	)
}

// ------------------------------------------------------------- A: shelf

function Shelf({
	shelf,
	rated,
	liked,
	rate,
	unrate,
	taste,
}: {
	shelf: ScoringMedia[]
	rated: Rated[]
	liked: number
	rate: (t: ScoringMedia, s: Score) => void
	unrate: (t: ScoringMedia) => void
	taste: SidesView | null
}) {
	const [kind, setKind] = useState<"all" | "movie" | "show">("all")
	const [shown, setShown] = useState(18)
	const [open, setOpen] = useState<string | null>(null)
	const scoreOf = (t: ScoringMedia) => rated.find((r) => key(r.title) === key(t))?.score ?? null
	const list = shelf.filter((t) => kind === "all" || t.media_type === kind)
	const done = liked >= GOAL
	return (
		<>
			<Intro liked={liked} />
			{done && <Reveal view={taste} from={rated.length} />}
			<section className="mx-auto max-w-7xl px-4 pt-8 md:px-8">
				{done && <h2 className="mb-3 text-xl font-bold">Rate more</h2>}
				<div className="mb-4 flex gap-2" role="group" aria-label="Show">
					{(["all", "movie", "show"] as const).map((k) => (
						<button
							key={k}
							type="button"
							onClick={() => setKind(k)}
							className={`min-h-11 cursor-pointer rounded-full px-4 text-sm font-semibold md:min-h-9 ${kind === k ? "bg-white text-gray-950" : "bg-white/10 text-gray-200 hover:bg-white/15"}`}
						>
							{k === "all" ? "All" : k === "movie" ? "Movies" : "Shows"}
						</button>
					))}
				</div>
				<p className="mb-3 text-sm text-gray-400">Tap one you've seen. Skip the rest, there's no penalty.</p>
				<ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-6">
					{list.slice(0, shown).map((t) => {
						const s = scoreOf(t)
						const isOpen = open === key(t)
						return (
							<li key={key(t)} className={isOpen ? "col-span-3 sm:col-span-4 md:col-span-3" : ""}>
								<div className={isOpen ? "flex gap-3 rounded-xl bg-gray-900 p-3 ring-1 ring-amber-400/50" : ""}>
									<button
										type="button"
										onClick={() => setOpen(isOpen ? null : key(t))}
										className={`relative block shrink-0 cursor-pointer overflow-hidden rounded-lg ${isOpen ? "w-24" : "w-full"}`}
										aria-label={`${t.title}${s ? `, rated ${s}` : ""}`}
									>
										<img src={poster(t.poster_path)} alt="" className={`aspect-[2/3] w-full object-cover ${s ? "opacity-50" : ""}`} loading="lazy" />
										{s && (
											<span className="absolute inset-x-0 bottom-0 bg-gray-950/80 py-1 text-center text-sm font-black text-amber-300">
												{s >= 7 ? "♥ " : ""}{s}
											</span>
										)}
									</button>
									{isOpen && (
										<div className="min-w-0 flex-1">
											<div className="font-bold">{t.title}</div>
											<div className="mb-2 text-xs text-gray-400">{t.release_year} · {t.media_type === "movie" ? "Movie" : "Show"}</div>
											<ScoreControl
												size="compact"
												value={s}
												onRate={(v) => {
													rate(t, v)
													setOpen(null)
												}}
												onClear={s ? () => unrate(t) : undefined}
											/>
										</div>
									)}
								</div>
							</li>
						)
					})}
				</ul>
				{shown < list.length && (
					<div className="mt-6">
						<button type="button" className={ghost} onClick={() => setShown((n) => n + 18)}>
							Show more titles
						</button>
					</div>
				)}
			</section>
		</>
	)
}

// ------------------------------------------------------------- B: sample first

function SampleFirst({ taste }: { taste: SidesView | null }) {
	return (
		<>
			<section className="border-b border-amber-500/20 bg-amber-950/30">
				<div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-3 px-4 py-4 md:px-8">
					<div className="min-w-0 flex-1 basis-64">
						<span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-black uppercase tracking-wide text-gray-950">
							Welcome · sample taste
						</span>
						<p className="mt-1.5 text-sm text-amber-50/90 md:text-base">
							This is how Taste works, shown with someone else's ratings. Rate {GOAL} titles you liked and this page becomes yours.
						</p>
					</div>
					<Link to={QUIZ_PATH} className={amber}>Start rating →</Link>
				</div>
			</section>
			{taste ? (
				taste.status === "ready" ? (
					<SidesOfYou view={taste} opening={openingSide(taste.sides, null, taste.openFirst)} />
				) : (
					<p className="mx-auto max-w-7xl px-4 py-10 text-gray-400 md:px-8">Taste status: {taste.status}</p>
				)
			) : (
				<p className="mx-auto max-w-7xl animate-pulse px-4 py-10 text-gray-400 md:px-8">Loading the sample…</p>
			)}
		</>
	)
}

// ------------------------------------------------------------- C: one at a time, on the page

function OneAtATime({
	shelf,
	rated,
	skipped,
	liked,
	rate,
	skip,
	undo,
	taste,
}: {
	shelf: ScoringMedia[]
	rated: Rated[]
	skipped: string[]
	liked: number
	rate: (t: ScoringMedia, s: Score) => void
	skip: (t: ScoringMedia) => void
	undo: () => void
	taste: SidesView | null
}) {
	const seen = new Set([...rated.map((r) => key(r.title)), ...skipped])
	const x = shelf.find((t) => !seen.has(key(t)))
	const done = liked >= GOAL
	const [more, setMore] = useState(false)
	const card = x && (!done || more) && (
		<div className="mx-auto max-w-7xl px-4 pt-6 md:px-8">
			<div className="relative flex flex-col gap-5 overflow-hidden rounded-2xl bg-gray-900 p-4 ring-1 ring-white/10 sm:flex-row md:p-6">
				{x.backdrop_path && (
					<img src={poster(x.backdrop_path, "w1280")} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
				)}
				<img src={poster(x.poster_path)} alt="" className="relative w-32 shrink-0 self-start rounded-lg shadow-xl md:w-44" />
				<div className="relative min-w-0 flex-1">
					<div className="text-xs font-bold uppercase tracking-wider text-amber-400/90">Seen it? How was it?</div>
					<div className="mt-1 text-2xl font-extrabold md:text-3xl">{x.title}</div>
					<div className="mb-4 text-sm text-gray-300">{x.release_year} · {x.genres?.slice(0, 3).join(", ")}</div>
					<ScoreControl onRate={(v) => rate(x, v)} fit="screen" />
					<div className="mt-4 flex flex-wrap gap-3">
						<button type="button" className={ghost} onClick={() => skip(x)}>Haven't seen it</button>
						{rated.length > 0 && (
							<button type="button" className="min-h-11 cursor-pointer px-2 text-sm font-semibold text-gray-400 hover:text-gray-200" onClick={undo}>
								Undo last
							</button>
						)}
					</div>
				</div>
			</div>
			{rated.length > 0 && (
				<ul className="mt-3 flex gap-2 overflow-x-auto" aria-label="Rated so far">
					{rated.map((r) => (
						<li key={key(r.title)} className="relative w-12 shrink-0">
							<img src={poster(r.title.poster_path, "w92")} alt={r.title.title} className="rounded" />
							<span className="absolute inset-x-0 bottom-0 bg-gray-950/80 text-center text-[11px] font-black text-amber-300">{r.score}</span>
						</li>
					))}
				</ul>
			)}
		</div>
	)
	return (
		<>
			<Intro
				liked={liked}
				right={done && !more ? <button type="button" className={amber} onClick={() => setMore(true)}>Rate more</button> : undefined}
			/>
			{card}
			{done && <Reveal view={taste} from={rated.length} />}
		</>
	)
}

// ------------------------------------------------------------- prototype switcher

function Switcher({
	variant,
	rated,
	liked,
	skipped,
}: { variant: FreshVariant; rated: Rated[]; liked: number; skipped: number }) {
	const navigate = useNavigate()
	const [params] = useSearchParams()
	const i = FRESH_VARIANTS.indexOf(variant)
	const go = (d: number) => {
		const next = new URLSearchParams(params)
		next.set("variant", FRESH_VARIANTS[(i + d + FRESH_VARIANTS.length) % FRESH_VARIANTS.length])
		navigate(`?${next}`, { replace: true, preventScrollReset: true })
	}
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.target as HTMLElement | null)?.closest?.("input, textarea")) return
			if (e.key === "ArrowLeft") go(-1)
			if (e.key === "ArrowRight") go(1)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})
	return (
		<div className="fixed bottom-24 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/90 px-3 py-2 text-sm text-white shadow-2xl ring-1 ring-white/20 lg:bottom-6">
			<button type="button" className="cursor-pointer px-2" onClick={() => go(-1)} aria-label="Previous variant">←</button>
			<span className="font-bold whitespace-nowrap">
				{variant === "now" ? "Today" : variant}: {NAMES[variant]}
			</span>
			<span className="hidden text-xs text-gray-400 sm:inline">
				· {rated.length} rated, {liked} liked, {skipped} skipped
			</span>
			<button type="button" className="cursor-pointer px-2" onClick={() => go(1)} aria-label="Next variant">→</button>
		</div>
	)
}
