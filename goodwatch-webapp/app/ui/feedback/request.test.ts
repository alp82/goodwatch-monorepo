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
const { feedbackSchema } = await import("../../server/feedback/schema.ts")
const { mapCorrection } = await import("../../server/feedback/corrections.ts")
const { applyCorrectionRows } = await import(
	"../../server/feedback/apply-corrections.ts"
)
type Correction = import("../../server/feedback/corrections.ts").Correction
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
				{
					number: 1,
					name: "System",
					score: 8.2,
					canonicalSeason: 1,
					canonicalNumber: 1,
				},
				{
					number: 7,
					name: "Review",
					score: 9.4,
					canonicalSeason: 1,
					canonicalNumber: 7,
				},
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
			currentRole: "Carmen Berzatto",
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
	assert.equal(r.data?.currentValue, "Carmen Berzatto")
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

/** Exercise the merged server, not a second client-side model of its behavior. */
function correctionFor(d: Draft, subject: Subjects): Correction {
	const request = feedbackSchema.parse(
		buildReportRequest(reportOfDraft(d, subject), envelope),
	)
	const mapped = mapCorrection(request.data)
	assert.ok(mapped)
	return {
		...mapped,
		id: "correction",
		status: "live",
		member_id: "member",
		reviewer: null,
		report_id: "report",
		source_link: null,
		created_at: 1,
		updated_at: 1,
	}
}

test("episode corrections use canonical identity when displayed numbering differs", () => {
	const subject: Subjects = {
		...show,
		grid: [
			{
				number: 1,
				episodes: [
					{
						number: 2,
						name: "Selected",
						score: 8,
						canonicalSeason: 2,
						canonicalNumber: 1,
					},
					{
						number: 3,
						name: "Another",
						score: 8,
						canonicalSeason: 1,
						canonicalNumber: 2,
					},
				],
			},
		],
	}
	const correction = correctionFor(
		draft("episodes", "ep-title", subject, {
			season: 1,
			episode: 2,
			suggested: "Correct title",
		}),
		subject,
	)
	assert.deepEqual(correction.target, { seasonNumber: 2, episodeNumber: 1 })
	const result = applyCorrectionRows(
		{ kind: "show", id: show.tmdbId },
		{ seasons: subject.grid },
		[correction],
	)
	assert.equal(result.seasons[0].episodes[0].name, "Correct title")
	assert.equal(result.seasons[0].episodes[1].name, "Another")
})

test("unmatched grid episodes remain reports instead of guessing a catalog identity", () => {
	const subject: Subjects = {
		...show,
		grid: [
			{ number: 1, episodes: [{ number: 1, name: "Unmatched", score: 8 }] },
		],
	}
	for (const problem of ["ep-title", "ep-date"]) {
		const request = feedbackSchema.parse(
			buildReportRequest(
				reportOfDraft(
					draft("episodes", problem, subject, {
						suggested: problem === "ep-date" ? "2022-06-22" : "Title",
					}),
					subject,
				),
				envelope,
			),
		)
		assert.equal(mapCorrection(request.data), null)
	}
})

test("a character correction on an actor/producer credit changes characters, not jobs", () => {
	const correction = correctionFor(
		draft("credits", "role", person, {
			credit: "tv:136315",
			suggested: "Carmy",
		}),
		person,
	)
	const result = applyCorrectionRows(
		{ kind: "person", id: person.tmdbId },
		[
			{
				tmdb_id: 136315,
				media_type: "show",
				characters: ["Carmen Berzatto"],
				jobs: ["Producer"],
			},
		],
		[correction],
	)
	assert.deepEqual(result[0].characters, ["Carmy"])
	assert.deepEqual(result[0].jobs, ["Producer"])
})

test("any retained typed Other answer prevents a live correction", () => {
	const request = feedbackSchema.parse(
		buildReportRequest(
			reportOfDraft(
				draft("watch", "missing", show, {
					provider: 8,
					offer: "flatrate",
					link: "https://netflix.com/title/1",
					others: { provider: "A different service" },
				}),
				show,
			),
			envelope,
		),
	)
	assert.equal(mapCorrection(request.data), null)
	assert.match(request.data?.note ?? "", /A different service/)
	// Date corrections need no target, so dropping the target alone is not sufficient.
	const date = data(draft("details", "date", show, {
		suggested: "2022-06-22",
		others: { episode: "A different episode" },
	}), show)
	assert.equal(mapCorrection(feedbackSchema.parse({
		kind: "data", message: "Date", ...envelope, website: "", data: date,
	}).data), null)
})

test("every rich problem builds a request accepted by the merged strict schema", () => {
	for (const area of Object.keys(RICH_AREAS) as (keyof typeof RICH_AREAS)[]) {
		const subject = area === "person" || area === "credits" ? person : show
		for (const problem of problemsOf(area)) {
			const request = buildReportRequest(
				reportOfDraft(
					draft(area, problem.id, subject, {
						provider: 15,
						providerName: "Hulu",
						offer: "flatrate",
						person: 1218635,
						credit: "tv:136315",
						source: "imdb",
						suggested: "2022-06-22",
						link: "https://example.com/source",
						note: "What looks wrong",
					}),
					subject,
				),
				envelope,
			)
			assert.equal(
				feedbackSchema.safeParse(request).success,
				true,
				`${area}/${problem.id}`,
			)
		}
	}
})

test("all nine correction operations match the merged server mapping", () => {
	const cases = [
		["details", "date", "first_air_date", "set", false],
		["episodes", "ep-title", "name", "set", false],
		["episodes", "ep-date", "air_date", "set", false],
		["cast", "character", "character", "set", false],
		["cast", "not-in-it", "character", "remove", true],
		["credits", "role", "role", "set", false],
		["credits", "not-theirs", "role", "remove", true],
		["watch", "not-there", "offer", "remove", false],
		["watch", "missing", "offer", "add", false],
	] as const
	for (const [area, problem, field, op, review] of cases) {
		const subject = area === "credits" ? person : show
		const request = feedbackSchema.parse(
			buildReportRequest(
				reportOfDraft(
					draft(area, problem, subject, {
						provider: 15,
						offer: "flatrate",
						person: 1218635,
						credit: "tv:136315",
						suggested: "2022-06-22",
						link: "https://example.com/source",
					}),
					subject,
				),
				envelope,
			),
		)
		const correction = mapCorrection(request.data)
		assert.ok(correction, `${area}/${problem}`)
		assert.equal(correction.field, field)
		assert.equal(correction.op, op)
		assert.equal(correction.review, review)
	}
	const missing = data(
		draft("watch", "missing", show, { provider: 15, offer: "flatrate" }),
		show,
	)
	assert.equal(
		mapCorrection(missing)?.review,
		true,
		"provider addition without evidence waits for staff",
	)
})

test("email and evidence validators enforce the server syntax and size boundaries", () => {
	for (const email of [
		"a@b.c",
		"a..b@example.com",
		`${"a".repeat(243)}@example.com`,
	]) {
		assert.equal(emailProblem(email), true, email)
	}
	const maxEmail = `${"a".repeat(242)}@example.com`
	assert.equal(maxEmail.length, 254)
	assert.equal(emailProblem(maxEmail), false)
	assert.equal(
		feedbackSchema.safeParse(
			buildMessageRequest(
				{ kind: "bug", message: "Test" },
				{ ...envelope, email: maxEmail },
			),
		).success,
		true,
	)
	const maxLink = `https://example.com/${"a".repeat(1980)}`
	assert.equal(maxLink.length, 2000)
	assert.equal(linkProblem(maxLink), false)
	assert.equal(linkProblem(`${maxLink}a`), true)
	assert.equal(linkProblem("ftp://example.com/source"), true)
	const request = buildReportRequest(
		reportOfDraft(
			draft("details", "date", show, {
				suggested: "2022-06-22",
				link: maxLink,
			}),
			show,
		),
		envelope,
	)
	assert.equal(feedbackSchema.safeParse(request).success, true)
})
