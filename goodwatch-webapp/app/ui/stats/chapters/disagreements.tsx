// Chapter 5, where the crowds disagree: the top of the GoodWatch scale, then rows of split verdicts, each title with a
// score standoff under its poster.
import { Link } from "@remix-run/react"
import type { StatsSnapshot, StatsTitle } from "~/domain/stats/snapshot"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { PosterImg } from "~/ui/profile/parts"
import { oneDecimal, titleHref, titleKey } from "../format"
import { Chapter, PANEL, Poster } from "../parts"
import { type VsSide, VsStandoff } from "../versus"

type Row = {
	key: string
	title: string
	line: string
	items: { t: StatsTitle; a: VsSide; b: VsSide }[]
}

const imdb = (t: { imdb: number }): VsSide => ({
	source: "imdb",
	n: oneDecimal(t.imdb),
	pct: t.imdb * 10,
})
const letterboxd = (t: { letterboxd: number }): VsSide => ({
	source: "lb",
	n: oneDecimal(t.letterboxd),
	pct: t.letterboxd * 20,
})

export function Disagreements({ s }: { s: StatsSnapshot }) {
	const r = s.records
	const top = r.topGoodwatchMovies[0]
	const best = [
		...r.topGoodwatchMovies.slice(1, 3),
		...r.topGoodwatchShows.slice(0, 2),
	]
	const lowLetterboxd = r.imdbOverLetterboxd.every((t) => t.letterboxd < 2)
	const [critics] = r.criticsOverUsers
	const [userPick, userPick2] = r.usersOverCritics
	const rows: Row[] = [
		{
			key: "imdb",
			title: "IMDb liked them. Letterboxd did not.",
			line: lowLetterboxd
				? "IMDb users give these average scores. Letterboxd members give them under 2 stars."
				: "IMDb users give these average scores. Letterboxd members score them far lower.",
			items: r.imdbOverLetterboxd.map((t) => ({
				t,
				a: imdb(t),
				b: letterboxd(t),
			})),
		},
		{
			key: "lb",
			title: "Letterboxd liked them. IMDb did not.",
			line: "Letterboxd members score these far above IMDb users.",
			items: r.letterboxdOverImdb.map((t) => ({
				t,
				a: imdb(t),
				b: letterboxd(t),
			})),
		},
		{
			key: "rt",
			title: "Critics against audiences",
			line: "The widest gaps between the Tomatometer and the Rotten Tomatoes audience score.",
			items: r.criticsVsAudience.map((t) => ({
				t,
				a: { source: "rt", n: String(t.critics), pct: t.critics },
				b: { source: "rta", n: String(t.audience), pct: t.audience },
			})),
		},
		{
			key: "mc",
			title: "Metacritic critics against Metacritic users",
			line: `Critics loved ${critics.title} and users did not. Users stood by ${userPick.title}${userPick2 ? ` and ${userPick2.title}` : ""}, which critics panned.`,
			items: [critics, ...r.usersOverCritics.slice(0, 4)].map((t) => ({
				t,
				a: { source: "mc", n: String(t.metascore), pct: t.metascore },
				b: { source: "mcu", n: oneDecimal(t.userScore), pct: t.userScore * 10 },
			})),
		},
	]
	return (
		<Chapter
			id="disagree"
			n={5}
			name="Where the crowds disagree"
			lead="Everyone agrees on"
			accent={top.title}
			tail={`(${top.year}).`}
			sub="It has the highest GoodWatch score of any movie with 100,000 or more votes. Below it, the titles where audiences and critics split."
		>
			<div
				className={`${PANEL} grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-center`}
			>
				<div className="flex items-center gap-5">
					<Link
						to={titleHref(top)}
						prefetch="intent"
						data-fx-spot="dis-top"
						className="block w-24 shrink-0 sm:w-28"
					>
						<PosterImg title={{ poster: top.poster }} className="rounded-lg" />
					</Link>
					<div className="flex flex-col gap-3">
						<Link
							to={titleHref(top)}
							prefetch="intent"
							className="text-xl font-bold text-white hover:text-amber-300"
						>
							{top.title}
						</Link>
						<ScoreRing
							media={{
								details: {
									goodwatch_overall_score_normalized_percent: top.score,
								},
							}}
							size={64}
						/>
					</div>
				</div>
				<div className="grid grid-cols-4 gap-2.5">
					{best.map((t) => (
						<Poster key={titleKey(t)} t={t} goodwatch={t.score} />
					))}
				</div>
			</div>
			{rows.map((row) => (
				<div
					key={row.key}
					className="grid gap-4 border-t border-white/10 pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]"
				>
					<div className="flex flex-col gap-1">
						<h3 className="text-lg font-bold text-white">{row.title}</h3>
						<p className="text-sm text-gray-400">{row.line}</p>
					</div>
					{/* Phones and small tablets: a row that scrolls sideways, two cards and a peek of the third. */}
					<ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:px-6 md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0 md:pb-0">
						{row.items.map(({ t, a, b }) => (
							<li
								key={titleKey(t)}
								className="w-[42%] shrink-0 snap-start sm:w-[30%] md:w-auto"
							>
								<Poster t={t}>
									<VsStandoff a={a} b={b} />
								</Poster>
							</li>
						))}
					</ul>
				</div>
			))}
		</Chapter>
	)
}
