// The Trivia chapter's quiz: up to ten questions with three answers each, all read from the snapshot. The wrong answers
// are real runners-up wherever the snapshot has them, so every reveal teaches something. A question whose data is too
// thin for three different answers is left out. `answers` is in a mixed order: the order before the page shuffles
// (server render, first paint). Plain Node runs quiz-questions.test.ts on this file, so its imports are relative.
import type {
	StatsEpisode,
	StatsSnapshot,
	StatsTitle,
} from "../../domain/stats/snapshot.ts"
import { regionName } from "../../utils/display-names.ts"
import {
	count,
	episodeCode,
	episodeHref,
	episodeName,
	oneDecimal,
	titleHref,
	titleKey,
} from "./format.ts"

export interface QuizAnswer {
	key: string
	label: string
	/** A short line under the label: the show and episode, "out of 10". */
	sub?: string
	/** Shown on every answer after the reveal: its real number. Empty for a made-up figure. */
	detail: string
	/** A poster path: the answer is a title, drawn as a poster. */
	poster?: string | null
	/** A small poster beside a text answer (an episode's show). */
	thumb?: string | null
	/** A country code: its flag goes before a text answer. */
	country?: string
}

export interface QuizQuestion {
	id: string
	category: string
	question: string
	answers: [QuizAnswer, QuizAnswer, QuizAnswer]
	/** The right answer's key. */
	right: string
	/** One line with the real numbers, shown after the reveal. */
	explain: string
	link?: { to: string; label: string }
}

const titleAnswer = (t: StatsTitle, detail: string): QuizAnswer => ({
	key: titleKey(t),
	label: t.title,
	detail,
	poster: t.poster,
})

/** Three answers in a fixed mixed order: the right one in the middle of `wrong`, or wherever `at` says. */
const three = (
	right: QuizAnswer,
	wrong: [QuizAnswer, QuizAnswer],
	at: 0 | 1 | 2,
): [QuizAnswer, QuizAnswer, QuizAnswer] => {
	const out = [...wrong]
	out.splice(at, 0, right)
	return out as [QuizAnswer, QuizAnswer, QuizAnswer]
}

const distinct = (answers: QuizAnswer[]) =>
	new Set(answers.map((a) => a.key)).size === answers.length &&
	new Set(answers.map((a) => a.label)).size === answers.length

/** Country names that read with "the": "the United States". */
const WITH_THE = new Set([
	"US",
	"GB",
	"NL",
	"PH",
	"AE",
	"CZ",
	"DO",
	"BS",
	"GM",
	"CF",
	"KM",
	"MV",
])
const country = (code: string) =>
	`${WITH_THE.has(code) ? "the " : ""}${regionName(code)}`

type Build = (s: StatsSnapshot) => QuizQuestion | null

const QUESTIONS: Build[] = [
	// IMDb votes: the top three are close at the top.
	(s) => {
		const [first, second, third] = s.records.mostImdbVotesMovies
		if (!third) return null
		const votes = (t: { votes: number }) => `${count(t.votes)} votes`
		return {
			id: "quiz-imdb-votes",
			category: "Scores",
			question: "Which movie has the most IMDb votes?",
			answers: [
				titleAnswer(third, votes(third)),
				titleAnswer(first, votes(first)),
				titleAnswer(second, votes(second)),
			],
			right: titleKey(first),
			explain: `${first.title} has ${count(first.votes)} votes, just ${count(first.votes - second.votes)} more than ${second.title}.`,
			link: { to: titleHref(first), label: first.title },
		}
	},
	// Titles: the chapter heading already says which title is first, so the quiz asks for second place.
	(s) => {
		const [first, second, third, fourth] = s.trivia.commonTitles
		if (!fourth) return null
		const movies = (x: { movies: number }) => `${count(x.movies)} movies`
		const gap = second.movies - third.movies
		return {
			id: "quiz-second-title",
			category: "Titles",
			question: `${first.title} is the most common movie title. Which comes second?`,
			answers: [
				{ key: third.title, label: third.title, detail: movies(third) },
				{ key: fourth.title, label: fourth.title, detail: movies(fourth) },
				{ key: second.title, label: second.title, detail: movies(second) },
			],
			right: second.title,
			explain: `${count(second.movies)} movies are called ${second.title}. ${third.title} is ${gap === 1 ? "one" : count(gap)} behind, and ${fourth.title} has ${count(fourth.movies)}.`,
		}
	},
	// Friday the 13th: the real count between a tenth and ten times it.
	(s) => {
		const n = s.trivia.friday13Horror
		const top = s.trivia.friday13Top[0]
		if (n < 10 || !top) return null
		return {
			id: "quiz-friday-13th",
			category: "Calendar",
			question: "How many horror movies came out on a Friday the 13th?",
			answers: [
				{ key: "tenth", label: count(Math.round(n / 10)), detail: "" },
				{ key: "real", label: count(n), detail: "horror movies" },
				{ key: "tenfold", label: count(n * 10), detail: "" },
			],
			right: "real",
			explain: `${count(n)} of them. The best known is ${top.title} (${top.year}).`,
			link: { to: titleHref(top), label: top.title },
		}
	},
	// Episodes: the top three shows.
	(s) => {
		const [first, second, third] = s.records.mostEpisodes
		if (!third) return null
		const episodes = (x: { episodes: number }) =>
			`${count(x.episodes)} episodes`
		return {
			id: "quiz-most-episodes",
			category: "Shows",
			question: "Which show has the most episodes?",
			answers: [
				titleAnswer(first, episodes(first)),
				titleAnswer(third, episodes(third)),
				titleAnswer(second, episodes(second)),
			],
			right: titleKey(first),
			explain: `${first.title} has ${count(first.episodes)} episodes since ${first.year}.`,
			link: { to: titleHref(first), label: first.title },
		}
	},
	// Members' most given score, against the runner-up and the perfect 10 (or the third).
	(s) => {
		const given = s.members.scores.spread
			.map((n, i) => ({ score: i + 1, n }))
			.sort((a, b) => b.n - a.n)
		const [top, next] = given
		const other =
			given.find((x) => x.score === 10 && x !== top && x !== next) ?? given[2]
		if (!other || !top.n) return null
		const times = (x: { n: number }) => `given ${count(x.n)} times`
		const answer = (x: { score: number; n: number }): QuizAnswer => ({
			key: String(x.score),
			label: String(x.score),
			sub: "out of 10",
			detail: times(x),
		})
		return {
			id: "quiz-member-score",
			category: "Members",
			question: "Which score do members give most often?",
			answers: three(answer(top), [answer(next), answer(other)], 2),
			right: String(top.score),
			explain: `Members gave ${count(top.n)} scores of ${top.score}, against ${count(next.n)} of ${next.score} and ${count(other.n)} ${other.score === 10 ? "perfect 10s" : `of ${other.score}`}.`,
		}
	},
	// Runtime by decade: the longest, against two decades people guess (the epic sixties, the nineties).
	(s) => {
		const decades = s.charts.runtimeByDecade
		const longest = decades.reduce((a, b) => (b.minutes > a.minutes ? b : a))
		const guesses = [1960, 1990, 1950, 1980, 2000]
			.map((d) => decades.find((x) => x.decade === d))
			.filter((x): x is (typeof decades)[number] => !!x && x !== longest)
		const [a, b] = guesses
		if (!a || !b) return null
		const answer = (d: { decade: number; minutes: number }): QuizAnswer => ({
			key: String(d.decade),
			label: `The ${d.decade}s`,
			detail: `${d.minutes} minutes`,
		})
		return {
			id: "quiz-runtime-decade",
			category: "Runtime",
			question: "Which decade's movies run longest on average?",
			answers: three(answer(longest), [answer(b), answer(a)], 1),
			right: String(longest.decade),
			explain: `Movies from the ${longest.decade}s average ${longest.minutes} minutes, against ${b.minutes} in the ${b.decade}s and ${a.minutes} in the ${a.decade}s.`,
		}
	},
	// Episodes by IMDb votes: the top three.
	(s) => {
		const [first, second, third] = s.episodes.mostVoted
		if (!third) return null
		const answer = (e: StatsEpisode): QuizAnswer => ({
			key: `${e.showId}-${e.season}-${e.episode}`,
			label: episodeName(e),
			sub: `${e.show} · ${episodeCode(e)}`,
			detail: `${count(e.votes)} votes`,
			thumb: e.poster,
		})
		const answers = three(answer(first), [answer(second), answer(third)], 2)
		return {
			id: "quiz-episode-votes",
			category: "Episodes",
			question: "Which episode has the most IMDb votes?",
			answers,
			right: answer(first).key,
			explain: `${episodeName(first)} has ${count(first.votes)} votes. ${episodeName(third)} is third, with an IMDb score of ${oneDecimal(third.imdb)}.`,
			link: { to: episodeHref(first), label: episodeName(first) },
		}
	},
	// Streaming offers: everyone guesses the leader, so the quiz asks who comes after it.
	(s) => {
		const [first, second, third, fourth] = s.streaming.topCountries
		if (!fourth) return null
		const answer = (c: { code: string; offers: number }): QuizAnswer => ({
			key: c.code,
			label: regionName(c.code),
			country: c.code,
			detail: `${count(c.offers)} offers`,
		})
		const share = second.offers / first.offers
		return {
			id: "quiz-streaming-country",
			category: "Streaming",
			question: `After ${country(first.code)}, which country has the most streaming offers?`,
			answers: three(answer(second), [answer(fourth), answer(third)], 1),
			right: second.code,
			explain: `${capitalize(country(second.code))} has ${count(second.offers)} offers${share < 0.5 ? `, less than half of the ${count(first.offers)} in ${country(first.code)}` : `, against ${count(first.offers)} in ${country(first.code)}`}.`,
		}
	},
	// Sources agree: the closest match, against the widest splits from the Disagreements chapter.
	(s) => {
		const agree = s.trivia.sourcesAgree[0]
		const split = s.records.criticsVsAudience[0]
		const lb = [...s.records.imdbOverLetterboxd].sort(
			(a, b) => b.imdbVotes - a.imdbVotes,
		)[0]
		if (!agree || !split || !lb) return null
		const marks = [
			agree.imdb * 10,
			agree.letterboxd * 20,
			agree.metascore,
			agree.tomatometer,
		]
		const answers = three(
			titleAnswer(
				agree,
				`${Math.round(Math.min(...marks))} to ${Math.round(Math.max(...marks))} out of 100 everywhere`,
			),
			[
				titleAnswer(
					split,
					`Critics ${split.critics}%, audiences ${split.audience}%`,
				),
				titleAnswer(
					lb,
					`IMDb ${oneDecimal(lb.imdb)}, Letterboxd ${lb.letterboxd.toFixed(2)}`,
				),
			],
			1,
		)
		return {
			id: "quiz-sources-agree",
			category: "Scores",
			question:
				"Which movie do IMDb, Letterboxd, Metacritic and Rotten Tomatoes score alike?",
			answers,
			right: titleKey(agree),
			explain: `IMDb ${oneDecimal(agree.imdb)}, Letterboxd ${agree.letterboxd.toFixed(2)} of 5, a Metascore of ${agree.metascore} and ${agree.tomatometer}% on the Tomatometer.`,
			link: { to: titleHref(agree), label: agree.title },
		}
	},
	// Members by genre: the top average, against the runner-up and the most-scored genre.
	(s) => {
		const genres = s.members.genres
		const [best, second] = genres
		const busiest = [...genres]
			.sort((a, b) => b.scores - a.scores)
			.find((g) => g !== best && g !== second)
		const last = genres[genres.length - 1]
		if (!best || !second || !busiest) return null
		const answer = (g: { genre: string; average: number }): QuizAnswer => ({
			key: g.genre,
			label: g.genre,
			detail: `${oneDecimal(g.average)} on average`,
		})
		return {
			id: "quiz-member-genre",
			category: "Members",
			question: "Which genre do members score highest?",
			answers: three(answer(best), [answer(busiest), answer(second)], 0),
			right: best.genre,
			explain: `${best.genre} averages ${oneDecimal(best.average)} across ${count(best.scores)} scores. ${last.genre} comes last at ${oneDecimal(last.average)}.`,
		}
	},
]

const capitalize = (text: string) =>
	text.charAt(0).toUpperCase() + text.slice(1)

export function buildQuiz(s: StatsSnapshot): QuizQuestion[] {
	return QUESTIONS.flatMap((build) => {
		const q = build(s)
		return q && distinct(q.answers) && q.answers.some((a) => a.key === q.right)
			? [q]
			: []
	})
}

export interface Verdict {
	label: string
	line: string
}

/** A playful verdict for a finished quiz. */
export function verdict(right: number, total: number): Verdict {
	if (right === total)
		return {
			label: "Perfect score",
			line: `${total} for ${total}. You could have written this page.`,
		}
	const share = right / total
	if (share >= 0.8)
		return {
			label: "Film buff",
			line: "You know your catalog. One more round for a perfect score?",
		}
	if (share >= 0.5)
		return {
			label: "Regular",
			line: "More right than wrong, and a few new facts for movie night.",
		}
	if (share >= 0.2)
		return {
			label: "Casual viewer",
			line: "The numbers surprised you. That's what they're for.",
		}
	return {
		label: "Fresh eyes",
		line: "Almost every answer was news to you, so this page did its job.",
	}
}
