// My shows on the TV: its rows and words, the New episodes signal on them, and which episode Seen it marks.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { derive } from "../../../domain/tracking/machine.ts"
import type { TvHomeData } from "./tv-home.ts"
import { homeApps, knownShow, tvContextOf } from "./tv-home.ts"
import { SHOWS_PER_GROUP, tvItems } from "./tv-machine.ts"
import {
	NO_SIGNAL,
	type TvShows,
	type TvShowsSignal,
	episodeSeenToast,
	episodeToMark,
	mayHaveNext,
	showRows,
	showsCrumb,
} from "./tv-shows.ts"
import { seenLabel } from "./tv-title.ts"

const show = (id: number, title = `Show ${id}`) => ({
	id,
	title,
	poster_path: `/poster-${id}.jpg`,
	backdrop_path: `/backdrop-${id}.jpg`,
})
const shows: TvShows = {
	next: [
		{
			...show(10, "Severance"),
			episode: { code: "S2 E4", name: "Woe's Hollow", runtime: 50 },
			left: 6,
			caughtUp: false,
		},
		{
			...show(11, "Slow Horses"),
			episode: { code: "S3 E1", name: null, runtime: null },
			left: 2,
			caughtUp: true,
		},
		// Its episode list was not read.
		{ ...show(12, "The Bear"), episode: null, left: 1 },
		{
			...show(13),
			episode: { code: "S1 E2", name: "Two", runtime: 30 },
		},
	],
	start: [
		{ ...show(20, "Andor"), match: 96, service: "Disney Plus", seasons: 2 },
		{ ...show(21), match: null, service: null, seasons: 1 },
		{ ...show(22), match: 71, service: "Netflix" },
		{ ...show(23), match: 60, service: null },
	],
}
const member: TvHomeData = {
	member: true,
	startTitles: [],
	picture: null,
	tonight: [],
	shows,
}

const signal = (rest: Partial<TvShowsSignal>): TvShowsSignal => ({
	...NO_SIGNAL,
	...rest,
})

test("My shows lists three shows with a Next episode, then three to start, as the machine does", () => {
	const rows = showRows(shows)
	assert.deepEqual(
		rows.map((row) => [row.key, row.kind]),
		[
			["show-10", "next"],
			["show-11", "next"],
			["show-12", "next"],
			["show-20", "start"],
			["show-21", "start"],
			["show-22", "start"],
		],
	)
	assert.equal(rows.length, 2 * SHOWS_PER_GROUP)
	// The rows are the machine's items for the screen, in its order.
	const items = tvItems({ name: "shows" }, tvContextOf(member, null))
	assert.deepEqual(
		rows.map((row) => row.item),
		items.filter((item) => item.startsWith("title:")),
	)
	assert.deepEqual(showRows(null), [])
	assert.deepEqual(showRows({ next: [], start: [] }), [])
})

test("a show the loader names in both groups is listed once", () => {
	const twice: TvShows = {
		next: [shows.next[0]],
		start: [{ ...show(10), match: 90, service: null }, shows.start[0]],
	}
	assert.deepEqual(
		showRows(twice).map((row) => [row.key, row.kind]),
		[
			["show-10", "next"],
			["show-20", "start"],
		],
	)
})

test("a poster says the Next episode and its length, or Start", () => {
	assert.deepEqual(
		showRows(shows).map((row) => row.label),
		["S2 E4 · 50 min", "S3 E1", "Continue", "Start", "Start", "Start"],
	)
})

test("the line of a show says its Next episode, what is left, and what starting it takes", () => {
	assert.deepEqual(
		showRows(shows).map((row) => row.facts),
		[
			"Next: S2 E4 · Woe's Hollow · 50 min · 6 episodes left",
			// A Seen show with new episodes counts what is new.
			"Next: S3 E1 · 2 new since you saw it",
			"Continue · 1 episode left",
			"To start · 2 seasons · 96% match · On Disney+",
			"To start · 1 season",
			"To start · 71% match · On Netflix",
		],
	)
})

test("a show the New episodes signal counts is marked, and its line says what is new", () => {
	const news = signal({
		words: { badge: "2", tile: "New in 2 shows", door: "2 shows have something new" },
		aired: [11],
		landed: [20, 12],
	})
	const rows = showRows(shows, news)
	assert.deepEqual(
		rows.filter((row) => row.fresh).map((row) => row.key),
		["show-11", "show-12", "show-20"],
	)
	assert.equal(rows[1].facts, "New: S3 E1 · 2 new since you saw it")
	// A show to start that landed on one of the member's services leads with the service.
	assert.equal(rows[3].facts, "Now on Disney+ · To start · 2 seasons · 96% match")
	// A show the member is in the middle of keeps its line: it is marked and keeps its place.
	assert.equal(rows[2].facts, "Continue · 1 episode left")
	assert.equal(rows[0].fresh, false)
	// Landed without a service the catalog names.
	const unnamed = showRows(shows, signal({ landed: [21] }))
	assert.equal(unnamed[4].facts, "Now on your services · To start · 1 season")
})

test("under the screen's name: the signal while something is new, else what the list holds", () => {
	assert.equal(showsCrumb(shows), "Your next episodes")
	assert.equal(showsCrumb({ next: [], start: shows.start }), "Shows to start")
	assert.equal(showsCrumb({ next: [], start: [] }), undefined)
	assert.equal(showsCrumb(null), undefined)
	const one = signal({
		words: {
			badge: "1",
			tile: "New: Slow Horses S3 E1",
			door: "New: Slow Horses S3 E1",
		},
		aired: [11],
	})
	assert.equal(showsCrumb(shows, one), "New: Slow Horses S3 E1")
})

test("home's My shows tile carries the New episodes signal", () => {
	const tile = (fresh: Parameters<typeof homeApps>[4]) =>
		homeApps(member, null, false, null, fresh).find(
			(app) => app.app === "shows",
		)
	assert.equal(tile(null)?.line, "Your next episodes.")
	assert.equal(tile(null)?.signal, undefined)
	const several = tile({
		badge: "3",
		tile: "New in 3 shows",
		door: "3 shows have new episodes",
	})
	assert.equal(several?.line, "New in 3 shows.")
	assert.deepEqual(several?.signal, {
		badge: "3",
		label: "3 shows have new episodes",
	})
	// No other tile changes with it.
	assert.deepEqual(
		homeApps(member, null, false, null, {
			badge: "3",
			tile: "New in 3 shows",
			door: "x",
		})
			.filter((app) => app.app !== "shows")
			.map(({ line, signal: own }) => [line, own]),
		homeApps(member, null)
			.filter((app) => app.app !== "shows")
			.map(({ line, signal: own }) => [line, own]),
	)
})

test("a show's title screen is named at once from My shows", () => {
	assert.deepEqual(knownShow(member, "show-10"), {
		media_type: "show",
		tmdb_id: 10,
		title: "Severance",
		poster_path: "/poster-10.jpg",
		backdrop_path: "/backdrop-10.jpg",
	})
	assert.equal(knownShow(member, "show-20")?.title, "Andor")
	assert.equal(knownShow(member, "movie-10"), null)
	assert.equal(knownShow(member, "show-999"), null)
	assert.equal(knownShow({ shows: null }, "show-10"), null)
})

// ---------------------------------------------------------------------------------------------------------
// Seen it on a show the member is midway through.

const episodes = [1, 2, 3, 4].map((number) => ({
	id: 100 + number,
	season: 1,
	number,
	aired: number <= 3,
}))
const watch = (number: number) => ({
	id: `w${number}`,
	episodeId: 100 + number,
	season: 1,
	number,
	origin: "episode" as const,
	group: null,
	pass: 1,
})
const world = (state: string, watched: number[]) =>
	derive({
		show: { running: true, episodes },
		record: {
			state,
			pass: 1,
			watches: watched.map(watch),
			seenPress: null,
			score: null,
			wantToSee: false,
			notInterested: false,
			ratePromptDismissed: false,
			seenQuestion: null,
		},
	} as never)

test("Seen it marks the Next episode of a Watching show", () => {
	const watching = world("watching", [1])
	assert.equal(watching.next?.number, 2)
	assert.equal(episodeToMark(watching)?.number, 2)
})

test("Seen it marks the new episode of a Seen show, and nothing once it is caught up", () => {
	const behind = world("seen", [1, 2])
	assert.equal(behind.newEpisodes, 1)
	assert.equal(episodeToMark(behind)?.number, 3)
	// Every aired episode is watched: the fourth has not aired.
	const caughtUp = world("seen", [1, 2, 3])
	assert.equal(episodeToMark(caughtUp), null)
})

test("On hold, Dropped and Not started keep their Seen it: a watch would end what the member chose", () => {
	// The show's page names a Next episode for a show on hold; the TV's key does not mark it.
	const onHold = world("on_hold", [1])
	assert.equal(onHold.next?.number, 2)
	assert.equal(episodeToMark(onHold), null)
	assert.equal(episodeToMark(world("dropped", [1])), null)
	assert.equal(episodeToMark(world("not_started", [])), null)
})

test("a show's tracking is read only for a Watching or a Seen show", () => {
	assert.equal(mayHaveNext("watching"), true)
	assert.equal(mayHaveNext("seen"), true)
	for (const state of ["on_hold", "dropped", "not_started", undefined, null])
		assert.equal(mayHaveNext(state), false, String(state))
})

test("the Seen it key names the episode it marks, before the score and the tick", () => {
	assert.equal(seenLabel(null, false, "S2 E4"), "Seen S2 E4")
	assert.equal(seenLabel(8, true, "S2 E4"), "Seen S2 E4")
	// Without an episode to mark the key is as on any title.
	assert.equal(seenLabel(8, true, null), "8 · Great")
	assert.equal(seenLabel(null, true), "Seen ✓")
	assert.equal(seenLabel(null, false), "Seen it")
})

test("the TV says which episode was marked", () => {
	assert.equal(episodeSeenToast("S2 E4", false), "S2 E4 seen")
	assert.equal(
		episodeSeenToast("S2 E8", true),
		"S2 E8 seen, every episode watched",
	)
})

test("the tracking store names the show page's event as its gate does, without importing the gate", () => {
	const read = (file: string) =>
		readFileSync(new URL(`../../tracking/${file}`, import.meta.url), "utf8")
	const name = /OPEN_EPISODES_EVENT = "([^"]+)"/
	assert.equal(name.exec(read("store.ts"))?.[1], "gw:open-episodes")
	assert.equal(name.exec(read("gate.tsx"))?.[1], name.exec(read("store.ts"))?.[1])
	// The store is loaded by the TV too: an import of the gate from it puts the gate into a file of its own, one
	// more script in the first view of every title page.
	assert.doesNotMatch(read("store.ts"), /from "\.\/gate"/)
})
