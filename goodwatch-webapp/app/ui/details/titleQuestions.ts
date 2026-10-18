// The questions section of a title page. Every answer carries a fact about this title, and a question is asked
// only when its data says something: where to stream it and whether it's worth watching on every page, the rest only
// when they clear their thresholds (see docs/research/discovery-search/title-qa-proposal.md). The page leaves out
// what the hero line already says (runtime, seasons and episodes, year, an adults-only rating) and the questions about
// how a title feels unless the verdict is strong (fingerprintQuestions.ts). At most 7 questions; a title with fewer
// than 3 gets no section.

import type { MovieResult, ShowResult } from "~/server/types/details-types"
import {
	type FingerprintAnswer,
	type FingerprintQuestionId,
	MAX_FINGERPRINT_QUESTIONS,
	fingerprintAnswers,
} from "~/ui/details/fingerprintQuestions"
import { countriesWithOffers } from "~/ui/details/hero/countryOffers"
import { list } from "~/ui/fingerprint/fingerprintText"
import { languageName, regionName } from "~/utils/display-names"
import { titlePath } from "~/utils/helpers"
import { goodwatchScoreDisplay } from "~/utils/ratings"
import { streamingLinks } from "~/utils/streaming-links"

type Media = MovieResult | ShowResult

/** The most questions the section asks. */
export const MAX_QUESTIONS = 7
/** The fewest questions worth a section; with fewer the page has none. */
export const MIN_QUESTIONS = 3

export interface TitleQuestion {
	id: QuestionId
	q: string
	a: string
	/** For a question answered from the fingerprint: the answer's visual and the traits behind it. */
	fingerprint?: FingerprintAnswer
	/** For the sequel question: the collection's movies in order, as links. */
	titles?: { id: number; path: string; label: string; current: boolean }[]
}

export type QuestionId =
	| "stream"
	| "worth"
	| "seasons"
	| "sequel"
	| "kids"
	| "binge"
	| "boxoffice"
	| "language"
	| "tropes"
	| FingerprintQuestionId

/** A movie of the title's collection, in release order, as the collection section has it. */
export interface CollectionMovie {
	tmdb_id: number
	title: string
	/** The title in the page address. */
	canonical_title?: string | null
	release_year?: string | number | null
}

/** What the questions read besides the title's details. */
export interface QuestionExtras {
	/** The movies of a movie's collection, oldest first, the title among them. */
	collection?: readonly CollectionMovie[] | null
}

/** "in the United States" */
const inCountry = (country: string) => {
	const name = regionName(country)
	return `in ${name === "United States" ? "the United States" : name}`
}

/** The names of the services with these offer types, as Where to Watch lists them, a service's plans as one. */
const serviceNames = (media: Media, country: string, types: string[]) => [
	...new Set(streamingLinks(media, country, types).map((link) => link.name.replace(/\s+Premium\+$/i, ""))),
]

function streamAnswer(media: Media, country: string) {
	const T = media.details.title
	const subs = serviceNames(media, country, ["flatrate", "flatrate_and_buy"])
	const free = serviceNames(media, country, ["free", "ads"]).filter((n) => !subs.includes(n))
	const store = serviceNames(media, country, ["rent", "buy"])
	// Where to Watch's "Also streaming in N other countries".
	const others = countriesWithOffers(media, "flatrate").filter((c) => c.code !== country).length
	const here = inCountry(country)
	const In = `I${here.slice(1)}`
	const watch = [subs.length ? `streams on ${list(subs.slice(0, 5))}` : "", free.length ? `is free with ads on ${list(free)}` : ""].filter(Boolean)
	const parts: string[] = []
	if (watch.length) parts.push(`${In}, ${T} ${watch.join(", and it ")}.`)
	if (store.length) parts.push(`${watch.length ? "You can" : `${In}, you can`} rent or buy ${watch.length ? "it" : T} from ${list(store.slice(0, 5))}.`)
	if (others) parts.push(`It ${watch.length ? "also " : ""}streams in ${others} other ${others === 1 ? "country" : "countries"}${watch.length ? "" : `, but not ${here}`}.`)
	return parts.length ? parts.join(" ") : null
}

// Critics vs audiences on the same 0-100 scale.
export function agreement(media: Media) {
	const d = media.details
	const avg = (xs: (number | null | undefined)[]) => {
		const v = xs.filter((x): x is number => typeof x === "number" && x > 0)
		return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null
	}
	const critics = avg([d.rotten_tomatoes_tomato_score_original, d.metacritic_meta_score_original])
	const audience = avg([
		d.rotten_tomatoes_audience_score_original,
		d.metacritic_user_score_original ? d.metacritic_user_score_original * 10 : null,
		d.imdb_user_score_original ? d.imdb_user_score_original * 10 : null,
	])
	return { critics, audience }
}

/** Critics and audiences this far apart (0-100) is worth saying. */
const AGREEMENT_GAP = 10
function worthAnswer(media: Media) {
	const d = media.details
	const gw = d.goodwatch_overall_score_normalized_percent
	if (gw == null) return null
	// The score as the page shows it everywhere, the ring beside the answer included.
	const score = goodwatchScoreDisplay(gw)
	const others = [
		d.imdb_user_score_original != null ? `IMDb ${d.imdb_user_score_original}` : "",
		d.rotten_tomatoes_tomato_score_original != null ? `Rotten Tomatoes ${d.rotten_tomatoes_tomato_score_original}%` : "",
		d.metacritic_meta_score_original != null ? `Metacritic ${d.metacritic_meta_score_original}` : "",
	].filter(Boolean)
	const verdict =
		score >= 80 ? "Yes, it's widely acclaimed" : score >= 65 ? "Mostly, it's well received" : score >= 50 ? "Opinions are mixed" : "Reviews are weak"
	const parts = [`${verdict}, with a GoodWatch score of ${score}${others.length ? ` (${list(others)})` : ""}.`]
	const { critics, audience } = agreement(media)
	if (critics != null && audience != null && Math.abs(critics - audience) >= AGREEMENT_GAP)
		parts.push(
			critics > audience
				? `Critics rate it higher (${critics} out of 100) than audiences (${audience}).`
				: `Audiences rate it higher (${audience} out of 100) than critics (${critics}).`,
		)
	const weakSpot = media.mediaType === "show" && media.season_summary?.weakSpot
	if (weakSpot) parts.push(weakSpot)
	return parts.join(" ")
}

/** Whether a movie is a sequel, or has one, from its collection. */
function sequelQuestion(
	media: Media,
	collection: readonly CollectionMovie[] | null | undefined,
): [string, string, TitleQuestion["titles"]] | null {
	if (media.mediaType !== "movie" || !collection || collection.length < 2) return null
	const index = collection.findIndex((m) => m.tmdb_id === media.details.tmdb_id)
	if (index < 0) return null
	const T = media.details.title
	const named = (m: CollectionMovie) => (m.release_year ? `${m.title} (${m.release_year})` : m.title)
	const place = `movie ${index + 1} of ${collection.length}`
	const before = collection[index - 1]
	const after = collection[index + 1]
	const titles = collection.map((m) => ({
		id: m.tmdb_id,
		path: titlePath("movie", m.tmdb_id, m.canonical_title || m.title),
		label: named(m),
		current: m.tmdb_id === media.details.tmdb_id,
	}))
	if (index === 0)
		return [`Is there a sequel to ${T}?`, `Yes: it's ${place} in its series, followed by ${named(after)}.`, titles]
	return [
		`Is ${T} a sequel?`,
		`Yes: it's ${place} in its series, after ${named(before)}${after ? ` and before ${named(after)}` : ""}.`,
		titles,
	]
}

export function ageInfo(media: Media, country: string) {
	const certs = media.details.age_certifications ?? []
	const find = (cc: string) => certs.find((c) => c.startsWith(`${cc}_`))?.split("_")[1]
	const cc = find(country) ? country : "US"
	const cert = find(cc)
	const advisories = ((media.details as unknown as { content_advisories?: string[] }).content_advisories ?? []).map((a) => a.toLowerCase())
	return { cc, cert, advisories }
}

// Ratings where "is it okay for kids" has no obvious answer: neither for everyone nor adults only.
const MIDDLE_RATINGS = ["PG", "PG-13", "TV-PG", "TV-14", "12A", "12", "6"]

function kidsAnswer(media: Media, country: string) {
	const { cc, cert, advisories } = ageInfo(media, country)
	const who = (media.fingerprint?.socialSuitability ?? []).map((entry) => entry.name)
	const kids = who.includes("Kids")
	const family = who.includes("Family Movie Night")
	const teens = who.includes("Teens")
	if (!MIDDLE_RATINGS.includes(cert ?? "") && !kids && !family) return null
	const rated = cert
		? `it's rated ${cert} ${inCountry(cc)}${advisories.length ? ` for ${list(advisories)}` : ""}`
		: advisories.length
			? `its content advisories are ${list(advisories)}`
			: ""
	const guide = kids
		? "the viewing guide lists it for kids"
		: family
			? "the viewing guide lists it for family nights"
			: teens
				? "the viewing guide lists it for teens and adults"
				: "the viewing guide lists it for adults"
	const verdict = kids || family ? "Yes" : teens ? "Not for young kids" : "Better for older viewers"
	return `${verdict}: ${[rated, guide].filter(Boolean).join(", and ")}.`
}

function bingeAnswer(media: Media) {
	if (media.mediaType !== "show") return null
	const d = media.details as unknown as {
		number_of_seasons?: number
		number_of_episodes?: number
		episode_runtime?: number[] | null
		first_air_date?: string | number
		last_air_date?: string | number
		in_production?: boolean
	}
	const episodes = d.number_of_episodes
	const minutes = d.episode_runtime?.[0]
	if (!episodes || !minutes) return null
	const hours = Math.round((episodes * minutes) / 60)
	const year = (v?: string | number) => (v ? new Date(v).getUTCFullYear() : null)
	const from = year(d.first_air_date)
	const to = year(d.last_air_date)
	const seasons = d.number_of_seasons
	const span = from ? (d.in_production ? ` since ${from}, and it's still in production` : `, aired from ${from} to ${to ?? from}`) : ""
	return `About ${hours < 1 ? "an hour" : `${hours} ${hours === 1 ? "hour" : "hours"}`}: ${episodes} episodes${seasons ? ` in ${seasons} ${seasons === 1 ? "season" : "seasons"}` : ""} of about ${minutes} minutes each${span}.`
}

export const money = (n: number) => (n >= 1e9 ? `$${(n / 1e9).toFixed(1)} billion` : n >= 1e6 ? `$${Math.round(n / 1e6)} million` : `$${n.toLocaleString("en-US")}`)

/** A clear hit (3 times the budget or more) or a flop (under the budget); nothing in between. */
function boxOfficeQuestion(media: Media): [string, string] | null {
	const { budget, revenue } = media.details
	if (media.mediaType !== "movie" || !budget || !revenue || budget < 1e6 || revenue < 1e6) return null
	const T = media.details.title
	const x = revenue / budget
	const made = `it cost about ${money(budget)} to make and earned ${money(revenue)} worldwide`
	if (x >= 3) return [`Was ${T} a box office hit?`, `${x >= 5 ? "Yes, a big one" : "Yes"}: ${made}, ${x.toFixed(1)} times its budget.`]
	if (x < 1) return [`Was ${T} a box office flop?`, `Yes: ${made}, ${Math.round(x * 100)}% of its budget.`]
	return null
}

function languageQuestion(media: Media): [string, string] | null {
	const d = media.details
	if (!d.original_language_code || d.original_language_code === "en") return null
	const others = (d.spoken_language_codes ?? []).filter((c) => c !== d.original_language_code).map((code) => languageName(code))
	return [
		`Is ${d.title} in English?`,
		`No, it was made in ${languageName(d.original_language_code)}${others.length ? `, with some ${list(others)}` : ""}.`,
	]
}

/** The trope chips: the payload carries the featured tropes, already in order (see orderTropes in title-details-shape). */
export const featuredTropes = (media: { details: { tropes?: string[] | null } }, n = FEATURED_TROPES) =>
	(media.details.tropes ?? []).slice(0, n)

/** How many trope chips the questions section shows. */
export const FEATURED_TROPES = 12
/** A title with fewer TV Tropes entries gets no tropes question. */
const MIN_TROPES = 20

/** How many tropes TV Tropes lists for the title, also when the payload carries only the featured ones. */
export const tropeCount = (media: Media) => media.details.tropes_count ?? media.details.tropes?.length ?? 0

function tropesAnswer(media: Media) {
	const count = tropeCount(media)
	if (count < MIN_TROPES) return null
	return `TV Tropes lists ${count.toLocaleString("en-US")} tropes for it, including ${list(featuredTropes(media, 3))}.`
}

/** The title's questions, in the order the section shows them; none when fewer than MIN_QUESTIONS qualify. */
export function titleQuestions(media: Media, country: string, extras: QuestionExtras = {}): TitleQuestion[] {
	const questions = qualifyingQuestions(media, country, extras)
	return questions.length >= MIN_QUESTIONS ? questions : []
}

/** The questions whose data clears their thresholds, at most MAX_QUESTIONS, before the section's floor. */
export function qualifyingQuestions(media: Media, country: string, extras: QuestionExtras = {}): TitleQuestion[] {
	const T = media.details.title
	const fact = (id: QuestionId, q: string, a: string | null): TitleQuestion[] => (a ? [{ id, q, a }] : [])
	const asked = (id: QuestionId, qa: [string, string, TitleQuestion["titles"]?] | null): TitleQuestion[] =>
		qa ? [{ id, q: qa[0], a: qa[1], ...(qa[2] && { titles: qa[2] }) }] : []
	const feel = fingerprintAnswers(media)
		.slice(0, MAX_FINGERPRINT_QUESTIONS)
		.map((answer) => ({ id: answer.id, q: answer.q, a: answer.a, fingerprint: answer }))
	const questions: TitleQuestion[] = [
		...fact("stream", `Where can I stream ${T}?`, streamAnswer(media, country)),
		...fact("worth", `Is ${T} worth watching?`, worthAnswer(media)),
		...(media.mediaType === "show" && media.season_summary?.question ? [{ id: "seasons" as const, ...media.season_summary.question }] : []),
		...asked("sequel", sequelQuestion(media, extras.collection)),
		...fact("kids", `Is ${T} okay for kids?`, kidsAnswer(media, country)),
		...fact("binge", `How long does it take to watch ${T}?`, bingeAnswer(media)),
		...feel,
		...asked("boxoffice", boxOfficeQuestion(media)),
		...asked("language", languageQuestion(media)),
		...fact("tropes", `What tropes does ${T} use?`, tropesAnswer(media)),
	]
	return questions.slice(0, MAX_QUESTIONS)
}
