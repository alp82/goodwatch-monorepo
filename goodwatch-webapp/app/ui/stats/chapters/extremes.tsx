// Chapter 4, extremes: records in pairs, one panel per pair, each with its holder and runners-up.
import { Link } from "@remix-run/react"
import type { StatsSnapshot, StatsTitle } from "~/domain/stats/snapshot"
import { PosterImg } from "~/ui/profile/parts"
import { money } from "~/ui/profile/taste/model"
import {
	count,
	episodeCode,
	episodeHref,
	episodeName,
	hoursMinutes,
	titleHref,
	titleKey,
} from "../format"
import { Chapter, PANEL } from "../parts"
import { Kicker } from "~/ui/eyebrow"

type RecordFact = {
	label: string
	value: string
	poster: string | null
	href: string
	name: string
	note?: string
	runners: { key: string; href: string; text: string }[]
	/** A pixel effect spot (effects/spots.ts) on the poster. */
	effect?: string
}

function RecordSide({ r }: { r: RecordFact }) {
	return (
		<div className="flex min-w-0 gap-4">
			<Link
				to={r.href}
				prefetch="intent"
				data-fx-spot={r.effect}
				className="block w-16 shrink-0 sm:w-20"
			>
				<PosterImg title={{ poster: r.poster }} className="rounded-md" />
			</Link>
			<div className="flex min-w-0 flex-col">
				<span className="text-[11px] font-bold tracking-wider text-gray-500 uppercase">
					{r.label}
				</span>
				<span className="text-3xl font-black text-white tabular-nums">{r.value}</span>
				<Link
					to={r.href}
					prefetch="intent"
					className="truncate text-sm font-semibold text-gray-200 hover:text-amber-300"
				>
					{r.name}
				</Link>
				{r.note && <span className="text-xs text-gray-500">{r.note}</span>}
				<ul className="mt-2 flex flex-col gap-0.5 text-xs text-gray-400">
					{r.runners.map((x) => (
						<li key={x.key} className="truncate">
							<Link to={x.href} prefetch="intent" className="hover:text-white">
								{x.text}
							</Link>
						</li>
					))}
				</ul>
			</div>
		</div>
	)
}

const runners = <T extends StatsTitle>(rows: T[], text: (t: T) => string) =>
	rows.slice(1, 4).map((t) => ({
		key: titleKey(t),
		href: titleHref(t),
		text: text(t),
	}))

export function Extremes({ s }: { s: StatsSnapshot }) {
	const r = s.records
	const ep = s.episodes
	const oldest = r.oldest[0]
	const longest = r.longest[0]
	const episodes = r.mostEpisodes[0]
	const voted = ep.mostVoted[0]
	const grossing = r.highestGrossing[0]
	const lowest = ep.lowestRated[0]
	const metaMovie = r.highestMetascoreMovies[0]
	const metaShow = r.highestMetascoreShows[0]
	const perfect = s.charts.metascoreSpread[10] ?? 0
	const episodeRunners = (rows: typeof ep.mostVoted, text: (e: (typeof rows)[number]) => string) =>
		rows.slice(1, 4).map((e) => ({
			key: `${e.showId}-${e.season}-${e.episode}`,
			href: episodeHref(e),
			text: text(e),
		}))
	const pairs: { theme: string; a: RecordFact; b: RecordFact }[] = [
		{
			theme: "Time",
			a: {
				label: "Oldest movie",
				effect: "ext-oldest",
				value: String(oldest.year),
				poster: oldest.poster,
				href: titleHref(oldest),
				name: oldest.title,
				runners: runners(r.oldest, (t) => `${t.year} · ${t.title}`),
			},
			b: {
				label: "Longest movie",
				effect: "ext-longest",
				value: hoursMinutes(longest.runtime),
				poster: longest.poster,
				href: titleHref(longest),
				name: longest.title,
				note: `${longest.year}, ${count(longest.runtime)} minutes`,
				runners: runners(r.longest, (t) => `${hoursMinutes(t.runtime)} · ${t.title}`),
			},
		},
		{
			theme: "Television",
			a: {
				label: "Most episodes",
				effect: "ext-episodes",
				value: count(episodes.episodes),
				poster: episodes.poster,
				href: titleHref(episodes),
				name: episodes.title,
				note: `${episodes.seasons} seasons since ${episodes.year}`,
				runners: runners(r.mostEpisodes, (t) => `${count(t.episodes)} · ${t.title}`),
			},
			b: {
				label: "Most-voted episode",
				effect: "ext-voted",
				value: count(voted.votes),
				poster: voted.poster,
				href: episodeHref(voted),
				name: episodeName(voted),
				note: `${voted.show} ${episodeCode(voted)} · IMDb ${voted.imdb}`,
				runners: episodeRunners(
					ep.mostVoted,
					(e) => `${count(e.votes)} · ${episodeName(e)} (${e.show})`,
				),
			},
		},
		{
			theme: "Highs and lows",
			a: {
				label: "Highest box office",
				effect: "ext-boxoffice",
				value: money(grossing.revenue),
				poster: grossing.poster,
				href: titleHref(grossing),
				name: grossing.title,
				note: grossing.budget ? `On a ${money(grossing.budget)} budget` : undefined,
				runners: runners(r.highestGrossing, (t) => `${money(t.revenue)} · ${t.title}`),
			},
			b: {
				label: "Lowest-rated well-known episode",
				effect: "ext-lowest",
				value: `${lowest.imdb}`,
				poster: lowest.poster,
				href: episodeHref(lowest),
				name: episodeName(lowest),
				note: `${lowest.show} ${episodeCode(lowest)} · ${count(lowest.votes)} votes`,
				// IMDb's placeholder names ("Episode #1.12") say nothing in a one-line list.
				runners: episodeRunners(
					[lowest, ...ep.lowestRated.slice(1).filter((e) => !e.name.startsWith("Episode #"))],
					(e) => `${e.imdb} · ${episodeName(e)} (${e.show})`,
				),
			},
		},
		{
			theme: "Critics",
			a: {
				label: "Highest Metascore · movies",
				effect: "ext-metascore",
				value: String(metaMovie.metascore),
				poster: metaMovie.poster,
				href: titleHref(metaMovie),
				name: metaMovie.title,
				note: `${metaMovie.year}, from ${metaMovie.criticReviews} critic reviews. ${count(perfect)} movies have a perfect 100.`,
				runners: runners(
					r.highestMetascoreMovies,
					(t) => `${t.metascore} · ${t.title} (${t.year})`,
				),
			},
			b: {
				label: "Highest Metascore · shows",
				value: String(metaShow.metascore),
				poster: metaShow.poster,
				href: titleHref(metaShow),
				name: metaShow.title,
				note: `${metaShow.year}, from ${metaShow.criticReviews} critic reviews`,
				runners: runners(r.highestMetascoreShows, (t) => `${t.metascore} · ${t.title}`),
			},
		},
	]
	return (
		<Chapter
			id="extremes"
			n={4}
			name="Extremes"
			lead="The oldest movie here is from"
			accent={`${oldest.year}.`}
			sub="Records from both ends of the catalog, two at a time."
		>
			<div className="flex flex-col gap-4">
				{pairs.map((p) => (
					<div key={p.theme} className={`${PANEL} p-4 sm:p-6`}>
						<Kicker className="mb-4">{p.theme}</Kicker>
						<div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-8">
							<RecordSide r={p.a} />
							<span aria-hidden className="hidden w-px bg-white/10 md:block" />
							<RecordSide r={p.b} />
						</div>
					</div>
				))}
			</div>
		</Chapter>
	)
}
