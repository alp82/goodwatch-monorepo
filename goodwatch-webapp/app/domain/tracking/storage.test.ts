// Checks the storage mapping against the state machine: what is stored is one `user_watch_state` row and the
// `user_watch_log` rows of a title, and nothing else. The stored side never sees the machine's record: for each
// action it rebuilds the record from its rows, runs the event, and applies the row changes. After every step it must
// equal the machine's own record, every value a list shows must come out of the grouped query and the catalog
// alone, and sending the action again, or again after only its log rows were written, must end in the same rows.
import assert from "node:assert/strict"
import { test } from "node:test"
import {
	type Episode,
	type Show,
	type State,
	type TrackingEvent,
	type World,
	derive,
	newRecord,
	seenButton,
	stateLabel,
	step,
} from "./machine.ts"
import {
	type AppliedEvent,
	type Flags,
	type LogRow,
	type Precision,
	type StateRow,
	applyShowEvent,
	movieLogRow,
	movieStateRow,
	recordFromRows,
	scoreWatchId,
	settleMovieRows,
	titleTotals,
	watchStateOf,
} from "./storage.ts"
import {
	type Action,
	PRESETS,
	SHOWS,
	changeCatalog,
	findShow,
	groupedQuery,
	isCatalogChange,
	mulberry32,
} from "./test-support.ts"

const SHOW_ID = 1399

/** Everything stored for one member and one title. The flags stand for user_score, user_wishlist, user_not_interested. */
interface Stored {
	state: StateRow | null
	log: LogRow[]
	flags: Flags
}

const emptyStored = (): Stored => ({
	state: null,
	log: [],
	flags: { score: null, wantToSee: false, notInterested: false },
})

/** What `applyShowEvent` returned, written to the rows as the writer writes it. */
function written(stored: Stored, applied: AppliedEvent): Stored {
	if (applied.refused) return stored
	const gone = new Set(applied.changes.deleteIds)
	return {
		state: applied.changes.state,
		log: [
			...stored.log.filter((r) => !gone.has(r.watch_id)),
			...applied.changes.insert,
		],
		flags: {
			score: applied.record.score,
			wantToSee: applied.record.wantToSee,
			notInterested: applied.record.notInterested,
		},
	}
}

const isRegularRow = (r: LogRow) =>
	r.season_number !== null && r.season_number > 0

// ---------------------------------------------------------------------------------------------------------
// What a list reads: the totals, the score, and the catalog (aired count, status, the cached episode list).
// It reads the show's log rows only when the member has a gap behind the furthest episode.
// ---------------------------------------------------------------------------------------------------------

const stats = {
	steps: 0,
	catalog: 0,
	groupMarks: 0,
	logDeletes: 0,
	nextReads: 0,
	gapReads: 0,
	promptBoundOff: 0,
	promptChecks: 0,
	ticks: 0,
	ticksStateUnchanged: 0,
	resent: 0,
	halfWritten: 0,
	halfWrittenBehind: 0,
	rows: new Set<string>(),
}

function listView(stored: Stored, show: Show) {
	const states = stored.state
		? [
				{
					tmdb_id: SHOW_ID,
					media_type: "show" as const,
					state: stored.state.state,
					pass: stored.state.pass,
				},
			]
		: []
	const groups = groupedQuery(stored.log)
	const totals = titleTotals(states, groups).get(`show-${SHOW_ID}`) ?? {
		state: "not_started" as State,
		pass: 1,
		count: 0,
		episodesWatched: 0,
		furthest: null,
		startedEver: false,
		firstWatchedAt: null,
		watchedAt: null,
		precision: "unknown" as Precision,
		lastActivityAt: null,
	}
	const aired = show.episodes
		.filter((e) => e.season > 0 && e.aired)
		.sort((a, b) => a.season - b.season || a.number - b.number)
	const airedCount = aired.length // show.aired_episode_count
	const state = totals.state
	const newEpisodes = state === "seen" ? airedCount - totals.episodesWatched : 0
	let next: Episode | null = null
	if (state === "watching" || state === "on_hold" || newEpisodes > 0) {
		stats.nextReads += 1
		const furthest = totals.furthest
		next =
			aired.find(
				(e) =>
					furthest === null ||
					e.season > furthest[0] ||
					(e.season === furthest[0] && e.number > furthest[1]),
			) ?? null
		if (!next && totals.episodesWatched < airedCount) {
			// A gap: the one case that reads the show's log rows.
			stats.gapReads += 1
			const have = new Set(
				stored.log
					.filter((r) => r.pass === totals.pass)
					.map((r) => `${r.season_number}.${r.episode_number}`),
			)
			next = aired.find((e) => !have.has(`${e.season}.${e.number}`)) ?? null
		}
	}
	const rated = stored.flags.score !== null
	const hasStatus =
		state === "watching" || state === "on_hold" || state === "dropped"
	const entry = watchStateOf(states, groups)[`show-${SHOW_ID}`]
	return {
		state,
		label: stateLabel(state, show.running, newEpisodes),
		pass: totals.pass,
		watched: totals.episodesWatched,
		aired: airedCount,
		newEpisodes,
		next,
		countsAsSeen: state === "seen" || rated,
		hiddenByNotSeenYet: state === "seen" || rated || hasStatus,
		hiddenFromRecommendations:
			state === "dropped" || stored.flags.notInterested,
		offers:
			state === "not_started"
				? ["notInterested"]
				: state === "watching" || state === "on_hold"
					? ["drop"]
					: [],
		seenQuestion: stored.state?.seen_question === "open",
		watchRemains: totals.startedEver,
		seenButton:
			state !== "seen"
				? "pressSeen"
				: newEpisodes > 0
					? "pressSeen"
					: stored.state?.seen_press_group
						? "undoSeen"
						: null,
		totals,
		entry,
		episodesEverAtMost: groups.reduce((n, g) => n + g.episodes_watched, 0),
	}
}

/** The prompt to rate needs the episodes watched in any pass, which the show page counts from the log rows. */
function ratePromptOnShowPage(stored: Stored): boolean {
	const ever = new Set(
		stored.log
			.filter(isRegularRow)
			.map((r) => `${r.season_number}.${r.episode_number}`),
	).size
	return (
		stored.flags.score === null &&
		stored.state?.rate_prompt_dismissed_at == null &&
		(ever >= 3 || !!stored.state?.seen_press_group)
	)
}

// ---------------------------------------------------------------------------------------------------------
// The invariants of the stored rows (section 5 of the data model)
// ---------------------------------------------------------------------------------------------------------

function checkInvariants(stored: Stored, where: string) {
	const row = stored.state
	const state = row?.state ?? "not_started"
	const pass = row?.pass ?? 1
	const regular = stored.log.filter(isRegularRow)
	// 1. Not started => no watch of a regular episode. Watching => at least one.
	if (state === "not_started")
		assert.equal(
			regular.length,
			0,
			`${where}: Not started with a regular watch`,
		)
	if (state === "watching")
		assert.ok(regular.length > 0, `${where}: Watching with no regular watch`)
	if (regular.length > 0)
		assert.ok(
			row && state !== "not_started",
			`${where}: regular watches without a state`,
		)
	// 2. The standing press.
	assert.equal(
		row?.seen_press_group == null,
		row?.seen_press_from == null,
		`${where}: half a press`,
	)
	if (row?.seen_press_group)
		assert.equal(
			state,
			"seen",
			`${where}: a press stands on a show that is not Seen`,
		)
	// 5. A started show is on no list of intentions.
	if (state !== "not_started")
		assert.ok(
			!stored.flags.wantToSee && !stored.flags.notInterested,
			`${where}: ${state} with Want to See or Not interested`,
		)
	// 7. A row exists only when it remembers something.
	if (row && state === "not_started")
		assert.ok(
			pass > 1 ||
				row.rate_prompt_dismissed_at !== null ||
				row.seen_question !== null,
			`${where}: an empty row`,
		)
	// 6. Rows are well formed, and none is in a pass beyond the row's.
	const seenIds = new Set<string>()
	for (const r of stored.log) {
		assert.ok(!seenIds.has(r.watch_id), `${where}: watch_id twice`)
		seenIds.add(r.watch_id)
		assert.ok(
			r.pass >= 1 && r.pass <= pass,
			`${where}: a watch in pass ${r.pass} beyond ${pass}`,
		)
		assert.equal(
			r.watched_at_precision === "unknown",
			r.watched_at === null,
			`${where}: precision`,
		)
		assert.equal(
			["seen", "season", "upto"].includes(r.origin),
			r.group_id !== null,
			`${where}: group`,
		)
		if (r.group_id !== null)
			assert.equal(
				r.watch_id,
				`g-${r.group_id}-${r.episode_tmdb_id}`,
				`${where}: a group's watch id`,
			)
		assert.equal(r.import_id, null, `${where}: import`)
		assert.ok(
			r.media_type === "show" &&
				r.tmdb_id === SHOW_ID &&
				r.season_number !== null &&
				r.episode_number !== null &&
				r.episode_tmdb_id !== null,
			`${where}: episode columns`,
		)
	}
}

// ---------------------------------------------------------------------------------------------------------
// One step of both sides, and everything that must agree after it
// ---------------------------------------------------------------------------------------------------------

interface Both {
	ref: World
	stored: Stored
	clock: number
	made: number
}

const start = (show: Show): Both => ({
	ref: { show, record: newRecord() },
	stored: emptyStored(),
	clock: 1_000,
	made: 0,
})

function compare(both: Both, where: string) {
	const { ref, stored } = both
	// A. The record rebuilt from the rows is the machine's record.
	assert.deepEqual(
		recordFromRows(stored.state, stored.log, stored.flags),
		ref.record,
		`${where}: the record`,
	)
	// B. What a list shows comes from the grouped query and the catalog.
	const want = derive(ref)
	const got = listView(stored, ref.show)
	for (const key of [
		"state",
		"label",
		"pass",
		"watched",
		"aired",
		"newEpisodes",
		"countsAsSeen",
		"hiddenByNotSeenYet",
		"hiddenFromRecommendations",
		"seenQuestion",
		"offers",
	] as const)
		assert.deepEqual(got[key], want[key], `${where}: ${key}`)
	assert.equal(
		got.next?.id ?? null,
		want.next?.id ?? null,
		`${where}: next episode`,
	)
	assert.equal(
		got.watchRemains,
		ref.record.watches.some((w) => w.season > 0),
		`${where}: a watch remains`,
	)
	assert.equal(
		got.seenButton,
		seenButton(ref).event,
		`${where}: the Seen button`,
	)
	assert.equal(
		got.totals.count,
		ref.record.watches.length,
		`${where}: watch count`,
	)
	// The member data entry exists exactly for a state other than Not started, and says what the totals say.
	assert.equal(got.entry !== undefined, want.state !== "not_started", where)
	if (got.entry)
		assert.deepEqual(
			[
				got.entry.state,
				got.entry.pass,
				got.entry.count,
				got.entry.episodesWatched,
			],
			[want.state, want.pass, ref.record.watches.length, want.watched],
			`${where}: the entry`,
		)
	// The prompt to rate: exact on the show page. From the groups alone only an upper bound exists.
	assert.equal(
		ratePromptOnShowPage(stored),
		want.ratePrompt,
		`${where}: the prompt to rate`,
	)
	stats.promptChecks += 1
	const fromGroups =
		stored.flags.score === null &&
		stored.state?.rate_prompt_dismissed_at == null &&
		(got.episodesEverAtMost >= 3 || !!stored.state?.seen_press_group)
	if (fromGroups !== want.ratePrompt) stats.promptBoundOff += 1
	// C. The invariants.
	checkInvariants(stored, where)
}

const DELETES = [
	"unwatch",
	"unmarkSeason",
	"undoGroup",
	"deleteWatch",
	"undoSeen",
]

function apply(both: Both, action: Action, where: string): Both {
	stats.steps += 1
	const { ref, stored } = both
	if (isCatalogChange(action)) {
		stats.catalog += 1
		// Nothing is written for a change of the catalog.
		const next: Both = {
			...both,
			ref: { show: changeCatalog(ref, action), record: ref.record },
		}
		compare(next, where)
		return next
	}
	const clock = both.clock + 1
	const made = both.made + 1
	const actionId = `a${made}`
	const input = {
		showId: SHOW_ID,
		show: ref.show,
		state: stored.state,
		log: stored.log,
		flags: stored.flags,
		event: action,
		actionId,
		now: clock,
	}
	const done = step(ref, action, actionId)
	for (const r of done.rows) stats.rows.add(r.id)
	const applied = applyShowEvent(input)
	assert.equal(
		applied.refused,
		done.refused,
		`${where}: refused on one side only`,
	)
	assert.equal(
		applied.row,
		done.row?.id ?? null,
		`${where}: a different row of the table`,
	)
	const { insert, deleteIds } = applied.changes
	const after = written(stored, applied)
	const pass = stored.state?.pass ?? 1

	if (applied.refused) {
		assert.deepEqual(
			[insert, deleteIds, applied.changes.stateWrite],
			[[], [], "none"],
		)
	} else {
		// D. What the action writes to the log, as the per-action table of the document says.
		const deleted = stored.log.filter((r) => deleteIds.includes(r.watch_id))
		assert.equal(deleted.length, deleteIds.length, `${where}: deletes a row`)
		if (action.type === "watch") {
			assert.equal(insert.length, 1)
			assert.equal(deleteIds.length, 0)
			assert.deepEqual(
				[
					insert[0].watch_id,
					insert[0].origin,
					insert[0].watched_at,
					insert[0].watched_at_precision,
					insert[0].pass,
					insert[0].group_id,
					insert[0].created_at,
				],
				[actionId, "single", clock, "moment", pass, null, clock],
			)
			stats.ticks += 1
			if (JSON.stringify(after.state) === JSON.stringify(stored.state))
				stats.ticksStateUnchanged += 1
		} else if (action.type === "unwatch") {
			assert.equal(insert.length, 0)
			assert.deepEqual(
				deleted,
				stored.log.filter(
					(r) =>
						r.pass === pass &&
						r.season_number === action.season &&
						r.episode_number === action.number,
				),
				`${where}: unwatch deletes the episode's rows of the pass`,
			)
		} else if (
			action.type === "pressSeen" ||
			action.type === "markSeason" ||
			action.type === "watchUpTo"
		) {
			assert.equal(deleteIds.length, 0)
			const origin =
				action.type === "pressSeen"
					? "seen"
					: action.type === "markSeason"
						? "season"
						: "upto"
			assert.ok(
				insert.every(
					(r) =>
						r.origin === origin &&
						r.group_id === actionId &&
						r.watched_at === null &&
						r.watched_at_precision === "unknown" &&
						r.pass === pass,
				),
				`${where}: the group's rows`,
			)
			if (action.type === "pressSeen") {
				assert.equal(after.state?.seen_press_group, actionId)
				assert.equal(
					after.state?.seen_press_from,
					stored.state?.state ?? "not_started",
				)
			} else {
				stats.groupMarks += 1
				assert.ok(insert.length > 0)
				// In the other order the watches and the state are the same.
				let reverse = ref
				for (const r of [...insert].reverse())
					reverse = step(
						reverse,
						{
							type: "watch",
							season: r.season_number as number,
							number: r.episode_number as number,
						},
						r.watch_id,
					).world
				assert.equal(
					reverse.record.state,
					done.world.record.state,
					`${where}: a group mark depends on the order`,
				)
				assert.equal(reverse.record.watches.length, after.log.length)
			}
		} else if (action.type === "undoSeen") {
			assert.equal(insert.length, 0)
			assert.deepEqual(
				deleted,
				stored.log.filter((r) => r.group_id === stored.state?.seen_press_group),
				`${where}: Seen again deletes the group`,
			)
			assert.equal(after.state?.seen_press_group ?? null, null)
		} else if (action.type === "unmarkSeason") {
			assert.equal(insert.length, 0)
			assert.deepEqual(
				deleted,
				stored.log.filter(
					(r) => r.pass === pass && r.season_number === action.season,
				),
				`${where}: unmark deletes the season's rows of the pass`,
			)
		} else if (action.type === "undoGroup") {
			assert.equal(insert.length, 0)
			assert.deepEqual(
				deleted,
				stored.log.filter((r) => r.group_id === action.group),
			)
		} else if (action.type === "deleteWatch") {
			stats.logDeletes += 1
			assert.deepEqual([insert.length, deleteIds], [0, [action.watchId]])
		} else {
			assert.equal(
				insert.length + deleteIds.length,
				0,
				`${where}: ${action.type} touched the log`,
			)
		}
		// The state write: there is one whenever a row exists before or after.
		assert.equal(
			applied.changes.stateWrite,
			after.state
				? stored.state
					? "update"
					: "insert"
				: stored.state
					? "delete"
					: "none",
		)
		// The clears: exactly the flags the event turned off.
		assert.deepEqual(applied.changes.clear, {
			wantToSee: stored.flags.wantToSee && !after.flags.wantToSee,
			notInterested: stored.flags.notInterested && !after.flags.notInterested,
		})

		// E. Sent again with the same id after it was written in full: nothing changes.
		const again = applyShowEvent({
			...input,
			state: after.state,
			log: after.log,
			flags: after.flags,
			now: clock + 1,
			resend: true,
		})
		stats.resent += 1
		if (!again.refused) {
			assert.deepEqual(
				[again.changes.insert, again.changes.deleteIds],
				[[], []],
				`${where}: sent again, the log changed`,
			)
			assert.deepEqual(
				again.changes.state,
				after.state,
				`${where}: sent again, the state changed`,
			)
		}
		// F. Sent again after only its log rows were written (the writer stopped before the state row).
		if (insert.length + deleteIds.length > 0) {
			stats.halfWritten += 1
			const half = applyShowEvent({
				...input,
				log: after.log,
				resend: true,
			})
			assert.equal(half.refused, null, `${where}: half written, refused`)
			assert.deepEqual(
				[half.changes.insert, half.changes.deleteIds],
				[[], []],
				`${where}: half written, the log changed again`,
			)
			const behind =
				JSON.stringify(half.changes.state) !== JSON.stringify(after.state)
			if (behind) {
				// A deleted watch or group can't say what it was once it is gone. The state then stays where it was,
				// which the machine allows, unless no watch is left.
				stats.halfWrittenBehind += 1
				assert.ok(
					action.type === "deleteWatch" || action.type === "undoGroup",
					`${where}: half written, ${action.type} ends in another state`,
				)
				assert.deepEqual(half.changes.state, stored.state)
				checkInvariants(
					{ state: half.changes.state, log: after.log, flags: after.flags },
					`${where}: half written`,
				)
			}
		}
	}
	assert.ok(DELETES.includes(action.type) || deleteIds.length === 0)
	const next: Both = { ref: done.world, stored: after, clock, made }
	compare(next, where)
	return next
}

// ---------------------------------------------------------------------------------------------------------
// Random walks
// ---------------------------------------------------------------------------------------------------------

const seasonNumber = (e: { season: number; number: number }) => ({
	season: e.season,
	number: e.number,
})

function randomAction(rng: () => number, world: World): Action {
	const pick = <T>(list: readonly T[]): T =>
		list[Math.floor(rng() * list.length)]
	const episodes = world.show.episodes
	const watches = world.record.watches
	const r = rng()
	if (r < 0.32)
		return episodes.length
			? { type: "watch", ...seasonNumber(pick(episodes)) }
			: { type: "pressSeen" }
	if (r < 0.43) {
		const watched = watches.filter((w) => w.pass === world.record.pass)
		if (watched.length && rng() < 0.8)
			return { type: "unwatch", ...seasonNumber(pick(watched)) }
		return episodes.length
			? { type: "unwatch", ...seasonNumber(pick(episodes)) }
			: { type: "undoSeen" }
	}
	if (r < 0.5) return { type: "pressSeen" }
	if (r < 0.55) return { type: "undoSeen" }
	if (r < 0.58) return { type: "hold" }
	if (r < 0.61) return { type: "drop" }
	if (r < 0.65) return { type: "resume" }
	if (r < 0.69)
		return {
			type: "rate",
			score: rng() < 0.3 ? null : 1 + Math.floor(rng() * 10),
		}
	if (r < 0.72) return { type: "wantToSee", on: rng() < 0.8 }
	if (r < 0.74) return { type: "notInterested", on: rng() < 0.8 }
	if (r < 0.78) return { type: "watchAgain" }
	if (r < 0.88)
		return {
			type: pick([
				"episodeAirs",
				"episodeAirs",
				"seasonAirs",
				"showEnds",
				"episodeReadded",
			] as const),
		}
	if (r < 0.9)
		return rng() < 0.4
			? { type: "dismissRatePrompt" }
			: {
					type: "answerSeenQuestion",
					answer: rng() < 0.5 ? "partway" : "just_rating",
				}
	if (r < 0.95) {
		const regular = episodes.filter((e) => e.season > 0)
		if (!regular.length) return { type: "pressSeen" }
		const e = pick(regular)
		return rng() < 0.5
			? { type: "markSeason", season: e.season }
			: { type: "watchUpTo", season: e.season, number: e.number }
	}
	if (r < 0.97) {
		const grouped = watches.filter((w) => w.group !== null)
		if (grouped.length && rng() < 0.7)
			return { type: "undoGroup", group: pick(grouped).group as string }
		return episodes.length
			? { type: "unmarkSeason", season: pick(episodes).season }
			: { type: "undoSeen" }
	}
	return watches.length
		? { type: "deleteWatch", watchId: pick(watches).id }
		: { type: "deleteWatch", watchId: "nothing" }
}

// ---------------------------------------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------------------------------------

const describeRows = (stored: Stored, show: Show) => {
	const view = listView(stored, show)
	const byOrigin = new Map<string, number>()
	for (const r of stored.log)
		byOrigin.set(
			`${r.origin} p${r.pass}`,
			(byOrigin.get(`${r.origin} p${r.pass}`) ?? 0) + 1,
		)
	const row = stored.state
	return {
		state: row ? `${row.state}, ${row.pass}` : "no row",
		press: row?.seen_press_group ? `from ${row.seen_press_from}` : "",
		prompts: row?.seen_question ? `seen_question ${row.seen_question}` : "",
		log: [...byOrigin].map(([k, n]) => `${n} ${k}`).join(", ") || "none",
		computed: `${view.totals.count}, ${view.totals.episodesWatched}, ${view.totals.furthest ? `S${view.totals.furthest[0]} E${view.totals.furthest[1]}` : "-"}`,
		reads: `${view.label}, ${view.watched} of ${view.aired}${view.next ? `, next S${view.next.season} E${view.next.number}` : ""}`,
	}
}

test("every preset: the rows rebuild the record and every list value after each step, and end as the document's table says", () => {
	const table: Record<string, ReturnType<typeof describeRows>> = {}
	for (const preset of PRESETS) {
		let both = start(findShow(preset.show))
		preset.steps.forEach((action, index) => {
			both = apply(both, action, `${preset.id} step ${index + 1}`)
		})
		table[preset.id] = describeRows(both.stored, both.ref.show)
	}
	// "Every preset" in section 5 of the data model.
	const none = { press: "", prompts: "" }
	assert.deepEqual(table, {
		"through-ended": {
			...none,
			state: "seen, 1",
			log: "6 single p1",
			computed: "6, 6, S2 E3",
			reads: "Seen, 6 of 6",
		},
		"caught-up-airs": {
			...none,
			state: "watching, 1",
			log: "7 single p1",
			computed: "7, 7, S2 E4",
			reads: "Watching, 7 of 10, next S3 E1",
		},
		"seen-twice": {
			...none,
			state: "watching, 1",
			log: "2 single p1",
			computed: "2, 2, S1 E2",
			reads: "Watching, 2 of 6, next S1 E3",
		},
		"on-hold": {
			...none,
			state: "watching, 1",
			log: "3 single p1",
			computed: "3, 3, S1 E3",
			reads: "Watching, 3 of 5, next S2 E1",
		},
		"dropped-want": {
			...none,
			state: "watching, 1",
			log: "1 single p1",
			computed: "1, 1, S1 E1",
			reads: "Watching, 1 of 6, next S1 E2",
		},
		"rate-never-started": {
			state: "not_started, 1",
			press: "",
			prompts: "seen_question open",
			log: "none",
			computed: "0, 0, -",
			reads: "Not started, 0 of 6",
		},
		rewatch: {
			...none,
			state: "watching, 2",
			log: "6 seen p1, 2 single p2",
			computed: "8, 2, S1 E2",
			reads: "Watching, 2 of 6, next S1 E3",
		},
		readded: {
			...none,
			state: "watching, 1",
			log: "3 single p1",
			computed: "3, 3, S1 E3",
			reads: "Watching, 3 of 5, next S2 E1",
		},
		"no-list": {
			state: "seen, 1",
			press: "from not_started",
			prompts: "",
			log: "none",
			computed: "0, 0, -",
			reads: "Seen, 0 of 0",
		},
		"rate-prompt": {
			...none,
			state: "watching, 1",
			log: "3 single p1",
			computed: "3, 3, S1 E3",
			reads: "Watching, 3 of 5, next S1 E4",
		},
		special: {
			...none,
			state: "watching, 1",
			log: "1 single p1",
			computed: "1, 1, S1 E1",
			reads: "Watching, 1 of 5, next S1 E2",
		},
		"unwatch-on-hold": {
			...none,
			state: "no row",
			log: "none",
			computed: "0, 0, -",
			reads: "Not started, 0 of 5",
		},
		"seen-new-episodes": {
			state: "seen, 1",
			press: "from not_started",
			prompts: "",
			log: "5 seen p1",
			computed: "5, 5, S2 E2",
			reads: "Caught up · 4 new, 5 of 9, next S2 E3",
		},
	})
})

test("3,000 seeded walks of 50 actions: the rows and the machine never part", () => {
	for (let seed = 1; seed <= 3000; seed++) {
		const rng = mulberry32(seed)
		let both = start(SHOWS[seed % SHOWS.length])
		for (let i = 0; i < 50; i++)
			both = apply(
				both,
				randomAction(rng, both.ref),
				`walk ${seed} action ${i + 1}`,
			)
	}
	// Every row of the table a member's event can take was walked.
	for (let id = 1; id <= 26; id++)
		assert.ok(stats.rows.has(String(id)), `row ${id} was never walked`)
	// The checks ran on enough of each kind to mean something.
	assert.ok(stats.catalog > 10_000, "catalog changes")
	assert.ok(stats.groupMarks > 1_000, "group marks")
	assert.ok(stats.logDeletes > 1_000, "deletions in the log")
	assert.ok(stats.gapReads > 5_000, "next episodes behind a gap")
	assert.ok(stats.ticksStateUnchanged > 5_000, "ticks that leave the state")
	assert.ok(stats.halfWritten > 20_000, "half-written actions")
	assert.ok(stats.halfWrittenBehind > 0 && stats.halfWrittenBehind < 2_000)
	// The prompt to rate can't be read from groups per pass: the bound is off in a few cases, which is why it is
	// computed on the show page only.
	assert.ok(stats.promptBoundOff > 0 && stats.promptBoundOff < 200)
	if (process.env.MODEL_CHECK_PRINT)
		console.log({ ...stats, rows: [...stats.rows].join(" ") })
})

test("Watch again without a watched episode is refused, and with one it starts pass 2", () => {
	let both = apply(start(findShow("nolist")), { type: "pressSeen" }, "nolist")
	assert.equal(both.stored.state?.state, "seen")
	assert.equal(both.stored.log.length, 0)
	both = apply(both, { type: "watchAgain" }, "nolist")
	assert.deepEqual(
		[both.stored.state?.state, both.stored.state?.pass],
		["seen", 1],
	)
	let again = apply(start(findShow("ended")), { type: "pressSeen" }, "ended")
	again = apply(again, { type: "watchAgain" }, "ended")
	assert.deepEqual(
		[
			again.stored.state?.state,
			again.stored.state?.pass,
			again.stored.state?.seen_press_group,
			again.stored.state?.seen_press_from,
		],
		["watching", 2, null, null],
	)
	const view = listView(again.stored, again.ref.show)
	assert.deepEqual(
		[view.watched, view.next?.season, view.next?.number],
		[0, 1, 1],
	)
	// A tick in pass 2 is a row of pass 2.
	again = apply(again, { type: "watch", season: 1, number: 1 }, "ended")
	assert.equal(again.stored.log[again.stored.log.length - 1].pass, 2)
})

test("deleting every watch of pass 1 in the log after Watch again: Not started, and the row keeps the pass", () => {
	let both = apply(start(findShow("ended")), { type: "pressSeen" }, "ended")
	both = apply(both, { type: "watchAgain" }, "ended")
	for (let i = 0; i < 6; i++)
		both = apply(
			both,
			{ type: "deleteWatch", watchId: both.stored.log[0].watch_id },
			`delete ${i + 1}`,
		)
	assert.equal(both.stored.log.length, 0)
	assert.deepEqual(
		[both.stored.state?.state, both.stored.state?.pass],
		["not_started", 2],
	)
})

test("a watch can carry a day or no date, and state_changed_at moves only with the state", () => {
	const show = findShow("ended")
	const base = {
		showId: SHOW_ID,
		show,
		state: null,
		log: [],
		flags: emptyStored().flags,
	}
	const day = applyShowEvent({
		...base,
		event: {
			type: "watch",
			season: 1,
			number: 1,
			when: { precision: "day", day: "2026-10-05" },
		},
		actionId: "a",
		now: 5_000,
	})
	assert.deepEqual(
		[
			day.changes.insert[0].watched_at,
			day.changes.insert[0].watched_at_precision,
		],
		[Date.UTC(2026, 9, 5), "day"],
	)
	assert.equal(day.changes.state?.state_changed_at, 5_000)
	const unknown = applyShowEvent({
		...base,
		state: day.changes.state,
		log: day.changes.insert,
		event: {
			type: "watch",
			season: 1,
			number: 2,
			when: { precision: "unknown" },
		},
		actionId: "b",
		now: 6_000,
	})
	assert.deepEqual(
		[
			unknown.changes.insert[0].watched_at,
			unknown.changes.insert[0].watched_at_precision,
			unknown.changes.insert[0].created_at,
		],
		[null, "unknown", 6_000],
	)
	assert.equal(unknown.changes.stateWrite, "update")
	assert.equal(unknown.changes.state?.state_changed_at, 5_000)
	// "Not now" is remembered with its time, on a row that is otherwise Not started.
	const dismissed = applyShowEvent({
		...base,
		event: { type: "dismissRatePrompt" },
		now: 7_000,
	})
	assert.deepEqual(
		[
			dismissed.changes.stateWrite,
			dismissed.changes.state?.state,
			dismissed.changes.state?.rate_prompt_dismissed_at,
		],
		["insert", "not_started", 7_000],
	)
})

test("the precision of the latest watch comes out of two maxima", () => {
	const rng = mulberry32(7)
	const maxOf = (values: (number | null)[]) =>
		values.reduce<number | null>(
			(m, v) => (v === null ? m : m === null || v > m ? v : m),
			null,
		)
	for (let i = 0; i < 5000; i++) {
		const rows: LogRow[] = Array.from(
			{ length: 1 + Math.floor(rng() * 6) },
			(_, n) => {
				const precision = (["moment", "day", "unknown"] as const)[
					Math.floor(rng() * 3)
				]
				const at =
					precision === "unknown"
						? null
						: precision === "day"
							? Math.floor(rng() * 5) * 100
							: Math.floor(rng() * 500)
				return {
					watch_id: `w${n}`,
					media_type: "movie",
					tmdb_id: 603,
					episode_tmdb_id: null,
					season_number: null,
					episode_number: null,
					watched_at: at,
					watched_at_precision: precision,
					origin: rng() < 0.3 ? "import" : "single",
					group_id: null,
					import_id: null,
					pass: 1 + Math.floor(rng() * 2),
					created_at: 1000 + n,
				}
			},
		)
		const totals = titleTotals([], groupedQuery(rows)).get("movie-603")
		assert.ok(totals)
		const dated = rows.filter((r) => r.watched_at !== null)
		const latest = maxOf(dated.map((r) => r.watched_at))
		assert.equal(totals.watchedAt, latest)
		// On a tie between a day and a moment at the same instant, the moment wins.
		const expected =
			latest === null
				? "unknown"
				: dated.some(
							(r) =>
								r.watched_at === latest && r.watched_at_precision === "moment",
						)
					? "moment"
					: "day"
		assert.equal(totals.precision, expected)
		// C3: dated watches by their date, undated ones made here by the time they were recorded, an import only by
		// its dates.
		const activity = maxOf(
			rows.map((r) =>
				r.watched_at !== null
					? r.watched_at
					: r.origin === "import"
						? null
						: r.created_at,
			),
		)
		assert.equal(totals.lastActivityAt, activity)
		assert.equal(totals.count, rows.length)
	}
})

test("the member data entry: one per title with a state, built from the state rows and the groups", () => {
	const at = Date.UTC(2026, 9, 6, 19, 40)
	const day = Date.UTC(2026, 9, 5)
	const group = (
		tmdb_id: number,
		media_type: "movie" | "show",
		pass: number,
		rest: Partial<ReturnType<typeof groupedQuery>[number]>,
	) => ({
		tmdb_id,
		media_type,
		pass,
		watch_count: 1,
		episodes_watched: 0,
		furthest: null,
		first_watched_at: null,
		last_watched_at: null,
		last_moment_at: null,
		last_activity_at: null,
		...rest,
	})
	const entries = watchStateOf(
		[
			{ tmdb_id: 157336, media_type: "movie", state: "seen", pass: 1 },
			{ tmdb_id: 680, media_type: "movie", state: "seen", pass: 1 },
			{ tmdb_id: 1622, media_type: "show", state: "watching", pass: 2 },
			{ tmdb_id: 1399, media_type: "show", state: "dropped", pass: 1 },
		],
		[
			group(157336, "movie", 1, {
				watch_count: 3,
				first_watched_at: day,
				last_watched_at: at,
				last_moment_at: at,
				last_activity_at: at,
			}),
			// The score's watch: one undated row made here.
			group(680, "movie", 1, { last_activity_at: 5_000 }),
			group(1622, "show", 1, {
				watch_count: 30,
				episodes_watched: 26,
				furthest: 2 * 100000 + 13,
				last_watched_at: at,
				last_moment_at: at,
				last_activity_at: at,
			}),
			group(1622, "show", 2, {
				watch_count: 4,
				episodes_watched: 3,
				furthest: 1 * 100000 + 12,
				last_watched_at: day,
				last_activity_at: day,
			}),
			// Only a special was watched: log rows and no state, so no entry.
			group(66732, "show", 1, { last_watched_at: at, last_moment_at: at }),
		],
	)
	assert.deepEqual(entries, {
		"movie-157336": {
			state: "seen",
			watchedAt: new Date(at),
			precision: "moment",
			count: 3,
			pass: 1,
			episodesWatched: 0,
			furthest: null,
			lastActivityAt: new Date(at),
		},
		"movie-680": {
			state: "seen",
			watchedAt: null,
			precision: "unknown",
			count: 1,
			pass: 1,
			episodesWatched: 0,
			furthest: null,
			lastActivityAt: new Date(5_000),
		},
		"show-1622": {
			state: "watching",
			watchedAt: new Date(at),
			precision: "moment",
			count: 34,
			pass: 2,
			episodesWatched: 3,
			furthest: [1, 12],
			lastActivityAt: new Date(at),
		},
		// Dropped with nothing watched: a state and no group.
		"show-1399": {
			state: "dropped",
			watchedAt: null,
			precision: "unknown",
			count: 0,
			pass: 1,
			episodesWatched: 0,
			furthest: null,
			lastActivityAt: null,
		},
	})
	// The totals keep the title without a state, for whoever asks about one title.
	const totals = titleTotals([], [group(66732, "show", 1, {})])
	assert.equal(totals.get("show-66732")?.state, "not_started")
})

// ---------------------------------------------------------------------------------------------------------
// Movies: a state row while the movie has a log row, and the watch that a score owns (origin 'score')
// ---------------------------------------------------------------------------------------------------------

const MOVIE = 603

/** A movie's rows and flags, and the statements the writer issues for each action: its own write, then the rule. */
function movieSide() {
	const s = {
		log: [] as LogRow[],
		state: null as StateRow | null,
		score: null as number | null,
		wishlist: true,
		notInterested: true,
	}
	const settle = (now: number) => {
		const settled = settleMovieRows({
			movieId: MOVIE,
			log: s.log,
			hasScore: s.score !== null,
			hasState: s.state !== null,
			now,
		})
		s.log = [
			...s.log.filter((r) => !settled.deleteIds.includes(r.watch_id)),
			...settled.insert,
		]
		if (settled.stateWrite === "insert") s.state = movieStateRow(now)
		if (settled.stateWrite === "delete") s.state = null
		assert.equal(settled.seen, s.log.length > 0)
		// Settling again changes nothing.
		assert.deepEqual(
			settleMovieRows({
				movieId: MOVIE,
				log: s.log,
				hasScore: s.score !== null,
				hasState: s.state !== null,
				now,
			}),
			{ insert: [], deleteIds: [], stateWrite: "none", seen: settled.seen },
		)
		return settled
	}
	return {
		s,
		rate(score: number, now: number) {
			s.score = score
			s.notInterested = false
			if (settle(now).insert.length) s.wishlist = false
		},
		clearScore(now: number) {
			s.score = null
			settle(now)
		},
		watch(
			id: string,
			at: number | null,
			now: number,
			origin: "single" | "import" = "single",
			importId: string | null = null,
		) {
			if (!s.log.some((r) => r.watch_id === id))
				s.log.push({
					...movieLogRow(MOVIE, id, origin, { precision: "unknown" }, now),
					watched_at: at,
					watched_at_precision: at === null ? "unknown" : "day",
					import_id: importId,
				})
			settle(now)
			s.wishlist = false
			s.notInterested = false
		},
		deleteWatch(id: string, now: number) {
			s.log = s.log.filter((r) => r.watch_id !== id)
			settle(now)
		},
		editDate(id: string, at: number | null, now: number) {
			const r = s.log.find((x) => x.watch_id === id)
			if (!r) return
			r.watched_at = at
			r.watched_at_precision = at === null ? "unknown" : "day"
			// A date the member sets makes the score's watch their own.
			if (r.origin === "score" && at !== null) r.origin = "single"
			settle(now)
		},
		undoImport(importId: string, now: number) {
			s.log = s.log.filter((r) => r.import_id !== importId)
			settle(now)
		},
	}
}

test("movies: the score's watch exists exactly while the movie has a score and no other watch", () => {
	const counts = { steps: 0, scoreOnly: 0, taken: 0 }
	for (let seed = 1; seed <= 3000; seed++) {
		const rng = mulberry32(seed * 7919)
		const movie = movieSide()
		const s = movie.s
		// What the member did, kept apart from the rows: the watches they logged and the score.
		const truth = { own: new Set<string>(), score: null as number | null }
		let now = 1000
		let made = 0
		for (let i = 0; i < 40; i++) {
			now += 1
			counts.steps += 1
			const r = rng()
			const ownIds = [...truth.own]
			if (r < 0.2) {
				const score = 1 + Math.floor(rng() * 10)
				truth.score = score
				movie.rate(score, now)
			} else if (r < 0.32) {
				truth.score = null
				movie.clearScore(now)
			} else if (r < 0.55) {
				const id = `w-${++made}`
				truth.own.add(id)
				movie.watch(id, rng() < 0.3 ? null : now - 500, now)
			} else if (r < 0.72) {
				if (ownIds.length) {
					const id = ownIds[Math.floor(rng() * ownIds.length)]
					truth.own.delete(id)
					movie.deleteWatch(id, now)
				}
			} else if (r < 0.82) {
				// Edit a date in the log: any row, the score's watch included.
				if (s.log.length) {
					const row = s.log[Math.floor(rng() * s.log.length)]
					const wasScore = row.origin === "score"
					const at = rng() < 0.25 ? null : now - 100
					movie.editDate(row.watch_id, at, now)
					if (wasScore && at !== null) {
						truth.own.add(row.watch_id)
						counts.taken += 1
					}
				}
			} else if (r < 0.92) {
				const importId = `imp-${1 + Math.floor(rng() * 2)}`
				const id = `i-${importId}`
				truth.own.add(id)
				movie.watch(id, rng() < 0.5 ? null : 200, now, "import", importId)
			} else {
				const importId = `imp-${1 + Math.floor(rng() * 2)}`
				truth.own.delete(`i-${importId}`)
				movie.undoImport(importId, now)
			}

			const where = `movie walk ${seed} step ${i + 1}`
			const scoreRows = s.log.filter((x) => x.origin === "score")
			const ownRows = s.log.filter((x) => x.origin !== "score")
			// The member's own watches are exactly the rows of another origin.
			assert.deepEqual(
				new Set(ownRows.map((x) => x.watch_id)),
				truth.own,
				`${where}: own watches`,
			)
			assert.equal(s.score, truth.score)
			// The score's watch: one, and only while there is a score and no other watch.
			assert.equal(
				scoreRows.length,
				truth.score !== null && truth.own.size === 0 ? 1 : 0,
				`${where}: the score's watch`,
			)
			for (const x of scoreRows)
				assert.deepEqual(
					[
						x.watch_id,
						x.watched_at,
						x.watched_at_precision,
						x.import_id,
						x.group_id,
					],
					[scoreWatchId(MOVIE), null, "unknown", null, null],
				)
			// The count never shows two for one viewing: it is the member's own watches, or 1 for a score alone.
			const totals = titleTotals(
				s.state
					? [
							{
								tmdb_id: MOVIE,
								media_type: "movie",
								state: s.state.state,
								pass: 1,
							},
						]
					: [],
				groupedQuery(s.log),
			).get(`movie-${MOVIE}`)
			assert.equal(
				totals?.count ?? 0,
				truth.own.size > 0 ? truth.own.size : truth.score !== null ? 1 : 0,
				`${where}: the count`,
			)
			// The state row: Seen, pass 1, exactly while a log row exists. So a rated movie is Seen by its row.
			assert.equal(s.state !== null, s.log.length > 0, `${where}: the row`)
			if (s.state)
				assert.deepEqual(
					[s.state.state, s.state.pass, s.state.seen_press_group],
					["seen", 1, null],
				)
			assert.equal(
				s.state?.state === "seen",
				truth.score !== null || truth.own.size > 0,
				`${where}: Seen means watched or rated`,
			)
			if (s.state)
				assert.ok(
					!s.wishlist && !s.notInterested,
					`${where}: a Seen movie on a list of intentions`,
				)
			for (const x of s.log) {
				assert.equal(
					x.watched_at_precision === "unknown",
					x.watched_at === null,
					`${where}: precision`,
				)
				assert.equal(
					x.origin === "import",
					x.import_id !== null,
					`${where}: import id`,
				)
				assert.deepEqual(
					[x.pass, x.season_number, x.episode_tmdb_id],
					[1, null, null],
				)
			}
			if (scoreRows.length) counts.scoreOnly += 1
		}
	}
	assert.ok(counts.scoreOnly > 5_000 && counts.taken > 300)
})
