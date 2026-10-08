// For the tests of tracking only: sample shows, the presets of the state machine's notes
// (docs/prototypes/tracking-machine/README.md), the catalog's own changes, and the grouped query written out in
// TypeScript so that the storage test and the fake Crate of the server tests compute it the same way.
import {
	type Episode,
	type Show,
	type Step,
	type TrackingEvent,
	type TrackingRecord,
	type World,
	airedRegular,
	isSpecial,
	newRecord,
	step,
	watchedIds,
} from "./machine.ts"
import type { GroupRow, LogRow } from "./storage.ts"

// ---------------------------------------------------------------------------------------------------------
// Sample shows
// ---------------------------------------------------------------------------------------------------------

export interface SampleShow extends Show {
	key: string
	/** The first episode id of the show; ids are base + season * 100 + number. */
	base: number
	/** Counter for the ids of episodes the catalog adds later. */
	made: number
}

const season = (
	base: number,
	number: number,
	aired: number,
	listed = aired,
): Episode[] =>
	Array.from({ length: listed }, (_, index) => ({
		id: base + number * 100 + index + 1,
		season: number,
		number: index + 1,
		aired: index < aired,
	}))

export const SHOWS: SampleShow[] = [
	// Ended. Two seasons of three episodes, all aired.
	{
		key: "ended",
		base: 10_000,
		running: false,
		made: 0,
		episodes: [...season(10_000, 1, 3), ...season(10_000, 2, 3)],
	},
	// Running weekly. Season 2 has two episodes out and two listed that have not aired.
	{
		key: "weekly",
		base: 20_000,
		running: true,
		made: 0,
		episodes: [...season(20_000, 1, 3), ...season(20_000, 2, 2, 4)],
	},
	// Running, between seasons. One season of five episodes and two specials.
	{
		key: "specials",
		base: 30_000,
		running: true,
		made: 0,
		episodes: [...season(30_000, 0, 2), ...season(30_000, 1, 5)],
	},
	// Ended. TMDB lists no episodes for it.
	{ key: "nolist", base: 40_000, running: false, made: 0, episodes: [] },
]

export const findShow = (key: string): SampleShow => {
	const found = SHOWS.find((show) => show.key === key)
	if (!found) throw new Error(`No sample show ${key}`)
	return found
}

/** The id of a listed episode of a sample show. */
export const episodeId = (key: string, s: number, n: number) =>
	findShow(key).base + s * 100 + n

// ---------------------------------------------------------------------------------------------------------
// The catalog's own changes. None is an event of the machine: they change the show a step is given.
// ---------------------------------------------------------------------------------------------------------

export type CatalogChange =
	| { type: "episodeAirs" }
	| { type: "seasonAirs" }
	| { type: "showEnds" }
	| { type: "episodeReadded" }

export type Action = TrackingEvent | CatalogChange

const CATALOG_TYPES = [
	"episodeAirs",
	"seasonAirs",
	"showEnds",
	"episodeReadded",
]
export const isCatalogChange = (action: {
	type: string
}): action is CatalogChange => CATALOG_TYPES.includes(action.type)

const inOrder = (a: Episode, b: Episode) =>
	a.season - b.season || a.number - b.number

/** The show after a change of the catalog; the same object when the change is not possible. */
export function changeCatalog(world: World, change: CatalogChange): SampleShow {
	const show = world.show as SampleShow
	const regular = show.episodes.filter((e) => !isSpecial(e)).sort(inOrder)
	const add = (s: number, n: number, at: number): Episode => ({
		id: show.base + 9000 + at,
		season: s,
		number: n,
		aired: true,
	})
	switch (change.type) {
		case "episodeAirs": {
			const waiting = regular.find((e) => !e.aired)
			if (waiting)
				return {
					...show,
					episodes: show.episodes.map((e) =>
						e.id === waiting.id ? { ...e, aired: true } : e,
					),
				}
			if (!regular.length || !show.running) return show
			const last = regular[regular.length - 1]
			return {
				...show,
				made: show.made + 1,
				episodes: [
					...show.episodes,
					add(last.season, last.number + 1, show.made + 1),
				],
			}
		}
		case "seasonAirs": {
			const next = (regular.length ? regular[regular.length - 1].season : 0) + 1
			return {
				...show,
				running: true,
				made: show.made + 3,
				episodes: [
					...show.episodes,
					...[1, 2, 3].map((n, index) => add(next, n, show.made + 1 + index)),
				],
			}
		}
		case "showEnds":
			return show.running ? { ...show, running: false } : show
		case "episodeReadded": {
			const aired = airedRegular(show)
			if (!aired.length) return show
			const ids = watchedIds(show, world.record)
			// The furthest watched episode shows the most; with nothing watched, the first.
			const target = [...aired].reverse().find((e) => ids.has(e.id)) ?? aired[0]
			const id = show.base + 9000 + show.made + 1
			return {
				...show,
				made: show.made + 1,
				episodes: show.episodes.map((e) =>
					e.id === target.id ? { ...e, id } : e,
				),
			}
		}
	}
}

/** Ids as the browser would make them, one after the other. */
export function idMaker(prefix = "id") {
	let made = 0
	return () => `${prefix}-${++made}`
}

export interface Played {
	world: World
	/** One per member event; a change of the catalog has none. */
	steps: (Step | null)[]
}

/** Plays actions from a fresh record. Every event gets a new id. */
export function play(show: Show, actions: readonly Action[]): Played {
	let world: World = { show, record: newRecord() }
	const steps: (Step | null)[] = []
	const nextId = idMaker()
	for (const action of actions) {
		if (isCatalogChange(action)) {
			world = { show: changeCatalog(world, action), record: world.record }
			steps.push(null)
			continue
		}
		const done = step(world, action, nextId())
		steps.push(done)
		world = done.world
	}
	return { world, steps }
}

/**
 * The event that puts the standing Seen press of a record back after it is taken back (row 30), as the page builds
 * it from the stored rows (`seenPressRestore`): here from the record, with no dates and `at` as every time.
 */
export function restoreOf(
	record: TrackingRecord,
	at = 1,
): Extract<TrackingEvent, { type: "restoreSeen" }> {
	const press = record.seenPress
	if (!press) throw new Error("No Seen press stands")
	return {
		type: "restoreSeen",
		group: press.group,
		from: press.from,
		pass: record.pass,
		changedAt: at,
		watches: record.watches
			.filter((watch) => watch.group === press.group)
			.map((watch) => ({
				id: watch.id,
				episodeId: watch.episodeId,
				season: watch.season,
				number: watch.number,
				watchedAt: null,
				precision: "unknown",
				createdAt: at,
			})),
	}
}

// ---------------------------------------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------------------------------------

export interface Preset {
	id: string
	show: string
	steps: Action[]
}

const w = (s: number, n: number): Action => ({
	type: "watch",
	season: s,
	number: n,
})
const u = (s: number, n: number): Action => ({
	type: "unwatch",
	season: s,
	number: n,
})

export const PRESETS: Preset[] = [
	{
		id: "through-ended",
		show: "ended",
		steps: [w(1, 1), w(1, 2), w(1, 3), w(2, 1), w(2, 2), w(2, 3)],
	},
	{
		id: "caught-up-airs",
		show: "weekly",
		steps: [
			w(1, 1),
			w(1, 2),
			w(1, 3),
			w(2, 1),
			w(2, 2),
			{ type: "episodeAirs" },
			w(2, 3),
			{ type: "episodeAirs" },
			{ type: "seasonAirs" },
			w(2, 4),
		],
	},
	{
		id: "seen-twice",
		show: "ended",
		steps: [w(1, 1), w(1, 2), { type: "pressSeen" }, { type: "undoSeen" }],
	},
	{
		id: "on-hold",
		show: "weekly",
		steps: [
			w(1, 1),
			w(1, 2),
			{ type: "hold" },
			{ type: "resume" },
			{ type: "hold" },
			w(1, 3),
		],
	},
	{
		id: "dropped-want",
		show: "ended",
		steps: [{ type: "drop" }, { type: "wantToSee", on: true }, w(1, 1)],
	},
	{
		id: "rate-never-started",
		show: "ended",
		steps: [{ type: "rate", score: 8 }],
	},
	{
		id: "rewatch",
		show: "ended",
		steps: [{ type: "pressSeen" }, { type: "watchAgain" }, w(1, 1), w(1, 2)],
	},
	{
		id: "readded",
		show: "weekly",
		steps: [w(1, 1), w(1, 2), w(1, 3), { type: "episodeReadded" }],
	},
	{
		id: "no-list",
		show: "nolist",
		steps: [
			{ type: "pressSeen" },
			{ type: "undoSeen" },
			{ type: "wantToSee", on: true },
			{ type: "pressSeen" },
		],
	},
	{ id: "rate-prompt", show: "specials", steps: [w(1, 1), w(1, 2), w(1, 3)] },
	{ id: "special", show: "specials", steps: [w(0, 1), w(1, 1), u(0, 1)] },
	{
		id: "unwatch-on-hold",
		show: "weekly",
		steps: [w(1, 1), { type: "hold" }, u(1, 1), { type: "resume" }],
	},
	{
		id: "seen-new-episodes",
		show: "weekly",
		steps: [
			{ type: "pressSeen" },
			{ type: "episodeAirs" },
			{ type: "seasonAirs" },
		],
	},
]

export const findPreset = (id: string): Preset => {
	const found = PRESETS.find((preset) => preset.id === id)
	if (!found) throw new Error(`No preset ${id}`)
	return found
}

// ---------------------------------------------------------------------------------------------------------
// A seeded generator, so a failing walk can be repeated
// ---------------------------------------------------------------------------------------------------------

export function mulberry32(seed: number) {
	let a = seed >>> 0
	return () => {
		a = (a + 0x6d2b79f5) >>> 0
		let t = a
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

// ---------------------------------------------------------------------------------------------------------
// The grouped query (QG of the data model), written out. One row per title and pass:
//   SELECT tmdb_id, media_type, pass, count(*) AS watch_count,
//          count(DISTINCT season_number * 100000 + episode_number) FILTER (WHERE season_number > 0) AS episodes_watched,
//          max(season_number * 100000 + episode_number) FILTER (WHERE season_number > 0) AS furthest,
//          min(watched_at) AS first_watched_at, max(watched_at) AS last_watched_at,
//          max(CASE WHEN watched_at_precision = 'moment' THEN watched_at END) AS last_moment_at,
//          max(CASE WHEN watched_at IS NOT NULL THEN watched_at WHEN origin <> 'import' THEN created_at END)
//              AS last_activity_at
//   FROM user_watch_log WHERE user_id = ? GROUP BY tmdb_id, media_type, pass
// ---------------------------------------------------------------------------------------------------------

const maxOf = (values: (number | null)[]) =>
	values.reduce<number | null>(
		(m, v) => (v === null ? m : m === null || v > m ? v : m),
		null,
	)
const minOf = (values: (number | null)[]) =>
	values.reduce<number | null>(
		(m, v) => (v === null ? m : m === null || v < m ? v : m),
		null,
	)

/** What Crate would answer to the grouped query over these log rows of one member. */
export function groupedQuery(log: readonly LogRow[]): GroupRow[] {
	const groups = new Map<string, LogRow[]>()
	for (const r of log) {
		const key = `${r.media_type}-${r.tmdb_id}-${r.pass}`
		const rows = groups.get(key) ?? []
		rows.push(r)
		groups.set(key, rows)
	}
	return [...groups.values()].map((rows) => {
		const regular = rows
			.filter((r) => r.season_number !== null && r.season_number > 0)
			.map(
				(r) =>
					(r.season_number as number) * 100000 + (r.episode_number as number),
			)
		return {
			tmdb_id: rows[0].tmdb_id,
			media_type: rows[0].media_type,
			pass: rows[0].pass,
			watch_count: rows.length,
			episodes_watched: new Set(regular).size,
			furthest: maxOf(regular),
			first_watched_at: minOf(rows.map((r) => r.watched_at)),
			last_watched_at: maxOf(rows.map((r) => r.watched_at)),
			last_moment_at: maxOf(
				rows.map((r) =>
					r.watched_at_precision === "moment" ? r.watched_at : null,
				),
			),
			last_activity_at: maxOf(
				rows.map((r) =>
					r.watched_at !== null
						? r.watched_at
						: r.origin !== "import"
							? r.created_at
							: null,
				),
			),
		}
	})
}
