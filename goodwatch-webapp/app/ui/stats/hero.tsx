// The /stats hero: one giant total that sums across the catalog, and a roll control that swaps in another. The first
// paint is always the watching-time total, so the server's HTML matches; each roll draws from a shuffled bag, so every
// total comes up once before any repeats, and never the one on screen. A roll throws the pixel die (the
// stats/die-tumble effect, loaded on first use) and the number arrives on slot reels. Nothing moves the layout: the
// number, the sentence and the note each sit in a grid cell that holds every total's copy, all but the current one
// invisible, so the cell is as big as the biggest total at the current width.
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import type { StatsSnapshot } from "~/domain/stats/snapshot"
import { Kicker } from "~/ui/info-page"
import { DISPLAY, WRAP } from "~/ui/my-pages/style"
import { onFirstInteraction } from "~/utils/first-interaction"
import { seededRandomMixed } from "~/utils/random"
import { loadEffects } from "./effects/load"
import type { HostStage } from "./effects/stage"
import { MINUTES_PER_YEAR, SECONDS_PER_YEAR, big, count } from "./format"
import { B, reducedMotion } from "./parts"
import { DIE_PX, RollControl, RollNumber, RollStyles } from "./roll-control"

/** World population, mid-2025: about 8.2 billion (UN World Population Prospects 2024). */
const WORLD_POPULATION = 8.2e9
/** Life expectancy at birth, world, 2023: 73.3 years (UN World Population Prospects 2024). */
const LIFE_YEARS = 73.3
/**
 * A trailer's length, for the trailers total. The catalog has no trailer lengths, so the copy says "if each one runs
 * two and a half minutes": the most a theatrical trailer may run under the MPA's advertising rules.
 */
const TRAILER_MINUTES = 2.5

type Total = { id: string; n: string; line: string; note: ReactNode }

export function heroTotals(s: StatsSnapshot): Total[] {
	const c = s.catalog
	const allMinutes = c.movieMinutes + c.episodeMinutes
	const watchYears = allMinutes / MINUTES_PER_YEAR
	const crowd =
		s.sources.imdbMovieVotes +
		s.sources.imdbShowVotes +
		s.sources.letterboxdRatings +
		s.sources.tmdbVotes +
		s.sources.metacriticUserRatings
	const made = new Date(s.generatedAt)
	const startYear = Math.floor(
		made.getUTCFullYear() + made.getUTCMonth() / 12 - watchYears,
	)
	const topTrope = s.tropes.top[0]
	return [
		{
			id: "watch",
			n: `${Math.round(watchYears)} years`,
			line: "of watching: every movie and every episode on GoodWatch, back to back.",
			note: (
				<>
					<B>{count(c.movieMinutes)}</B> minutes of movies and{" "}
					<B>{count(c.episodeMinutes)}</B> minutes of episodes. Press play in{" "}
					<B>{startYear}</B>, never stop, and you would finish about now.
				</>
			),
		},
		{
			id: "ratings",
			n: count(crowd),
			line: "audience ratings stand behind the scores on GoodWatch.",
			note: (
				<>
					IMDb, Letterboxd, TMDB and Metacritic users, read for{" "}
					<B>{count(c.movies + c.shows)}</B> movies and shows.
				</>
			),
		},
		{
			id: "per-second",
			n: `${Math.round(crowd / SECONDS_PER_YEAR)} years`,
			line: "to count every audience rating behind our scores, one per second.",
			note: (
				<>
					<B>{big(crowd)}</B> ratings, with no sleep and no breaks.
				</>
			),
		},
		{
			id: "earth",
			n: `1 in ${Math.round(WORLD_POPULATION / crowd)}`,
			line: "people on Earth could each be handed one of the audience ratings behind our scores.",
			note: (
				<>
					<B>{big(crowd)}</B> ratings against a world population of about{" "}
					<B>{big(WORLD_POPULATION, 1)}</B>.
				</>
			),
		},
		{
			id: "lifetimes",
			n: `${(watchYears / LIFE_YEARS).toFixed(1)} lifetimes`,
			line: "of watching, from the first minute of the catalog to the last.",
			note: (
				<>
					<B>{Math.round(watchYears)}</B> years of movies and episodes, against
					a human life of about <B>{LIFE_YEARS}</B> years.
				</>
			),
		},
		{
			id: "nights",
			n: `${count(Math.round(allMinutes / 120 / 365))} years`,
			line: "of two-hour movie nights to see everything on GoodWatch.",
			note: (
				<>
					That's <B>{count(Math.round(allMinutes / 120))}</B> nights in a row,
					one every evening.
				</>
			),
		},
		{
			id: "credits",
			n: count(c.castCredits + c.crewCredits),
			line: `cast and crew credits connect ${count(c.people)} people to the screen.`,
			note: (
				<>
					<B>{count(c.castCredits)}</B> cast credits and{" "}
					<B>{count(c.crewCredits)}</B> crew credits, for{" "}
					<B>{count(c.characters)}</B> characters.
				</>
			),
		},
		{
			id: "pictures",
			n: count(c.posters + c.backdrops + c.logos),
			line: "pictures: posters, backdrops and logos for every corner of the catalog.",
			note: (
				<>
					<B>{count(c.posters)}</B> posters, <B>{count(c.backdrops)}</B>{" "}
					backdrops and <B>{count(c.logos)}</B> logos, plus{" "}
					<B>{count(c.characterPortraits)}</B> character portraits.
				</>
			),
		},
		{
			id: "offers",
			n: count(s.streaming.offers),
			line: `ways to watch: streaming, rental and purchase offers in ${s.streaming.countries} countries.`,
			note: (
				<>
					On <B>{count(s.streaming.services)}</B> services, for{" "}
					<B>{count(s.streaming.titles)}</B> titles.
				</>
			),
		},
		{
			id: "tropes",
			n: count(s.tropes.mentions),
			line: `trope mentions, from ${count(s.tropes.distinct)} different tropes.`,
			note: topTrope ? (
				<>
					{topTrope.name} alone turns up in <B>{count(topTrope.titles)}</B>{" "}
					titles.
				</>
			) : null,
		},
		{
			id: "episodes",
			n: count(c.episodes),
			line: `episodes, in ${count(c.seasons)} seasons of ${count(c.shows)} shows.`,
			note: (
				<>
					IMDb users have cast <B>{count(s.sources.imdbEpisodeVotes)}</B> votes
					on single episodes.
				</>
			),
		},
		{
			id: "trailers",
			n: `${count(Math.round((c.trailers * TRAILER_MINUTES) / 60 / 24))} days`,
			line: "of trailers, if each one runs two and a half minutes.",
			note: (
				<>
					<B>{count(c.trailers)}</B> trailers, back to back.
				</>
			),
		},
	]
}

const NUMBER = `${DISPLAY} text-[clamp(2.75rem,11vw,8.5rem)] leading-[0.9] text-amber-400 tabular-nums`
/** How long the thrown die is in the air before the button's die shows again (ms). */
const AIRBORNE_MS = 1010

/** Every total's copy in one grid cell; only `at` shows, the rest hold the cell's size. */
function Stack({
	totals,
	at,
	render,
	className = "",
}: {
	totals: Total[]
	at: number
	render: (k: number, current: boolean) => ReactNode
	className?: string
}) {
	return (
		<span className={`grid ${className}`}>
			{totals.map((x, k) => (
				<span
					key={x.id}
					aria-hidden={k !== at || undefined}
					className={`col-start-1 row-start-1 ${k === at ? "" : "invisible"}`}
				>
					{render(k, k === at)}
				</span>
			))}
		</span>
	)
}

export function Hero({ s, asOf }: { s: StatsSnapshot; asOf: string }) {
	const totals = useMemo(() => heroTotals(s), [s])
	const [at, setAt] = useState(0)
	const [rolls, setRolls] = useState(0)
	const [face, setFace] = useState(5)
	const [airborne, setAirborne] = useState(false)
	const bag = useRef<number[]>([])
	const host = useRef<HTMLElement>(null)
	const stage = useRef<HostStage | null>(null)
	const timer = useRef(0)
	const alive = useRef(true)

	const ensureStage = async () => {
		if (stage.current) return stage.current
		// reduced motion plays no effects, so it never fetches them
		if (reducedMotion()) return null
		const effects = await loadEffects()
		if (!alive.current || !host.current) return null
		stage.current ??= effects.createHostStage(host.current, DIE_PX, {
			pad: 96,
			maxLive: 16,
		})
		return stage.current
	}

	useEffect(() => {
		alive.current = true
		if (!reducedMotion()) onFirstInteraction(() => void ensureStage())
		return () => {
			alive.current = false
			window.clearTimeout(timer.current)
			stage.current?.destroy()
			stage.current = null
		}
	}, [])

	/** Host-local CSS px of the die on screen (the column card or the pill, whichever shows). */
	const dieSpot = () => {
		const h = host.current
		if (!h) return null
		const hr = h.getBoundingClientRect()
		for (const el of h.querySelectorAll<SVGElement>('[data-fx="die"]')) {
			const r = el.getBoundingClientRect()
			if (r.width) return { left: r.left - hr.left, top: r.top - hr.top }
		}
		return null
	}
	const snap = (v: number) => Math.round(v / DIE_PX) * DIE_PX

	const roll = () => {
		const random = (key: string) =>
			seededRandomMixed(`${Date.now()}|${rolls}|${key}`)
		if (!bag.current.length) {
			const others = totals.map((_, k) => k).filter((k) => k !== at)
			for (let i = others.length - 1; i > 0; i--) {
				const j = Math.floor(random(`bag${i}`) * (i + 1))
				;[others[i], others[j]] = [others[j], others[i]]
			}
			bag.current = others
		}
		const next = bag.current.pop() ?? 0
		const nextFace = 1 + Math.floor(random("face") * 6)
		setFace(nextFace)
		setAt(next)
		setRolls((n) => n + 1)
		if (reducedMotion()) return
		const seed = rolls + 3
		void ensureStage().then((st) => {
			const die = dieSpot()
			if (!st || !die) return
			st.clear()
			setAirborne(true)
			window.clearTimeout(timer.current)
			timer.current = window.setTimeout(() => setAirborne(false), AIRBORNE_MS)
			st.play(
				"stats/die-tumble",
				snap(die.left) + 8 * DIE_PX,
				snap(die.top) + 15 * DIE_PX,
				{
					x0: 0,
					y0: 0,
					peak: 26,
					turns: 5,
					spin: 1,
					hold: 0.05,
					face: nextFace,
					seed,
				},
			)
		})
	}

	const total = totals[at]
	const control = (compact: boolean) => (
		<RollControl
			face={face}
			hidden={airborne}
			compact={compact}
			onRoll={roll}
			onIntent={() => void ensureStage()}
		/>
	)
	return (
		<header
			ref={host}
			className={`${WRAP} relative flex flex-col gap-8 pt-12 pb-10 sm:pt-20 sm:pb-14`}
		>
			<RollStyles />
			<div className="flex min-h-6 items-center justify-between gap-4">
				<Kicker>GoodWatch in numbers · as of {asOf}</Kicker>
			</div>
			<div className="lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-10">
				<div className="flex flex-col gap-3">
					<div className="flex items-center gap-x-6">
						<h1 className="min-w-0">
							<span className="sr-only">
								{total.n} {total.line}
							</span>
							<span aria-hidden className={NUMBER}>
								<Stack
									totals={totals}
									at={at}
									render={(k, current) =>
										current ? (
											<RollNumber
												key={`${total.id}-${rolls}`}
												text={total.n}
												roll={rolls}
											/>
										) : (
											<RollNumber text={totals[k].n} roll={0} still />
										)
									}
								/>
							</span>
						</h1>
					</div>
					<Stack
						totals={totals}
						at={at}
						className="max-w-3xl text-2xl font-bold tracking-tight text-white sm:text-4xl"
						render={(k, current) => (
							<span
								aria-hidden
								key={current ? `line-${rolls}` : undefined}
								className={`block ${current && rolls ? "stats-swap" : ""}`}
							>
								{totals[k].line}
							</span>
						)}
					/>
				</div>
				<div className="hidden lg:block">{control(false)}</div>
			</div>
			<div className="flex items-center lg:hidden">{control(true)}</div>
			<div className="flex max-w-2xl flex-col gap-1 text-lg leading-relaxed text-gray-300">
				<Stack
					totals={totals}
					at={at}
					render={(k, current) => (
						<span
							key={current ? `note-${rolls}` : undefined}
							className={`block ${current && rolls ? "stats-swap" : ""}`}
						>
							{totals[k].note}
						</span>
					)}
				/>
				<p>Here is the rest of the story, in ten chapters.</p>
			</div>
			<p className="sr-only" aria-live="polite">
				{rolls ? `${total.n} ${total.line}` : ""}
			</p>
		</header>
	)
}
