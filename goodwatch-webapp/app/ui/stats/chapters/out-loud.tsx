// Chapter 3, said out loud: the numbers as sentences, big and quiet, one per line. The line under the heading counts
// the movies' runtime another way at each tap.
import { Link } from "@remix-run/react"
import { Fragment } from "react"
import type { StatsSnapshot } from "~/domain/stats/snapshot"
import { MINUTES_PER_DAY, MINUTES_PER_YEAR, count, titleHref } from "../format"
import { Amber, B, Chapter, RecountLine } from "../parts"

const LINK = "underline decoration-white/20 underline-offset-4 hover:text-white"

export function OutLoud({ s }: { s: StatsSnapshot }) {
	const c = s.catalog
	const movieYears = Math.round(c.movieMinutes / MINUTES_PER_YEAR)
	const episodeYears = Math.round(c.episodeMinutes / MINUTES_PER_YEAR)
	const startYear = new Date(s.generatedAt).getUTCFullYear() - movieYears
	const runtimes = s.charts.runtimeByDecade
	const first = runtimes[0]
	const last = runtimes[runtimes.length - 1]
	const imdbTop = s.records.mostImdbVotesMovies[0]
	const letterboxdTop = s.records.mostLetterboxdRatings[0]
	const ways = [
		<Fragment key="minutes">
			That's <B>{count(c.movieMinutes)}</B> minutes of movies, without a break.
		</Fragment>,
		<Fragment key="days">
			That's <B>{count(c.movieMinutes / MINUTES_PER_DAY)}</B> days, or{" "}
			<B>{count(c.movieMinutes / 60)}</B> hours.
		</Fragment>,
		<Fragment key="new-year">
			Start on New Year's Day <B>{startYear}</B>, never stop, and you would
			finish about now.
		</Fragment>,
		<Fragment key="nights">
			At two hours a night, <B>{count(c.movieMinutes / 120 / 365)}</B> years of
			movie nights.
		</Fragment>,
	]
	const lines = [
		<Fragment key="episodes">
			Every episode of every show would take another{" "}
			<Amber>{count(episodeYears)} years</Amber>.
		</Fragment>,
		<Fragment key="runtime">
			Movies got longer: <Amber>{first.minutes} minutes</Amber> on average in
			the {first.decade}s, <Amber>{last.minutes}</Amber> in the {last.decade}s.
		</Fragment>,
		<Fragment key="images">
			We keep <Amber>{count(c.posters)}</Amber> posters,{" "}
			<Amber>{count(c.backdrops)}</Amber> backdrops and{" "}
			<Amber>{count(c.logos)}</Amber> logos.
		</Fragment>,
		<Fragment key="characters">
			<Amber>{count(c.characterPortraits)}</Amber> of {count(c.characters)}{" "}
			characters have a picture of the role.
		</Fragment>,
		<Fragment key="votes">
			<Link data-fx-spot="out-imdb" to={titleHref(imdbTop)} className={LINK}>
				{imdbTop.title}
			</Link>{" "}
			has <Amber>{count(imdbTop.votes)}</Amber> IMDb votes, more than any other
			movie.{" "}
			<Link
				data-fx-spot="out-letterboxd"
				to={titleHref(letterboxdTop)}
				className={LINK}
			>
				{letterboxdTop.title}
			</Link>{" "}
			leads Letterboxd with <Amber>{count(letterboxdTop.ratings)}</Amber>.
		</Fragment>,
	]
	return (
		<Chapter
			id="out-loud"
			n={3}
			name="Said out loud"
			lead="Watching every movie back to back would take"
			accent={`${movieYears} years.`}
			sub={<RecountLine ways={ways} effect="out-runtime" />}
		>
			<ol className="flex max-w-4xl flex-col">
				{lines.map((line, i) => (
					<li
						key={line.key}
						className="flex gap-4 border-t border-white/10 py-6 font-['Gabarito'] text-2xl leading-snug font-light tracking-[-0.02em] text-gray-300 sm:gap-6 sm:text-4xl"
					>
						<span className="pt-1.5 text-xs font-bold tracking-[0.18em] text-gray-600 tabular-nums sm:pt-3">
							{String(i + 1).padStart(2, "0")}
						</span>
						<span>{line}</span>
					</li>
				))}
			</ol>
		</Chapter>
	)
}
