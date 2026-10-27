// PROTOTYPE (start page lab, round 2): what member c and d share: the deck of tonight candidates from Sam's own
// lists, the Watch button, and the slim search whose results take over a fixed box in place. Round 4: the deck
// follows what the member has, and FirstSteps stands in for the deck when there is nothing on any list yet.
import { ArrowRightIcon } from "@heroicons/react/20/solid"
import { PlayIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { type ReactNode, useEffect, useMemo, useState } from "react"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { EASE } from "~/ui/watch-next/style"
import { type FixtureAnswer, typedSearch } from "../../lab/fixture-search"
import { titleHref, tmdbImage } from "../../lab/kit"
import { type LabCard, type LabData, useLab } from "../../lab/types"
import { ReadingLine, SearchField, SeeAll, readingChips } from "../hero/shared"
import { type Member, type ShowCard, episodeLine, interleave, useMember } from "../member/shared"

export type Source = "continue" | "wishlist" | "forYou"

export const SOURCE_LABEL: Record<Source, string> = {
	continue: "Continue",
	wishlist: "Wishlist",
	forYou: "For you",
}

export type Candidate = {
	card: LabCard
	source: Source
	/** "Next episode", "On your Wishlist", "For you · 89% match". */
	why: string
	/** "S2 E1 · Last Chance for a Slow Dance" for a show with a next episode. */
	episode: string | null
	/** The wide picture: the backdrop when any list has one, else the poster (shows from My shows have no backdrop). */
	art: string
	artIsPoster: boolean
	service: { name: string; logo: string | null } | null
}

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" ? (v as Record<string, unknown>) : null)

/**
 * The deck: every title Sam could start tonight, best first. The ranking is deliberately simple:
 * 1. Today's Tonight pick (get_tonight) leads.
 * 2. Then the three lists take turns, one title each: Continue (shows with a next episode, in My shows' order,
 *    which is most recently watched first), Wishlist movies (highest taste match first), For you (movies and shows
 *    interleaved, in the order the server ranked them). Taking turns means every list shows up in the first few
 *    titles, so "Not this one" and the pairs move between kinds of evening, not down one list.
 * 3. Each title once (Loki is in Want to See and For you; the first list that reaches it wins).
 *
 * Round 4, members with less data: a list with no titles simply drops out of the turns, so the pairs only ever
 * draw on lists that have something (with one list left, "this or that" happens within it). While For you is
 * still forming (fewer than PERSONAL_AT ratings) its picks are guesses, so they wait until the member's own lists
 * (Continue, Wishlist) run out instead of taking turns with them. The owner's data (905 ratings) is unchanged.
 */
export function buildDeck(data: LabData, m: Member): Candidate[] {
	const backdrops = new Map<number, string>()
	for (const c of [...(data.member?.tonight ?? []), ...m.forYou, ...m.forYouShows, ...m.movies, ...m.continueShows])
		if (c.backdrop_path && !backdrops.has(c.key)) backdrops.set(c.key, tmdbImage(c.backdrop_path, "w1280"))
	// The Tonight pick's raw answer carries a backdrop the show lists don't.
	const raw = obj(data.member?.tonightRaw)
	const rawTitle = obj(obj(raw?.pick)?.title)
	const rawBackdrop = typeof rawTitle?.backdrop_url === "string" ? rawTitle.backdrop_url.replace("/w780/", "/w1280/") : null
	if (m.tonight && rawBackdrop && !backdrops.has(m.tonight.card.key)) backdrops.set(m.tonight.card.key, rawBackdrop)

	const make = (card: LabCard, source: Source): Candidate => {
		const episode = episodeLine((card as ShowCard).next)
		const bd = backdrops.get(card.key)
		const svc = card.services?.[0]
		const isTonight = m.tonight?.card.key === card.key
		return {
			card,
			source,
			why:
				source === "continue"
					? "Next episode"
					: source === "wishlist"
						? "On your Wishlist"
						: card.match
							? `For you · ${card.match}% match`
							: "For you",
			episode: isTonight ? (m.tonight?.episode ?? episode) : episode,
			art: bd ?? tmdbImage(card.poster_path, "w780"),
			artIsPoster: !bd,
			service: isTonight
				? (m.tonight?.service ?? null)
				: svc
					? { name: svc.name, logo: svc.logo_path ? `https://image.tmdb.org/t/p/w92${svc.logo_path}` : null }
					: null,
		}
	}

	const byMatch = (a: LabCard, b: LabCard) => (b.match ?? 0) - (a.match ?? 0)
	const forming = (data.member?.ratings ?? 0) < PERSONAL_AT
	const forYou = interleave(m.forYou, m.forYouShows)
	const lists: [Source, LabCard[]][] = [
		["continue", m.continueShows],
		["wishlist", [...m.movies].sort(byMatch)],
		["forYou", forming ? [] : forYou],
	]
	const out: Candidate[] = []
	const keys = new Set<number>()
	const add = (card: LabCard | undefined, source: Source) => {
		if (!card?.poster_path || keys.has(card.key)) return
		keys.add(card.key)
		out.push(make(card, source))
	}
	if (m.tonight) {
		const t = m.tonight.card
		const source = lists.find(([, l]) => l.some((c) => c.key === t.key))?.[0] ?? "continue"
		add(t, source)
	}
	const longest = Math.max(...lists.map(([, l]) => l.length))
	for (let i = 0; i < longest; i++) for (const [source, list] of lists) add(list[i], source)
	if (forming) for (const card of forYou) add(card, "forYou")
	return out
}

export function useDeck(): { m: Member; deck: Candidate[]; ratings: number } {
	const { data } = useLab()
	const m = useMember()
	// useMember reads only the fixtures, so the deck never changes after the first render.
	// biome-ignore lint/correctness/useExhaustiveDependencies: m derives from data
	const deck = useMemo(() => buildDeck(data, m), [data])
	return { m, deck, ratings: data.member?.ratings ?? 0 }
}

// ---------------------------------------------------------------------------------------------------------
// Members with little or no data (round 4)
// ---------------------------------------------------------------------------------------------------------

/** For you gets personal from this many ratings; below it, it is "still forming". */
export const PERSONAL_AT = 10

/** The real pages the empty states lead to. */
export const START_HREF = {
	taste: "/taste",
	imports: "/settings/imports",
	findShow: "/discover?type=show",
	discover: "/discover",
	forYou: "/for-you",
}

/** The For you page's own buttons (ForYouPage Unready): an amber pill, and a quiet ringed one. */
export const PILL =
	"inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-amber-400 px-5 text-sm font-black text-gray-950 hover:bg-amber-300 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
export const PILL_GHOST =
	"inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-semibold text-gray-200 ring-1 ring-inset ring-white/15 hover:bg-white/5 hover:text-white outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"

/**
 * What a brand new member sees where the deck would be: three first steps instead of an empty pair. Each step is
 * one big link (a phone row, a desktop column), so nothing here waits for data and the box keeps its size.
 */
export function FirstSteps({ ratings }: { ratings: number }) {
	const steps = [
		{
			n: 1,
			title: "Rate a few titles",
			line: `Tap the ones you've seen. Picks get personal at ${PERSONAL_AT} ratings.`,
			cta: "Start rating",
			href: START_HREF.taste,
			progress: true,
		},
		{
			n: 2,
			title: "Bring your ratings",
			line: "From IMDb, Letterboxd, Trakt, Plex and more.",
			cta: "Import",
			href: START_HREF.imports,
			progress: false,
		},
		{
			n: 3,
			title: "Find something",
			line: "Search by mood above, or browse Discover.",
			cta: "Open Discover",
			href: START_HREF.discover,
			progress: false,
		},
	]
	return (
		<div className="flex h-full flex-col pt-3">
			<div className="flex h-10 items-center">
				<h2 className="truncate text-base font-bold text-white lg:text-lg">Start here</h2>
			</div>
			<p className="text-sm text-gray-300">Three ways to get your first picks.</p>
			<ol className="mt-4 grid gap-3 sm:grid-cols-3 lg:gap-5">
				{steps.map((s) => (
					<li key={s.n} className="min-w-0">
						<Link
							to={s.href}
							prefetch="intent"
							className="group flex h-full items-center gap-3 rounded-2xl bg-gray-900/90 p-4 ring-1 ring-white/10 outline-none transition-colors hover:bg-gray-900 hover:ring-amber-400/50 focus-visible:ring-2 focus-visible:ring-amber-300 sm:flex-col sm:items-start sm:gap-2 sm:p-5 lg:p-6"
						>
							<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-sm font-black text-amber-300 ring-1 ring-amber-400/40 sm:mb-1">
								{s.n}
							</span>
							<span className="min-w-0 flex-1">
								<span className="block text-base font-bold text-white lg:text-lg">{s.title}</span>
								<span className="mt-0.5 block text-sm leading-snug text-gray-400">{s.line}</span>
								{s.progress ? <Progress have={ratings} className="mt-2.5 max-sm:hidden" /> : null}
							</span>
							<ArrowRightIcon aria-hidden className="h-5 w-5 shrink-0 text-amber-400 sm:hidden" />
							<span className={`${PILL} mt-3 max-sm:hidden sm:mt-auto`}>
								{s.cta}
								<ArrowRightIcon aria-hidden className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
							</span>
						</Link>
					</li>
				))}
			</ol>
		</div>
	)
}

/** "4 of 10 ratings" with a thin amber bar (a static width, nothing animates). */
export function Progress({ have, className = "" }: { have: number; className?: string }) {
	const n = Math.min(have, PERSONAL_AT)
	return (
		<span className={`block ${className}`}>
			<span className="block text-xs font-semibold tabular-nums text-amber-300">
				{n} of {PERSONAL_AT} ratings
			</span>
			<span className="mt-1 block h-1.5 w-full max-w-[12rem] overflow-hidden rounded-full bg-white/10" aria-hidden>
				<span className="block h-full rounded-full bg-amber-400" style={{ width: `${(n / PERSONAL_AT) * 100}%` }} />
			</span>
		</span>
	)
}

/** "2h 1m" for a movie, "24 min" for a show's episode. */
export const runtimeText = (card: LabCard) => {
	const r = card.runtime
	if (!r) return null
	if (card.media_type === "show") return `${r} min episodes`
	return r >= 60 ? `${Math.floor(r / 60)}h ${r % 60 ? `${r % 60}m` : ""}`.trim() : `${r} min`
}

/** The facts line: year, length, match, score. */
export const factsLine = (card: LabCard) =>
	[
		card.release_year,
		runtimeText(card),
		card.match ? `${card.match}% match` : null,
		card.goodwatch_overall_score_normalized_percent ? `Score ${Math.round(card.goodwatch_overall_score_normalized_percent)}` : null,
	]
		.filter(Boolean)
		.join(" · ")

/** The Watch next hero's main button (shared.tsx WatchButton), smaller on phones; to the title page. */
export function WatchLink({ c, className = "" }: { c: Candidate; className?: string }) {
	const s = c.service
	return (
		<Link
			to={titleHref(c.card)}
			className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-white pl-1.5 pr-4 text-sm font-bold text-black shadow-lg shadow-black/40 hover:bg-gray-200 lg:h-12 lg:gap-2.5 lg:pl-2 lg:pr-5 lg:text-base ${className}`}
		>
			{s?.logo ? <img src={s.logo} alt="" className="h-8 w-8 rounded-md" /> : null}
			<PlayIcon className={`h-5 w-5 ${s?.logo ? "" : "ml-2"}`} aria-hidden />
			<span className="truncate">{s ? `Watch on ${s.name}` : "Where to watch"}</span>
		</Link>
	)
}

export const GHOST =
	"inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-gray-100 ring-1 ring-inset ring-white/15 hover:bg-white/10 lg:h-12 lg:text-base"

// ---------------------------------------------------------------------------------------------------------
// Search: a slim field; a committed search takes over the box under it (same size), Clear gives the box back.
// ---------------------------------------------------------------------------------------------------------

/**
 * The field, then a fixed box: `children` while there's no search, the results while there is. Enter commits (a
 * typed search costs money on the site, so no search-as-you-type); the answer arrives with typedSearch's timing.
 */
export function SearchBox({ boxClass, children }: { boxClass: string; children: ReactNode }) {
	const { data } = useLab()
	const [text, setText] = useState("")
	const [q, setQ] = useState<string | null>(null)
	const [reading, setReading] = useState<unknown>(undefined)
	const [answer, setAnswer] = useState<FixtureAnswer | null>(null)

	useEffect(() => {
		if (!q) return
		const ac = new AbortController()
		setAnswer(null)
		setReading(undefined)
		typedSearch(data, q, { signal: ac.signal, onReading: setReading }).then((a) => {
			if (!ac.signal.aborted) setAnswer(a)
		})
		return () => ac.abort()
	}, [q, data])

	return (
		<>
			<SearchField
				size="small"
				value={text}
				onChange={setText}
				onSubmit={(v) => setQ(v.trim() || null)}
				onClear={() => setQ(null)}
				placeholder="Search by mood or anything"
			/>
			<div className={`relative ${boxClass}`}>
				<AnimatePresence initial={false}>
					<motion.div
						key={q ? `q:${q}` : "home"}
						className="absolute inset-0"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.25, ease: EASE }}
					>
						{q ? (
							<Results
								q={q}
								reading={reading}
								answer={answer}
								onBack={() => {
									setText("")
									setQ(null)
								}}
							/>
						) : (
							children
						)}
					</motion.div>
				</AnimatePresence>
			</div>
		</>
	)
}

/** Six on phones, eight on tablets, sixteen on desktop: always two rows, so the box never grows. */
const SLOT_VIS = (i: number) => (i >= 8 ? "hidden lg:block" : i >= 6 ? "hidden sm:block" : "")

function Results({ q, reading, answer, onBack }: { q: string; reading: unknown; answer: FixtureAnswer | null; onBack: () => void }) {
	const reduce = useReducedMotion()
	const early: FixtureAnswer = { q, answeredAs: q, kind: "prompt", reading, titles: [] }
	const hasChips = readingChips(answer?.reading ?? reading).length > 0
	return (
		<div className="flex h-full flex-col pt-3">
			<div className="flex h-10 min-w-0 items-center gap-2">
				<div className="min-w-0 flex-1">
					{answer && (hasChips || answer.kind === "mood") ? (
						<ReadingLine answer={answer} />
					) : hasChips ? (
						<ReadingLine answer={early} />
					) : (
						<p className="truncate text-sm text-gray-400">{answer ? `Results for “${q}”` : `Reading “${q}”…`}</p>
					)}
				</div>
				<SeeAll q={q} className="-mr-1" />
				<button type="button" onClick={onBack} className="h-9 shrink-0 cursor-pointer rounded-lg px-3 text-sm font-semibold text-gray-300 hover:bg-white/10 hover:text-white">
					Back
				</button>
			</div>
			<ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-8">
				{Array.from({ length: 16 }, (_, i) => {
					const card = answer?.titles[i]
					return (
						<li key={card ? card.key : `s${i}`} className={`min-w-0 ${SLOT_VIS(i)}`}>
							{card ? (
								<motion.div
									initial={reduce ? false : { opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.3, delay: Math.min(i, 11) * 0.03, ease: "easeOut" }}
								>
									<TitlePosterCard card={card} actions={false} />
								</motion.div>
							) : (
								<div className={`aspect-[2/3] rounded-lg border-2 border-gray-800 bg-gray-900 ${answer ? "" : "animate-pulse"}`} />
							)}
						</li>
					)
				})}
			</ul>
		</div>
	)
}
