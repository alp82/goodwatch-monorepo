// Chapter 2, the crowd behind the scores: brand cards per source, the counts under them, the most-rated titles, and
// how IMDb scores and Metascores spread.
import type { StatsSnapshot } from "~/domain/stats/snapshot"
import imdbLogo from "~/img/imdb-logo-250.webp?no-inline"
import letterboxdLogo from "~/img/letterboxd-dots.svg?no-inline"
import metacriticLogo from "~/img/metacritic-logo-icon-64.webp?no-inline"
import rottenLogo from "~/img/rotten-logo-icon-64.webp"
import { BrandCard } from "~/ui/living-room/intro/parts/brand-cards"
import type { Source } from "~/ui/living-room/intro/parts/score-kit"
import { SpreadBars } from "~/ui/profile/parts"
import { assetUrl } from "~/utils/asset-url"
import { big, count, short, splitCompact } from "../format"
import { Chapter, LABEL, PANEL, RankRows, titleRows } from "../parts"

/** Every audience rating behind the scores: IMDb (movies and shows), Letterboxd, TMDB and Metacritic users. */
export const crowdOf = (s: StatsSnapshot) =>
	s.sources.imdbMovieVotes +
	s.sources.imdbShowVotes +
	s.sources.letterboxdRatings +
	s.sources.tmdbVotes +
	s.sources.metacriticUserRatings

export function Crowd({ s }: { s: StatsSnapshot }) {
	const src = s.sources
	const r = s.records
	// IMDb's buckets are the ten whole scores; the peak is the bucket with the most movies.
	const imdb = s.charts.imdbSpread
	const imdbPeak = imdb.indexOf(Math.max(...imdb))
	// Metascores in tens, with the perfect 100s in the top bar: ten bars, as SpreadBars draws them.
	const metascores = s.charts.metascoreSpread
	const perfect = metascores[10] ?? 0
	const metaBars = metascores
		.slice(0, 10)
		.map((n, i) => n + (i === 9 ? perfect : 0))
	const metaPeak = metascores.indexOf(Math.max(...metascores.slice(0, 10)))
	const metacritic = splitCompact(src.metacriticCriticReviews)
	const cards: { source: Source; line: string }[] = [
		{
			source: {
				id: "imdb",
				logo: assetUrl(imdbLogo),
				n: short(src.imdbMovieVotes + src.imdbShowVotes),
				unit: "",
				label: "IMDb",
				wide: true,
			},
			line: `votes on ${count(src.imdbTitles)} movies and shows`,
		},
		{
			source: {
				id: "lb",
				logo: assetUrl(letterboxdLogo),
				n: short(src.letterboxdRatings),
				unit: "",
				label: "Letterboxd",
			},
			line: `ratings on ${count(src.letterboxdTitles)} movies`,
		},
		{
			source: {
				id: "rt",
				logo: assetUrl(rottenLogo),
				n: short(src.rottenTomatoesTitles),
				unit: "",
				label: "Rotten Tomatoes",
			},
			line: "titles with a Tomatometer",
		},
		{
			source: {
				id: "mc",
				logo: assetUrl(metacriticLogo),
				n: metacritic.n,
				unit: metacritic.unit,
				label: "Metacritic",
			},
			line: `critic reviews on ${count(src.metacriticTitles)} movies and shows`,
		},
	]
	return (
		<Chapter
			id="crowd"
			n={2}
			name="The crowd behind the scores"
			lead="Our scores stand on"
			accent={big(crowdOf(s))}
			tail="ratings."
			sub="Audiences on IMDb, Letterboxd, TMDB and Metacritic, and critics on Rotten Tomatoes and Metacritic. The GoodWatch score blends them."
		>
			<div
				data-fx-spot="crowd-cards"
				className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-4 sm:gap-6 lg:max-w-5xl"
			>
				{cards.map(({ source, line }) => (
					<figure key={source.id} className="flex min-w-0 flex-col gap-2">
						<div className="stats-brand">
							<BrandCard s={source} />
						</div>
						<figcaption className="text-center text-xs text-gray-400 sm:text-sm">
							{line}
						</figcaption>
					</figure>
				))}
			</div>
			<dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:max-w-5xl lg:grid-cols-6">
				{[
					["TMDB votes", count(src.tmdbVotes)],
					["IMDb episode votes", count(src.imdbEpisodeVotes)],
					["Metacritic user ratings", count(src.metacriticUserRatings)],
					["Metacritic critic reviews", count(src.metacriticCriticReviews)],
					["Titles with a Metascore", count(src.metacriticTitles)],
					["Titles with a GoodWatch score", count(src.goodwatchScored)],
				].map(([label, value]) => (
					<div key={label} className="flex flex-col">
						<dt className="order-2 text-[11px] text-gray-500">{label}</dt>
						<dd className="font-bold text-white tabular-nums">{value}</dd>
					</div>
				))}
			</dl>
			<div className="grid gap-4 lg:grid-cols-3">
				<RankRows
					heading="Most IMDb votes · movies"
					rows={titleRows(r.mostImdbVotesMovies, (t) => short(t.votes))}
				/>
				<RankRows
					heading="Most IMDb votes · shows"
					rows={titleRows(r.mostImdbVotesShows, (t) => short(t.votes))}
				/>
				<RankRows
					heading="Most Letterboxd ratings"
					rows={titleRows(r.mostLetterboxdRatings, (t) => short(t.ratings))}
				/>
			</div>
			<div className="grid gap-4 lg:grid-cols-2">
				<div
					className={`${PANEL} flex flex-col justify-between gap-6 p-4 sm:p-5`}
				>
					<div>
						<p className={LABEL}>IMDb scores, movies with 1,000+ votes</p>
						<p className="mt-2 text-lg text-gray-300">
							Most land between{" "}
							<b className="text-white">
								{imdbPeak + 1} and {imdbPeak + 1}.9
							</b>
							: {count(imdb[imdbPeak])} movies. Only{" "}
							<b className="text-white">{count(imdb[8] + imdb[9])}</b> score 9
							or higher.
						</p>
					</div>
					<div data-fx-spot="crowd-spread">
						<SpreadBars spread={imdb} height="h-28" />
					</div>
				</div>
				<div
					className={`${PANEL} flex flex-col justify-between gap-6 p-4 sm:p-5`}
				>
					<div>
						<p className={LABEL}>Metascores, movies</p>
						<p className="mt-2 text-lg text-gray-300">
							Most land between{" "}
							<b className="text-white">
								{metaPeak * 10} and {metaPeak * 10 + 9}
							</b>
							: {count(metascores[metaPeak])} movies. Only{" "}
							<b data-fx-spot="crowd-perfect" className="text-white">
								{count(perfect)}
							</b>{" "}
							have a perfect 100.
						</p>
					</div>
					<SpreadBars spread={metaBars} height="h-28" />
				</div>
			</div>
		</Chapter>
	)
}
