// Chapter 9, trivia: the quiz, then question cards (trivia-card.tsx) for the facts the other chapters don't show and
// the odd ones, in a masonry. Two small extras hide in them: a live box office counter and a Christmas, zombie and
// shark switch. One chapter rather than interludes: each chapter above keeps one subject under its sentence heading,
// and the questions jump between subjects.
import { useEffect, useMemo, useRef, useState } from "react"
import type { StatsSnapshot, StatsTitle } from "~/domain/stats/snapshot"
import { ScoreTile } from "~/ui/details/episode-grid/ScoreTile"
import { RatingChipRow } from "~/ui/details/hero/RatingChips"
import {
	count,
	episodeCode,
	episodeHref,
	episodeName,
	oneDecimal,
	titleHref,
	titleKey,
} from "../format"
import { Chapter } from "../parts"
import { Quiz, numberWord } from "../quiz"
import { buildQuiz } from "../quiz-questions"
import { type Entry, type Trivia, TriviaCard } from "../trivia-card"

const capitalize = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)

const titleEntry = (
	t: StatsTitle,
	value: string,
	unit?: string,
	more: Partial<Entry> = {},
): Entry => ({
	key: titleKey(t),
	name: t.title,
	href: titleHref(t),
	poster: t,
	value,
	unit,
	sub: t.year ? String(t.year) : undefined,
	...more,
})

/** A number with no picture: the card's #1 answer as a figure. */
const figure = (
	key: string,
	value: string,
	unit: string,
	name = "",
): Entry => ({
	key,
	name,
	value,
	unit,
})

/** A movie's box office per second, counted from when the page opened; the count moves only while it is in view. */
function BoxOfficeMeter({
	perSecond,
	title,
}: { perSecond: number; title: string }) {
	const [seconds, setSeconds] = useState(0)
	const box = useRef<HTMLParagraphElement>(null)
	useEffect(() => {
		const start = Date.now()
		let id = 0
		const tick = () => setSeconds(Math.floor((Date.now() - start) / 1000))
		const io = new IntersectionObserver(([e]) => {
			window.clearInterval(id)
			if (!e.isIntersecting) return
			tick()
			id = window.setInterval(tick, 1000)
		})
		if (box.current) io.observe(box.current)
		return () => {
			io.disconnect()
			window.clearInterval(id)
		}
	}, [])
	return (
		<p
			ref={box}
			data-fx-spot="triv-meter"
			className="rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-gray-400 ring-1 ring-white/10"
		>
			Since you opened this page, {title} would have earned{" "}
			<b className="text-amber-300 tabular-nums">
				${count(seconds * perSecond)}
			</b>
			.
		</p>
	)
}

export function triviaDeck(s: StatsSnapshot): Trivia[] {
	const f = s.trivia
	const lbTop = s.records.highestLetterboxd
	const lbTies = lbTop.filter((r) => r.score === lbTop[0].score).length
	const jobs = f.commonRoles
	const perMinute = f.boxOfficePerMinute.map((r) => ({
		...r,
		pace: r.revenue / r.runtime,
	}))
	const fastest = perMinute[0]
	const series = f.biggestSeries
	const bond = series.find((x, i) => i > 0 && x.name.startsWith("James Bond"))
	const lowest = s.records.lowestMetascoreMovies
	const best = s.episodes.highestRated
	const ties = best.filter((e) => e.imdb === best[0].imdb)
	const tiedShow = ties.filter((e) => e.showId === ties[0].showId).length
	const [busiest, ...nextYears] = f.busiestYears
	const longest = f.longestTitles
	const borats = longest.slice(1).every((t) => t.title.startsWith("Borat"))
	const millionsPerMinute = (n: number) => `$${(n / 1e6).toFixed(1)}M`
	const [one1, one2, one3] = f.oneLetterTitles

	const cards: (Trivia | null)[] = [
		jobs.length > 1
			? {
					id: "trivia-common-role",
					category: "People",
					sides: [
						{
							key: "all",
							label: "Roles",
							question: "Which role do actors play most often?",
							entries: jobs.map((r) =>
								figure(r.role, count(r.credits), "credits", capitalize(r.role)),
							),
							fact: `${capitalize(jobs[0].role)} beats ${jobs[1].role} by ${count(jobs[0].credits - jobs[1].credits)} credits.${f.topFirstName ? ` The most common character name is ${capitalize(f.topFirstName.role)}, with ${count(f.topFirstName.credits)}.` : ""}`,
						},
					],
				}
			: null,
		{
			id: "trivia-seasonal",
			category: "Titles",
			sides: [
				{
					key: "christmas",
					label: "Christmas",
					question: "How many Christmas movies are there?",
					entries: [
						figure("christmas", count(f.christmas), "Christmas movies"),
					],
					fact: `One a day would fill every December for ${Math.floor(f.christmas / 31)} years.`,
				},
				{
					key: "zombies",
					label: "Zombies",
					question: "How many zombie movies are there?",
					entries: [figure("zombies", count(f.zombies), "zombie movies")],
					fact:
						f.zombies > f.sharks
							? `That's ${count(f.zombies - f.sharks)} more than there are shark movies.`
							: `Shark movies outnumber them by ${count(f.sharks - f.zombies)}.`,
				},
				{
					key: "sharks",
					label: "Sharks",
					question: "How many shark movies are there?",
					entries: [figure("sharks", count(f.sharks), "shark movies")],
					fact: `Christmas movies outnumber them ${Math.round(f.christmas / Math.max(1, f.sharks))} to one.`,
				},
			],
		},
		one3
			? {
					id: "trivia-one-letter",
					category: "Titles",
					sides: [
						{
							key: "all",
							label: "Movies",
							question: "Which one-letter title has the most IMDb votes?",
							entries: f.oneLetterTitles.map((r) =>
								titleEntry(r, count(r.votes), "IMDb votes", {
									extra: (
										<RatingChipRow
											imdb={oneDecimal(r.imdb)}
											mc={null}
											mcUser={null}
											rt={null}
											rtUser={null}
										/>
									),
								}),
							),
							fact: `${one1.title} (${one1.year}) leads ${one2.title} (${one2.year}) and ${one3.title} (${one3.year}).`,
						},
					],
				}
			: null,
		{
			id: "trivia-longest-title",
			category: "Titles",
			reveal: true,
			sides: [
				{
					key: "all",
					label: "Movies",
					question: "What is the longest movie title?",
					entries: longest.map((r) =>
						titleEntry(r, count(r.letters), "letters"),
					),
					// Marat/Sade's full title is the record; people know it by its short name.
					fact:
						longest[0].tmdbId === 44258
							? `Most people call it Marat/Sade.${longest.length > 2 && borats ? " Both runners-up are Borat movies." : ""}`
							: `${longest[0].title} runs to ${longest[0].letters} letters.`,
				},
			],
		},
		{
			id: "trivia-biggest-series",
			category: "Series",
			sides: [
				{
					key: "all",
					label: "Series",
					question: "Which movie series has the most movies?",
					entries: series.map((x) =>
						figure(String(x.id), String(x.movies), "movies", x.name),
					),
					fact: `${series[0].name}${series[0].name === "Beck" ? ", the Swedish detective," : ""} has ${series[0].movies} movies.${bond ? ` ${bond.name} has ${bond.movies}.` : ""}`,
				},
			],
		},
		{
			id: "trivia-box-office-minute",
			category: "Money",
			sides: [
				{
					key: "all",
					label: "Movies",
					question: "Which movie earned the most per minute of runtime?",
					entries: perMinute.map((r) =>
						titleEntry(
							r,
							millionsPerMinute(r.pace),
							`per minute, over ${r.runtime} minutes`,
						),
					),
					fact: `${fastest.title} earned about $${count(Math.round(fastest.pace / 60 / 1000) * 1000)} for every second on screen.`,
					below: (
						<BoxOfficeMeter
							perSecond={fastest.pace / 60}
							title={fastest.title}
						/>
					),
				},
			],
		},
		best.length
			? {
					id: "trivia-best-episodes",
					category: "Episodes",
					sides: [
						{
							key: "all",
							label: "Episodes",
							question: "Which episodes score highest on IMDb?",
							entries: best.map((e) => ({
								key: `${e.showId}-${e.season}-${e.episode}`,
								name: episodeName(e),
								href: episodeHref(e),
								poster: {
									type: "show" as const,
									tmdbId: e.showId,
									title: e.show,
									year: null,
									poster: e.poster,
								},
								value: oneDecimal(e.imdb),
								unit: `IMDb score, from ${count(e.votes)} votes`,
								sub: `${e.show} · ${episodeCode(e)}`,
								extra: (
									<ScoreTile
										score={e.imdb}
										title="IMDb score"
										className="h-6 w-fit min-w-9 text-xs"
									/>
								),
							})),
							fact:
								ties.length > 1
									? `${ties.length} episodes share a ${oneDecimal(best[0].imdb)}${tiedShow > 1 ? `, and ${ties[0].show} has ${tiedShow} of them` : ""}.`
									: `${episodeName(best[0])} from ${best[0].show} leads with ${oneDecimal(best[0].imdb)}.`,
						},
					],
				}
			: null,
		{
			id: "trivia-highest-letterboxd",
			category: "Scores",
			reveal: true,
			sides: [
				{
					key: "all",
					label: "Movies",
					question: "What is the highest-rated movie on Letterboxd?",
					entries: lbTop.map((r) =>
						titleEntry(
							r,
							r.score.toFixed(2),
							`out of 5, from ${count(r.ratings)} ratings`,
						),
					),
					fact:
						lbTies > 1
							? `${lbTies} movies share the top average of ${lbTop[0].score.toFixed(2)} stars, among movies with 10,000 or more ratings.`
							: `Among movies with 10,000 or more ratings, ${lbTop[0].title} has the top average.`,
				},
			],
		},
		{
			id: "trivia-lowest-metascore",
			category: "Scores",
			reveal: true,
			sides: [
				{
					key: "all",
					label: "Movies",
					question: "Which movie did critics score lowest on Metacritic?",
					entries: lowest.map((r) =>
						titleEntry(
							r,
							String(r.metascore),
							`Metascore, from ${r.criticReviews} critic reviews`,
							{
								extra: (
									<RatingChipRow
										small
										imdb={null}
										mc={String(r.metascore)}
										mcUser={
											r.userScore === null ? null : oneDecimal(r.userScore)
										}
										rt={null}
										rtUser={null}
									/>
								),
							},
						),
					),
					fact: `${lowest[0].title} has a Metascore of ${lowest[0].metascore}.${lowest[0].userScore === null ? "" : ` Metacritic users give it ${oneDecimal(lowest[0].userScore)}.`}`,
				},
			],
		},
		{
			id: "trivia-busiest-year",
			category: "Calendar",
			sides: [
				{
					key: "all",
					label: "Years",
					question: "Which year had the most new movies?",
					entries: [busiest, ...nextYears].map((y) =>
						figure(String(y.year), count(y.movies), "movies", String(y.year)),
					),
					fact: `${count(busiest.movies)} movies came out in ${busiest.year}, about ${count(Math.round(busiest.movies / 365))} a day.`,
				},
			],
		},
	]
	return cards.filter((c): c is Trivia => c !== null)
}

export function TriviaChapter({ s }: { s: StatsSnapshot }) {
	const home = s.trivia.commonTitles[0]
	const deck = useMemo(() => triviaDeck(s), [s])
	const quiz = useMemo(() => buildQuiz(s), [s])
	return (
		<Chapter
			id="trivia"
			n={9}
			name="Trivia"
			lead={`${count(home.movies)} movies are called`}
			accent={`${home.title}.`}
			sub={`${numberWord(quiz.length)} questions to test yourself, then odd facts from the catalog, some with the answer behind a tap.`}
		>
			<Quiz quiz={quiz} />
			<div className="mt-6 columns-1 gap-4 md:columns-2 xl:columns-3">
				{deck.map((t) => (
					<TriviaCard key={t.id} t={t} />
				))}
			</div>
		</Chapter>
	)
}
