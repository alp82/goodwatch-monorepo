import assert from "node:assert/strict"
import test from "node:test"
import "../../server/title-filter/test-alias.ts"

const {
	tvtimeIntentLine,
	tvtimeMatchEffect,
	tvtimeReleaseDate,
	tvtimeMatchIntro,
	tvtimeRowsLeft,
	tvtimeMatchedLine,
} = await import("./TvTimeMatchCopy.ts")

test("an entry names what TV Time has for the movie: watches, For later, a rating", () => {
	assert.equal(tvtimeIntentLine({ watch: 1 }), "1 watch")
	assert.equal(tvtimeIntentLine({ watch: 3, want: 1 }), "3 watches · For later")
	assert.equal(tvtimeIntentLine({ want: 2 }), "For later")
	assert.equal(tvtimeIntentLine({ watch: 1, rating: 1 }), "1 watch · Rated")
	assert.equal(tvtimeIntentLine({}), "")
	assert.equal(tvtimeIntentLine(undefined), "")
})

test("an entry says what its match adds: a watch, rewatches, or Want to See", () => {
	assert.equal(tvtimeMatchEffect({ watch: 1 }), "Matching adds 1 watch.")
	assert.equal(
		tvtimeMatchEffect({ watch: 2 }),
		"Matching adds 1 watch and 1 rewatch.",
	)
	assert.equal(
		tvtimeMatchEffect({ watch: 4 }),
		"Matching adds 1 watch and 3 rewatches.",
	)
	assert.equal(
		tvtimeMatchEffect({ want: 1 }),
		"Matching adds the movie to Want to See.",
	)
	assert.equal(
		tvtimeMatchEffect({ want: 2 }),
		"Matching adds the movie to Want to See.",
	)
	assert.equal(
		tvtimeMatchEffect({ watch: 1, rating: 1 }),
		"Matching adds 1 watch and your rating.",
	)
})

test("a watch wins over For later for the same movie, and the entry says so", () => {
	assert.equal(
		tvtimeMatchEffect({ watch: 2, want: 1 }),
		"Matching adds 1 watch and 1 rewatch. For later isn't added: a watch comes first.",
	)
})

test("a release date reads as a date, and a placeholder date isn't shown", () => {
	assert.equal(tvtimeReleaseDate("1995-11-22"), "November 22, 1995")
	// A date-only value is a calendar day, never shifted by the reader's time zone.
	assert.equal(tvtimeReleaseDate("2000-01-01"), "January 1, 2000")
	assert.equal(tvtimeReleaseDate("0001-01-01"), null)
	assert.equal(tvtimeReleaseDate(null), null)
	assert.equal(tvtimeReleaseDate(undefined), null)
	assert.equal(tvtimeReleaseDate("not a date"), null)
})

test("the match section explains one movie or many, and that a watch wins over For later", () => {
	assert.equal(
		tvtimeMatchIntro(1),
		"TV Time's export names this movie but has no catalog ID for it, so GoodWatch didn't add it on its own. Choose the GoodWatch movie it is. A movie you don't match isn't added.",
	)
	assert.equal(
		tvtimeMatchIntro(12),
		"TV Time's export names these 12 movies but has no catalog ID for them, so GoodWatch didn't add them on its own. Choose the GoodWatch movie for each one. Movies you don't match aren't added.",
	)
})

test("the lookup boxes count the rows a rerun can still match", () => {
	assert.equal(tvtimeRowsLeft(1), "1 row isn't matched yet.")
	assert.equal(tvtimeRowsLeft(2400), "2,400 rows aren't matched yet.")
})

test("once movies are matched, the section says how many of them, and that the rest aren't added", () => {
	assert.equal(
		tvtimeMatchIntro(3, 1),
		"You matched 2 of 3 movies. TV Time's export has no catalog ID for the other 1, so it isn't added until you match it.",
	)
	assert.equal(
		tvtimeMatchIntro(3, 0),
		"You matched all 3 movies. Change a match if one is wrong.",
	)
	assert.equal(
		tvtimeMatchIntro(1, 0),
		"You matched the movie. Change the match if it's wrong.",
	)
	// A preview from before the count counts every movie as unmatched.
	assert.equal(tvtimeMatchIntro(3, undefined), tvtimeMatchIntro(3))
	assert.equal(tvtimeMatchedLine(3, 1), "2 of 3 matched")
	assert.equal(tvtimeMatchedLine(3, 3), "3")
	assert.equal(tvtimeMatchedLine(3, undefined), "3")
})

const {
	tvtimeProgress,
	tvtimeSuggestionEvidence,
	tvtimeSuggestionNote,
	tvtimeBusyHint,
} = await import("./TvTimeMatchCopy.ts")

const proof = (
	title: "primary" | "original" | "alternative" | "translation",
	date: { basis: "primary" | "country"; country?: string },
) =>
	({
		rule: "tvtime_exact_title_release_date_v1",
		mediaType: "movie",
		tmdbId: 862,
		sourceFingerprint: "f",
		title: { value: "Toy Story", kind: title, locale: "und" },
		date: { value: "1995-11-22", ...date },
		candidateCount: 1,
		sourceCountry: null,
		verifiedCandidates: 1,
		discoveryBound: { pages: 5, candidates: 100 },
		discoveryComplete: true,
		pages: 1,
		verifiedAt: "2026-10-19T00:00:00Z",
	}) as const

test("a suggestion's evidence reads in plain words: which title and which release date match on TMDB", () => {
	assert.equal(
		tvtimeSuggestionEvidence(proof("primary", { basis: "primary" })),
		"Same title and release date on TMDB",
	)
	assert.equal(
		tvtimeSuggestionEvidence(proof("original", { basis: "primary" })),
		"Same original title and release date on TMDB",
	)
	assert.equal(
		tvtimeSuggestionEvidence(
			proof("translation", { basis: "country", country: "DE" }),
		),
		"Same translated title and release date in Germany on TMDB",
	)
	assert.equal(
		tvtimeSuggestionEvidence(proof("alternative", { basis: "primary" })),
		"Same alternative title and release date on TMDB",
	)
})

test("a movie without a suggestion says why, and a lookup failure reads differently from no match", () => {
	assert.equal(
		tvtimeSuggestionNote("tvtime_suggestion_pending"),
		"Checking movie suggestions…",
	)
	assert.equal(
		tvtimeSuggestionNote("tvtime_suggestion_no_exact_match"),
		"No movie on TMDB has this exact title and release date. Find it yourself.",
	)
	assert.equal(
		tvtimeSuggestionNote("tvtime_suggestion_ambiguous"),
		"More than one movie fits. Choose the right one.",
	)
	assert.equal(
		tvtimeSuggestionNote("tvtime_suggestion_unavailable"),
		"GoodWatch couldn't check this movie right now. Find it yourself.",
	)
	assert.equal(
		tvtimeSuggestionNote("tvtime_suggestion_rejected"),
		"You turned down the suggestion.",
	)
	assert.equal(tvtimeSuggestionNote(undefined), null)
	assert.equal(tvtimeSuggestionNote("no_native_id_match"), null)
})

test("progress names the step and counts checked and matched rows", () => {
	assert.deepEqual(
		tvtimeProgress({
			state: "running",
			phase: "episodes",
			total: 8088,
			processed: 2400,
			matched: 1900,
		}),
		{
			active: true,
			step: "Matching shows and episodes…",
			line: "Checked 2,400 of 8,088 rows. 1,900 matched so far.",
		},
	)
	assert.equal(
		tvtimeProgress({
			state: "running",
			phase: "movies",
			total: 1,
			processed: 0,
			matched: 0,
		}).step,
		"Checking movie suggestions…",
	)
	assert.equal(
		tvtimeProgress({
			state: "queued",
			phase: "watched_parents",
			total: 10,
			processed: 0,
			matched: 0,
		}).step,
		"Waiting to start…",
	)
	assert.equal(
		tvtimeProgress({
			state: "editing",
			phase: "publishing",
			total: 10,
			processed: 10,
			matched: 9,
		}).step,
		"Putting the preview together…",
	)
	assert.equal(
		tvtimeProgress({
			state: "completed",
			phase: "publishing",
			total: 10,
			processed: 10,
			matched: 9,
		}).active,
		false,
	)
})

test("a busy refusal says when to try again", () => {
	assert.equal(
		tvtimeBusyHint("tvtime_resolution_member_busy"),
		"Open it to follow its progress, or discard it to start again.",
	)
	assert.equal(
		tvtimeBusyHint("tvtime_resolution_global_busy"),
		"Matching a large export can take about 15 minutes.",
	)
	assert.equal(
		tvtimeBusyHint("tvtime_resolution_busy"),
		"Try again in a minute.",
	)
	assert.equal(tvtimeBusyHint("something_else"), null)
})
