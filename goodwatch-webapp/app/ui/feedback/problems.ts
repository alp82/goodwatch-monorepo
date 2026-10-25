// The questions fix mode asks about a title or a person page's parts, and the report each answer makes. No React here,
// so node:test covers it (request.test.ts). The generic parts of the other pages are in areas.ts.
//
// Members correct plain facts (cast and crew, dates, episode titles, a wrong or missing streaming service); everything
// computed (scores, title analysis) is flagged for staff. The server decides what goes live
// (docs/implementation/feedback/fix-mode-contract.md); the client only sends what was picked.
import type { FeedbackSubject, PersonSubject, TitleSubject } from "./subject"

export type Kind = "fix" | "flag"
export type Outcome = "live" | "pending" | "flag"

export type RichArea =
	| "watch"
	| "scores"
	| "analysis"
	| "episodes"
	| "details"
	| "cast"
	| "credits"
	| "person"

export type Question =
	| "provider"
	| "missingProvider"
	| "offer"
	| "country"
	| "episode"
	| "person"
	| "credit"
	| "source"

export type Problem = {
	id: string
	label: string
	/** Flag-only problems are never applied; staff look at them. */
	flag?: boolean
	/** The questions after "What's wrong?". */
	ask: Question[]
	/** The suggested value's label; none for a problem that only removes something. */
	suggest?: string
	/** What the report changes, for staff. */
	field: string
}

export const SOMETHING_ELSE = "Something else"

export const RICH_AREAS: Record<
	RichArea,
	{ label: string; problems: Problem[] }
> = {
	watch: {
		label: "Where to watch",
		problems: [
			{
				id: "not-there",
				label: "It's not on a service listed here",
				ask: ["provider", "offer", "country"],
				field: "providers",
			},
			{
				id: "missing",
				label: "A service has it, but it's missing",
				ask: ["missingProvider", "offer", "country"],
				field: "providers",
			},
			{
				id: "link",
				label: "A link opens the wrong page",
				ask: ["provider", "country"],
				suggest: "Right link",
				field: "provider_link",
			},
		],
	},
	scores: {
		label: "Scores",
		problems: [
			{
				id: "score-wrong",
				label: "A score looks wrong or old",
				ask: ["source"],
				flag: true,
				field: "score",
			},
			{
				id: "score-title",
				label: "A score belongs to another title",
				ask: ["source"],
				flag: true,
				field: "score",
			},
		],
	},
	analysis: {
		label: "Title analysis",
		problems: [
			{
				id: "analysis-off",
				label: "The description doesn't fit",
				ask: [],
				flag: true,
				field: "title_analysis",
			},
			{
				id: "analysis-scale",
				label: "A scale is off (pace, tone, …)",
				ask: [],
				flag: true,
				field: "title_analysis",
			},
			{
				id: "analysis-goodfor",
				label: "“Good for” doesn't fit",
				ask: [],
				flag: true,
				field: "title_analysis",
			},
		],
	},
	episodes: {
		label: "Episodes",
		problems: [
			{
				id: "ep-title",
				label: "Wrong episode title",
				ask: ["episode"],
				suggest: "Right title",
				field: "episode_name",
			},
			{
				id: "ep-date",
				label: "Wrong air date",
				ask: ["episode"],
				suggest: "Right date",
				field: "episode_air_date",
			},
			{
				id: "ep-missing",
				label: "An episode is missing",
				ask: ["episode"],
				suggest: "Its title",
				field: "episodes",
			},
			{
				id: "ep-score",
				label: "An episode score looks wrong",
				ask: ["episode"],
				flag: true,
				field: "episode_score",
			},
		],
	},
	details: {
		label: "Details",
		problems: [
			{
				id: "date",
				label: "Wrong year or date",
				ask: [],
				suggest: "Right date",
				field: "date",
			},
			{
				id: "seasons",
				label: "Wrong number of seasons or episodes",
				ask: [],
				suggest: "Right count",
				field: "episode_count",
			},
			{
				id: "about",
				label: "The description is wrong",
				ask: [],
				flag: true,
				field: "description",
			},
		],
	},
	cast: {
		label: "Cast and crew",
		problems: [
			{
				id: "character",
				label: "Wrong character name",
				ask: ["person"],
				suggest: "Right name",
				field: "character",
			},
			{
				id: "not-in-it",
				label: "Someone isn't in it",
				ask: ["person"],
				field: "cast",
			},
			{
				id: "missing-person",
				label: "Someone is missing",
				ask: [],
				suggest: "Name and role",
				field: "cast",
			},
		],
	},
	credits: {
		label: "Credits",
		problems: [
			{
				id: "not-theirs",
				label: "A title isn't theirs",
				ask: ["credit"],
				field: "credits",
			},
			{
				id: "role",
				label: "Wrong role or character",
				ask: ["credit"],
				suggest: "Right role",
				field: "credit_role",
			},
			{
				id: "missing-credit",
				label: "A title is missing",
				ask: [],
				suggest: "Title and year",
				field: "credits",
			},
		],
	},
	person: {
		label: "Details",
		problems: [
			{
				id: "department",
				label: "Wrong main job",
				ask: [],
				suggest: "Right job",
				field: "known_for_department",
			},
			{
				id: "career",
				label: "Wrong career years",
				ask: [],
				suggest: "Right years",
				field: "career_years",
			},
			{
				id: "photo",
				label: "Wrong photo",
				ask: [],
				flag: true,
				field: "photo",
			},
		],
	},
}

export const TITLE_AREAS: RichArea[] = [
	"scores",
	"watch",
	"analysis",
	"episodes",
	"details",
	"cast",
]
export const PERSON_AREAS: RichArea[] = ["person", "credits"]

export const isRichArea = (
	area: string,
	subject: FeedbackSubject | null,
): area is RichArea =>
	subject?.kind === "title"
		? (TITLE_AREAS as string[]).includes(area)
		: subject?.kind === "person"
			? (PERSON_AREAS as string[]).includes(area)
			: false

/** The area's problems, ending with "Something else" (a flag where the area only takes flags). */
export function problemsOf(area: RichArea): Problem[] {
	const list = RICH_AREAS[area].problems
	const flagOnly = list.every((p) => p.flag)
	return [
		...list,
		{
			id: "other",
			label: SOMETHING_ELSE,
			ask: [],
			flag: flagOnly || undefined,
			field: area,
		},
	]
}

export const areaKind = (area: RichArea): Kind =>
	RICH_AREAS[area].problems.every((p) => p.flag) ? "flag" : "fix"

export const OFFER_LABEL: Record<string, string> = {
	flatrate: "Stream",
	free: "Free",
	ads: "Free with ads",
	rent: "Rent",
	buy: "Buy",
}
export type Offer = "flatrate" | "free" | "ads" | "rent" | "buy"
export const OFFERS: Offer[] = ["flatrate", "free", "ads", "rent", "buy"]

/** Everything a report says, filled in step by step. */
export type Draft = {
	area: RichArea
	problem?: Problem
	provider?: number
	/** The picked service's name (a missing one isn't on the page). */
	providerName?: string
	offer?: Offer
	country?: string
	season?: number
	episode?: number
	person?: number
	/** "movie:123" or "tv:123". */
	credit?: string
	source?: string
	suggested: string
	link: string
	note: string
	/** Questions answered with "Something else": the question and the typed answer. */
	others: Partial<Record<Question, string>>
}

export function newDraft(
	area: RichArea,
	subject: FeedbackSubject | null,
): Draft {
	const season = subject?.kind === "title" ? subject.grid[0] : undefined
	return {
		area,
		country: subject?.kind === "title" ? subject.country : undefined,
		season: season?.number,
		episode: season?.episodes[0]?.number,
		suggested: "",
		link: "",
		note: "",
		others: {},
	}
}

/** Problems whose suggested value is a date (the date field sends YYYY-MM-DD). */
export const DATE_PROBLEMS = ["date", "ep-date"]

/** The offer types a service has on the page, in the tabs' order. */
export const offersOf = (subject: TitleSubject, provider?: number): Offer[] =>
	OFFERS.filter((o) =>
		subject.offers.some((x) => x.providerId === provider && x.type === o),
	)

/** The services the page lists, once each. */
export const listedServices = (subject: TitleSubject) =>
	subject.offers.filter(
		(o, i, all) => all.findIndex((x) => x.providerId === o.providerId) === i,
	)

const serviceName = (d: Draft, subject: TitleSubject | null) =>
	d.providerName ??
	subject?.offers.find((o) => o.providerId === d.provider)?.name ??
	"a service"

const episodeOf = (subject: TitleSubject, season?: number, episode?: number) =>
	subject.grid
		.find((s) => s.number === season)
		?.episodes.find((e) => e.number === episode)

const creditOf = (subject: PersonSubject, key?: string) =>
	subject.credits.find((c) => `${c.mediaType}:${c.tmdbId}` === key)

const asTitle = (s: FeedbackSubject | null) => (s?.kind === "title" ? s : null)
const asPerson = (s: FeedbackSubject | null) =>
	s?.kind === "person" ? s : null

/** "2022-06-23" → "June 23, 2022"; anything else as it is. */
export function longDate(value: string | null | undefined): string {
	if (!value) return "No date"
	const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
	if (!m) return value
	const date = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
	return date.toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
		timeZone: "UTC",
	})
}

/** What the page shows now for the report's subject. */
export function currentValue(
	d: Draft,
	subject: FeedbackSubject | null,
): string {
	const p = d.problem?.id
	const title = asTitle(subject)
	const person = asPerson(subject)
	switch (d.area) {
		case "watch": {
			if (p === "missing")
				return d.provider || d.providerName
					? `Not listed: ${serviceName(d, title)}`
					: "Not listed"
			if (!d.provider)
				return title
					? listedServices(title)
							.map((s) => s.name)
							.slice(0, 4)
							.join(", ") || "No services listed"
					: "No services listed"
			const offer = d.offer ? ` · ${OFFER_LABEL[d.offer]}` : ""
			return `${serviceName(d, title)}${offer}${d.country ? ` · ${d.country}` : ""}`
		}
		case "episodes": {
			if (d.season === undefined || d.episode === undefined || !title)
				return "Pick an episode"
			const tag = `S${d.season} E${d.episode}`
			const e = episodeOf(title, d.season, d.episode)
			if (!e) return `${tag} · not listed`
			if (p === "ep-score")
				return `${tag} · IMDb ${e.score === null ? "–" : e.score.toFixed(1)}`
			return `${tag} · “${e.name}”`
		}
		case "cast": {
			if (p === "missing-person")
				return `${title?.castTotal ?? 0} people listed`
			const c = title?.cast.find((x) => x.id === d.person)
			return c ? `${c.name} as ${c.character || "—"}` : "Pick a person"
		}
		case "details":
			if (p === "seasons")
				return title?.seasons
					? `${title.episodes} episodes in ${title.seasons} seasons`
					: "No count listed"
			if (p === "date")
				return `${title?.mediaType === "show" ? "First aired" : "Released"} ${longDate(title?.date)}`
			return "The description on the page"
		case "scores": {
			const s = title?.scores.find((x) => x.id === d.source)
			return s ? `${s.label}: ${s.value}` : "Pick a score"
		}
		case "analysis":
			return "The title analysis on the page"
		case "credits": {
			if (p === "missing-credit")
				return `${person?.titleCount ?? 0} titles listed`
			const c = person && creditOf(person, d.credit)
			return c
				? `${c.title}${c.year ? ` (${c.year})` : ""}${c.role ? ` · ${c.role}` : ""}`
				: "Pick a title"
		}
		case "person":
			if (p === "career")
				return person?.firstYear
					? `${person.firstYear}–${person.lastYear ?? ""}`
					: "No years listed"
			if (p === "photo") return "Current photo"
			return person?.department ?? "No main job listed"
	}
}

/** The suggested value: what was typed, or what a removal or an addition means. */
export function suggestedValue(
	d: Draft,
	subject: FeedbackSubject | null,
): string {
	const p = d.problem?.id
	if (p === "not-there") return `Not on ${serviceName(d, asTitle(subject))}`
	if (p === "not-in-it" || p === "not-theirs") return "Remove"
	if (p === "missing")
		return [
			serviceName(d, asTitle(subject)),
			d.offer && OFFER_LABEL[d.offer],
			d.country,
		]
			.filter(Boolean)
			.join(" · ")
	return d.suggested.trim()
}

const QUESTION_LABEL: Record<Question, string> = {
	provider: "Service",
	missingProvider: "Service",
	offer: "How",
	country: "Country",
	episode: "Episode",
	person: "Who",
	credit: "Title",
	source: "Score",
}

/** "questions": every question answered (a pick, or typed text after "Something else"). "send": that, plus the words
 *  "Something else" needs. */
export function ready(d: Draft, stage: "questions" | "send"): boolean {
	if (!d.problem) return false
	const ok = (q: Question, v: unknown) =>
		q in d.others ? Boolean(d.others[q]?.trim()) : v !== undefined && v !== ""
	for (const q of d.problem.ask) {
		const value =
			q === "provider" || q === "missingProvider"
				? (d.provider ?? d.providerName)
				: q === "offer"
					? d.offer
					: q === "country"
						? d.country
						: q === "episode"
							? d.episode
							: q === "person"
								? d.person
								: q === "credit"
									? d.credit
									: q === "source"
										? d.source
										: true
		if (!ok(q, value)) return false
	}
	if (stage === "send" && d.problem.id === "other" && !d.note.trim())
		return false
	return true
}

/** The page part a picked answer points at, lit while the questions are open. */
export function spotOf(d: Draft): string | null {
	const a = d.problem?.ask ?? []
	if (a.includes("person") && d.person && !("person" in d.others))
		return `person:${d.person}`
	if (a.includes("provider") && d.provider && !("provider" in d.others))
		return `provider:${d.provider}`
	if (a.includes("source") && d.source && !("source" in d.others))
		return `source:${d.source}`
	if (a.includes("credit") && d.credit && !("credit" in d.others))
		return `credit:${d.credit}`
	if (
		a.includes("episode") &&
		d.season !== undefined &&
		!("episode" in d.others)
	)
		return `episode:${d.season}:${d.episode}`
	return null
}

// --- The report ---

export type Target = {
	personId?: number
	creditTmdbId?: number
	creditMediaType?: "movie" | "tv"
	seasonNumber?: number
	episodeNumber?: number
	providerId?: number
	offerType?: Offer
	country?: string
	scoreSource?: string
}

/** What one report says, before the request's envelope (request.ts). */
export type Report = {
	area: string
	problem: string
	/** The problem as the member picked it ("Wrong character name"). */
	label: string
	kind: Kind
	/** The title or person the page is about; null on pages without one. */
	subject: {
		entityKind: "movie" | "show" | "person"
		entityName: string
		ids: Record<string, number>
	} | null
	field: string
	currentValue?: string
	suggestedValue?: string
	sourceLink?: string
	target?: Target
	note?: string
	country?: string
	providerIds?: number[]
}

export function subjectOf(subject: FeedbackSubject | null): Report["subject"] {
	if (!subject) return null
	return subject.kind === "title"
		? {
				entityKind: subject.mediaType,
				entityName: subject.title,
				ids: { tmdbId: subject.tmdbId },
			}
		: {
				entityKind: "person",
				entityName: subject.name,
				ids: { tmdbId: subject.tmdbId },
			}
}

const COUNTRY = /^[A-Z]{2}$/

/** A picked problem with its answers, as a report. Typed "Something else" answers go in the note, not the target. */
export function reportOfDraft(
	d: Draft,
	subject: FeedbackSubject | null,
): Report {
	const problem = d.problem
	if (!problem) throw new Error("No problem picked")
	const other = (q: Question) => q in d.others
	const asks = (q: Question) => problem.ask.includes(q) && !other(q)
	const target: Target = {}
	if (asks("person") && d.person) target.personId = d.person
	if (asks("credit") && d.credit) {
		const [type, id] = d.credit.split(":")
		target.creditTmdbId = Number(id)
		target.creditMediaType = type === "tv" ? "tv" : "movie"
	}
	if (asks("episode") && d.season !== undefined && d.episode !== undefined) {
		target.seasonNumber = d.season
		target.episodeNumber = d.episode
	}
	const providerAsked = problem.ask.includes("provider")
		? "provider"
		: problem.ask.includes("missingProvider")
			? "missingProvider"
			: null
	if (providerAsked && !other(providerAsked) && d.provider)
		target.providerId = d.provider
	if (asks("offer") && d.offer) target.offerType = d.offer
	const country =
		asks("country") && d.country && COUNTRY.test(d.country)
			? d.country
			: undefined
	if (country) target.country = country
	if (asks("source") && d.source) target.scoreSource = d.source

	const typed = (Object.keys(d.others) as Question[])
		.filter((q) => d.others[q]?.trim())
		.map((q) => `${QUESTION_LABEL[q]}: ${d.others[q]?.trim()}`)
	const note = [...typed, d.note.trim()].filter(Boolean).join("\n")
	const isOther = problem.id === "other"
	const suggested = isOther || problem.flag ? "" : suggestedValue(d, subject)
	const link = d.link.trim()
	return {
		area: d.area,
		problem: problem.id,
		label: problem.label,
		kind: problem.flag ? "flag" : "fix",
		subject: subjectOf(subject),
		field: problem.field,
		currentValue: isOther ? undefined : currentValue(d, subject),
		suggestedValue: suggested || undefined,
		sourceLink: link || undefined,
		target: Object.keys(target).length ? target : undefined,
		note: note || undefined,
		country,
		providerIds: target.providerId ? [target.providerId] : undefined,
	}
}
