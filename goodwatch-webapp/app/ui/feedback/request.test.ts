// The Feedback tab's requests: each fix mode problem's payload (fix-mode-contract.md), Send feedback's message, and how
// the server's answer becomes the thanks screen's outcome.
import "../../server/title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"

const {
	RICH_AREAS,
	newDraft,
	problemsOf,
	reportOfDraft,
	ready,
	spotOf,
	subjectOf,
} = await import("./problems.ts")
const {
	buildMessageRequest,
	buildReportRequest,
	emailProblem,
	fallbackOutcome,
	linkProblem,
	sendFailure,
	summaryOf,
} = await import("./request.ts")
const { outcomeOf } = await import("../../utils/feedback.ts")
type Subjects = import("./subject.ts").FeedbackSubject
type Draft = import("./problems.ts").Draft

const KEY = "0b8a3c1e-5d2f-4a6b-9c7d-1e2f3a4b5c6d"
const envelope = { idempotencyKey: KEY, startedAt: 1_000 }

const show: Subjects = {
	kind: "title",
	mediaType: "show",
	tmdbId: 136315,
	title: "The Bear",
	country: "US",
	date: "2022-06-23",
	seasons: 4,
	episodes: 38,
	offers: [
		{ providerId: 15, name: "Hulu", logo: "/hulu.png", type: "flatrate" },
		{ providerId: 337, name: "Disney+", logo: "/d.png", type: "flatrate" },
		{ providerId: 337, name: "Disney+", logo: "/d.png", type: "buy" },
	],
	cast: [
		{
			id: 1218635,
			name: "Jeremy Allen White",
			character: "Carmen Berzatto",
			profilePath: "/jaw.jpg",
		},
		{
			id: 1,
			name: "Ayo Edebiri",
			character: "Sydney Adamu",
			profilePath: null,
		},
	],
	castTotal: 40,
	scores: [
		{ id: "goodwatch", label: "GoodWatch score", value: "84" },
		{ id: "imdb", label: "IMDb", value: "8.5" },
	],
	grid: [
		{
			number: 1,
			episodes: [
				{ number: 1, name: "System", score: 8.2 },
				{ number: 7, name: "Review", score: 9.4 },
			],
		},
	],
}
const person: Subjects = {
	kind: "person",
	tmdbId: 1218635,
	name: "Jeremy Allen White",
	department: "Acting",
	firstYear: 2006,
	lastYear: 2025,
	titleCount: 41,
	credits: [
		{
			tmdbId: 136315,
			mediaType: "tv",
			title: "The Bear",
			year: "2022",
			role: "as Carmen Berzatto",
		},
	],
}

const problem = (area: keyof typeof RICH_AREAS, id: string) => {
	const p = problemsOf(area).find((x) => x.id === id)
	assert.ok(p, `${area}/${id}`)
	return p
}
const draft = (
	area: keyof typeof RICH_AREAS,
	id: string,
	subject: Subjects,
	fill: Partial<Draft> = {},
): Draft => ({
	...newDraft(area, subject),
	problem: problem(area, id),
	...fill,
})
const data = (d: Draft, subject: Subjects) => {
	const r = buildReportRequest(reportOfDraft(d, subject), envelope)
	assert.equal(r.kind, "data")
	assert.ok(r.data)
	return r.data
}

test("a wrong character names the person and the right name", () => {
	const d = draft("cast", "character", show, {
		person: 1218635,
		suggested: "Carmy Berzatto",
	})
	assert.equal(ready(d, "send"), true)
	const r = buildReportRequest(reportOfDraft(d, show), envelope)
	assert.deepEqual(r, {
		kind: "data",
		message:
			"Wrong character name: Jeremy Allen White as Carmen Berzatto. Should be: Carmy Berzatto",
		idempotencyKey: KEY,
		website: "",
		startedAt: 1_000,
		data: {
			entityKind: "show",
			entityName: "The Bear",
			ids: { tmdbId: 136315 },
			field: "character",
			currentValue: "Jeremy Allen White as Carmen Berzatto",
			suggestedValue: "Carmy Berzatto",
			area: "cast",
			problem: "character",
			target: { personId: 1218635 },
		},
	})
})

test("someone isn't in it removes the person; no source link is sent unless it's a link", () => {
	const d = draft("cast", "not-in-it", show, { person: 1, link: "not a link" })
	const out = data(d, show)
	assert.equal(out.problem, "not-in-it")
	assert.equal(out.suggestedValue, "Remove")
	assert.deepEqual(out.target, { personId: 1 })
	assert.equal(out.sourceLink, undefined)
	assert.equal(linkProblem("not a link"), true)
})

test("a service that isn't there names the service, the offer type and the country", () => {
	const d = draft("watch", "not-there", show, {
		provider: 337,
		providerName: "Disney+",
		offer: "buy",
	})
	assert.equal(d.country, "US")
	const out = data(d, show)
	assert.deepEqual(out.target, {
		providerId: 337,
		offerType: "buy",
		country: "US",
	})
	assert.equal(out.country, "US")
	assert.deepEqual(out.providerIds, [337])
	assert.equal(out.suggestedValue, "Not on Disney+")
	assert.equal(out.field, "providers")
})

test("a missing service sends what to add and its source link", () => {
	const d = draft("watch", "missing", show, {
		provider: 8,
		providerName: "Netflix",
		offer: "flatrate",
		link: "https://www.netflix.com/title/81000000",
	})
	const out = data(d, show)
	assert.equal(out.problem, "missing")
	assert.deepEqual(out.target, {
		providerId: 8,
		offerType: "flatrate",
		country: "US",
	})
	assert.equal(out.sourceLink, "https://www.netflix.com/title/81000000")
	assert.equal(out.currentValue, "Not listed: Netflix")
	assert.equal(out.suggestedValue, "Netflix · Stream · US")
})

test("a wrong link names the service and the country", () => {
	const d = draft("watch", "link", show, {
		provider: 15,
		suggested: "https://www.hulu.com/series/the-bear",
	})
	const out = data(d, show)
	assert.deepEqual(out.target, { providerId: 15, country: "US" })
	assert.equal(out.suggestedValue, "https://www.hulu.com/series/the-bear")
})

test("episode problems carry the season and the episode", () => {
	const title = data(
		draft("episodes", "ep-title", show, {
			season: 1,
			episode: 7,
			suggested: "Review!",
		}),
		show,
	)
	assert.deepEqual(title.target, { seasonNumber: 1, episodeNumber: 7 })
	assert.equal(title.currentValue, "S1 E7 · “Review”")
	assert.equal(title.field, "episode_name")
	const date = data(
		draft("episodes", "ep-date", show, {
			season: 1,
			episode: 1,
			suggested: "2022-06-22",
		}),
		show,
	)
	assert.equal(date.problem, "ep-date")
	assert.equal(date.suggestedValue, "2022-06-22")
	assert.equal(date.field, "episode_air_date")
	const score = data(
		draft("episodes", "ep-score", show, { note: "Too low" }),
		show,
	)
	assert.equal(score.suggestedValue, undefined)
	assert.equal(score.note, "Too low")
	assert.equal(score.currentValue, "S1 E1 · IMDb 8.2")
})

test("a wrong date sends the full date", () => {
	const out = data(
		draft("details", "date", show, { suggested: "2022-06-22" }),
		show,
	)
	assert.equal(out.problem, "date")
	assert.equal(out.currentValue, "First aired June 23, 2022")
	assert.equal(out.suggestedValue, "2022-06-22")
	assert.equal(out.target, undefined)
})

test("scores and title analysis are flags; a score names its source", () => {
	const d = draft("scores", "score-wrong", show, { source: "imdb" })
	const r = reportOfDraft(d, show)
	assert.equal(r.kind, "flag")
	const out = data(d, show)
	assert.deepEqual(out.target, { scoreSource: "imdb" })
	assert.equal(out.currentValue, "IMDb: 8.5")
	assert.equal(out.suggestedValue, undefined)
	const analysis = reportOfDraft(
		draft("analysis", "analysis-scale", show),
		show,
	)
	assert.equal(analysis.kind, "flag")
	assert.equal(analysis.area, "analysis")
})

test("credits on a person page point at the title by TMDB id and type", () => {
	const d = draft("credits", "role", person, {
		credit: "tv:136315",
		suggested: "Carmy",
	})
	const r = buildReportRequest(reportOfDraft(d, person), envelope)
	assert.equal(r.data?.entityKind, "person")
	assert.deepEqual(r.data?.ids, { tmdbId: 1218635 })
	assert.deepEqual(r.data?.target, {
		creditTmdbId: 136315,
		creditMediaType: "tv",
	})
	assert.equal(r.data?.currentValue, "The Bear (2022) · as Carmen Berzatto")
	const gone = data(
		draft("credits", "not-theirs", person, { credit: "tv:136315" }),
		person,
	)
	assert.equal(gone.suggestedValue, "Remove")
	assert.equal(
		spotOf(draft("credits", "role", person, { credit: "tv:136315" })),
		"credit:tv:136315",
	)
})

test("an answer typed under Something else goes in the note, not the target", () => {
	const d = draft("cast", "character", show, {
		others: { person: "The cousin" },
		suggested: "Richie",
	})
	assert.equal(ready(d, "questions"), true)
	const out = data(d, show)
	assert.equal(out.target, undefined)
	assert.equal(out.note, "Who: The cousin")
	const blank = draft("cast", "character", show, { others: { person: " " } })
	assert.equal(ready(blank, "questions"), false)
})

test("Something else needs words and is never a correction", () => {
	const d = draft("watch", "other", show)
	assert.equal(ready(d, "send"), false)
	const out = data({ ...d, note: "Two Hulu tiles" }, show)
	assert.equal(out.problem, "other")
	assert.equal(out.currentValue, undefined)
	assert.equal(out.suggestedValue, undefined)
	assert.equal(out.note, "Two Hulu tiles")
	assert.equal(reportOfDraft({ ...d, note: "x" }, show).kind, "fix")
	assert.equal(
		reportOfDraft({ ...draft("scores", "other", show), note: "x" }, show).kind,
		"flag",
	)
})

test("a part on a page without a title or person goes as a bug report naming the part", () => {
	const r = buildReportRequest(
		{
			area: "results",
			problem: "a-score-looks-wrong",
			label: "A score looks wrong",
			kind: "flag",
			subject: null,
			field: "results",
			note: "The second card",
		},
		{ ...envelope, email: "sam@example.com" },
	)
	assert.deepEqual(r, {
		kind: "bug",
		message:
			"Page part: results\nProblem: A score looks wrong (a-score-looks-wrong)\nThe second card",
		idempotencyKey: KEY,
		website: "",
		startedAt: 1_000,
		email: "sam@example.com",
	})
})

test("a generic part on a title page is a data report about the title", () => {
	const r = buildReportRequest(
		{
			area: "related",
			problem: "a-title-isn-t-similar",
			label: "A title isn't similar",
			kind: "flag",
			subject: subjectOf(show),
			field: "related",
		},
		envelope,
	)
	assert.equal(r.kind, "data")
	assert.equal(r.data?.area, "related")
	assert.equal(r.message, "A title isn't similar")
})

test("Send feedback sends the message, the kind and the screenshot only when taken", () => {
	assert.deepEqual(
		buildMessageRequest({ kind: "idea", message: "  Dark mode  " }, envelope),
		{
			kind: "idea",
			message: "Dark mode",
			idempotencyKey: KEY,
			website: "",
			startedAt: 1_000,
		},
	)
	const withShot = buildMessageRequest(
		{ kind: "bug", message: "Broken", screenshot: "AAAA" },
		{ ...envelope, email: "not-an-email" },
	)
	assert.equal(withShot.screenshot, "AAAA")
	assert.equal("email" in withShot, false)
	assert.equal(emailProblem("not-an-email"), true)
	assert.equal(emailProblem(""), false)
})

test("the server's outcome wins; without one a fix is pending and a flag a flag", () => {
	assert.deepEqual(
		outcomeOf(
			{ reportId: "r", outcome: "live", correctionId: "c1" },
			"pending",
		),
		{ outcome: "live", correctionId: "c1" },
	)
	assert.deepEqual(
		outcomeOf(
			{ reportId: "r", outcome: "pending", correctionId: null },
			"pending",
		),
		{ outcome: "pending", correctionId: null },
	)
	assert.deepEqual(outcomeOf({ reportId: "r", outcome: "flag" }, "pending"), {
		outcome: "flag",
		correctionId: null,
	})
	assert.deepEqual(outcomeOf({ reportId: "r" }, fallbackOutcome("fix")), {
		outcome: "pending",
		correctionId: null,
	})
	assert.deepEqual(outcomeOf({ reportId: "r" }, fallbackOutcome("flag")), {
		outcome: "flag",
		correctionId: null,
	})
	assert.deepEqual(
		outcomeOf({ reportId: "r", outcome: "bogus" as never }, "pending"),
		{ outcome: "pending", correctionId: null },
	)
})

test("refusals read as busy, rejected or try again", () => {
	assert.equal(sendFailure(429), "busy")
	assert.equal(sendFailure(413), "rejected")
	assert.equal(sendFailure(0), "retry")
	assert.equal(sendFailure(503), "retry")
})

test("the summary says what to take off", () => {
	const r = reportOfDraft(draft("cast", "not-in-it", show, { person: 1 }), show)
	assert.equal(
		summaryOf(r),
		"Someone isn't in it: Ayo Edebiri as Sydney Adamu. Take it off",
	)
})
