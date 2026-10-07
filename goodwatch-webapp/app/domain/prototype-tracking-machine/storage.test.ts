// PROTOTYPE - throwaway (issue #378). Checks the decided data model (docs/implementation/tracking/data-model.md)
// against the state machine: what is stored is one `user_watch_state` row and the `user_watch_log` rows of a title,
// and nothing else. The stored side below never sees the machine's record: it rebuilds a member from its rows, runs
// the machine, and writes rows back. After every step it must equal the machine's own record, and every value a list
// shows must come out of the grouped query (emulated here) and the catalog alone.
import assert from "node:assert/strict"
import { test } from "node:test"
import {
	type AnyEvent,
	type Episode,
	type Member,
	RECOMMENDED,
	type Settings,
	type Show,
	type State,
	type Watch,
	type World,
	derive,
	isCatalogEvent,
	isPageEvent,
	newMember,
	seenButton,
	step,
} from "./machine.ts"
import { PRESETS, SHOWS, findShow } from "./presets.ts"

// The owner's decisions: M1 a, M2 a, M3 a, M4 b (Watch again is built), M5 a, M6 a.
const SETTINGS: Settings = { ...RECOMMENDED, m4: "built" }

// ---------------------------------------------------------------------------------------------------------
// The two tables
// ---------------------------------------------------------------------------------------------------------

type Origin = "single" | "upto" | "season" | "seen" | "score" | "import"
type Precision = "moment" | "day" | "unknown"

interface LogRow {
	watch_id: string
	media_type: "movie" | "show"
	episode_tmdb_id: string | null
	season_number: number | null
	episode_number: number | null
	watched_at: number | null
	watched_at_precision: Precision
	origin: Origin
	group_id: string | null
	import_id: string | null
	pass: number
	created_at: number
}

interface StateRow {
	state: State
	state_changed_at: number
	pass: number
	seen_press_group: string | null
	seen_press_from: State | null
	rate_prompt_dismissed_at: number | null
	seen_question: "open" | "answered" | null
}

/** Everything stored for one member and one title. The last three stand for user_score, user_wishlist, user_not_interested. */
interface Stored {
	state: StateRow | null
	log: LogRow[]
	score: number | null
	wishlist: boolean
	notInterested: boolean
}

const emptyStored = (): Stored => ({ state: null, log: [], score: null, wishlist: false, notInterested: false })

/** What the browser and the clock supply: ids and the time. Never read back from the rows. */
interface Ids {
	clock: number
	watch: number
	group: number
	/** How many Seen presses were sent. The machine names groups by its own counter; this keeps the names equal. */
	presses: number
}
const newIds = (): Ids => ({ clock: 1_000, watch: 0, group: 0, presses: 0 })

// ---------------------------------------------------------------------------------------------------------
// Rows -> the machine's record, and back
// ---------------------------------------------------------------------------------------------------------

type KeyedWatch = Watch & { id?: string }

function memberFromRows(stored: Stored, presses: number): Member {
	const row = stored.state
	const watches: KeyedWatch[] = stored.log.map((r) => ({
		id: r.watch_id,
		episodeId: r.episode_tmdb_id as string,
		season: r.season_number as number,
		number: r.episode_number as number,
		// The machine only asks whether a watch belongs to the Seen press. Every other origin is a watch of its own.
		origin: r.origin === "seen" ? "bulk" : "hand",
		group: r.origin === "seen" ? r.group_id : null,
		pass: r.pass,
	}))
	return {
		state: row?.state ?? "not_started",
		pass: row?.pass ?? 1,
		watches,
		score: stored.score,
		wantToSee: stored.wishlist,
		notInterested: stored.notInterested,
		seenPress: row?.seen_press_group ? { group: row.seen_press_group, from: row.seen_press_from as State } : null,
		presses,
		ratePromptDismissed: row?.rate_prompt_dismissed_at != null,
		seenQuestion: row?.seen_question ?? "not_asked",
	}
}

/** The state row of a member. No row when there is nothing to remember. */
function stateRowOf(member: Member, before: StateRow | null, now: number): StateRow | null {
	const nothing = member.state === "not_started" && member.pass === 1 && !member.ratePromptDismissed && member.seenQuestion === "not_asked"
	if (nothing) return null
	return {
		state: member.state,
		state_changed_at: before && before.state === member.state ? before.state_changed_at : now,
		pass: member.pass,
		seen_press_group: member.seenPress?.group ?? null,
		seen_press_from: member.seenPress?.from ?? null,
		rate_prompt_dismissed_at: member.ratePromptDismissed ? (before?.rate_prompt_dismissed_at ?? now) : null,
		seen_question: member.seenQuestion === "not_asked" ? null : member.seenQuestion,
	}
}

const plain = (member: Member) => ({
	state: member.state,
	pass: member.pass,
	watches: member.watches.map((w) => ({ episodeId: w.episodeId, season: w.season, number: w.number, origin: w.origin, group: w.group, pass: w.pass })),
	score: member.score,
	wantToSee: member.wantToSee,
	notInterested: member.notInterested,
	seenPress: member.seenPress,
	ratePromptDismissed: member.ratePromptDismissed,
	seenQuestion: member.seenQuestion,
})
const sorted = (member: Member) => {
	const p = plain(member)
	return { ...p, watches: [...p.watches].sort((a, b) => a.pass - b.pass || a.season - b.season || a.number - b.number || a.episodeId.localeCompare(b.episodeId)) }
}

const isRegularRow = (r: LogRow) => r.season_number !== null && r.season_number > 0

// ---------------------------------------------------------------------------------------------------------
// The Watch-again guard (row 26): at least one watched regular episode. The prototype's machine.ts does not have
// it; the model does, so both sides of the check apply it here.
// ---------------------------------------------------------------------------------------------------------

function guardedStep(world: World, event: AnyEvent) {
	if (event.type === "watchAgain" && !world.member.watches.some((w) => w.season > 0)) return { ...step(world, { type: "hold" }, SETTINGS), world, refused: "Nothing watched.", row: null }
	return step(world, event, SETTINGS)
}

// ---------------------------------------------------------------------------------------------------------
// The writer: rows in, rows out
// ---------------------------------------------------------------------------------------------------------

interface Written {
	stored: Stored
	inserted: LogRow[]
	deleted: LogRow[]
	refused: boolean
	row: string | null
}

type GroupMark = { type: "markSeason"; season: number } | { type: "upTo"; season: number; number: number }
type LogDelete = { type: "deleteLogRow"; index: number }
type Action = AnyEvent | GroupMark | LogDelete

const isGroupMark = (a: Action): a is GroupMark => a.type === "markSeason" || a.type === "upTo"

/** The aired regular episodes of a group mark that are not watched in the current pass, in order. */
function groupTargets(show: Show, member: Member, mark: GroupMark): Episode[] {
	const have = new Set(member.watches.filter((w) => w.pass === member.pass).map((w) => `${w.season}.${w.number}`))
	return show.episodes
		.filter((e) => e.season > 0 && e.aired && !have.has(`${e.season}.${e.number}`))
		.filter((e) => (mark.type === "markSeason" ? e.season === mark.season : e.season < mark.season || (e.season === mark.season && e.number <= mark.number)))
		.sort((a, b) => a.season - b.season || a.number - b.number)
}

/** Applies one member, page or group action to the stored rows. Catalog events never reach it. */
function write(stored: Stored, show: Show, action: Exclude<Action, LogDelete>, ids: Ids): Written {
	ids.clock += 1
	const now = ids.clock
	const before = memberFromRows(stored, ids.presses)
	let after = before
	let refused = false
	let row: string | null = null
	let origin: Origin = "single"
	let group: string | null = null

	if (isGroupMark(action)) {
		const targets = groupTargets(show, before, action)
		if (!targets.length) return { stored, inserted: [], deleted: [], refused: true, row: null }
		origin = action.type === "markSeason" ? "season" : "upto"
		ids.group += 1
		group = `grp-${ids.group}`
		let world: World = { show, member: before }
		for (const e of targets) {
			const done = guardedStep(world, { type: "watch", season: e.season, number: e.number })
			assert.equal(done.refused, null, "a group mark only names episodes that can be ticked")
			world = done.world
			row = done.row?.id ?? null
		}
		after = world.member
	} else {
		const done = guardedStep({ show, member: before }, action)
		refused = !!done.refused
		row = done.row?.id ?? null
		after = done.world.member
		if (action.type === "pressSeen" && !refused) {
			origin = "seen"
			ids.presses += 1
		}
	}
	if (refused) return { stored, inserted: [], deleted: [], refused, row }

	// The log: what the machine added has no watch_id yet; what it removed is named by its watch_id.
	const kept = new Set((after.watches as KeyedWatch[]).filter((w) => w.id).map((w) => w.id))
	const deleted = stored.log.filter((r) => !kept.has(r.watch_id))
	const inserted: LogRow[] = (after.watches as KeyedWatch[])
		.filter((w) => !w.id)
		.map((w) => {
			ids.watch += 1
			const pressGroup = origin === "seen" ? w.group : group
			return {
				watch_id: pressGroup ? `g-${pressGroup}-${w.episodeId}` : `w-${ids.watch}`,
				media_type: "show",
				episode_tmdb_id: w.episodeId,
				season_number: w.season,
				episode_number: w.number,
				watched_at: origin === "single" ? now : null,
				watched_at_precision: origin === "single" ? "moment" : "unknown",
				origin,
				group_id: pressGroup,
				import_id: null,
				pass: w.pass,
				created_at: now,
			}
		})
	const log = [...stored.log.filter((r) => kept.has(r.watch_id)), ...inserted]
	return {
		stored: { state: stateRowOf(after, stored.state, now), log, score: after.score, wishlist: after.wantToSee, notInterested: after.notInterested },
		inserted,
		deleted,
		refused,
		row,
	}
}

/**
 * Deleting one watch in the log. It is an unwatch when it was the episode's last watch of the current pass; and when
 * no watch of a regular episode is left in any pass, a Watching or Seen show becomes Not started (row 8).
 */
function deleteLogRow(stored: Stored, show: Show, watchId: string, ids: Ids): Stored {
	const target = stored.log.find((r) => r.watch_id === watchId)
	if (!target) return stored
	const pass = stored.state?.pass ?? 1
	const same = stored.log.filter((r) => r.pass === pass && r.season_number === target.season_number && r.episode_number === target.episode_number)
	if (target.pass === pass && same.length === 1) {
		const done = write(stored, show, { type: "unwatch", season: target.season_number as number, number: target.episode_number as number }, ids)
		assert.equal(done.refused, false)
		assert.deepEqual(done.deleted.map((r) => r.watch_id), [watchId])
		return done.stored
	}
	ids.clock += 1
	const log = stored.log.filter((r) => r.watch_id !== watchId)
	let state = stored.state
	if (state && (state.state === "watching" || state.state === "seen") && !log.some(isRegularRow))
		state = stateRowOf({ ...memberFromRows({ ...stored, log }, 0), state: "not_started", seenPress: null }, state, ids.clock)
	return { ...stored, log, state }
}

/** The same deletion on the machine's own record, written without the rows. */
function deleteWatchInRecord(world: World, index: number): World {
	const member = world.member
	const target = member.watches[index]
	const same = member.watches.filter((w) => w.pass === member.pass && w.season === target.season && w.number === target.number)
	if (target.pass === member.pass && same.length === 1) return guardedStep(world, { type: "unwatch", season: target.season, number: target.number }).world
	const watches = member.watches.filter((_, i) => i !== index)
	const none = !watches.some((w) => w.season > 0)
	const lost = none && (member.state === "watching" || member.state === "seen")
	return { ...world, member: { ...member, watches, state: lost ? "not_started" : member.state, seenPress: lost ? null : member.seenPress } }
}

// ---------------------------------------------------------------------------------------------------------
// The grouped query, emulated. One row per pass of one title:
//   SELECT pass, count(*), count(DISTINCT season_number * 100000 + episode_number) FILTER (WHERE season_number > 0),
//          max(season_number * 100000 + episode_number) FILTER (WHERE season_number > 0), min(watched_at),
//          max(watched_at), max(CASE WHEN watched_at_precision = 'moment' THEN watched_at END),
//          max(CASE WHEN watched_at IS NOT NULL THEN watched_at WHEN origin <> 'import' THEN created_at END)
//   FROM user_watch_log WHERE user_id = ? GROUP BY tmdb_id, media_type, pass
// ---------------------------------------------------------------------------------------------------------

interface Grouped {
	pass: number
	watch_count: number
	episodes_watched: number
	furthest: number | null
	first_watched_at: number | null
	last_watched_at: number | null
	last_moment_at: number | null
	last_activity_at: number | null
}

const maxOf = (values: (number | null)[]) => values.reduce<number | null>((m, v) => (v === null ? m : m === null || v > m ? v : m), null)
const minOf = (values: (number | null)[]) => values.reduce<number | null>((m, v) => (v === null ? m : m === null || v < m ? v : m), null)

function groupedQuery(log: LogRow[]): Map<number, Grouped> {
	const out = new Map<number, Grouped>()
	for (const pass of new Set(log.map((r) => r.pass))) {
		const rows = log.filter((r) => r.pass === pass)
		const regular = rows.filter(isRegularRow).map((r) => (r.season_number as number) * 100000 + (r.episode_number as number))
		out.set(pass, {
			pass,
			watch_count: rows.length,
			episodes_watched: new Set(regular).size,
			furthest: maxOf(regular),
			first_watched_at: minOf(rows.map((r) => r.watched_at)),
			last_watched_at: maxOf(rows.map((r) => r.watched_at)),
			last_moment_at: maxOf(rows.map((r) => (r.watched_at_precision === "moment" ? r.watched_at : null))),
			last_activity_at: maxOf(rows.map((r) => (r.watched_at !== null ? r.watched_at : r.origin !== "import" ? r.created_at : null))),
		})
	}
	return out
}

/** What the server function makes of the groups of one title: the entry of the member data. */
function entryOf(state: StateRow | null, groups: Map<number, Grouped>) {
	const all = [...groups.values()]
	const current = groups.get(state?.pass ?? 1)
	const last = maxOf(all.map((g) => g.last_watched_at))
	const lastMoment = maxOf(all.map((g) => g.last_moment_at))
	return {
		state: state?.state ?? "not_started",
		pass: state?.pass ?? 1,
		count: all.reduce((n, g) => n + g.watch_count, 0),
		episodesWatched: current?.episodes_watched ?? 0,
		furthest: current?.furthest ?? null,
		startedEver: all.some((g) => g.episodes_watched > 0),
		episodesEverAtMost: all.reduce((n, g) => n + g.episodes_watched, 0),
		firstWatchedAt: minOf(all.map((g) => g.first_watched_at)),
		watchedAt: last,
		watchedAtPrecision: (last === null ? "unknown" : last === lastMoment ? "moment" : "day") as Precision,
		lastActivityAt: maxOf(all.map((g) => g.last_activity_at)),
	}
}

// ---------------------------------------------------------------------------------------------------------
// What a list reads: the entry, the score, and the catalog (aired count, status, the cached episode list).
// It reads the show's log rows only when the member has a gap behind the furthest episode.
// ---------------------------------------------------------------------------------------------------------

const stats = { steps: 0, catalog: 0, groupMarks: 0, logDeletes: 0, nextReads: 0, gapReads: 0, promptBoundOff: 0, promptChecks: 0, c5Signature: 0, c5SignatureWithList: 0, notStartedLaterPass: 0, ticks: 0, ticksStateUnchanged: 0, rows: new Set<string>() }

function listView(stored: Stored, show: Show) {
	const entry = entryOf(stored.state, groupedQuery(stored.log))
	const aired = show.episodes.filter((e) => e.season > 0 && e.aired).sort((a, b) => a.season - b.season || a.number - b.number)
	const airedCount = aired.length // show.aired_episode_count
	const state = entry.state
	const newEpisodes = state === "seen" ? airedCount - entry.episodesWatched : 0
	let label = { not_started: "Not started", watching: "Watching", on_hold: "On hold", dropped: "Dropped", seen: "Seen" }[state]
	if (state === "seen") {
		label = show.running ? "Caught up" : "Seen"
		if (newEpisodes > 0) label += show.running ? ` · ${newEpisodes} new` : ` · ${newEpisodes} new episode${newEpisodes === 1 ? "" : "s"}`
	}
	let next: Episode | null = null
	if (state === "watching" || state === "on_hold" || newEpisodes > 0) {
		stats.nextReads += 1
		next = aired.find((e) => entry.furthest === null || e.season * 100000 + e.number > entry.furthest) ?? null
		if (!next && entry.episodesWatched < airedCount) {
			// A gap: the one case that reads the show's log rows.
			stats.gapReads += 1
			const have = new Set(stored.log.filter((r) => r.pass === entry.pass).map((r) => `${r.season_number}.${r.episode_number}`))
			next = aired.find((e) => !have.has(`${e.season}.${e.number}`)) ?? null
		}
	}
	const rated = stored.score !== null
	const hasStatus = state === "watching" || state === "on_hold" || state === "dropped"
	return {
		state,
		label,
		pass: entry.pass,
		watched: entry.episodesWatched,
		aired: airedCount,
		newEpisodes,
		next,
		countsAsSeen: state === "seen" || rated,
		hiddenByNotSeenYet: state === "seen" || rated || hasStatus,
		hiddenFromRecommendations: state === "dropped" || stored.notInterested,
		offers: state === "not_started" ? ["notInterested"] : state === "watching" || state === "on_hold" ? ["drop"] : [],
		seenQuestion: stored.state?.seen_question === "open",
		watchRemains: entry.startedEver,
		seenButton: state !== "seen" ? "pressSeen" : newEpisodes > 0 ? "pressSeen" : stored.state?.seen_press_group ? "undoSeen" : null,
		entry,
	}
}

/** The prompt to rate needs the episodes watched in any pass, which the show page counts from the log rows. */
function ratePromptOnShowPage(stored: Stored): boolean {
	const ever = new Set(stored.log.filter(isRegularRow).map((r) => `${r.season_number}.${r.episode_number}`)).size
	return stored.score === null && stored.state?.rate_prompt_dismissed_at == null && (ever >= 3 || !!stored.state?.seen_press_group)
}

// ---------------------------------------------------------------------------------------------------------
// The invariants of the stored rows
// ---------------------------------------------------------------------------------------------------------

function checkInvariants(stored: Stored, show: Show, where: string) {
	const row = stored.state
	const state = row?.state ?? "not_started"
	const pass = row?.pass ?? 1
	const regular = stored.log.filter(isRegularRow)
	// 1. Not started <=> no watch of a regular episode... except On hold and Dropped, which stay with nothing watched.
	if (state === "not_started") assert.equal(regular.length, 0, `${where}: Not started with a regular watch`)
	if (state === "watching") assert.ok(regular.length > 0, `${where}: Watching with no regular watch`)
	if (regular.length > 0) assert.ok(row && state !== "not_started", `${where}: regular watches without a state`)
	// 2. The standing press.
	assert.equal(row?.seen_press_group == null, row?.seen_press_from == null, `${where}: half a press`)
	if (row?.seen_press_group) assert.equal(state, "seen", `${where}: a press stands on a show that is not Seen`)
	// 3. No watch beyond the current pass; a later pass rests on a watch of an earlier one or of its own.
	for (const r of stored.log) assert.ok(r.pass >= 1 && r.pass <= pass, `${where}: a watch in pass ${r.pass} beyond ${pass}`)
	// 4. A started show is on no list of intentions.
	if (state !== "not_started") assert.ok(!stored.wishlist && !stored.notInterested, `${where}: ${state} with Want to See or Not interested`)
	// 5. A row exists only when it remembers something.
	if (row && state === "not_started") assert.ok(pass > 1 || row.rate_prompt_dismissed_at !== null || row.seen_question !== null, `${where}: an empty row`)
	// 6. Rows are well formed.
	const seenIds = new Set<string>()
	for (const r of stored.log) {
		assert.ok(!seenIds.has(r.watch_id), `${where}: watch_id twice`)
		seenIds.add(r.watch_id)
		assert.equal(r.watched_at_precision === "unknown", r.watched_at === null, `${where}: precision`)
		assert.equal(["seen", "season", "upto"].includes(r.origin), r.group_id !== null, `${where}: group`)
		assert.equal(r.origin === "import", r.import_id !== null, `${where}: import`)
		assert.ok(r.season_number !== null && r.episode_number !== null && r.episode_tmdb_id !== null, `${where}: episode columns`)
	}
	// The signature the fill job looks for (C5): Seen, a press not made on a Seen show, no row of its group.
	if (row?.seen_press_group && row.seen_press_from !== "seen" && !stored.log.some((r) => r.group_id === row.seen_press_group)) {
		stats.c5Signature += 1
		if (show.episodes.some((e) => e.season > 0 && e.aired)) stats.c5SignatureWithList += 1
	}
	if (state === "not_started" && pass > 1) stats.notStartedLaterPass += 1
}

// ---------------------------------------------------------------------------------------------------------
// One step of both sides, and everything that must agree after it
// ---------------------------------------------------------------------------------------------------------

interface Both {
	ref: World
	stored: Stored
	ids: Ids
}

const start = (show: Show): Both => ({ ref: { show, member: newMember() }, stored: emptyStored(), ids: newIds() })

function compare(both: Both, where: string) {
	const { ref, stored } = both
	// A. The record rebuilt from the rows is the machine's record.
	assert.deepEqual(plain(memberFromRows(stored, 0)), plain(ref.member), `${where}: the record`)
	// B. What a list shows comes from the grouped query and the catalog.
	const want = derive(ref, SETTINGS)
	const got = listView(stored, ref.show)
	for (const key of ["state", "label", "pass", "watched", "aired", "newEpisodes", "countsAsSeen", "hiddenByNotSeenYet", "hiddenFromRecommendations", "seenQuestion"] as const)
		assert.deepEqual(got[key], want[key], `${where}: ${key}`)
	assert.deepEqual(got.offers, want.offers, `${where}: offers`)
	assert.equal(got.next?.id ?? null, want.next?.id ?? null, `${where}: next episode`)
	assert.equal(got.watchRemains, ref.member.watches.some((w) => w.season > 0), `${where}: a watch remains`)
	assert.equal(got.seenButton, seenButton(ref, SETTINGS).event?.type ?? null, `${where}: the Seen button`)
	assert.equal(got.entry.count, ref.member.watches.length, `${where}: watch count`)
	// The prompt to rate: exact on the show page. From the groups alone only an upper bound exists.
	assert.equal(ratePromptOnShowPage(stored), want.ratePrompt, `${where}: the prompt to rate`)
	stats.promptChecks += 1
	const fromGroups = stored.score === null && stored.state?.rate_prompt_dismissed_at == null && (got.entry.episodesEverAtMost >= 3 || !!stored.state?.seen_press_group)
	if (fromGroups !== want.ratePrompt) stats.promptBoundOff += 1
	// C. The invariants.
	checkInvariants(stored, ref.show, where)
}

function apply(both: Both, action: Action, where: string): Both {
	stats.steps += 1
	const { ref, stored, ids } = both
	if (action.type === "deleteLogRow") {
		if (!stored.log.length) return both
		stats.logDeletes += 1
		const index = action.index % stored.log.length
		const next: Both = { ref: deleteWatchInRecord(ref, index), stored: deleteLogRow(stored, ref.show, stored.log[index].watch_id, ids), ids }
		compare(next, where)
		return next
	}
	if (isGroupMark(action)) {
		const targets = groupTargets(ref.show, ref.member, action)
		let world = ref
		for (const e of targets) world = guardedStep(world, { type: "watch", season: e.season, number: e.number }).world
		// In the other order the record is the same.
		let reverse = ref
		for (const e of [...targets].reverse()) reverse = guardedStep(reverse, { type: "watch", season: e.season, number: e.number }).world
		assert.deepEqual(sorted(reverse.member), sorted(world.member), `${where}: a group mark depends on the order`)
		const done = write(stored, ref.show, action, ids)
		if (targets.length) {
			stats.groupMarks += 1
			assert.equal(done.inserted.length, targets.length, `${where}: one row per episode`)
			assert.equal(done.deleted.length, 0)
			assert.ok(done.inserted.every((r) => r.origin === (action.type === "markSeason" ? "season" : "upto") && r.group_id === done.inserted[0].group_id && r.watched_at === null))
		}
		const next: Both = { ref: world, stored: done.stored, ids }
		compare(next, where)
		return next
	}
	if (isCatalogEvent(action)) {
		stats.catalog += 1
		const done = guardedStep(ref, action)
		if (done.row) stats.rows.add(done.row.id)
		// Nothing is written for a catalog event.
		const next: Both = { ref: done.world, stored, ids }
		compare(next, where)
		return next
	}
	const done = guardedStep(ref, action)
	if (done.row) stats.rows.add(done.row.id)
	const wrote = write(stored, ref.show, action, ids)
	assert.equal(wrote.refused, !!done.refused, `${where}: refused on one side only`)
	assert.equal(wrote.row, done.row?.id ?? null, `${where}: a different row of the table`)
	// D. What the action writes to the log, as the per-action table of the document says.
	const pass = stored.state?.pass ?? 1
	if (!wrote.refused) {
		if (action.type === "watch") {
			assert.equal(wrote.inserted.length, 1)
			assert.equal(wrote.deleted.length, 0)
			assert.deepEqual([wrote.inserted[0].origin, wrote.inserted[0].watched_at_precision, wrote.inserted[0].pass], ["single", "moment", pass])
			stats.ticks += 1
			if (JSON.stringify(wrote.stored.state) === JSON.stringify(stored.state)) stats.ticksStateUnchanged += 1
		} else if (action.type === "unwatch") {
			assert.equal(wrote.inserted.length, 0)
			const bySeasonAndNumber = stored.log.filter((r) => r.pass === pass && r.season_number === action.season && r.episode_number === action.number)
			assert.deepEqual(wrote.deleted, bySeasonAndNumber, `${where}: unwatch deletes the episode's rows of the pass`)
		} else if (action.type === "pressSeen") {
			assert.equal(wrote.deleted.length, 0)
			const group = wrote.stored.state?.seen_press_group
			assert.ok(group)
			assert.ok(wrote.inserted.every((r) => r.origin === "seen" && r.group_id === group && r.watched_at === null && r.pass === pass))
			assert.equal(wrote.stored.state?.seen_press_from, stored.state?.state ?? "not_started")
		} else if (action.type === "undoSeen") {
			assert.equal(wrote.inserted.length, 0)
			assert.deepEqual(wrote.deleted, stored.log.filter((r) => r.group_id === stored.state?.seen_press_group), `${where}: Seen again deletes the group`)
			assert.equal(wrote.stored.state?.seen_press_group ?? null, null)
		} else {
			assert.equal(wrote.inserted.length + wrote.deleted.length, 0, `${where}: ${action.type} touched the log`)
		}
	}
	const next: Both = { ref: done.world, stored: wrote.stored, ids }
	compare(next, where)
	return next
}

// ---------------------------------------------------------------------------------------------------------
// Random walks
// ---------------------------------------------------------------------------------------------------------

function mulberry32(seed: number) {
	let a = seed >>> 0
	return () => {
		a = (a + 0x6d2b79f5) >>> 0
		let t = a
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

function randomAction(rng: () => number, world: World): Action {
	const pick = <T>(list: readonly T[]): T => list[Math.floor(rng() * list.length)]
	const episodes = world.show.episodes
	const r = rng()
	if (r < 0.32) return episodes.length ? { type: "watch", ...seasonNumber(pick(episodes)) } : { type: "pressSeen" }
	if (r < 0.43) {
		const watched = world.member.watches.filter((w) => w.pass === world.member.pass)
		if (watched.length && rng() < 0.8) return { type: "unwatch", ...seasonNumber(pick(watched)) }
		return episodes.length ? { type: "unwatch", ...seasonNumber(pick(episodes)) } : { type: "undoSeen" }
	}
	if (r < 0.5) return { type: "pressSeen" }
	if (r < 0.55) return { type: "undoSeen" }
	if (r < 0.58) return { type: "hold" }
	if (r < 0.61) return { type: "drop" }
	if (r < 0.65) return { type: "resume" }
	if (r < 0.69) return { type: "rate", score: rng() < 0.3 ? null : 1 + Math.floor(rng() * 10) }
	if (r < 0.72) return { type: "wantToSee" }
	if (r < 0.74) return { type: "notInterested" }
	if (r < 0.78) return { type: "watchAgain" }
	if (r < 0.88) return { type: pick(["episodeAirs", "episodeAirs", "seasonAirs", "showEnds", "episodeReadded"] as const) }
	if (r < 0.91) return rng() < 0.4 ? { type: "dismissRatePrompt" } : { type: "answerSeenQuestion", answer: rng() < 0.5 ? "partway" : "just_rating" }
	if (r < 0.97) {
		const regular = episodes.filter((e) => e.season > 0)
		if (!regular.length) return { type: "pressSeen" }
		const e = pick(regular)
		return rng() < 0.5 ? { type: "markSeason", season: e.season } : { type: "upTo", season: e.season, number: e.number }
	}
	return { type: "deleteLogRow", index: Math.floor(rng() * 1000) }
}
const seasonNumber = (e: { season: number; number: number }) => ({ season: e.season, number: e.number })

// ---------------------------------------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------------------------------------

const describeRows = (stored: Stored, show: Show) => {
	const view = listView(stored, show)
	const byOrigin = new Map<string, number>()
	for (const r of stored.log) byOrigin.set(`${r.origin} p${r.pass}`, (byOrigin.get(`${r.origin} p${r.pass}`) ?? 0) + 1)
	const row = stored.state
	return {
		state: row ? `${row.state}, ${row.pass}` : "no row",
		press: row?.seen_press_group ? `${row.seen_press_group} from ${row.seen_press_from}` : "",
		prompts: [row?.rate_prompt_dismissed_at != null ? "rate prompt dismissed" : "", row?.seen_question ? `seen_question ${row.seen_question}` : ""].filter(Boolean).join(", "),
		log: [...byOrigin].map(([k, n]) => `${n} ${k}`).join(", ") || "none",
		computed: `count ${view.entry.count}, episodes ${view.entry.episodesWatched}, furthest ${view.entry.furthest ?? "-"}`,
		reads: `${view.label}, ${view.watched} of ${view.aired}${view.next ? `, next S${view.next.season} E${view.next.number}` : ""}`,
	}
}

test("every preset: the rows rebuild the record and every list value after each step", () => {
	const table: Record<string, unknown> = {}
	for (const preset of PRESETS) {
		const show = findShow(preset.show)
		assert.ok(show)
		let both = start(show)
		preset.steps.forEach((event, index) => {
			both = apply(both, event, `${preset.id} step ${index + 1}`)
		})
		table[preset.id] = describeRows(both.stored, both.ref.show)
	}
	if (process.env.MODEL_CHECK_PRINT) console.log(JSON.stringify(table, null, 1))
})

test("3,000 seeded walks of 50 actions: the rows and the machine never part", () => {
	const walks = 3000
	for (let seed = 1; seed <= walks; seed++) {
		const rng = mulberry32(seed)
		let both = start(SHOWS[seed % SHOWS.length])
		for (let i = 0; i < 50; i++) both = apply(both, randomAction(rng, both.ref), `walk ${seed} action ${i + 1}`)
	}
	// Every row of the table the owner's decisions leave active was walked.
	for (const id of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27"])
		assert.ok(stats.rows.has(id), `row ${id} was never walked`)
	assert.ok(!stats.rows.has("10b") && !stats.rows.has("27b"))
	if (process.env.MODEL_CHECK_PRINT) console.log({ ...stats, rows: [...stats.rows].sort((a, b) => Number.parseInt(a) - Number.parseInt(b)).join(" ") })
})

test("Watch again without a watched episode is refused, and with one it starts pass 2", () => {
	const nolist = findShow("nolist")
	assert.ok(nolist)
	let both = apply(start(nolist), { type: "pressSeen" }, "nolist")
	assert.equal(both.stored.state?.state, "seen")
	assert.equal(both.stored.log.length, 0)
	both = apply(both, { type: "watchAgain" }, "nolist")
	assert.deepEqual([both.stored.state?.state, both.stored.state?.pass], ["seen", 1])
	const ended = findShow("ended")
	assert.ok(ended)
	let again = apply(start(ended), { type: "pressSeen" }, "ended")
	again = apply(again, { type: "watchAgain" }, "ended")
	assert.deepEqual([again.stored.state?.state, again.stored.state?.pass, again.stored.state?.seen_press_group], ["watching", 2, null])
	assert.equal(listView(again.stored, again.ref.show).watched, 0)
	assert.equal(listView(again.stored, again.ref.show).next?.id, "ended-s1e1")
})

test("deleting every watch of pass 1 in the log after Watch again: Not started, and the row keeps the pass", () => {
	const ended = findShow("ended")
	assert.ok(ended)
	let both = apply(start(ended), { type: "pressSeen" }, "ended")
	both = apply(both, { type: "watchAgain" }, "ended")
	for (let i = 0; i < 6; i++) both = apply(both, { type: "deleteLogRow", index: 0 }, `delete ${i + 1}`)
	assert.equal(both.stored.log.length, 0)
	assert.deepEqual([both.stored.state?.state, both.stored.state?.pass], ["not_started", 2])
})

test("the precision of the latest watch comes out of two maxima", () => {
	const rng = mulberry32(7)
	for (let i = 0; i < 5000; i++) {
		const rows: LogRow[] = Array.from({ length: 1 + Math.floor(rng() * 6) }, (_, n) => {
			const precision = (["moment", "day", "unknown"] as const)[Math.floor(rng() * 3)]
			const at = precision === "unknown" ? null : precision === "day" ? Math.floor(rng() * 5) * 100 : Math.floor(rng() * 500)
			return { watch_id: `w${n}`, media_type: "movie", episode_tmdb_id: null, season_number: null, episode_number: null, watched_at: at, watched_at_precision: precision, origin: rng() < 0.3 ? "import" : "single", group_id: null, import_id: null, pass: 1 + Math.floor(rng() * 2), created_at: 1000 + n }
		})
		const entry = entryOf(null, groupedQuery(rows))
		const dated = rows.filter((r) => r.watched_at !== null)
		const latest = maxOf(dated.map((r) => r.watched_at))
		assert.equal(entry.watchedAt, latest)
		// On a tie between a day and a moment at the same instant, the moment wins.
		const expected = latest === null ? "unknown" : dated.some((r) => r.watched_at === latest && r.watched_at_precision === "moment") ? "moment" : "day"
		assert.equal(entry.watchedAtPrecision, expected)
		// C3: dated watches by their date, undated ones made here by the time they were recorded, an import only by its dates.
		const activity = maxOf(rows.map((r) => (r.watched_at !== null ? r.watched_at : r.origin === "import" ? null : r.created_at)))
		assert.equal(entry.lastActivityAt, activity)
	}
})

// ---------------------------------------------------------------------------------------------------------
// Movies: a state row while the movie has a log row, and the watch that a score owns (origin 'score')
// ---------------------------------------------------------------------------------------------------------

/** What the member did, kept apart from the rows: the watches they logged and the score. */
interface MovieTruth {
	own: Set<string>
	score: number | null
}

const movieRow = (id: string, origin: Origin, at: number | null, precision: Precision, now: number, importId: string | null = null): LogRow => ({
	watch_id: id,
	media_type: "movie",
	episode_tmdb_id: null,
	season_number: null,
	episode_number: null,
	watched_at: at,
	watched_at_precision: precision,
	origin,
	group_id: null,
	import_id: importId,
	pass: 1,
	created_at: now,
})

const SCORE_WATCH = "score-movie-603"

/** Each function is the statements the per-action table gives for a movie. */
const movie = {
	ensureState(s: Stored, now: number) {
		if (!s.state) s.state = { state: "seen", state_changed_at: now, pass: 1, seen_press_group: null, seen_press_from: null, rate_prompt_dismissed_at: null, seen_question: null }
	},
	afterDelete(s: Stored, now: number) {
		if (s.log.length) return
		// Nothing is left. A scored movie gets the score's watch back; an unscored one loses its row.
		if (s.score !== null) s.log.push(movieRow(SCORE_WATCH, "score", null, "unknown", now))
		else s.state = null
	},
	rate(s: Stored, score: number, now: number) {
		s.score = score
		s.notInterested = false
		if (!s.log.length) {
			s.log.push(movieRow(SCORE_WATCH, "score", null, "unknown", now))
			s.wishlist = false
			movie.ensureState(s, now)
		}
	},
	clearScore(s: Stored) {
		s.score = null
		s.log = s.log.filter((r) => r.origin !== "score")
		if (!s.log.length) s.state = null
	},
	ownWatch(s: Stored, id: string, at: number | null, precision: Precision, now: number, origin: Origin = "single", importId: string | null = null) {
		if (!s.log.some((r) => r.watch_id === id)) s.log.push(movieRow(id, origin, at, precision, now, importId))
		s.log = s.log.filter((r) => r.origin !== "score")
		movie.ensureState(s, now)
		s.wishlist = false
		s.notInterested = false
	},
	deleteWatch(s: Stored, id: string, now: number) {
		s.log = s.log.filter((r) => r.watch_id !== id)
		movie.afterDelete(s, now)
	},
	editDate(s: Stored, id: string, at: number | null) {
		const r = s.log.find((x) => x.watch_id === id)
		if (!r) return
		r.watched_at = at
		r.watched_at_precision = at === null ? "unknown" : "day"
		// A date the member sets makes the score's watch their own.
		if (r.origin === "score" && at !== null) r.origin = "single"
	},
	undoImport(s: Stored, importId: string, now: number) {
		s.log = s.log.filter((r) => r.import_id !== importId)
		movie.afterDelete(s, now)
	},
}

test("movies: the score's watch exists exactly while the movie has a score and no other watch", () => {
	const counts = { steps: 0, scoreOnly: 0, taken: 0 }
	for (let seed = 1; seed <= 3000; seed++) {
		const rng = mulberry32(seed * 7919)
		const s = emptyStored()
		const truth: MovieTruth = { own: new Set(), score: null }
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
				movie.rate(s, score, now)
			} else if (r < 0.32) {
				truth.score = null
				movie.clearScore(s)
			} else if (r < 0.47) {
				const id = `w-${++made}`
				truth.own.add(id)
				movie.ownWatch(s, id, now, "moment", now)
			} else if (r < 0.55) {
				const id = `w-${++made}`
				truth.own.add(id)
				movie.ownWatch(s, id, rng() < 0.5 ? null : now - 500, rng() < 0.5 ? "unknown" : "day", now)
				const row = s.log.find((x) => x.watch_id === id)
				if (row) row.watched_at_precision = row.watched_at === null ? "unknown" : "day"
			} else if (r < 0.72) {
				if (ownIds.length) {
					const id = ownIds[Math.floor(rng() * ownIds.length)]
					truth.own.delete(id)
					movie.deleteWatch(s, id, now)
				}
			} else if (r < 0.82) {
				// Edit a date in the log: any row, the score's watch included.
				if (s.log.length) {
					const row = s.log[Math.floor(rng() * s.log.length)]
					const wasScore = row.origin === "score"
					const at = rng() < 0.25 ? null : now - 100
					movie.editDate(s, row.watch_id, at)
					if (wasScore && at !== null) {
						truth.own.add(row.watch_id)
						counts.taken += 1
					}
				}
			} else if (r < 0.92) {
				const importId = `imp-${1 + Math.floor(rng() * 2)}`
				const id = `i-${importId}`
				truth.own.add(id)
				movie.ownWatch(s, id, rng() < 0.5 ? null : 200, "day", now, "import", importId)
				const row = s.log.find((x) => x.watch_id === id)
				if (row) row.watched_at_precision = row.watched_at === null ? "unknown" : "day"
			} else {
				const importId = `imp-${1 + Math.floor(rng() * 2)}`
				truth.own.delete(`i-${importId}`)
				movie.undoImport(s, importId, now)
			}

			const where = `movie walk ${seed} step ${i + 1}`
			const scoreRows = s.log.filter((x) => x.origin === "score")
			const ownRows = s.log.filter((x) => x.origin !== "score")
			// The member's own watches are exactly the rows of another origin.
			assert.deepEqual(new Set(ownRows.map((x) => x.watch_id)), truth.own, `${where}: own watches`)
			assert.equal(s.score, truth.score)
			// The score's watch: one, and only while there is a score and no other watch.
			assert.equal(scoreRows.length, truth.score !== null && truth.own.size === 0 ? 1 : 0, `${where}: the score's watch`)
			for (const x of scoreRows) assert.deepEqual([x.watched_at, x.watched_at_precision, x.import_id, x.group_id], [null, "unknown", null, null])
			// The count never shows two for one viewing: it is the member's own watches, or 1 for a score alone.
			const entry = entryOf(s.state, groupedQuery(s.log))
			assert.equal(entry.count, truth.own.size > 0 ? truth.own.size : truth.score !== null ? 1 : 0, `${where}: the count`)
			// The state row: Seen, pass 1, exactly while a log row exists. So a rated movie is Seen by its row.
			assert.equal(s.state !== null, s.log.length > 0, `${where}: the row`)
			if (s.state) assert.deepEqual([s.state.state, s.state.pass, s.state.seen_press_group], ["seen", 1, null])
			assert.equal(s.state?.state === "seen", truth.score !== null || truth.own.size > 0, `${where}: Seen means watched or rated`)
			if (s.state) assert.ok(!s.wishlist && !s.notInterested, `${where}: a Seen movie on a list of intentions`)
			for (const x of s.log) {
				assert.equal(x.watched_at_precision === "unknown", x.watched_at === null, `${where}: precision`)
				assert.equal(x.origin === "import", x.import_id !== null, `${where}: import id`)
				assert.equal(x.pass, 1)
			}
			if (scoreRows.length) counts.scoreOnly += 1
		}
	}
	if (process.env.MODEL_CHECK_PRINT) console.log(counts)
})
