// PROTOTYPE (issue #368). Runs the scenarios through the rules and renders the report. The report file
// docs/prototypes/tracking-rules/README.md is this module's output and nothing else; a test fails when the
// two differ. Regenerate it from goodwatch-webapp with:
//
//   node app/domain/prototype-tracking-rules/write-report.ts
import {
	type Rules,
	type View,
	type World,
	SETTLED,
	episodeLabel,
	step,
	view,
} from "./rules.ts"
import type { Scenario } from "./scenarios.ts"
import type { Surprise } from "./surprises.ts"

/** One line of a scenario's table, in the words a reader sees. */
export interface Row {
	seen: string
	status: string
	caughtUp: string
	next: string
	progress: string
	hiddenByNotSeenYet: string
	hiddenFromRecommendations: string
	marked: string
	offered: string
}

const yesNo = (value: boolean) => (value ? "yes" : "no")
const STATUS_LABEL = {
	watching: "Watching",
	on_hold: "On hold",
	dropped: "Dropped",
}

export function rowOf(world: World, seenView: View): Row {
	const { progress, offered } = seenView
	const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : word.endsWith("ch") ? "es" : "s"}`

	let progressText: string
	if (world.film) progressText = count(seenView.filmWatches, "watch")
	else if (!progress.hasEpisodeList) progressText = "no episode list"
	else {
		progressText = `${progress.watched}/${progress.aired}`
		if (progress.seasons.length > 1)
			progressText += ` (${progress.seasons
				.map((s) => `S${s.season} ${s.watched}/${s.aired}`)
				.join(", ")})`
		if (progress.listed > progress.aired)
			progressText += `, ${progress.listed} listed`
		if (progress.specialsWatched > 0)
			progressText += `, ${count(progress.specialsWatched, "special")}`
	}

	const offers = [
		offered.notInterested ? "Not interested" : null,
		offered.onHold ? "On hold" : null,
		offered.dropped ? "Dropped" : null,
	].filter(Boolean)

	return {
		seen: !seenView.seen
			? "no"
			: seenView.hasNewEpisodes
				? "Seen, new episodes"
				: "Seen",
		status: seenView.status ? STATUS_LABEL[seenView.status] : "none",
		caughtUp: yesNo(seenView.caughtUp),
		next: seenView.nextEpisode ? episodeLabel(seenView.nextEpisode) : "none",
		progress: progressText,
		hiddenByNotSeenYet: yesNo(seenView.hiddenByNotSeenYet),
		hiddenFromRecommendations: yesNo(seenView.hiddenFromRecommendations),
		marked: seenView.notInterested
			? "Not interested"
			: seenView.wantToSee
				? "Want to See"
				: "none",
		offered: offers.length > 0 ? offers.join(", ") : "none",
	}
}

export interface RanStep {
	label: string
	row: Row
	note: string
}

/** The scenario's table: the start, then one line per step. */
export function run(scenario: Scenario, rules: Rules = SETTLED): RanStep[] {
	let world = scenario.start
	let before = view(world, rules)
	const lines: RanStep[] = [{ label: "Start", row: rowOf(world, before), note: "" }]
	for (const scenarioStep of scenario.steps) {
		const result = step(world, scenarioStep.action, rules)
		world = result.world
		const after = view(world, rules)
		const notes = [result.note]
		if (after.promptToRate && !before.promptToRate)
			notes.push("The prompt to rate appears.")
		if (!after.promptToRate && before.promptToRate)
			notes.push("The prompt to rate is gone.")
		lines.push({
			label: scenarioStep.label,
			row: rowOf(world, after),
			note: notes.filter(Boolean).join(" "),
		})
		before = after
	}
	return lines
}

// ---------------------------------------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------------------------------------

const COLUMNS: [keyof Row, string][] = [
	["seen", "Seen"],
	["status", "Status"],
	["caughtUp", "Caught up"],
	["next", "Next episode"],
	["progress", "Progress"],
	["hiddenByNotSeenYet", "Hidden by Not seen yet"],
	["hiddenFromRecommendations", "Hidden from recommendations"],
	["marked", "Want to See / Not interested"],
	["offered", "Offered"],
]

const cell = (text: string) => text.replace(/\|/g, "\\|")

/** `against`: the same steps under the settled rules. Cells that differ from it are bold. */
function table(lines: RanStep[], against?: RanStep[]): string {
	const head = ["Step", ...COLUMNS.map(([, title]) => title), "What happened"]
	const body = lines.map((line, index) => [
		line.label,
		...COLUMNS.map(([key]) => {
			const value = line.row[key]
			return against && against[index].row[key] !== value ? `**${value}**` : value
		}),
		line.note,
	])
	return [
		`| ${head.join(" | ")} |`,
		`| ${head.map(() => "---").join(" | ")} |`,
		...body.map((cells) => `| ${cells.map(cell).join(" | ")} |`),
	].join("\n")
}

const scenarioHeading = (scenario: Scenario, index: number) =>
	`Scenario ${index + 1}: ${scenario.title}`

/** GitHub's anchor for a heading. */
export const anchorOf = (heading: string) =>
	heading
		.toLowerCase()
		.replace(/[^a-z0-9 -]/g, "")
		.replace(/ /g, "-")

const RULE_NOTES: Record<keyof Rules, { says: string; source: string }> = {
	airedBy: {
		says: "Whose calendar decides that an episode has aired",
		source: "Map: the member's date. Research: the UTC date",
	},
	goneEpisode: {
		says: "A watch whose episode id TMDB no longer lists",
		source: "ADR 0008: kept, never counts",
	},
	nextEpisode: {
		says: "Which unwatched episode is the next episode",
		source: "Glossary: the earliest aired regular episode without a watch",
	},
	removeSeenRemoves: {
		says: "Which bulk watches removing Seen removes",
		source: "Map: \"only bulk watches\", read as all of them",
	},
	upcomingSeason: {
		says: "A season with a dated episode and none aired",
		source: "Research: it is the season judged, so it is still airing",
	},
	undatedEpisode: {
		says: "An episode without a date in the latest season",
		source: "Research: it has not aired, so the season is still airing",
	},
	endedStatus: {
		says: "TMDB status Ended or Canceled",
		source: "Research: no season is airing",
	},
	airingGapDays: {
		says: "Days after the last aired episode until a season without a finale is over",
		source: "Research: 45, a judgment",
	},
	midSeasonGapDays: {
		says: "The same when the last aired episode is marked mid_season",
		source: "Research: no difference, 45",
	},
	laterEpisodes: {
		says: "Later episodes of a season the member has watched from, on a Seen show",
		source: "Map: a show stays Seen when later episodes air",
	},
	seenPressWhileAiring: {
		says: "Pressing Seen while a season is still airing",
		source: "Proposal. The glossary's Seen needs no season still airing",
	},
	unmarkOnSeen: {
		says: "Unmarking an episode of a show that is Seen by watching",
		source: "Proposal. The rules are silent",
	},
	seenEvaluation: {
		says: "When \"watched through with no season still airing\" is decided",
		source: "Proposal, and not the recommended one: see the surprises",
	},
	specialStartsShow: {
		says: "Whether watching a special starts the show",
		source: "Proposal. Map: specials never count",
	},
	markUnaired: {
		says: "Marking a listed episode by hand before it has aired",
		source: "Proposal. The rules are silent",
	},
	backfillWhenListAppears: {
		says: "A show marked Seen with no episode list, when the list appears",
		source: "Proposal, after the map's rule for existing rows",
	},
}

export function renderReport(
	scenarios: Scenario[],
	surprises: Surprise[],
): string {
	const headingOf = new Map(
		scenarios.map((s, index) => [s.key, scenarioHeading(s, index)]),
	)
	const link = (key: string) => {
		const heading = headingOf.get(key)
		if (!heading) throw new Error(`No scenario "${key}"`)
		return `[${heading.replace(/:.*/, "")}](#${anchorOf(heading)})`
	}
	const out: string[] = []

	out.push(
		"# Tracking rules as runnable scenarios",
		"",
		"Prototype for [issue #368](https://github.com/alp82/goodwatch-monorepo/issues/368). It is throwaway and lives on the branch `prototype/tracking-rules` only.",
		"",
		"**Question:** do the settled rules for episode tracking and show statuses (map [#365](https://github.com/alp82/goodwatch-monorepo/issues/365), `CONTEXT.md`, ADR 0008, and the \"aired\" and \"season still airing\" rules of the TMDB episode research) hold together when run?",
		"",
		"**Answer:** the common paths do: starting, catching up, finishing, On hold, Dropped, specials, films. They stop holding where Seen meets the calendar, where Seen meets its own button, and where TMDB edits its list. The first section lists every such place with the options and a recommended rule.",
		"",
		"How it is built:",
		"",
		"- The rules are one pure module, `goodwatch-webapp/app/domain/prototype-tracking-rules/rules.ts`: no storage, no interface, no network.",
		"- The scenarios in `scenarios.ts` run through it. Every table below is printed from that run, and this file is generated: `node app/domain/prototype-tracking-rules/write-report.ts` from `goodwatch-webapp`. `npm test` asserts the outcomes and fails when this file differs from what the module produces.",
		"- Each rule that could go more than one way is a field of `Rules`. The default follows the settled wording where there is one, and a proposal where the rules are silent. The table after the surprises lists them.",
		"- Where a scenario has a second table, it shows the same steps under the other reading. Cells that differ from the first table are bold.",
		"- Members are on UTC unless a scenario says otherwise. A \"time passes\" step also stands for \"something recomputes the show\": the prototype decides Seen after every step.",
		"- This is a report and not the click-through page the `prototype` skill describes, because the ticket asks for outcomes to read. The tests exist to keep the report honest, not to keep the code.",
		"",
	)

	out.push("## Surprises and undefined cases", "")
	out.push(
		"Three kinds: **contradiction** (two settled rules disagree, or one defeats its own purpose), **odd** (the rules give a result a member would not expect), **undefined** (the rules say nothing; the prototype runs the recommended rule as a proposal).",
		"",
		"| # | Kind | Surprise | Recommended |",
		"| --- | --- | --- | --- |",
		...surprises.map(
			(s, index) =>
				`| ${index + 1} | ${s.kind} | [${cell(s.title)}](#${anchorOf(`${index + 1}. ${s.title}`)}) | ${cell(s.short)} |`,
		),
		"",
	)
	surprises.forEach((surprise, index) => {
		out.push(
			`### ${index + 1}. ${surprise.title}`,
			"",
			`**Kind:** ${surprise.kind}. **Seen in:** ${surprise.scenarios.map(link).join(", ")}.`,
			"",
			surprise.what,
			"",
			"Options:",
			"",
			...surprise.options.map((option) => `- ${option}`),
			"",
			`**Recommended:** ${surprise.recommended}`,
			"",
			`**In the prototype:** ${surprise.inPrototype}`,
			"",
		)
	})

	out.push(
		"## The rules as the prototype runs them",
		"",
		"| Rule | Where it comes from | Runs as | Field of `Rules` |",
		"| --- | --- | --- | --- |",
		...(Object.keys(RULE_NOTES) as (keyof Rules)[]).map(
			(key) =>
				`| ${RULE_NOTES[key].says} | ${RULE_NOTES[key].source} | \`${String(SETTLED[key])}\` | \`${key}\` |`,
		),
		"",
		"Rules the prototype takes as given and has no switch for: a rating makes a show Seen and marks no episode; the first watched episode sets Watching and clears Want to See; watching an episode of an On hold or Dropped show returns it to Watching; Dropped is hidden from recommendations and clears Want to See; a single mark is dated now and a bulk mark has no date; specials never count; Not seen yet hides a show that is Seen or has a status.",
		"",
	)

	out.push("## Scenarios", "")
	scenarios.forEach((scenario, index) => {
		const settled = run(scenario)
		out.push(
			`### ${scenarioHeading(scenario, index)}`,
			"",
			scenario.about,
			"",
			table(settled),
			"",
		)
		if (scenario.compare) {
			const other = run(scenario, { ...SETTLED, ...scenario.compare.rules })
			out.push(
				`The same steps under: **${scenario.compare.label}** (${Object.entries(
					scenario.compare.rules,
				)
					.map(([key, value]) => `\`${key}: ${String(value)}\``)
					.join(", ")}).`,
				"",
				table(other, settled),
				"",
			)
		}
	})

	return `${out.join("\n").trimEnd()}\n`
}
