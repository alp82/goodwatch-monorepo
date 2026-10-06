// PROTOTYPE (issue #368). The scenarios the rules are run through. Each is a starting world and a list of
// steps; `expect` holds what the settled rules give after a step and `expectAlt` what the compared reading
// gives, both in the words of the report's table. The tests assert them and the report prints them.
import type { Row } from "./report.ts"
import {
	type Action,
	type Episode,
	type EpisodeType,
	type Member,
	type Rules,
	type Show,
	type TmdbStatus,
	type World,
	addDays,
	newMember,
} from "./rules.ts"

export interface ScenarioStep {
	label: string
	action: Action
	expect?: Partial<Row>
	expectAlt?: Partial<Row>
}

export interface Scenario {
	key: string
	title: string
	/** The situation and what to watch for. */
	about: string
	start: World
	steps: ScenarioStep[]
	/** The same steps under another reading of the rules, printed as a second table. */
	compare?: { label: string; rules: Partial<Rules> }
}

// ---------------------------------------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------------------------------------

const episode = (
	season: number,
	number: number,
	airDate: string | null,
	type: EpisodeType = "standard",
	tmdbId = season * 1000 + number,
): Episode => ({ tmdbId, season, number, airDate, type, removed: false })

/** A season released one episode a week from `first`. `finale` marks the last one. */
const weekly = (
	season: number,
	first: string,
	count: number,
	options: { finale?: boolean; from?: number } = {},
): Episode[] =>
	Array.from({ length: count }, (_, index) =>
		episode(
			season,
			(options.from ?? 1) + index,
			addDays(first, index * 7),
			options.finale && index === count - 1 ? "finale" : "standard",
		),
	)

const show = (
	name: string,
	tmdbStatus: TmdbStatus,
	episodes: Episode[],
): Show => ({ name, tmdbStatus, episodes })

const at = (day: string, time = "12:00") => `${day}T${time}:00Z`

const world = (
	title: Show,
	now: string,
	member: Partial<Member> = {},
	utcOffsetMinutes = 0,
): World => ({
	show: title,
	member: newMember(member),
	clock: { now, utcOffsetMinutes },
})

const mark = (season: number, number: number): Action => ({
	do: "markEpisode",
	season,
	number,
})
const unmark = (season: number, number: number): Action => ({
	do: "unmarkEpisode",
	season,
	number,
})
const upTo = (season: number, number: number): Action => ({
	do: "markUpTo",
	season,
	number,
})
const time = (to: string): Action => ({ do: "timePasses", to })

// Shows used by more than one scenario.
const streamingSeason = () =>
	show(
		"A streaming season, listed in full with its finale marked",
		"Returning Series",
		weekly(1, "2026-09-01", 8, { finale: true }),
	)

const twoEndedSeasons = () =>
	show("An ended show with two seasons", "Ended", [
		...weekly(1, "2023-01-03", 8, { finale: true }),
		...weekly(2, "2024-01-02", 8, { finale: true }),
	])

// ---------------------------------------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------------------------------------

export const SCENARIOS: Scenario[] = [
	{
		key: "start-and-finish",
		title: "Starting a show and watching it through",
		about:
			"An ended show with four episodes, on the Wishlist. The first watch sets Watching and clears Want to See; the last one makes the show Seen and asks for a rating once.",
		start: world(
			show("An ended four-episode show", "Ended", weekly(1, "2025-03-03", 4, { finale: true })),
			at("2026-10-06"),
			{ wantToSee: true },
		),
		steps: [
			{
				label: "Marks S1E1",
				action: mark(1, 1),
				expect: {
					seen: "no",
					status: "Watching",
					caughtUp: "no",
					next: "S1E2",
					progress: "1/4",
					hiddenByNotSeenYet: "yes",
					hiddenFromRecommendations: "no",
					marked: "none",
					offered: "On hold, Dropped",
				},
			},
			{
				label: "Marks up to S1E3",
				action: upTo(1, 3),
				expect: { status: "Watching", next: "S1E4", progress: "3/4" },
			},
			{
				label: "Marks S1E4, the last episode",
				action: mark(1, 4),
				expect: {
					seen: "Seen",
					status: "none",
					caughtUp: "no",
					next: "none",
					progress: "4/4",
					hiddenByNotSeenYet: "yes",
					offered: "none",
				},
			},
			{
				label: "Dismisses the prompt to rate",
				action: { do: "dismissRatePrompt" },
				expect: { seen: "Seen", status: "none" },
			},
			{
				label: "Rates the show 8",
				action: { do: "rate", score: 8 },
				expect: { seen: "Seen", status: "none", progress: "4/4" },
			},
		],
	},
	{
		key: "streaming-season",
		title: "Catching up mid-season on a streaming show listed in full",
		about:
			"Eight weekly episodes, all listed ahead with the finale marked; six have aired. Caught up stays Watching, and the finale makes the show Seen on the spot.",
		start: world(streamingSeason(), at("2026-10-06")),
		steps: [
			{
				label: "Marks up to S1E6",
				action: upTo(1, 6),
				expect: {
					seen: "no",
					status: "Watching",
					caughtUp: "yes",
					next: "none",
					progress: "6/6, 8 listed",
					hiddenByNotSeenYet: "yes",
				},
			},
			{
				label: "A week passes; S1E7 airs",
				action: time(at("2026-10-13")),
				expect: {
					status: "Watching",
					caughtUp: "no",
					next: "S1E7",
					progress: "6/7, 8 listed",
				},
			},
			{
				label: "Marks S1E7",
				action: mark(1, 7),
				expect: { seen: "no", status: "Watching", caughtUp: "yes", next: "none" },
			},
			{
				label: "A week passes; the finale airs",
				action: time(at("2026-10-20")),
				expect: { seen: "no", caughtUp: "no", next: "S1E8" },
			},
			{
				label: "Marks S1E8, the finale",
				action: mark(1, 8),
				expect: { seen: "Seen", status: "none", caughtUp: "no", progress: "8/8" },
			},
		],
	},
	{
		key: "weekly-network",
		title: "A weekly network show listed three weeks ahead, no finale marked",
		about:
			"TMDB lists only the next few episodes and never says which one ends the season. The season counts as airing for 45 days after its last aired episode. Watch what the winter break does.",
		start: world(
			show(
				"A weekly network show",
				"Returning Series",
				weekly(1, "2026-09-22", 6),
			),
			at("2026-10-06"),
		),
		compare: {
			label: "A later episode of a season the member has watched from reopens the show",
			rules: { laterEpisodes: "reopen" },
		},
		steps: [
			{
				label: "Marks season 1",
				action: { do: "markSeason", season: 1 },
				expect: {
					seen: "no",
					status: "Watching",
					caughtUp: "yes",
					progress: "3/3, 6 listed",
				},
			},
			{
				label: "TMDB lists S1E7 and S1E8, the last two before the winter break",
				action: {
					do: "tmdbLists",
					episodes: weekly(1, "2026-11-03", 2, { from: 7 }),
				},
				expect: { caughtUp: "yes", progress: "3/3, 8 listed" },
			},
			{
				label: "Five weeks pass; S1E8 has aired",
				action: time(at("2026-11-10", "22:00")),
				expect: { caughtUp: "no", next: "S1E4", progress: "3/8" },
			},
			{
				label: "Marks up to S1E8",
				action: upTo(1, 8),
				expect: { seen: "no", status: "Watching", caughtUp: "yes", progress: "8/8" },
			},
			{
				label: "40 days after S1E8, nothing new listed",
				action: time(at("2026-12-20")),
				expect: { seen: "no", status: "Watching", caughtUp: "yes" },
			},
			{
				label: "46 days after S1E8",
				action: time(at("2026-12-26")),
				expect: { seen: "Seen", status: "none", caughtUp: "no", next: "none" },
			},
			{
				label: "TMDB lists S1E9 and S1E10 for January",
				action: {
					do: "tmdbLists",
					episodes: weekly(1, "2027-01-12", 2, { from: 9 }),
				},
				expect: { seen: "Seen", status: "none", progress: "8/8, 10 listed" },
			},
			{
				label: "S1E9 airs",
				action: time(at("2027-01-12", "22:00")),
				expect: {
					seen: "Seen, new episodes",
					status: "none",
					caughtUp: "no",
					next: "S1E9",
					progress: "8/9, 10 listed",
					offered: "On hold, Dropped",
				},
				expectAlt: { seen: "no", status: "Watching", caughtUp: "no", next: "S1E9" },
			},
			{
				label: "Marks S1E9",
				action: mark(1, 9),
				expect: { seen: "Seen", status: "Watching", caughtUp: "yes", next: "none" },
				expectAlt: { seen: "no", status: "Watching", caughtUp: "yes", next: "none" },
			},
		],
	},
	{
		key: "new-season-on-seen-show",
		title: "A new season airs on a Seen show",
		about:
			"Season 1 is over and marked Seen in one press. A year later season 2 is listed, then starts. The show stays Seen; watch its status and what the member is offered.",
		start: world(
			show(
				"A returning show",
				"Returning Series",
				weekly(1, "2025-09-02", 8, { finale: true }),
			),
			at("2025-11-01"),
		),
		steps: [
			{
				label: "Presses Seen",
				action: { do: "pressSeen" },
				expect: {
					seen: "Seen",
					status: "none",
					next: "none",
					progress: "8/8",
					offered: "none",
				},
			},
			{
				label: "TMDB lists season 2, five weeks before it starts",
				action: {
					do: "tmdbLists",
					episodes: weekly(2, "2026-10-06", 8, { finale: true }),
				},
				expect: { seen: "Seen", status: "none", next: "none" },
			},
			{
				label: "S2E1 airs",
				action: time(at("2026-10-06")),
				expect: {
					seen: "Seen, new episodes",
					status: "none",
					caughtUp: "no",
					next: "S2E1",
					progress: "8/9 (S1 8/8, S2 0/1), 16 listed",
					hiddenByNotSeenYet: "yes",
					hiddenFromRecommendations: "no",
					offered: "On hold, Dropped",
				},
			},
			{
				label: "Marks S2E1",
				action: mark(2, 1),
				expect: { seen: "Seen", status: "Watching", caughtUp: "yes", next: "none" },
			},
			{
				label: "A week passes; S2E2 airs",
				action: time(at("2026-10-13")),
				expect: {
					seen: "Seen, new episodes",
					status: "Watching",
					caughtUp: "no",
					next: "S2E2",
				},
			},
		],
	},
	{
		key: "upcoming-season-listed-first",
		title: "Finishing the latest season when the next one already has a date",
		about:
			"Two finished seasons, and TMDB already lists the season 3 premiere eleven months ahead. By the research's rule the highest season with a dated episode is the one judged, so a season is \"still airing\" all that time.",
		start: world(
			show("A show between seasons", "Returning Series", [
				...weekly(1, "2025-01-07", 6, { finale: true }),
				...weekly(2, "2026-01-06", 6, { finale: true }),
				episode(3, 1, "2027-09-07"),
			]),
			at("2026-10-06"),
		),
		compare: {
			label: "A season nothing has aired of is not airing yet",
			rules: { upcomingSeason: "not-airing" },
		},
		steps: [
			{
				label: "Marks up to S2E6, the season 2 finale",
				action: upTo(2, 6),
				expect: {
					seen: "no",
					status: "Watching",
					caughtUp: "yes",
					next: "none",
					progress: "12/12 (S1 6/6, S2 6/6, S3 0/0), 13 listed",
				},
				expectAlt: { seen: "Seen", status: "none", caughtUp: "no" },
			},
			{
				label: "Eleven months pass; S3E1 airs",
				action: time(at("2027-09-07")),
				expect: { seen: "no", status: "Watching", caughtUp: "no", next: "S3E1" },
				expectAlt: { seen: "Seen, new episodes", status: "none", next: "S3E1" },
			},
		],
	},
	{
		key: "upcoming-season-listed-after",
		title: "The same show, finished a day before TMDB lists the next season",
		about:
			"The same member and the same episodes as in the scenario before. Only the order differs: the premiere date appears after the last watch.",
		start: world(
			show("A show between seasons", "Returning Series", [
				...weekly(1, "2025-01-07", 6, { finale: true }),
				...weekly(2, "2026-01-06", 6, { finale: true }),
			]),
			at("2026-10-06"),
		),
		steps: [
			{
				label: "Marks up to S2E6, the season 2 finale",
				action: upTo(2, 6),
				expect: { seen: "Seen", status: "none", caughtUp: "no" },
			},
			{
				label: "TMDB lists S3E1 for next September",
				action: { do: "tmdbLists", episodes: [episode(3, 1, "2027-09-07")] },
				expect: { seen: "Seen", status: "none", caughtUp: "no" },
			},
			{
				label: "Eleven months pass; S3E1 airs",
				action: time(at("2027-09-07")),
				expect: { seen: "Seen, new episodes", status: "none", next: "S3E1" },
			},
		],
	},
	{
		key: "season-ends-looked-at",
		title: "A season ends without a finale mark, and the member looks in between",
		about:
			"Six weekly episodes, no finale marked, all watched on the day the last one aired. Nothing the member does makes the show Seen; only the 45 days running out does, and only when something recomputes the show.",
		start: world(
			show("A show whose finale TMDB never marked", "Returning Series", weekly(1, "2026-01-06", 6)),
			at("2026-02-10", "21:00"),
		),
		compare: {
			label: "Seen worked out from the dates of the watches, and an unstarted season not airing",
			rules: { seenEvaluation: "from-history", upcomingSeason: "not-airing" },
		},
		steps: [
			{
				label: "Marks season 1 on the night of S1E6",
				action: { do: "markSeason", season: 1 },
				expect: { seen: "no", status: "Watching", caughtUp: "yes" },
				expectAlt: { seen: "no", status: "Watching", caughtUp: "yes" },
			},
			{
				label: "50 days later the show is looked at",
				action: time(at("2026-04-01")),
				expect: { seen: "Seen", status: "none", caughtUp: "no" },
				expectAlt: { seen: "Seen", status: "none", caughtUp: "no" },
			},
			{
				label: "TMDB lists season 2",
				action: { do: "tmdbLists", episodes: weekly(2, "2026-09-08", 6) },
				expect: { seen: "Seen", status: "none" },
			},
			{
				label: "October: five episodes of season 2 have aired",
				action: time(at("2026-10-06")),
				expect: {
					seen: "Seen, new episodes",
					status: "none",
					next: "S2E1",
					progress: "6/11 (S1 6/6, S2 0/5), 12 listed",
				},
				expectAlt: { seen: "Seen, new episodes", status: "none", next: "S2E1" },
			},
		],
	},
	{
		key: "season-ends-not-looked-at",
		title: "The same season and the same watches, and nobody looks until season 2",
		about:
			"The member and the episodes of the scenario before. The only difference is that nothing recomputed the show between the end of season 1 and the start of season 2.",
		start: world(
			show("A show whose finale TMDB never marked", "Returning Series", weekly(1, "2026-01-06", 6)),
			at("2026-02-10", "21:00"),
		),
		compare: {
			label: "Seen worked out from the dates of the watches, and an unstarted season not airing",
			rules: { seenEvaluation: "from-history", upcomingSeason: "not-airing" },
		},
		steps: [
			{
				label: "Marks season 1 on the night of S1E6",
				action: { do: "markSeason", season: 1 },
				expect: { seen: "no", status: "Watching", caughtUp: "yes" },
			},
			{
				label: "TMDB lists season 2",
				action: { do: "tmdbLists", episodes: weekly(2, "2026-09-08", 6) },
				expect: { seen: "no", status: "Watching" },
			},
			{
				label: "October: five episodes of season 2 have aired",
				action: time(at("2026-10-06")),
				expect: {
					seen: "no",
					status: "Watching",
					caughtUp: "no",
					next: "S2E1",
					progress: "6/11 (S1 6/6, S2 0/5), 12 listed",
				},
				expectAlt: { seen: "Seen, new episodes", status: "none", next: "S2E1" },
			},
		],
	},
	{
		key: "remove-seen-with-hand-marks",
		title: "Marking Seen and removing it again when some episodes were marked by hand",
		about:
			"Two episodes by hand, then the rest of season 1 with \"mark season\", then Seen on the show. Removing Seen removes bulk watches. Watch which ones.",
		start: world(twoEndedSeasons(), at("2026-10-06")),
		compare: {
			label: "Removing Seen removes only the watches Seen itself made",
			rules: { removeSeenRemoves: "show-bulk" },
		},
		steps: [
			{ label: "Marks S1E1", action: mark(1, 1) },
			{
				label: "Marks S1E2",
				action: mark(1, 2),
				expect: { status: "Watching", progress: "2/16 (S1 2/8, S2 0/8)" },
			},
			{
				label: "Marks season 1",
				action: { do: "markSeason", season: 1 },
				expect: { status: "Watching", next: "S2E1", progress: "8/16 (S1 8/8, S2 0/8)" },
			},
			{
				label: "Presses Seen",
				action: { do: "pressSeen" },
				expect: { seen: "Seen", status: "none", progress: "16/16 (S1 8/8, S2 8/8)" },
			},
			{
				label: "Removes Seen",
				action: { do: "removeSeen" },
				expect: {
					seen: "no",
					status: "Watching",
					next: "S1E3",
					progress: "2/16 (S1 2/8, S2 0/8)",
				},
				expectAlt: {
					seen: "no",
					status: "Watching",
					next: "S2E1",
					progress: "8/16 (S1 8/8, S2 0/8)",
				},
			},
		],
	},
	{
		key: "remove-seen-changes-nothing",
		title: "Removing Seen from a show watched by hand, and from a rated show",
		about:
			"Every episode marked by hand, so there is no bulk watch to remove. Then a rating. Watch whether the member can make the show not Seen.",
		start: world(
			show("An ended three-episode show", "Ended", weekly(1, "2024-05-07", 3, { finale: true })),
			at("2026-10-06"),
		),
		steps: [
			{ label: "Marks S1E1", action: mark(1, 1) },
			{ label: "Marks S1E2", action: mark(1, 2) },
			{
				label: "Marks S1E3",
				action: mark(1, 3),
				expect: { seen: "Seen", status: "none", progress: "3/3" },
			},
			{
				label: "Removes Seen",
				action: { do: "removeSeen" },
				expect: { seen: "Seen", status: "none", progress: "3/3" },
			},
			{ label: "Rates the show 7", action: { do: "rate", score: 7 } },
			{
				label: "Unmarks S1E3",
				action: unmark(1, 3),
				expect: { seen: "Seen", status: "Watching", next: "S1E3", progress: "2/3" },
			},
			{
				label: "Removes Seen",
				action: { do: "removeSeen" },
				expect: { seen: "Seen", status: "Watching", progress: "2/3" },
			},
			{
				label: "Removes the rating",
				action: { do: "removeRating" },
				expect: { seen: "no", status: "Watching", progress: "2/3" },
			},
		],
	},
	{
		key: "seen-press-while-airing",
		title: "Pressing Seen on a show whose season is still airing",
		about:
			"Six of eight episodes have aired. Seen marks all six. By the glossary a show is Seen only with no season still airing, so the press cannot make it Seen.",
		start: world(streamingSeason(), at("2026-10-06")),
		compare: {
			label: "Pressing Seen always makes the show Seen",
			rules: { seenPressWhileAiring: "seen" },
		},
		steps: [
			{
				label: "Presses Seen",
				action: { do: "pressSeen" },
				expect: {
					seen: "no",
					status: "Watching",
					caughtUp: "yes",
					progress: "6/6, 8 listed",
				},
				expectAlt: { seen: "Seen", status: "none", caughtUp: "no" },
			},
			{
				label: "A week passes; S1E7 airs",
				action: time(at("2026-10-13")),
				expect: { seen: "no", status: "Watching", caughtUp: "no", next: "S1E7" },
				expectAlt: { seen: "Seen, new episodes", status: "none", next: "S1E7" },
			},
			{
				label: "Removes Seen",
				action: { do: "removeSeen" },
				expect: { seen: "no", status: "none", progress: "0/7, 8 listed" },
				expectAlt: { seen: "no", status: "none", progress: "0/7, 8 listed" },
			},
		],
	},
	{
		key: "unmarking",
		title: "Unmarking an episode",
		about:
			"A show on the Wishlist. A mis-tap on the first episode and its undo, then Seen in one press, then one episode unmarked because the member skipped it.",
		start: world(
			show("An ended four-episode show", "Ended", weekly(1, "2025-03-03", 4, { finale: true })),
			at("2026-10-06"),
			{ wantToSee: true },
		),
		compare: {
			label: "Unmarking an episode leaves Seen alone",
			rules: { unmarkOnSeen: "keeps-seen" },
		},
		steps: [
			{
				label: "Marks S1E1 by mistake",
				action: mark(1, 1),
				expect: { status: "Watching", marked: "none" },
			},
			{
				label: "Unmarks S1E1",
				action: unmark(1, 1),
				expect: {
					seen: "no",
					status: "none",
					progress: "0/4",
					hiddenByNotSeenYet: "no",
					marked: "none",
					offered: "Not interested",
				},
			},
			{
				label: "Presses Seen",
				action: { do: "pressSeen" },
				expect: { seen: "Seen", status: "none", progress: "4/4" },
			},
			{
				label: "Unmarks S1E2, the one episode skipped",
				action: unmark(1, 2),
				expect: { seen: "no", status: "Watching", next: "S1E2", progress: "3/4" },
				expectAlt: { seen: "Seen", status: "none", next: "S1E2", progress: "3/4" },
			},
			{
				label: "Marks S1E2 after all",
				action: mark(1, 2),
				expect: { seen: "Seen", status: "none", next: "none", progress: "4/4" },
				expectAlt: { seen: "Seen", status: "none", next: "none", progress: "4/4" },
			},
		],
	},
	{
		key: "on-hold-and-dropped",
		title: "On hold, Dropped, and coming back",
		about:
			"An ended six-episode show. The member sets it aside, returns, gives up, wants to see it after all, gives up again and then marks the rest.",
		start: world(
			show("An ended six-episode show", "Ended", weekly(1, "2024-02-06", 6, { finale: true })),
			at("2026-10-06"),
		),
		steps: [
			{
				label: "Marks up to S1E2",
				action: upTo(1, 2),
				expect: { status: "Watching", progress: "2/6" },
			},
			{
				label: "Sets On hold",
				action: { do: "setOnHold" },
				expect: {
					status: "On hold",
					hiddenByNotSeenYet: "yes",
					hiddenFromRecommendations: "no",
					offered: "Dropped",
				},
			},
			{
				label: "Marks S1E3",
				action: mark(1, 3),
				expect: { status: "Watching", next: "S1E4" },
			},
			{
				label: "Sets Dropped",
				action: { do: "setDropped" },
				expect: {
					seen: "no",
					status: "Dropped",
					hiddenByNotSeenYet: "yes",
					hiddenFromRecommendations: "yes",
					offered: "On hold",
				},
			},
			{
				label: "Adds Want to See",
				action: { do: "addWantToSee" },
				expect: { status: "Watching", marked: "none", hiddenFromRecommendations: "no" },
			},
			{
				label: "Sets Dropped again",
				action: { do: "setDropped" },
				expect: { status: "Dropped" },
			},
			{
				label: "Marks season 1",
				action: { do: "markSeason", season: 1 },
				expect: {
					seen: "Seen",
					status: "none",
					progress: "6/6",
					hiddenFromRecommendations: "no",
				},
			},
		],
	},
	{
		key: "before-the-first-episode",
		title: "Not interested, Dropped and On hold before any episode is watched",
		about:
			"Nothing watched. Not interested is the offer; Dropped is allowed with no episode watched, which is how an import brings it. Watch what each one clears.",
		start: world(
			show("An ended six-episode show", "Ended", weekly(1, "2024-02-06", 6, { finale: true })),
			at("2026-10-06"),
		),
		steps: [
			{
				label: "Sets Not interested",
				action: { do: "setNotInterested" },
				expect: {
					status: "none",
					hiddenByNotSeenYet: "no",
					hiddenFromRecommendations: "yes",
					marked: "Not interested",
				},
			},
			{
				label: "Adds Want to See",
				action: { do: "addWantToSee" },
				expect: { marked: "Want to See", hiddenFromRecommendations: "no" },
			},
			{
				label: "Sets Not interested",
				action: { do: "setNotInterested" },
				expect: { marked: "Not interested" },
			},
			{
				label: "Tries On hold",
				action: { do: "setOnHold" },
				expect: { status: "none", marked: "Not interested" },
			},
			{
				label: "Dropped arrives with no episode watched",
				action: { do: "setDropped" },
				expect: {
					status: "Dropped",
					hiddenByNotSeenYet: "yes",
					hiddenFromRecommendations: "yes",
					marked: "none",
					offered: "none",
				},
			},
			{
				label: "Adds Want to See",
				action: { do: "addWantToSee" },
				expect: {
					status: "none",
					marked: "Want to See",
					hiddenByNotSeenYet: "no",
					hiddenFromRecommendations: "no",
				},
			},
			{
				label: "Marks S1E1",
				action: mark(1, 1),
				expect: { status: "Watching", marked: "none", offered: "On hold, Dropped" },
			},
			{
				label: "Tries Not interested",
				action: { do: "setNotInterested" },
				expect: { status: "Watching", marked: "none" },
			},
		],
	},
	{
		key: "rated-with-some-episodes",
		title: "A rated show with some episodes watched",
		about:
			"Three of ten episodes watched, then a low rating. A rated show is Seen, and it still has a status.",
		start: world(
			show("An ended ten-episode show", "Ended", weekly(1, "2024-02-06", 10, { finale: true })),
			at("2026-10-06"),
		),
		steps: [
			{
				label: "Marks up to S1E3",
				action: upTo(1, 3),
				expect: { seen: "no", status: "Watching", progress: "3/10" },
			},
			{
				label: "Rates the show 4",
				action: { do: "rate", score: 4 },
				expect: {
					seen: "Seen",
					status: "Watching",
					caughtUp: "no",
					next: "S1E4",
					progress: "3/10",
					hiddenByNotSeenYet: "yes",
					offered: "On hold, Dropped",
				},
			},
			{
				label: "Sets Dropped",
				action: { do: "setDropped" },
				expect: { seen: "Seen", status: "Dropped", hiddenFromRecommendations: "yes" },
			},
			{
				label: "Marks S1E4",
				action: mark(1, 4),
				expect: { seen: "Seen", status: "Watching", hiddenFromRecommendations: "no" },
			},
		],
	},
	{
		key: "rated-without-episodes",
		title: "A rated show with no episode watched",
		about:
			"A rating marks no episodes. The show is Seen with nothing watched. Then a second season starts.",
		start: world(
			show(
				"A returning show",
				"Returning Series",
				weekly(1, "2025-01-07", 6, { finale: true }),
			),
			at("2026-10-06"),
		),
		steps: [
			{
				label: "Rates the show 9",
				action: { do: "rate", score: 9 },
				expect: {
					seen: "Seen",
					status: "none",
					next: "S1E1",
					progress: "0/6",
					hiddenByNotSeenYet: "yes",
					offered: "none",
				},
			},
			{
				label: "Removes Seen",
				action: { do: "removeSeen" },
				expect: { seen: "Seen", status: "none", progress: "0/6" },
			},
			{
				label: "TMDB lists season 2",
				action: {
					do: "tmdbLists",
					episodes: weekly(2, "2026-11-03", 6, { finale: true }),
				},
			},
			{
				label: "S2E1 airs",
				action: time(at("2026-11-03")),
				expect: {
					seen: "Seen, new episodes",
					status: "none",
					next: "S1E1",
					progress: "0/7 (S1 0/6, S2 0/1), 12 listed",
				},
			},
			{
				label: "Presses Seen to mark the episodes",
				action: { do: "pressSeen" },
				expect: {
					seen: "Seen",
					status: "Watching",
					caughtUp: "yes",
					progress: "7/7 (S1 6/6, S2 1/1), 12 listed",
				},
			},
		],
	},
	{
		key: "specials",
		title: "Specials",
		about:
			"Two specials, one without a date, and four regular episodes. The show is on the Wishlist. A special can be watched and never counts.",
		start: world(
			show("An ended show with specials", "Ended", [
				episode(0, 1, "2024-12-24"),
				episode(0, 2, null),
				...weekly(1, "2025-03-03", 4, { finale: true }),
			]),
			at("2026-10-06"),
			{ wantToSee: true },
		),
		steps: [
			{
				label: "Marks Special 1",
				action: mark(0, 1),
				expect: {
					seen: "no",
					status: "none",
					next: "S1E1",
					progress: "0/4, 1 special",
					hiddenByNotSeenYet: "no",
					marked: "Want to See",
					offered: "Not interested",
				},
			},
			{
				label: "Presses Seen",
				action: { do: "pressSeen" },
				expect: {
					seen: "Seen",
					status: "none",
					progress: "4/4, 1 special",
					marked: "none",
				},
			},
			{
				label: "Marks the specials as a season",
				action: { do: "markSeason", season: 0 },
				expect: { progress: "4/4, 1 special" },
			},
			{
				label: "Marks Special 2, which has no date, by hand",
				action: mark(0, 2),
				expect: { seen: "Seen", progress: "4/4, 2 specials" },
			},
		],
	},
	{
		key: "specials-only",
		title: "A show that has only specials",
		about:
			"TMDB lists nothing but season 0. No regular episode exists, so nothing can count.",
		start: world(
			show("A show of specials", "Ended", [
				episode(0, 1, "2023-06-01"),
				episode(0, 2, "2023-06-08"),
			]),
			at("2026-10-06"),
		),
		steps: [
			{
				label: "Marks Special 1",
				action: mark(0, 1),
				expect: {
					seen: "no",
					status: "none",
					next: "none",
					progress: "0/0, 1 special",
					hiddenByNotSeenYet: "no",
				},
			},
			{
				label: "Presses Seen",
				action: { do: "pressSeen" },
				expect: { seen: "Seen", status: "none", progress: "0/0, 1 special" },
			},
		],
	},
	{
		key: "no-air-date",
		title: "An episode without an air date",
		about:
			"Four episodes aired in 2025; TMDB lists a fifth with no date. It has not aired, so Seen does not mark it and it does not count. By the research's rule it also keeps the season airing.",
		start: world(
			show("A show with a blank fifth episode", "Returning Series", [
				...weekly(1, "2025-03-04", 4),
				episode(1, 5, null),
			]),
			at("2026-10-06"),
		),
		compare: {
			label: "An episode without a date does not keep a season airing",
			rules: { undatedEpisode: "ignored" },
		},
		steps: [
			{
				label: "Presses Seen",
				action: { do: "pressSeen" },
				expect: {
					seen: "no",
					status: "Watching",
					caughtUp: "yes",
					next: "none",
					progress: "4/4, 5 listed",
				},
				expectAlt: { seen: "Seen", status: "none", caughtUp: "no" },
			},
			{
				label: "Marks S1E5 by hand",
				action: mark(1, 5),
				expect: { seen: "no", status: "Watching", progress: "4/4, 5 listed" },
				expectAlt: { seen: "Seen", status: "none", progress: "4/4, 5 listed" },
			},
			{
				label: "A year passes",
				action: time(at("2027-10-06")),
				expect: { seen: "no", status: "Watching", caughtUp: "yes" },
				expectAlt: { seen: "Seen", status: "none" },
			},
			{
				label: "TMDB sets the show to Ended",
				action: { do: "tmdbSetsStatus", status: "Ended" },
				expect: { seen: "Seen", status: "none", caughtUp: "no" },
			},
		],
	},
	{
		key: "no-episode-list",
		title: "A show with no episode list",
		about:
			"TMDB lists no season. The show can only be marked Seen as a whole, with no watches behind it. Later TMDB adds two seasons, one of which aired after the member marked the show.",
		start: world(show("A show TMDB lists no episodes for", "Returning Series", []), at("2025-06-01")),
		compare: {
			label: "No bulk watches when the list appears",
			rules: { backfillWhenListAppears: false },
		},
		steps: [
			{
				label: "Presses Seen",
				action: { do: "pressSeen" },
				expect: {
					seen: "Seen",
					status: "none",
					next: "none",
					progress: "no episode list",
					hiddenByNotSeenYet: "yes",
				},
			},
			{
				label: "Sixteen months pass",
				action: time(at("2026-10-06")),
				expect: { seen: "Seen", progress: "no episode list" },
			},
			{
				label: "TMDB lists season 1 from 2024 and three episodes of season 2 from September 2026",
				action: {
					do: "tmdbLists",
					episodes: [
						...weekly(1, "2024-01-02", 6, { finale: true }),
						...weekly(2, "2026-09-08", 3),
					],
				},
				expect: {
					seen: "Seen, new episodes",
					status: "none",
					next: "S2E1",
					progress: "6/9 (S1 6/6, S2 0/3)",
				},
				expectAlt: {
					seen: "Seen, new episodes",
					status: "none",
					next: "S1E1",
					progress: "0/9 (S1 0/6, S2 0/3)",
				},
			},
			{
				label: "Removes Seen",
				action: { do: "removeSeen" },
				expect: { seen: "no", status: "none", progress: "0/9 (S1 0/6, S2 0/3)" },
			},
		],
	},
	{
		key: "tmdb-readds-episode-watching",
		title: "TMDB removes an episode and adds it again under a new id, on a Watching show",
		about:
			"The member is caught up in season 2. A TMDB editor deletes S1E2 and adds it again, which gives it a new id. ADR 0008: a watch whose episode is gone is kept and doesn't count.",
		start: world(
			show("A show in its second season", "Returning Series", [
				...weekly(1, "2025-09-02", 8, { finale: true }),
				...weekly(2, "2026-09-22", 5),
			]),
			at("2026-10-06"),
		),
		compare: {
			label: "Count the watch when exactly one listed episode has the same season and number",
			rules: { goneEpisode: "same-number" },
		},
		steps: [
			{
				label: "Marks up to S2E3",
				action: upTo(2, 3),
				expect: {
					status: "Watching",
					caughtUp: "yes",
					progress: "11/11 (S1 8/8, S2 3/3), 13 listed",
				},
			},
			{
				label: "TMDB removes S1E2",
				action: { do: "tmdbRemoves", tmdbId: 1002 },
				expect: {
					status: "Watching",
					caughtUp: "yes",
					next: "none",
					progress: "10/10 (S1 7/7, S2 3/3), 12 listed",
				},
				expectAlt: { caughtUp: "yes", progress: "10/10 (S1 7/7, S2 3/3), 12 listed" },
			},
			{
				label: "TMDB adds S1E2 again under a new id",
				action: {
					do: "tmdbLists",
					episodes: [episode(1, 2, "2025-09-09", "standard", 9002)],
				},
				expect: {
					status: "Watching",
					caughtUp: "no",
					next: "S1E2",
					progress: "10/11 (S1 7/8, S2 3/3), 13 listed",
				},
				expectAlt: {
					status: "Watching",
					caughtUp: "yes",
					next: "none",
					progress: "11/11 (S1 8/8, S2 3/3), 13 listed",
				},
			},
			{
				label: "Marks S1E2 again",
				action: mark(1, 2),
				expect: { caughtUp: "yes", next: "none" },
				expectAlt: { caughtUp: "yes", next: "none" },
			},
		],
	},
	{
		key: "tmdb-readds-episode-seen",
		title: "The same re-added episode on a Seen show",
		about:
			"A finished show marked Seen. TMDB deletes S1E2 and adds it again under a new id.",
		start: world(
			show("An ended four-episode show", "Ended", weekly(1, "2025-03-03", 4, { finale: true })),
			at("2026-10-06"),
		),
		compare: {
			label: "Count the watch when exactly one listed episode has the same season and number",
			rules: { goneEpisode: "same-number" },
		},
		steps: [
			{
				label: "Presses Seen",
				action: { do: "pressSeen" },
				expect: { seen: "Seen", status: "none", progress: "4/4" },
			},
			{
				label: "TMDB removes S1E2",
				action: { do: "tmdbRemoves", tmdbId: 1002 },
				expect: { seen: "Seen", progress: "3/3" },
			},
			{
				label: "TMDB adds S1E2 again under a new id",
				action: {
					do: "tmdbLists",
					episodes: [episode(1, 2, "2025-03-10", "standard", 9002)],
				},
				expect: { seen: "Seen", status: "none", next: "S1E2", progress: "3/4" },
				expectAlt: { seen: "Seen", status: "none", next: "none", progress: "4/4" },
			},
		],
	},
	{
		key: "tmdb-renumbers",
		title: "TMDB removes an episode and renumbers the ones after it",
		about:
			"The case that speaks against matching by season and number. The member watched five of ten. An editor deletes S1E5 as a duplicate and moves episodes 6 to 10 down to 5 to 9, keeping their ids.",
		start: world(
			show("An ended ten-episode show", "Ended", weekly(1, "2024-02-06", 10, { finale: true })),
			at("2026-10-06"),
		),
		compare: {
			label: "Count the watch when exactly one listed episode has the same season and number",
			rules: { goneEpisode: "same-number" },
		},
		steps: [
			{
				label: "Marks up to S1E5",
				action: upTo(1, 5),
				expect: { status: "Watching", next: "S1E6", progress: "5/10" },
			},
			{
				label: "TMDB removes S1E5 and renumbers 6 to 10 as 5 to 9",
				action: { do: "tmdbRemoves", tmdbId: 1005 },
			},
			{
				label: "(the renumbering)",
				action: {
					do: "tmdbChanges",
					changes: [6, 7, 8, 9, 10].map((number) => ({
						tmdbId: 1000 + number,
						to: { number: number - 1 },
					})),
				},
				expect: { status: "Watching", next: "S1E5", progress: "4/9" },
				expectAlt: { status: "Watching", next: "S1E6", progress: "5/9" },
			},
		],
	},
	{
		key: "airs-today-los-angeles",
		title: "An episode airing today, for a member in Los Angeles",
		about:
			"S1E6 is dated October 7. It is 18:00 on October 6 in Los Angeles, which is already October 7 in UTC. The map says aired is decided by the member's date; the research proposes UTC.",
		start: world(
			show("A weekly show", "Returning Series", weekly(1, "2026-09-02", 7)),
			at("2026-10-07", "01:00"),
			{},
			-420,
		),
		compare: { label: "Aired by the UTC date", rules: { airedBy: "utc-date" } },
		steps: [
			{
				label: "Marks up to S1E5 (18:00 on October 6, local)",
				action: upTo(1, 5),
				expect: { caughtUp: "yes", next: "none", progress: "5/5, 7 listed" },
				expectAlt: { caughtUp: "no", next: "S1E6", progress: "5/6, 7 listed" },
			},
			{
				label: "Marks S1E6 by hand",
				action: mark(1, 6),
				expect: { caughtUp: "yes", next: "none", progress: "5/5, 7 listed" },
				expectAlt: { caughtUp: "yes", next: "none", progress: "6/6, 7 listed" },
			},
			{
				label: "Half past midnight, local",
				action: time(at("2026-10-07", "07:30")),
				expect: { caughtUp: "yes", progress: "6/6, 7 listed" },
				expectAlt: { caughtUp: "yes", progress: "6/6, 7 listed" },
			},
		],
	},
	{
		key: "airs-today-auckland",
		title: "The same episode for a member in Auckland",
		about:
			"It is 08:00 on October 7 in Auckland and 19:00 on October 6 in UTC. A broadcast on the evening of October 7 in New York is 29 hours away.",
		start: world(
			show("A weekly show", "Returning Series", weekly(1, "2026-09-02", 7)),
			at("2026-10-06", "19:00"),
			{},
			780,
		),
		compare: { label: "Aired by the UTC date", rules: { airedBy: "utc-date" } },
		steps: [
			{
				label: "Marks up to S1E5 (08:00 on October 7, local)",
				action: upTo(1, 5),
				expect: { caughtUp: "no", next: "S1E6", progress: "5/6, 7 listed" },
				expectAlt: { caughtUp: "yes", next: "none", progress: "5/5, 7 listed" },
			},
			{
				label: "13:30, local",
				action: time(at("2026-10-07", "00:30")),
				expect: { caughtUp: "no", next: "S1E6" },
				expectAlt: { caughtUp: "no", next: "S1E6" },
			},
		],
	},
	{
		key: "starting-in-the-middle",
		title: "Starting a show at season 2",
		about:
			"The member saw season 1 years ago and never marked it. They mark what they watch now. The glossary's next episode is the earliest aired regular episode without a watch.",
		start: world(twoEndedSeasons(), at("2026-10-06")),
		compare: {
			label: "Next episode is the first unwatched one after the furthest watched",
			rules: { nextEpisode: "after-furthest" },
		},
		steps: [
			{ label: "Marks S2E1", action: mark(2, 1) },
			{
				label: "Marks S2E2",
				action: mark(2, 2),
				expect: {
					status: "Watching",
					next: "S1E1",
					progress: "2/16 (S1 0/8, S2 2/8)",
				},
				expectAlt: { status: "Watching", next: "S2E3" },
			},
			{
				label: "Marks up to S2E2, which fills season 1",
				action: upTo(2, 2),
				expect: { next: "S2E3", progress: "10/16 (S1 8/8, S2 2/8)" },
				expectAlt: { next: "S2E3" },
			},
			{
				label: "Unmarks S1E4, an episode skipped back then",
				action: unmark(1, 4),
				expect: { next: "S1E4" },
				expectAlt: { next: "S2E3" },
			},
		],
	},
	{
		key: "split-season",
		title: "A season split in two parts",
		about:
			"Part one ends with an episode TMDB marks `mid_season`. Part two has no date yet and is not listed. The research's 45 days apply to this break as to any other.",
		start: world(
			show("A show with a split season", "Returning Series", [
				...weekly(1, "2026-03-03", 3),
				episode(1, 4, "2026-03-24", "mid_season"),
			]),
			at("2026-03-24", "22:00"),
		),
		compare: {
			label: "A later episode of a season the member has watched from reopens the show",
			rules: { laterEpisodes: "reopen" },
		},
		steps: [
			{
				label: "Marks season 1 on the night of S1E4",
				action: { do: "markSeason", season: 1 },
				expect: { seen: "no", status: "Watching", caughtUp: "yes" },
			},
			{
				label: "46 days later",
				action: time(at("2026-05-09")),
				expect: { seen: "Seen", status: "none", caughtUp: "no" },
				expectAlt: { seen: "Seen", status: "none", caughtUp: "no" },
			},
			{
				label: "TMDB lists part two for September",
				action: {
					do: "tmdbLists",
					episodes: weekly(1, "2026-09-01", 4, { from: 5, finale: true }),
				},
			},
			{
				label: "S1E5 airs",
				action: time(at("2026-09-01", "22:00")),
				expect: { seen: "Seen, new episodes", status: "none", next: "S1E5" },
				expectAlt: { seen: "no", status: "Watching", caughtUp: "no", next: "S1E5" },
			},
		],
	},
	{
		key: "canceled-with-episodes-left",
		title: "A canceled show with episodes still to air",
		about:
			"The network cancels the show and burns off the last two episodes. TMDB sets the status to Canceled at once. By the research's rule a Canceled show has no season airing.",
		start: world(
			show("A canceled show", "Canceled", weekly(1, "2026-09-08", 7)),
			at("2026-10-06", "22:00"),
		),
		compare: {
			label: "Ended or Canceled does not close a season that lists a dated episode ahead",
			rules: { endedStatus: "ignored-while-episodes-ahead" },
		},
		steps: [
			{
				label: "Marks up to S1E5",
				action: upTo(1, 5),
				expect: { seen: "Seen", status: "none", caughtUp: "no", progress: "5/5, 7 listed" },
				expectAlt: { seen: "no", status: "Watching", caughtUp: "yes" },
			},
			{
				label: "A week passes; S1E6 airs",
				action: time(at("2026-10-13", "22:00")),
				expect: { seen: "Seen, new episodes", status: "none", next: "S1E6" },
				expectAlt: { seen: "no", status: "Watching", caughtUp: "no", next: "S1E6" },
			},
		],
	},
	{
		key: "import-old-history",
		title: "An import brings an old history, and a show the member dropped by hand",
		about:
			"Season 1 aired in 2019 and season 2 in 2021. An import brings eight dated watches from 2019. Later the member drops the show, and a second import brings two more watches.",
		start: world(
			show("A show with two finished seasons", "Returning Series", [
				...weekly(1, "2019-01-08", 8, { finale: true }),
				...weekly(2, "2021-01-05", 8, { finale: true }),
			]),
			at("2026-10-06"),
		),
		compare: {
			label: "Seen worked out from the dates of the watches, and an unstarted season not airing",
			rules: { seenEvaluation: "from-history", upcomingSeason: "not-airing" },
		},
		steps: [
			{
				label: "An import brings season 1, watched on 8 days in early 2019",
				action: {
					do: "importWatches",
					importId: "trakt-1",
					watches: weekly(1, "2019-01-09", 8).map((e) => ({
						season: 1,
						number: e.number,
						date: { precision: "day", day: e.airDate as string },
					})),
				},
				expect: {
					seen: "no",
					status: "Watching",
					next: "S2E1",
					progress: "8/16 (S1 8/8, S2 0/8)",
				},
				expectAlt: { seen: "Seen, new episodes", status: "none", next: "S2E1" },
			},
			{
				label: "Sets Dropped",
				action: { do: "setDropped" },
				expect: { status: "Dropped", hiddenFromRecommendations: "yes" },
			},
			{
				label: "A second import brings S2E1 and S2E2 without dates",
				action: {
					do: "importWatches",
					importId: "netflix-1",
					watches: [1, 2].map((number) => ({
						season: 2,
						number,
						date: { precision: "unknown" },
					})),
				},
				expect: {
					status: "Dropped",
					next: "S2E3",
					progress: "10/16 (S1 8/8, S2 2/8)",
					hiddenFromRecommendations: "yes",
				},
			},
		],
	},
	{
		key: "film",
		title: "A film",
		about:
			"A film has watches and no status. It is Seen when watched or rated. A second watch is another row.",
		start: {
			...world(show("A film", "Ended", []), at("2026-10-06"), { wantToSee: true }),
			film: true,
		},
		steps: [
			{
				label: "Marks the film watched",
				action: { do: "markFilm" },
				expect: {
					seen: "Seen",
					status: "none",
					progress: "1 watch",
					hiddenByNotSeenYet: "yes",
					marked: "none",
				},
			},
			{
				label: "Adds a second watch for a day in 2019",
				action: { do: "markFilm", date: { precision: "day", day: "2019-07-14" } },
				expect: { seen: "Seen", progress: "2 watches" },
			},
			{ label: "Rates the film 9", action: { do: "rate", score: 9 } },
			{
				label: "Removes the watches",
				action: { do: "removeFilmWatches" },
				expect: { seen: "Seen", progress: "0 watches" },
			},
			{
				label: "Removes the rating",
				action: { do: "removeRating" },
				expect: { seen: "no", hiddenByNotSeenYet: "no" },
			},
		],
	},
]
