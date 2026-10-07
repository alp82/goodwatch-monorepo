// PROTOTYPE (issue #368). The decisions of the tracking rules as cases a person can press through, for the
// playground at /prototype/tracking-rules. A case names a scenario of scenarios.ts and how many of its steps are
// already done; the rest are the presses to try. Its switches are readings of `Rules`: flipping one replays the
// same presses under the other reading. Its questions are what the owner answers, one per surprise of the report.
import {
	type Action,
	type Rules,
	SETTLED,
	type View,
	type World,
	episodeLabel,
	step,
	view,
} from "./rules.ts"
import { SCENARIOS } from "./scenarios.ts"
import { SURPRISES } from "./surprises.ts"

// ---------------------------------------------------------------------------------------------------------
// Playing a list of presses under a set of rules
// ---------------------------------------------------------------------------------------------------------

export interface PlayedStep {
	action: Action
	note: string
	refused: boolean
	view: View
	/** The clock after the press. */
	now: string
}

export interface Played {
	world: World
	view: View
	steps: PlayedStep[]
}

export function play(start: World, actions: Action[], rules: Rules): Played {
	let world = start
	const steps: PlayedStep[] = []
	for (const action of actions) {
		const result = step(world, action, rules)
		world = result.world
		steps.push({
			action,
			note: result.note,
			refused: result.note.startsWith("Refused"),
			view: view(world, rules),
			now: world.clock.now,
		})
	}
	return { world, view: view(world, rules), steps }
}

/** Where the member stands with the show, in the words a surface would use. */
export function stateLabel(v: View): string {
	const seen = v.seen ? (v.hasNewEpisodes ? "Seen · new episodes" : "Seen") : ""
	const status =
		v.status === "watching"
			? v.caughtUp
				? "Watching · caught up"
				: "Watching"
			: v.status === "on_hold"
				? "On hold"
				: v.status === "dropped"
					? "Dropped"
					: ""
	const both = [seen, status].filter(Boolean).join(" and ")
	if (both) return both
	if (v.notInterested) return "Not interested"
	if (v.wantToSee) return "Want to See"
	return "Not started"
}

/** One line that tells two readings apart: state, progress, next episode, the prompt to rate. */
export function outcomeLine(v: View): string {
	const parts = [stateLabel(v)]
	if (v.progress.hasEpisodeList)
		parts.push(`${v.progress.watched} of ${v.progress.aired} watched`)
	parts.push(v.nextEpisode ? `next ${episodeLabel(v.nextEpisode)}` : "no next episode")
	if (v.wantToSee && stateLabel(v) !== "Want to See") parts.push("on the Wishlist")
	if (!v.offered.seen && !v.seen) parts.push("Seen not offered")
	if (v.promptToRate) parts.push("asks for a score")
	return parts.join(" · ")
}

const day = (instant: string) =>
	new Date(instant).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "UTC",
	})

/** A press in the second person, for the log and the "what just happened" line. */
export function actionLabel(action: Action): string {
	switch (action.do) {
		case "markEpisode":
			return `You ticked ${episodeLabel(action)}`
		case "unmarkEpisode":
			return `You unticked ${episodeLabel(action)}`
		case "markSeason":
			return action.season === 0 ? "You marked the specials" : `You marked season ${action.season}`
		case "markUpTo":
			return `You marked everything up to ${episodeLabel(action)}`
		case "pressSeen":
			return "You pressed Seen"
		case "removeSeen":
			return "You pressed Seen again to remove it"
		case "rate":
			return `You gave it a ${action.score}`
		case "removeRating":
			return "You cleared your score"
		case "setOnHold":
			return "You set On hold"
		case "setDropped":
			return "You set Dropped"
		case "addWantToSee":
			return "You pressed Want to See"
		case "removeWantToSee":
			return "You removed Want to See"
		case "setNotInterested":
			return "You pressed Not interested"
		case "dismissRatePrompt":
			return "You put the prompt to rate away"
		case "importWatches":
			return `An import brought ${action.watches.length} watches${action.status ? ` and the status ${action.status}` : ""}`
		case "timePasses":
			return `Time passed, to ${day(action.to)}`
		case "tmdbLists":
			return `TMDB listed ${action.episodes.map(episodeLabel).join(", ")}`
		case "tmdbRemoves":
			return "TMDB removed an episode"
		case "tmdbChanges":
			return "TMDB changed episodes"
		case "tmdbSetsStatus":
			return `TMDB set the show to ${action.status}`
		default:
			return "Something happened"
	}
}

// ---------------------------------------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------------------------------------

export interface CaseStep {
	label: string
	action: Action
}

export interface Setup {
	/** Empty for a case's first set-up; otherwise the part after the dot in `?case=<id>.<key>`. */
	key: string
	button: string
	/** A made-up title for the show page. */
	show: string
	/** What to press, as an instruction. */
	say: string
	start: World
	/** Presses already made when the case opens. */
	done: Action[]
	/** The presses to try, in order. */
	steps: CaseStep[]
}

export interface SwitchEntry {
	label: string
	/** What it changes against the settled rules. Empty: the rules as settled. */
	rules: Partial<Rules>
	recommended?: boolean
}

export interface RuleSwitch {
	label: string
	entries: SwitchEntry[]
}

export interface CaseOption {
	id: string
	label: string
	/** The option in full, from the report. */
	detail: string
	recommended?: boolean
}

export interface CaseQuestion {
	/** `r` and the surprise's number in the report: r1 to r27. */
	id: string
	number: number
	title: string
	options: CaseOption[]
}

export interface Case {
	id: string
	/** The eight decisions that change settled wording come first. */
	group: "wording" | "rest"
	title: string
	problem: string
	setups: Setup[]
	switches: RuleSwitch[]
	questions: CaseQuestion[]
}

const scenario = (key: string) => {
	const found = SCENARIOS.find((s) => s.key === key)
	if (!found) throw new Error(`No scenario ${key}`)
	return found
}

/** A set-up from a scenario: its first `done` steps are made, the rest (or `steps`) are the presses to try. */
const setup = (
	scenarioKey: string,
	done: number,
	show: string,
	say: string,
	more: { key?: string; button?: string; steps?: CaseStep[]; now?: string } = {},
): Setup => {
	const from = scenario(scenarioKey)
	return {
		key: more.key ?? "",
		button: more.button ?? "Set up this case",
		show,
		say,
		start: more.now ? { ...from.start, clock: { ...from.start.clock, now: more.now } } : from.start,
		done: from.steps.slice(0, done).map((s) => s.action),
		steps:
			more.steps ??
			from.steps.slice(done).map((s) => ({ label: s.label, action: s.action })),
	}
}

/** The question for surprise `number`, with a short label per option of the report, in the report's order. */
const question = (
	number: number,
	recommended: number,
	labels: string[],
	extra: string[] = [],
): CaseQuestion => {
	const surprise = SURPRISES[number - 1]
	const details = [...surprise.options, ...extra]
	if (labels.length !== details.length)
		throw new Error(`Surprise ${number} has ${details.length} options`)
	return {
		id: `r${number}`,
		number,
		title: surprise.title,
		options: labels.map((label, index) => ({
			id: "abcde"[index],
			label,
			detail: details[index],
			recommended: index === recommended,
		})),
	}
}

const at = (dayOfMonth: string, time = "12:00") => `${dayOfMonth}T${time}:00Z`

export const CASES: Case[] = [
	// ---- The eight that change settled wording --------------------------------------------------------
	{
		id: "seen-while-airing",
		group: "wording",
		title: "Pressing Seen while the season is still airing",
		problem:
			"Six of eight episodes have aired. The button says Seen, but by the glossary a show is Seen only when no season is still airing.",
		setups: [
			setup(
				"seen-press-while-airing",
				0,
				"Harbour Lights",
				"Press Seen. Look at what the show says it is. Then let a week pass, and press Seen again to take it back.",
			),
		],
		switches: [
			{
				label: "A Seen press on an airing show",
				entries: [
					{ label: "Watching, caught up", rules: {}, recommended: true },
					{ label: "Always Seen", rules: { seenPressWhileAiring: "seen" } },
					{ label: "Seen not offered", rules: { seenPressWhileAiring: "not-offered" } },
				],
			},
		],
		questions: [
			question(1, 0, [
				"Watching and caught up; Seen comes when the season ends",
				"The press always makes it Seen",
				"No Seen button while a season airs",
			]),
		],
	},
	{
		id: "announced-premiere",
		group: "wording",
		title: "An announced premiere keeps a finished show \"still airing\"",
		problem:
			"Two finished seasons, and TMDB already lists the season 3 premiere eleven months ahead. Finishing season 2 leaves the show Watching and caught up for all that time.",
		setups: [
			setup(
				"upcoming-season-listed-first",
				0,
				"The Long Tide",
				"Mark everything up to the season 2 finale (\"up to here\" on S2E6). You have watched all there is. Is the show Seen?",
			),
			setup(
				"upcoming-season-listed-first",
				0,
				"The Long Tide",
				"The same show, five days before the season 3 premiere. Mark everything up to S2E6.",
				{
					key: "week",
					button: "Set up: five days before the premiere",
					now: "2027-09-02T12:00:00Z",
					steps: [
						{ label: "Marks up to S2E6, the season 2 finale", action: { do: "markUpTo", season: 2, number: 6 } },
						{ label: "Five days pass; S3E1 airs", action: { do: "timePasses", to: "2027-09-07T12:00:00Z" } },
					],
				},
			),
		],
		switches: [
			{
				label: "A season nothing has aired of",
				entries: [
					{ label: "Counts as airing", rules: {} },
					{ label: "Not airing until it starts", rules: { upcomingSeason: "not-airing" }, recommended: true },
					{ label: "Airing from a week before", rules: { upcomingSeason: "airing-from-a-week-before" } },
				],
			},
		],
		questions: [
			question(6, 1, [
				"A dated premiere makes the season airing",
				"A season is airing only once an episode has aired",
				"Airing from 7 days before the premiere",
			]),
		],
	},
	{
		id: "mid-season-break",
		group: "wording",
		title: "A break longer than 45 days turns the show Seen mid-season",
		problem:
			"Nothing is listed for 45 days, so the season counts as over: a caught-up show turns Seen and asks for a score. When the next episode airs it is \"Seen, new episodes\" with no status.",
		setups: [
			setup(
				"split-season",
				0,
				"Glass Country",
				"Press Mark season (you are caught up, and S1E4 is marked mid-season by TMDB). Then step through the break below.",
				{ button: "Set up: split season" },
			),
			setup(
				"weekly-network",
				4,
				"Ward Nine",
				"You are caught up at 8 of 8 before the winter break. Step through the break below.",
				{ key: "winter", button: "Set up: winter break" },
			),
		],
		switches: [
			{
				label: "The break",
				entries: [
					{ label: "45 days, stays Seen", rules: {} },
					{ label: "A later episode reopens it", rules: { laterEpisodes: "reopen" }, recommended: true },
					{ label: "365 days after a mid-season mark", rules: { midSeasonGapDays: 365 } },
					{
						label: "Both",
						rules: { laterEpisodes: "reopen", midSeasonGapDays: 365 },
						recommended: true,
					},
					{ label: "120 days for every break", rules: { airingGapDays: 120, midSeasonGapDays: 120 } },
				],
			},
		],
		questions: [
			question(7, 1, [
				"A longer gap, such as 120 days",
				"Keep 45 days; a later episode of a season watched from returns it to Watching",
				"Keep it; the Watching views treat \"Seen, new episodes\" like Watching",
			]),
			question(
				8,
				2,
				[
					"No special case for the mid-season mark",
					"A longer gap (a year) after a mid-season episode",
					"Both: the longer gap, and the reopen rule for the rest",
				],
				["Both: a longer gap when the last aired episode is `mid_season`, and the reopen rule for every other break."],
			),
		],
	},
	{
		id: "undated-and-ended",
		group: "wording",
		title: "A blank air date, and Canceled with episodes still to air",
		problem:
			"One episode without a date keeps its season airing for good, so the show can never be Seen by watching. And TMDB's Canceled closes a season that still lists episodes ahead.",
		setups: [
			setup(
				"no-air-date",
				0,
				"Paper Suns",
				"Four episodes aired in 2025; a fifth has no date. Press Seen.",
				{ button: "Set up: blank air date" },
			),
			setup(
				"canceled-with-episodes-left",
				0,
				"Night Freight",
				"Canceled, with two episodes still listed ahead. Mark up to S1E5, then let a week pass.",
				{ key: "canceled", button: "Set up: canceled show" },
			),
		],
		switches: [
			{
				label: "An episode without a date",
				entries: [
					{ label: "Keeps the season airing", rules: {} },
					{ label: "Is ignored", rules: { undatedEpisode: "ignored" }, recommended: true },
				],
			},
			{
				label: "Ended or Canceled",
				entries: [
					{ label: "Closes the season at once", rules: {} },
					{
						label: "Not while a dated episode is ahead",
						rules: { endedStatus: "ignored-while-episodes-ahead" },
						recommended: true,
					},
				],
			},
		],
		questions: [
			question(9, 1, [
				"An undated episode keeps the season airing",
				"Only a future date keeps it airing",
			]),
			question(10, 1, [
				"Ended or Canceled closes the season whatever is listed",
				"A dated episode ahead keeps it airing; the status only skips the 45 days",
			]),
		],
	},
	{
		id: "seen-evaluation",
		group: "wording",
		title: "Seen depends on when somebody last looked",
		problem:
			"The 45 days run out on a day when nobody does anything. Two members with the same watches differ: one whose show was looked at between the seasons has it Seen, the other has it Watching and five behind.",
		setups: [
			setup(
				"season-ends-not-looked-at",
				0,
				"Salt Road",
				"Press Mark season. Then use the steps below: TMDB lists season 2, and time jumps straight to October. Nobody looked in between.",
				{ button: "Set up: nobody looked" },
			),
			setup(
				"season-ends-looked-at",
				0,
				"Salt Road",
				"The same show. Press Mark season, then the steps below: this time the show is looked at 50 days later, before season 2.",
				{ key: "looked", button: "Set up: looked at in the gap" },
			),
			setup(
				"import-old-history",
				0,
				"Coldwater",
				"Season 1 aired in 2019, season 2 in 2021. Run the import of season 1, watched in 2019.",
				{ key: "import", button: "Set up: an old import" },
			),
		],
		switches: [
			{
				label: "When Seen is decided",
				entries: [
					{ label: "When somebody looks", rules: {} },
					{
						label: "Worked out from the dates",
						rules: { seenEvaluation: "from-history", upcomingSeason: "not-airing" },
						recommended: true,
					},
				],
			},
		],
		questions: [
			question(5, 1, [
				"Decide when the show is recomputed, on a schedule",
				"Work it out from watch dates and air dates",
				"Never by the calendar: only at a watch, a press or a score",
			]),
		],
	},
	{
		id: "readded-episode",
		group: "wording",
		title: "TMDB deletes an episode and adds it again under a new id",
		problem:
			"ADR 0008 keeps the old watch and never counts it again. Every delete and re-add by an editor costs every member one episode, without a word.",
		setups: [
			setup(
				"tmdb-readds-episode-watching",
				1,
				"Second City",
				"You are caught up in season 2. Use the steps below: TMDB removes S1E2, then adds it again.",
				{ button: "Set up: caught up" },
			),
			setup(
				"tmdb-readds-episode-seen",
				1,
				"Quiet Hours",
				"A finished show, marked Seen. Use the steps below: TMDB removes S1E2, then adds it again.",
				{ key: "seen", button: "Set up: a Seen show" },
			),
			setup(
				"tmdb-renumbers",
				1,
				"Ten Rooms",
				"The case against matching: you watched five of ten. An editor deletes S1E5 and moves 6 to 10 down. Run the steps below.",
				{ key: "renumber", button: "Set up: a renumbering" },
			),
		],
		switches: [
			{
				label: "A watch whose episode id is gone",
				entries: [
					{ label: "Never counts (ADR 0008)", rules: {} },
					{ label: "Counts by season and number", rules: { goneEpisode: "same-number" } },
					{
						label: "By number and air date",
						rules: { goneEpisode: "same-number-and-date" },
						recommended: true,
					},
				],
			},
		],
		questions: [
			question(4, 2, [
				"ADR 0008 as written: the watch never counts again",
				"Count it when one listed episode has the same season and number",
				"The same, and the air date must match too",
			]),
		],
	},
	{
		id: "next-episode",
		group: "wording",
		title: "Next episode when you start at season 2",
		problem:
			"You saw season 1 years ago and never marked it. The glossary's next episode is the earliest unwatched one, so it stays S1E1 however far you are.",
		setups: [
			setup(
				"starting-in-the-middle",
				0,
				"Border Station",
				"Tick S2E1, then S2E2. Watch the Next episode line.",
			),
		],
		switches: [
			{
				label: "Next episode",
				entries: [
					{ label: "Earliest unwatched", rules: {} },
					{ label: "First after the furthest watched", rules: { nextEpisode: "after-furthest" }, recommended: true },
				],
			},
		],
		questions: [
			question(12, 1, [
				"The earliest unwatched episode",
				"The first unwatched after the furthest watched, else the oldest gap",
				"The first unwatched after the most recently watched",
			]),
		],
	},
	{
		id: "remove-seen",
		group: "wording",
		title: "Removing Seen also removes seasons you marked earlier",
		problem:
			"You ticked two episodes, marked the rest of season 1 with Mark season, then pressed Seen. Taking Seen back should put you where you were: 8 of 16.",
		setups: [
			setup(
				"remove-seen-with-hand-marks",
				3,
				"Open Water",
				"Season 1 is marked: two ticks by hand, six by Mark season. Press Seen, then press Seen again to remove it.",
			),
		],
		switches: [
			{
				label: "Removing Seen removes",
				entries: [
					{ label: "Every bulk watch", rules: {} },
					{ label: "Only what the Seen press made", rules: { removeSeenRemoves: "show-bulk" }, recommended: true },
				],
			},
		],
		questions: [
			question(3, 1, [
				"Every bulk watch goes, season marks included",
				"Only the watches the Seen press made",
				"Each bulk action gets its own id, undone one by one",
			]),
		],
	},

	// ---- The rest of the 27 -----------------------------------------------------------------------------
	{
		id: "remove-seen-nothing",
		group: "rest",
		title: "Removing Seen can leave the show Seen",
		problem:
			"Every episode was ticked by hand, so there is no bulk watch to remove. The button does nothing you can see. The same on a show that is Seen because you scored it.",
		setups: [
			setup(
				"remove-seen-changes-nothing",
				3,
				"Three Rivers",
				"All three episodes are ticked by hand and the show is Seen. Press Seen to remove it.",
			),
		],
		switches: [],
		questions: [
			question(2, 0, [
				"Offer Remove Seen only when it removes something; say why otherwise",
				"Remove Seen removes every watch and the score",
				"Leave it: the press removes what it can",
			]),
		],
	},
	{
		id: "aired-time-zone",
		group: "rest",
		title: "Aired by your date or by the UTC date",
		problem:
			"S1E6 is dated October 7. For some hours a member in Los Angeles and one in Auckland get different answers to \"has it aired?\", and which one depends on the rule.",
		setups: [
			setup(
				"airs-today-los-angeles",
				0,
				"Late Edition",
				"It is 18:00 on October 6 in Los Angeles, already October 7 in UTC. Mark up to S1E5 and look at S1E6.",
				{ button: "Set up: Los Angeles" },
			),
			setup(
				"airs-today-auckland",
				0,
				"Late Edition",
				"It is 08:00 on October 7 in Auckland, still October 6 in UTC. Mark up to S1E5 and look at S1E6.",
				{ key: "auckland", button: "Set up: Auckland" },
			),
		],
		switches: [
			{
				label: "\"Today\" for aired",
				entries: [
					{ label: "Your date", rules: {}, recommended: true },
					{ label: "The UTC date", rules: { airedBy: "utc-date" } },
				],
			},
		],
		questions: [
			question(11, 2, [
				"The member's date",
				"The UTC date",
				"The member's date, UTC where the zone is unknown; marking is never blocked",
			]),
		],
	},
	{
		id: "seen-and-status",
		group: "rest",
		title: "Seen and a status at the same time",
		problem:
			"A scored show is Seen. Score a show after three of ten episodes and it is Seen and Watching, with a next episode. Nothing says which of the two a card shows.",
		setups: [
			setup(
				"rated-with-some-episodes",
				1,
				"Low Winter Sun Road",
				"Three of ten watched. Give it a score, then set Dropped, then tick S1E4.",
			),
		],
		switches: [],
		questions: [
			question(13, 0, [
				"Allow both; where both hold, show the status",
				"A score does not make a show Seen while episodes are left",
				"Scoring a started show ends its status",
			]),
		],
	},
	{
		id: "seen-new-season",
		group: "rest",
		title: "A Seen show gets a new season",
		problem:
			"\"The first watched episode sets Watching\" covers the first watch only. On a Seen show whose season 2 starts, nothing says what the status is or what a watch does.",
		setups: [
			setup(
				"new-season-on-seen-show",
				2,
				"Field Notes",
				"Season 1 is Seen; season 2 is listed. Go to the next air date, then tick S2E1.",
			),
		],
		switches: [],
		questions: [
			question(14, 0, [
				"No status until the member acts; a watch sets Watching",
				"The show returns to Watching by itself",
			]),
		],
	},
	{
		id: "existing-seen-shows",
		group: "rest",
		title: "Existing Seen shows will say \"new episodes\" from day one",
		problem:
			"A show marked Seen years ago that has continued since comes out of the migration as \"Seen, new episodes\". For a long history that is many shows at once.",
		setups: [
			setup(
				"new-season-on-seen-show",
				3,
				"Field Notes",
				"Marked Seen a year ago; season 2 started today. This is how the show looks. Let a week pass to see the count grow.",
			),
		],
		switches: [],
		questions: [
			question(15, 0, [
				"Accept it, and keep the sign quiet",
				"Mark everything aired by the day of the migration",
			]),
		],
	},
	{
		id: "unmark-on-seen",
		group: "rest",
		title: "Unticking an episode of a Seen show",
		problem:
			"You marked the show Seen in one press and untick the one episode you skipped. Is the show still Seen, at 3 of 4?",
		setups: [
			setup("unmarking", 3, "Small Hours", "The show is Seen in one press. Untick S1E2, the one you skipped."),
		],
		switches: [
			{
				label: "Unticking an episode of a Seen show",
				entries: [
					{ label: "Takes Seen away", rules: {}, recommended: true },
					{ label: "Leaves Seen", rules: { unmarkOnSeen: "keeps-seen" } },
				],
			},
		],
		questions: [
			question(16, 0, [
				"It takes Seen away if the episode had aired by then",
				"Seen stays until the member removes it",
				"Seen from a press stays, Seen from watching goes",
			]),
		],
	},
	{
		id: "mis-tap",
		group: "rest",
		title: "A mis-tap on the first episode costs the Want to See",
		problem:
			"The first watched episode sets Watching and clears Want to See. Unticking it takes the watch away, and the show has left the Wishlist for good.",
		setups: [
			setup("unmarking", 0, "Small Hours", "The show is on your Wishlist. Tick S1E1, then untick it."),
		],
		switches: [],
		questions: [
			question(17, 1, [
				"Unticking the last watch ends Watching; Want to See stays cleared",
				"The same, and the undo right after the tick restores Want to See",
				"Store what the first watch cleared and restore it whenever no watch is left",
			]),
		],
	},
	{
		id: "before-first-episode",
		group: "rest",
		title: "Before the first episode: Not interested, Dropped, On hold",
		problem:
			"With nothing watched, Not interested and Dropped do nearly the same. Nothing says whether On hold is possible, or what Dropped does to Not interested.",
		setups: [
			setup(
				"before-the-first-episode",
				0,
				"Clear Skies",
				"Nothing watched. Press Not interested, then Want to See, and walk through the steps below.",
			),
		],
		switches: [],
		questions: [
			question(18, 0, [
				"Offer Not interested only; Dropped comes from imports; On hold needs an episode",
				"Offer both from the start",
				"Turn an imported Dropped with no episode into Not interested",
			]),
		],
	},
	{
		id: "want-on-started",
		group: "rest",
		title: "Want to See on a show you have started",
		problem:
			"Adding Want to See clears Dropped. On a dropped show with three episodes watched, that would leave watches, no status, and a show on the Wishlist.",
		setups: [
			setup(
				"on-hold-and-dropped",
				4,
				"Iron Coast",
				"Three episodes watched, then Dropped. Press Want to See.",
			),
		],
		switches: [],
		questions: [
			question(19, 0, [
				"On a started show with episodes left it means Watching",
				"Want to See and a status hold together",
				"It clears Dropped and nothing else",
			]),
		],
	},
	{
		id: "special-starts",
		group: "rest",
		title: "Does watching a special start the show?",
		problem:
			"Specials can be watched and never count. If a special is \"the first watched episode\", a recap special sets Watching and takes the show off the Wishlist.",
		setups: [
			setup("specials", 0, "Winter Annual", "The show is on your Wishlist. Tick Special 1."),
		],
		switches: [
			{
				label: "A watched special",
				entries: [
					{ label: "Changes nothing else", rules: {}, recommended: true },
					{ label: "Starts the show", rules: { specialStartsShow: true } },
				],
			},
		],
		questions: [
			question(20, 0, [
				"A special changes nothing but its own mark",
				"A special starts the show like any episode",
			]),
		],
	},
	{
		id: "list-appears",
		group: "rest",
		title: "Marked Seen with no episode list; the list comes later",
		problem:
			"A show TMDB lists no season for can only be marked Seen as a whole. When the episodes appear, it is Seen at 0 of 9 with S1E1 as next episode.",
		setups: [
			setup(
				"no-episode-list",
				0,
				"The Unlisted",
				"There is no episode list. Press Seen, then run the steps below: time passes and TMDB adds two seasons.",
			),
		],
		switches: [
			{
				label: "When the list first appears",
				entries: [
					{ label: "Bulk watches for what had aired", rules: {}, recommended: true },
					{ label: "Nothing", rules: { backfillWhenListAppears: false } },
				],
			},
		],
		questions: [
			question(21, 0, [
				"Bulk watches for what had aired when it was marked Seen",
				"Nothing: Seen stays with no progress behind it",
			]),
		],
	},
	{
		id: "rated-no-episodes",
		group: "rest",
		title: "A scored show with no episode watched",
		problem:
			"A score marks no episodes. The show is Seen at 0 of 6, its next episode is S1E1, and the Seen button already shows Seen, so there is no press that marks what you watched.",
		setups: [
			setup(
				"rated-without-episodes",
				0,
				"Half Light",
				"Give the show a score. Look at the Seen button, the progress and the next episode. Then press Seen.",
			),
		],
		switches: [],
		questions: [
			question(22, 0, [
				"Next episode only with a status; a \"mark all aired\" in the episode list",
				"A score marks every aired episode",
			]),
		],
	},
	{
		id: "status-vs-calendar",
		group: "rest",
		title: "Dropped while caught up, and then the season ends",
		problem:
			"A dropped show that is watched through with no season airing fits the definition of Seen. Nothing says whether the calendar may take Dropped away.",
		setups: [
			setup(
				"streaming-season",
				1,
				"Harbour Lights",
				"You are caught up at 6 of 6. Set Dropped, then jump past the season end.",
				{
					steps: [
						{ label: "Sets Dropped", action: { do: "setDropped" } },
						{ label: "Three weeks pass; the season is over", action: { do: "timePasses", to: at("2026-10-27") } },
					],
				},
			),
		],
		switches: [],
		questions: [
			question(23, 0, [
				"Time never changes On hold or Dropped; a score still counts for taste",
				"Watched through with no season airing is Seen whatever the status",
			]),
		],
	},
	{
		id: "mark-unaired",
		group: "rest",
		title: "Ticking an episode that has not aired",
		problem:
			"Bulk marks include aired episodes only. Nothing says whether one tick by hand works on an episode that has not aired, or what progress is measured against.",
		setups: [
			setup(
				"streaming-season",
				1,
				"Harbour Lights",
				"Six of eight have aired and you are caught up. Tick S1E7, which airs next week. Then let a week pass.",
				{
					steps: [
						{ label: "Ticks S1E7, which has not aired", action: { do: "markEpisode", season: 1, number: 7 } },
						{ label: "A week passes; S1E7 airs", action: { do: "timePasses", to: at("2026-10-13") } },
					],
				},
			),
		],
		switches: [
			{
				label: "A tick on an unaired episode",
				entries: [
					{ label: "Allowed", rules: {}, recommended: true },
					{ label: "Refused", rules: { markUnaired: "refused" } },
				],
			},
		],
		questions: [
			question(24, 0, [
				"Allowed by hand; progress counts aired episodes only",
				"Unaired episodes cannot be marked",
			]),
		],
	},
	{
		id: "rate-prompt",
		group: "rest",
		title: "When the one prompt to rate appears",
		problem:
			"One prompt when a show is watched through. Does it ask after a Seen press, again for a later season, after an import, or when the 45 days run out?",
		setups: [
			setup(
				"start-and-finish",
				2,
				"Small Hours",
				"Three of four watched. Tick S1E4, the last one: the prompt appears. Put it away with Not now.",
			),
		],
		switches: [],
		questions: [
			question(25, 0, [
				"Once per show, when it first becomes Seen by the member's own watch or press",
				"Every time a show becomes watched through",
			]),
		],
	},
	{
		id: "import-status",
		group: "rest",
		title: "What imported watches do to a status",
		problem:
			"Watching an episode of a Dropped show returns it to Watching. An import adds watches from long ago; if they count as watching, every dropped show comes back.",
		setups: [
			setup(
				"import-old-history",
				2,
				"Coldwater",
				"Season 1 was imported and you then dropped the show. Run the second import below: two more watches, no dates.",
			),
		],
		switches: [],
		questions: [
			question(26, 0, [
				"An import starts a show without a status and never overrides On hold or Dropped",
				"Compare dates: a watch dated after the status change returns it to Watching",
			]),
		],
	},
	{
		id: "mark-over",
		group: "rest",
		title: "Marking over existing watches, and what unticking removes",
		problem:
			"An episode can have several watches. Nothing says whether Mark season adds a second watch to an episode that has one, or which watch an untick removes.",
		setups: [
			setup(
				"remove-seen-with-hand-marks",
				2,
				"Open Water",
				"S1E1 and S1E2 are ticked by hand. Press Mark season on season 1 and count the bulk watches. Then untick S1E3.",
				{
					steps: [
						{ label: "Marks season 1", action: { do: "markSeason", season: 1 } },
						{ label: "Unticks S1E3", action: { do: "unmarkEpisode", season: 1, number: 3 } },
					],
				},
			),
		],
		switches: [],
		questions: [
			question(27, 0, [
				"Bulk marks skip watched episodes; an untick removes every watch of the episode",
				"An untick removes the newest watch only",
			]),
		],
	},
]

/** `?case=<id>` or `?case=<id>.<setup key>`. */
export function findSetup(param: string | null): { found: Case; setup: Setup } | null {
	if (!param) return null
	const [id, key = ""] = param.split(".")
	const found = CASES.find((c) => c.id === id)
	const chosen = found?.setups.find((s) => s.key === key) ?? found?.setups[0]
	return found && chosen ? { found, setup: chosen } : null
}

export const caseParam = (found: Case, chosen: Setup) =>
	chosen.key ? `${found.id}.${chosen.key}` : found.id

/** The rules with one switch entry applied: the keys its switch owns go back to settled, then the entry's. */
export function withEntry(rules: Rules, ruleSwitch: RuleSwitch, entry: SwitchEntry): Rules {
	const next: Record<string, unknown> = { ...rules }
	for (const key of keysOf(ruleSwitch)) next[key] = SETTLED[key]
	return { ...(next as unknown as Rules), ...entry.rules }
}

const keysOf = (ruleSwitch: RuleSwitch) =>
	[...new Set(ruleSwitch.entries.flatMap((e) => Object.keys(e.rules)))] as (keyof Rules)[]

export const entryIsOn = (rules: Rules, ruleSwitch: RuleSwitch, entry: SwitchEntry) =>
	keysOf(ruleSwitch).every((key) => rules[key] === (entry.rules[key] ?? SETTLED[key]))

/** Every recommended switch entry applied at once. The last recommended entry of a switch wins ("Both"). */
export const RECOMMENDED: Rules = CASES.flatMap((c) => c.switches).reduce((rules, ruleSwitch) => {
	const entry = [...ruleSwitch.entries].reverse().find((e) => e.recommended)
	return entry ? withEntry(rules, ruleSwitch, entry) : rules
}, SETTLED)
