// Chapter 10, members: what members watch, score and save, all aggregate (app/server/stats/members.ts has the privacy
// rules: title rows need 10 or more members, averages 25 or more). The heading counts the time members logged; a tap
// on the line under it counts it another way. Then the time split, the most-seen titles, binges, members' highest
// rated, agreement ranges, members against IMDb, genres, decades and shared titles, the week and the day, the score
// spread, Wishlists, and how members brought their history in and where they are. A block whose list is empty is
// left out.
import { Link } from "@remix-run/react"
import { Fragment, useState } from "react"
import { genreColor } from "~/domain/genre-colors"
import type { MemberStats, ScoredTitle, StatsSnapshot } from "~/domain/stats/snapshot"
import imdbLogo from "~/img/imdb-logo-250.webp?no-inline"
import { PosterImg, SpreadBars, vibe } from "~/ui/profile/parts"
import { flag, pct } from "~/ui/profile/taste/model"
import { sectionPillClass } from "~/ui/profile/taste/parts"
import { assetUrl } from "~/utils/asset-url"
import { regionName } from "~/utils/display-names"
import { MINUTES_PER_YEAR, count, oneDecimal, titleHref, titleKey } from "../format"
import {
	B,
	Block,
	Chapter,
	FactTile,
	LABEL,
	PANEL,
	Poster,
	PosterLink,
	RankRows,
	RecountLine,
	titleRows,
} from "../parts"

/** Interstellar's runtime, for counting the watch time in Interstellars. */
const INTERSTELLAR_MINUTES = 169

const loggedOf = (m: MemberStats) => m.loggedMovieMinutes + m.loggedEpisodeMinutes

function LoggedRecount({ m, generatedAt }: { m: MemberStats; generatedAt: string }) {
	const minutes = loggedOf(m)
	const start = new Date(new Date(generatedAt).getTime() - minutes * 60_000).toLocaleDateString(
		"en-US",
		{
			month: "long",
			year: "numeric",
			timeZone: "UTC",
		},
	)
	return (
		<RecountLine
			effect="mem-logged"
			ways={[
				<Fragment key="hours">
					That's <B>{count(minutes / 60)}</B> hours of movies and episodes that members marked as
					watched.
				</Fragment>,
				<Fragment key="interstellar">
					Enough to watch Interstellar <B>{count(minutes / INTERSTELLAR_MINUTES)}</B> times in a
					row.
				</Fragment>,
				<Fragment key="screen">
					Switch on a screen in <b className="text-white">{start}</b>, never switch it off, and it
					would catch up about now.
				</Fragment>,
				<Fragment key="nights">
					Or <B>{count(minutes / 120)}</B> two-hour movie nights.
				</Fragment>,
			]}
		/>
	)
}

/** Where the hours went: the streaming chapter's country strip as a two-part split, beside fact tiles. */
function HoursSplit({ m }: { m: MemberStats }) {
	const episodes = Math.round(m.loggedEpisodeMinutes / 60)
	const movies = Math.round(m.loggedMovieMinutes / 60)
	const both = Math.max(1, episodes + movies)
	return (
		<div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
			<div className={`${PANEL} flex flex-col gap-4 p-4 sm:p-5`}>
				<p className="text-sm font-bold text-gray-200">Where the hours went</p>
				<div className="flex h-32 gap-1.5">
					<div
						className="flex min-w-0 flex-col justify-between rounded-lg bg-amber-400 p-3 text-gray-950"
						style={{ flex: `${episodes} 1 0` }}
					>
						<span className="truncate text-sm font-bold">Episodes</span>
						<span>
							<span className="block text-3xl font-black tabular-nums">{count(episodes)} h</span>
							<span className="text-xs font-bold">{pct(episodes / both)} of the time</span>
						</span>
					</div>
					<div
						className="flex min-w-16 flex-col justify-end rounded-lg bg-amber-400/15 p-2 text-amber-200 ring-1 ring-amber-400/20"
						style={{ flex: `${movies} 1 0` }}
					>
						<span className="text-xs font-bold">Movies</span>
						<span className="text-sm font-black tabular-nums">{count(movies)} h</span>
					</div>
				</div>
				<p className="text-sm text-gray-400">
					{episodes > movies * 2 ? "Shows win by a distance: one episode at a time adds up. " : ""}
					The average member who logs anything has logged{" "}
					<B>{count((episodes + movies) / Math.max(1, m.watchers))}</B> hours.
				</p>
			</div>
			<div className="grid grid-cols-2 gap-3">
				<FactTile label="Episode watches" value={count(m.episodeWatches)} />
				<FactTile label="Movie watches" value={count(m.movieWatches)} />
				<FactTile label="Different titles seen" value={count(m.seenTitles)} />
				<FactTile label="Scores given" value={count(m.scores.count)} />
			</div>
		</div>
	)
}

/** The most-seen title on a podium with its number, and the runners-up as poster cards. */
function MostSeen({ m }: { m: MemberStats }) {
	const [top, ...rest] = m.mostSeen
	if (!top) return null
	return (
		<Block
			title={`The ${top.type === "show" ? "show" : "movie"} members have seen most`}
			line="Members can mark a title as seen without scoring it. These have the most marks."
		>
			<div
				className={`${PANEL} grid gap-6 p-4 sm:p-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center`}
			>
				<div className="flex items-center gap-5">
					<PosterLink t={top} className="w-28 shrink-0 sm:w-36" />
					<div className="flex flex-col">
						<span
							data-fx-spot="mem-most-seen"
							className="text-6xl font-black text-amber-400 tabular-nums sm:text-7xl"
						>
							{top.members}
						</span>
						<span className="text-sm text-gray-300">members have seen</span>
						<Link
							to={titleHref(top)}
							prefetch="intent"
							className="text-xl font-bold text-white hover:text-amber-300"
						>
							{top.title}
						</Link>
						<span className="text-xs text-gray-500">{top.year}</span>
					</div>
				</div>
				<ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
					{rest.slice(0, 6).map((t, i) => (
						<li key={titleKey(t)}>
							<Poster t={t}>
								<span className="text-xs text-gray-400">
									<b className="text-gray-600 tabular-nums">{i + 2}</b> · {t.members} members
								</span>
							</Poster>
						</li>
					))}
				</ul>
			</div>
		</Block>
	)
}

/** Binges as ranked rows, counted in total or per member, beside members' highest rated. */
function Binges({ m }: { m: MemberStats }) {
	const [perMember, setPerMember] = useState(false)
	const rows = m.mostBinged
		.map((t) => ({
			t,
			n: perMember ? Math.round(t.episodeWatches / t.members) : t.episodeWatches,
		}))
		.sort((a, b) => b.n - a.n)
	const leader = rows[0]
	if (!leader && !m.highestRated.length) return null
	return (
		<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
			{leader && (
				<div className="flex flex-col gap-3">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<p className="text-sm font-bold text-gray-200">Most binged shows</p>
						<div
							className="flex gap-1.5"
							// biome-ignore lint/a11y/useSemanticElements: buttons in a row, not a form's fieldset
							role="group"
							aria-label="Count"
							data-fx-replay="mem-binged"
						>
							<button
								type="button"
								aria-pressed={!perMember}
								onClick={() => setPerMember(false)}
								className={sectionPillClass(!perMember)}
							>
								All episodes
							</button>
							<button
								type="button"
								aria-pressed={perMember}
								onClick={() => setPerMember(true)}
								className={sectionPillClass(perMember)}
							>
								Per member
							</button>
						</div>
					</div>
					<div data-fx-spot="mem-binged">
						<RankRows
							heading={perMember ? "Episode watches per member" : "Episode watches"}
							rows={rows.map(({ t, n }) => ({
								key: titleKey(t),
								href: titleHref(t),
								poster: t.poster,
								name: t.title,
								value: count(n),
							}))}
						/>
					</div>
					<p className="text-sm text-gray-400" aria-live="polite">
						{perMember ? (
							<>
								Each member who watches {leader.t.title} has logged <B>{count(leader.n)}</B>{" "}
								episodes of it, on average.
							</>
						) : (
							<>
								<B>{count(leader.n)}</B> episodes of {leader.t.title}, logged by {leader.t.members}{" "}
								members.
							</>
						)}
					</p>
				</div>
			)}
			{m.highestRated.length > 0 && (
				<div className={`${PANEL} p-4 sm:p-5`}>
					<p className="mb-3 text-sm font-bold text-gray-200">Members' highest rated</p>
					<ul className="grid grid-cols-3 gap-2.5">
						{m.highestRated.map((t) => (
							<li key={titleKey(t)}>
								<Poster t={t}>
									<span className="flex items-baseline gap-1.5 text-xs text-gray-400">
										<b
											className="text-base font-black tabular-nums"
											style={{ color: vibe(t.average) }}
										>
											{oneDecimal(t.average)}
										</b>
										from {t.members}
									</span>
								</Poster>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	)
}

type Ranged = ScoredTitle & { spread: number }

/** A title's average as a dot on a 1 to 10 track, with a bar one standard deviation each way. */
function RangeRow({ t }: { t: Ranged }) {
	const at = (x: number) => `${((Math.min(10, Math.max(1, x)) - 1) / 9) * 100}%`
	const lo = Math.max(1, t.average - t.spread)
	const hi = Math.min(10, t.average + t.spread)
	return (
		<li data-spread={t.spread.toFixed(3)} className="flex items-center gap-3 py-2">
			<PosterLink t={t} className="w-8 shrink-0" />
			<div className="flex min-w-0 flex-1 flex-col gap-1.5">
				<div className="flex items-baseline justify-between gap-2">
					<Link
						to={titleHref(t)}
						prefetch="intent"
						className="truncate text-sm font-semibold text-gray-200 hover:text-white"
					>
						{t.title}
					</Link>
					<span className="shrink-0 text-xs text-gray-500 tabular-nums">
						<b className="text-white">{oneDecimal(t.average)}</b> ± {oneDecimal(t.spread)}
					</span>
				</div>
				<div className="relative h-3" aria-hidden>
					<span className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
					<span
						data-range-bar
						className="stats-grow absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/25"
						style={{ left: at(lo), width: `${((hi - lo) / 9) * 100}%` }}
					/>
					<span
						data-range-dot
						className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-gray-900"
						style={{ left: at(t.average), background: vibe(t.average) }}
					/>
				</div>
			</div>
		</li>
	)
}

function Agreement({ m }: { m: MemberStats }) {
	const agreed = m.agreed[0]
	const split = m.split[0]
	if (!agreed || !split) return null
	return (
		<Block
			title="Where members agree, and where they split"
			line={
				<>
					{agreed.title} gets {oneDecimal(agreed.average)} give or take {oneDecimal(agreed.spread)}.{" "}
					{split.title} gets {oneDecimal(split.average)} give or take {oneDecimal(split.spread)}:
					some members love it, others score it low.
				</>
			}
		>
			<div className="grid gap-4 lg:grid-cols-2">
				{[
					{ head: "Members agree", rows: m.agreed, effect: "agree" },
					{ head: "Members split", rows: m.split, effect: "split" },
				].map((g) => (
					<div key={g.head} className={`${PANEL} p-4`}>
						<p className={`${LABEL} mb-1`}>{g.head}</p>
						<ol data-fx-range={g.effect} className="flex flex-col divide-y divide-white/5">
							{g.rows.map((t) => (
								<RangeRow key={titleKey(t)} t={t} />
							))}
						</ol>
						<div
							className="mt-1 flex justify-between pl-11 text-[10px] font-bold text-gray-600 tabular-nums"
							aria-hidden
						>
							<span>1</span>
							<span>5</span>
							<span>10</span>
						</div>
					</div>
				))}
			</div>
			<p className="text-xs text-gray-500">
				The dot is the members' average. The bar reaches one standard deviation to each side, where
				most scores fall.
			</p>
		</Block>
	)
}

type Versus = ScoredTitle & { imdb: number }

/** A dumbbell per title on a 5 to 10 track: IMDb in gray, members in amber. */
function Dumbbell({ t }: { t: Versus }) {
	const at = (x: number) => `${((Math.min(10, Math.max(5, x)) - 5) / 5) * 100}%`
	const lo = Math.min(t.average, t.imdb)
	const hi = Math.max(t.average, t.imdb)
	const gap = t.average - t.imdb
	return (
		<li className="flex items-center gap-3 py-2">
			<PosterLink t={t} className="w-8 shrink-0" />
			<div className="flex min-w-0 flex-1 flex-col gap-1.5">
				<div className="flex items-baseline justify-between gap-2">
					<Link
						to={titleHref(t)}
						prefetch="intent"
						className="truncate text-sm font-semibold text-gray-200 hover:text-white"
					>
						{t.title}
					</Link>
					<span className="shrink-0 text-xs text-gray-500 tabular-nums">
						<b className="text-amber-300">{oneDecimal(t.average)}</b> vs{" "}
						<b className="text-gray-200">{oneDecimal(t.imdb)}</b>{" "}
						<span className={gap < 0 ? "text-gray-400" : "text-amber-300/80"}>
							({gap > 0 ? "+" : "−"}
							{oneDecimal(Math.abs(gap))})
						</span>
					</span>
				</div>
				<div className="relative h-3" aria-hidden>
					<span className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
					<span
						className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-white/30"
						style={{ left: at(lo), width: `${((hi - lo) / 5) * 100}%` }}
					/>
					<span
						className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gray-300"
						style={{ left: at(t.imdb) }}
					/>
					<span
						className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400 ring-2 ring-gray-900"
						style={{ left: at(t.average) }}
					/>
				</div>
			</div>
		</li>
	)
}

function VersusImdb({ m }: { m: MemberStats }) {
	const worst = m.belowImdb[0]
	if (!worst || !m.aboveImdb.length) return null
	const mostly = (rows: Versus[], type: "movie" | "show") =>
		rows.filter((t) => t.type === type).length > rows.length / 2
	const lean = mostly(m.belowImdb, "show") && mostly(m.aboveImdb, "movie")
	return (
		<Block
			title="Members against IMDb"
			line={
				lean ? (
					<>
						Members are tougher on long-running shows: {worst.title} gets{" "}
						{oneDecimal(worst.average)} here and {oneDecimal(worst.imdb)} on IMDb. On movies, they
						lean the other way.
					</>
				) : (
					<>
						{worst.title} gets {oneDecimal(worst.average)} here and {oneDecimal(worst.imdb)} on
						IMDb, the widest gap below.
					</>
				)
			}
			right={
				<span className="flex items-center gap-4 text-xs text-gray-400">
					<span className="flex items-center gap-1.5">
						<span className="size-3 rounded-full bg-amber-400" />
						Members
					</span>
					<span className="flex items-center gap-1.5">
						<span className="size-2.5 rounded-full bg-gray-300" />
						<img src={assetUrl(imdbLogo)} alt="IMDb" className="h-3.5 rounded-[2px]" />
					</span>
				</span>
			}
		>
			<div className="grid gap-4 lg:grid-cols-2">
				{[
					{ head: "Lower than IMDb", rows: m.belowImdb },
					{ head: "Higher than IMDb", rows: m.aboveImdb },
				].map((g) => (
					<div key={g.head} className={`${PANEL} p-4`}>
						<p className={`${LABEL} mb-1`}>{g.head}</p>
						<ol className="flex flex-col divide-y divide-white/5">
							{g.rows.map((t) => (
								<Dumbbell key={titleKey(t)} t={t} />
							))}
						</ol>
						<div
							className="mt-1 flex justify-between pl-11 text-[10px] font-bold text-gray-600 tabular-nums"
							aria-hidden
						>
							<span>5</span>
							<span>7.5</span>
							<span>10</span>
						</div>
					</div>
				))}
			</div>
		</Block>
	)
}

/** A dot per genre on a shared track, in the genre's color; tap a genre for its counts. */
function GenreLove({ m }: { m: MemberStats }) {
	const genres = m.genres
	const [picked, setPicked] = useState(genres[0]?.genre ?? "")
	if (!genres.length) return null
	const row = genres.find((x) => x.genre === picked) ?? genres[0]
	const last = genres[genres.length - 1]
	// The track runs from 6.5 to 8, wider in half points when an average falls outside.
	const min = Math.min(6.5, Math.floor(Math.min(...genres.map((g) => g.average)) * 2) / 2)
	const max = Math.max(8, Math.ceil(Math.max(...genres.map((g) => g.average)) * 2) / 2)
	const at = (x: number) => `${((x - min) / (max - min)) * 100}%`
	return (
		<Block
			title={`${genres[0].genre} movies and shows score highest with members`}
			line={`${genres[0].genre} averages ${oneDecimal(genres[0].average)}. ${last.genre} comes last, at ${oneDecimal(last.average)}.`}
		>
			<div className={`${PANEL} p-4 sm:p-5`}>
				<p className="mb-3 text-sm text-gray-400" aria-live="polite">
					<b className="text-white">{row.genre}</b>:{" "}
					<b className="text-amber-300 tabular-nums">{oneDecimal(row.average)}</b> on average, from{" "}
					{count(row.scores)} scores by {row.members} members.
				</p>
				<ol className="grid gap-x-8 lg:grid-cols-2">
					{genres.map((x, i) => {
						const on = x.genre === picked
						return (
							<li key={x.genre}>
								<button
									type="button"
									onClick={() => setPicked(x.genre)}
									aria-pressed={on}
									className="group flex w-full cursor-pointer items-center gap-3 rounded-md py-1.5 text-left focus-visible:outline-2 focus-visible:outline-amber-400"
								>
									<span className="w-5 text-xs font-black text-gray-600 tabular-nums">{i + 1}</span>
									<span
										className={`w-28 shrink-0 truncate text-sm font-semibold ${on ? "text-white" : "text-gray-300 group-hover:text-white"}`}
									>
										{x.genre}
									</span>
									<span className="relative h-4 min-w-0 flex-1" aria-hidden>
										<span className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
										<span
											className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform ${on ? "size-4 ring-2 ring-white" : "size-3"}`}
											style={{
												left: at(x.average),
												background: genreColor(x.genre),
											}}
										/>
									</span>
									<span className="w-8 text-right text-xs font-bold text-gray-400 tabular-nums">
										{oneDecimal(x.average)}
									</span>
								</button>
							</li>
						)
					})}
				</ol>
				<p className="mt-2 text-[11px] text-gray-500">
					Average member score per genre, on a track from {min} to {max}. A title counts for each of
					its genres.
				</p>
			</div>
		</Block>
	)
}

type Bar = { key: string; label: string; n: number; aria: string }

/** Tap-to-read bars, as the catalog chapter's decades. */
function PickBars({
	bars,
	picked,
	onPick,
	labelEvery = 1,
}: {
	bars: Bar[]
	picked: string
	onPick: (key: string) => void
	labelEvery?: number
}) {
	const most = Math.max(1, ...bars.map((b) => b.n))
	return (
		<div
			className="flex h-40 items-stretch gap-0.5 sm:gap-1"
			// biome-ignore lint/a11y/useSemanticElements: buttons in a row, not a form's fieldset
			role="group"
		>
			{bars.map((b, i) => {
				const on = b.key === picked
				return (
					<button
						key={b.key}
						type="button"
						onClick={() => onPick(b.key)}
						aria-pressed={on}
						aria-label={b.aria}
						className="group flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-end gap-1 rounded-md focus-visible:outline-2 focus-visible:outline-amber-400"
					>
						<span
							className={`block w-full rounded-t-md transition-colors ${on ? "bg-amber-400" : "bg-gray-500/60 group-hover:bg-gray-400/70"}`}
							style={{ height: `${Math.max(3, (b.n / most) * 85)}%` }}
						/>
						<span
							className={`text-[10px] font-bold tabular-nums ${on ? "text-white" : "text-gray-500"} ${i % labelEvery ? "invisible" : ""}`}
						>
							{b.label}
						</span>
					</button>
				)
			})}
		</div>
	)
}

function PosterStrip({ label, titles }: { label: string; titles: MemberStats["oldestShared"] }) {
	return (
		<div className={`${PANEL} p-4`}>
			<p className={`${LABEL} mb-3`}>{label}</p>
			<ul className="grid grid-cols-5 gap-2">
				{titles.map((t) => (
					<li key={titleKey(t)} className="min-w-0">
						<Link
							to={titleHref(t)}
							prefetch="intent"
							className="group block"
							title={`${t.title}: ${t.members} members`}
						>
							<PosterImg title={{ poster: t.poster }} className="rounded-sm" />
							<span className="mt-1 block text-[11px] font-black text-amber-300 tabular-nums">
								{t.year}
							</span>
							<span className="block truncate text-[11px] font-bold text-gray-300 group-hover:text-white">
								{t.title}
							</span>
						</Link>
					</li>
				))}
			</ul>
		</div>
	)
}

/** The decade bars, then the oldest and newest titles that 10 or more members share. */
function Decades({ m }: { m: MemberStats }) {
	const d = m.decades
	const top = d.reduce((a, b) => (b.scores > a.scores ? b : a), d[0])
	const [picked, setPicked] = useState(String(top?.decade ?? ""))
	if (!top) return null
	const total = Math.max(
		1,
		d.reduce((a, x) => a + x.scores, 0),
	)
	const row = d.find((x) => String(x.decade) === picked) ?? top
	const before1990 = d.filter((x) => x.decade < 1990).reduce((a, x) => a + x.scores, 0)
	const oldest = m.oldestShared[0]
	return (
		<Block
			title={`Members score the ${top.decade}s most`}
			line={`Titles from before 1990 get ${pct(before1990 / total)} of all member scores.${oldest ? ` The oldest title 10 or more members share is from ${oldest.year}.` : ""}`}
		>
			<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
				<div className={`${PANEL} flex flex-col p-4 sm:p-5`}>
					<p className="mb-4 text-sm text-gray-400" aria-live="polite">
						<b className="text-amber-300 tabular-nums">{count(row.scores)}</b> scores for titles
						from the {row.decade}s, {pct(row.scores / total)} of the total.
					</p>
					<PickBars
						bars={d.map((x) => ({
							key: String(x.decade),
							label: `’${String(x.decade).slice(2)}`,
							n: x.scores,
							aria: `${x.decade}s: ${count(x.scores)} scores`,
						}))}
						picked={picked}
						onPick={setPicked}
					/>
				</div>
				<div className="flex flex-col gap-4">
					{m.oldestShared.length > 0 && (
						<PosterStrip label="Oldest titles members share" titles={m.oldestShared} />
					)}
					{m.newestShared.length > 0 && (
						<PosterStrip label="Newest titles members share" titles={m.newestShared} />
					)}
				</div>
			</div>
		</Block>
	)
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const hh = (n: number) => `${String(n).padStart(2, "0")}:00`

/** Scores by weekday and by hour (UTC); tap a bar to read it. */
function WhenTheyScore({ m }: { m: MemberStats }) {
	const w = m.weekdays
	const h = m.hours
	const busiest = <T extends { scores: number }>(rows: T[]) =>
		rows.reduce((a, b) => (b.scores > a.scores ? b : a))
	const quietest = <T extends { scores: number }>(rows: T[]) =>
		rows.reduce((a, b) => (b.scores < a.scores ? b : a))
	const topDay = busiest(w)
	const lowDay = quietest(w)
	const topHour = busiest(h)
	const lowHour = quietest(h)
	const [day, setDay] = useState(String(topDay.day))
	const [hour, setHour] = useState(String(topHour.hour))
	if (!topDay.scores) return null
	const dayRow = w.find((x) => String(x.day) === day) ?? topDay
	const hourRow = h.find((x) => String(x.hour) === hour) ?? topHour
	const dayNote =
		dayRow.day === topDay.day
			? "the busiest day."
			: dayRow.day === lowDay.day
				? "the quietest day."
				: `${pct(dayRow.scores / topDay.scores)} of ${DAYS[topDay.day - 1]}.`
	const hourNote =
		hourRow.hour === topHour.hour
			? "the busiest hour."
			: hourRow.hour === lowHour.hour
				? "the quietest hour."
				: ""
	const ratio = topDay.scores / Math.max(1, lowDay.scores)
	return (
		<Block
			title={`${DAYS[topDay.day - 1]} is scoring day`}
			effect="mem-weekday"
			line={`${count(topDay.scores)} scores on ${DAYS[topDay.day - 1]}s, ${
				ratio >= 1.95
					? `about ${Math.round(ratio)} times as many as on ${DAYS[lowDay.day - 1]}s`
					: `${pct(ratio - 1)} more than on ${DAYS[lowDay.day - 1]}s`
			}.`}
		>
			<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
				<div className={`${PANEL} flex flex-col p-4 sm:p-5`}>
					<p className={`${LABEL} mb-1`}>By day of the week</p>
					<p className="mb-4 text-sm text-gray-400" aria-live="polite">
						{DAYS[dayRow.day - 1]}:{" "}
						<b className="text-amber-300 tabular-nums">{count(dayRow.scores)}</b> scores, {dayNote}
					</p>
					<PickBars
						bars={w.map((x) => ({
							key: String(x.day),
							label: DAYS[x.day - 1].slice(0, 3),
							n: x.scores,
							aria: `${DAYS[x.day - 1]}: ${count(x.scores)} scores`,
						}))}
						picked={day}
						onPick={setDay}
					/>
				</div>
				<div className={`${PANEL} flex flex-col p-4 sm:p-5`}>
					<p className={`${LABEL} mb-1`}>By hour of the day, UTC</p>
					<p className="mb-4 text-sm text-gray-400" aria-live="polite">
						{hh(hourRow.hour)} to {hh((hourRow.hour + 1) % 24)} UTC:{" "}
						<b className="text-amber-300 tabular-nums">{count(hourRow.scores)}</b> scores
						{hourNote ? `, ${hourNote}` : "."}
					</p>
					<PickBars
						bars={h.map((x) => ({
							key: String(x.hour),
							label: String(x.hour),
							n: x.scores,
							aria: `${hh(x.hour)} UTC: ${count(x.scores)} scores`,
						}))}
						picked={hour}
						onPick={setHour}
						labelEvery={3}
					/>
				</div>
			</div>
		</Block>
	)
}

/** The score spread, tap a bar to read it, beside the perfect 10s. */
function ScoreSpread({ m }: { m: MemberStats }) {
	const sc = m.scores
	const common = sc.spread.indexOf(Math.max(...sc.spread)) + 1
	const [picked, setPicked] = useState(common)
	const n = sc.spread[picked - 1] ?? 0
	const movie = sc.byType.find((x) => x.type === "movie")
	const show = sc.byType.find((x) => x.type === "show")
	return (
		<div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
			<div className={`${PANEL} flex flex-col gap-5 p-4 sm:p-5`}>
				<div>
					<p className={LABEL}>Member scores</p>
					<p className="mt-2 text-lg text-gray-300">
						<b className="text-white">{common}</b> is the most common score. The average is{" "}
						<b className="text-white">{oneDecimal(sc.average)}</b>.
					</p>
				</div>
				<SpreadBars
					spread={sc.spread}
					average={Math.round(sc.average * 10) / 10}
					onPick={setPicked}
					height="h-32"
				/>
				<p className="text-sm text-gray-400" aria-live="polite">
					A <b className="text-white">{picked}</b> was given{" "}
					<b className="text-amber-300 tabular-nums">{count(n)}</b> times,{" "}
					{pct(n / Math.max(1, sc.count))} of all scores.
				</p>
			</div>
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
				<div className={`${PANEL} flex flex-col justify-center gap-1 p-4 sm:p-5`}>
					<span data-fx-spot="mem-tens" className="text-5xl font-black text-amber-400 tabular-nums">
						{count(sc.perfectTens)}
					</span>
					<span className="text-sm text-gray-300">
						perfect 10s, given by {sc.perfectTenMembers} members
					</span>
				</div>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2">
					{movie && <FactTile label="Movies average" value={oneDecimal(movie.average)} />}
					{show && <FactTile label="Shows average" value={oneDecimal(show.average)} />}
				</div>
			</div>
		</div>
	)
}

/** Wishlists: the last 30 days, the runtime waiting, and the most-wishlisted posters. */
function Wishlists({ m }: { m: MemberStats }) {
	const w = m.wishlist
	const hours = Math.round(w.movieMinutes / 60)
	const both = Math.max(1, w.movies + w.shows)
	return (
		<Block
			title="Saved for later"
			line={`Members added ${count(w.addedLast30Days)} titles to their Wishlists in the last 30 days.`}
		>
			<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
				<div className={`${PANEL} flex flex-col gap-4 p-4 sm:p-5`}>
					<div>
						<span
							data-fx-spot="mem-wishlist"
							className="text-5xl font-black text-amber-400 tabular-nums"
						>
							{count(hours)}
						</span>
						<p className="mt-1 text-sm text-gray-300">
							hours of movies wait on Wishlists. That's <B>{count(hours / 24)}</B> days, before a
							single show.
						</p>
					</div>
					<div>
						<div className="flex h-3 overflow-hidden rounded-full">
							<span className="bg-amber-400" style={{ width: `${(w.movies / both) * 100}%` }} />
							<span className="flex-1 bg-amber-400/25" />
						</div>
						<div className="mt-2 flex justify-between text-xs text-gray-400">
							<span>
								<B>{count(w.movies)}</B> movies
							</span>
							<span>
								<B>{count(w.shows)}</B> shows
							</span>
						</div>
					</div>
				</div>
				{w.most.length > 0 && (
					<div className={`${PANEL} p-4`}>
						<p className="mb-3 text-sm font-bold text-gray-200">Most on Wishlists</p>
						<ul className="grid grid-cols-4 gap-2.5">
							{w.most.map((t, i) => (
								<li key={titleKey(t)} className={i >= 4 ? "max-sm:hidden" : ""}>
									<Poster t={t}>
										<span className="text-xs text-gray-400">{t.members} members</span>
									</Poster>
								</li>
							))}
						</ul>
					</div>
				)}
			</div>
		</Block>
	)
}

const SOURCE_NAMES: Record<string, string> = {
	tvtime: "TV Time",
	trakt: "Trakt",
	imdb: "IMDb",
	letterboxd: "Letterboxd",
	csv: "CSV files",
	imdb_list: "IMDb lists",
	tmdb: "TMDB",
	wishlist: "Wishlist files",
}

/** Titles brought in by import source, and member countries. */
function Arrivals({ m }: { m: MemberStats }) {
	const imports = m.imports
	const most = Math.max(1, imports[0]?.titles ?? 1)
	const total = imports.reduce((a, x) => a + x.titles, 0)
	const countries = m.countries
	const topCountry = Math.max(1, countries[0]?.members ?? 1)
	if (!imports.length && !countries.length) return null
	return (
		<div className="grid gap-4 lg:grid-cols-2">
			{imports.length > 0 && (
				<div className={`${PANEL} p-4 sm:p-5`}>
					<p className={`${LABEL} mb-1`}>Titles brought in by import</p>
					<p className="mb-4 text-sm text-gray-400">
						<B>{count(total)}</B> titles arrived with their history, most from{" "}
						{SOURCE_NAMES[imports[0].source] ?? imports[0].source}.
					</p>
					<ol className="flex flex-col gap-2">
						{imports.map((x) => (
							<li key={x.source} className="flex items-center gap-3 text-sm">
								<span className="w-24 shrink-0 truncate font-semibold text-gray-200">
									{SOURCE_NAMES[x.source] ?? x.source}
								</span>
								<span className="h-3 min-w-0 flex-1">
									<span
										className="stats-grow block h-full rounded-sm bg-amber-400/80"
										style={{
											width: `${Math.max(1, (x.titles / most) * 100)}%`,
										}}
									/>
								</span>
								<span className="w-14 text-right text-xs text-gray-400 tabular-nums">
									{count(x.titles)}
								</span>
							</li>
						))}
					</ol>
				</div>
			)}
			{countries.length > 0 && (
				<div className={`${PANEL} p-4 sm:p-5`}>
					<p className={`${LABEL} mb-1`}>Where members watch from</p>
					<p className="mb-4 text-sm text-gray-400">Countries with 10 or more members.</p>
					<ol className="flex flex-col gap-2">
						{countries.map((x) => (
							<li key={x.code} className="flex items-center gap-3 text-sm">
								<span className="w-32 shrink-0 truncate font-semibold text-gray-200">
									<span aria-hidden>{flag(x.code)} </span>
									{regionName(x.code)}
								</span>
								<span className="h-3 min-w-0 flex-1">
									<span
										className="stats-grow block h-full rounded-sm bg-white/25"
										style={{ width: `${(x.members / topCountry) * 100}%` }}
									/>
								</span>
								<span className="w-10 text-right text-xs text-gray-400 tabular-nums">
									{x.members}
								</span>
							</li>
						))}
					</ol>
				</div>
			)}
		</div>
	)
}

export function MembersChapter({ s }: { s: StatsSnapshot }) {
	const m = s.members
	return (
		<Chapter
			id="members"
			n={10}
			name="Members"
			lead="Members have logged"
			accent={`${oneDecimal(loggedOf(m) / MINUTES_PER_YEAR)} years`}
			tail="of watching."
			sub={<LoggedRecount m={m} generatedAt={s.generatedAt} />}
		>
			<HoursSplit m={m} />
			<MostSeen m={m} />
			<Binges m={m} />
			<Agreement m={m} />
			<VersusImdb m={m} />
			<GenreLove m={m} />
			<Decades m={m} />
			<WhenTheyScore m={m} />
			<ScoreSpread m={m} />
			<Wishlists m={m} />
			<Arrivals m={m} />
		</Chapter>
	)
}
