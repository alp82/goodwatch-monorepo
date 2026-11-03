import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { type AlignImdbEpisode, type AlignTmdbEpisode, alignEpisodes, nearTitle } from "./episode-alignment.ts"

type Season = (string | null)[]
let nextId = 0
const tmdbRun = (seasons: Season[], ids: Record<string, string> = {}): AlignTmdbEpisode[] =>
	seasons.flatMap((names, s) =>
		names.map((name, n) => ({
			tmdb_id: 1000 + 100 * (s + 1) + n + 1,
			imdb_id: name !== null ? (ids[name] ?? null) : null,
			season_number: s + 1,
			episode_number: n + 1,
			name,
		})),
	)
const imdbRun = (seasons: Season[], first = 0): AlignImdbEpisode[] =>
	seasons.flatMap((names, s) =>
		names.map((name, n) => ({
			imdb_episode_id: `tt${first + ++nextId}`,
			season_number: s + 1,
			episode_number: n + 1,
			name,
		})),
	)
/** Each IMDb title → the TMDB title it was paired with. */
const paired = (imdb: AlignImdbEpisode[], tmdb: AlignTmdbEpisode[]) => {
	const a = alignEpisodes(imdb, tmdb)
	const names = new Map(tmdb.map((e) => [e.tmdb_id, e.name]))
	return Object.fromEntries(
		imdb.map((e) => {
			const t = a.pairs.get(e.imdb_episode_id)
			return [e.name, t === undefined ? null : names.get(t)]
		}),
	)
}

test("Naruto: one IMDb season of 220 and four TMDB seasons line up episode for episode", () => {
	const naruto = JSON.parse(readFileSync(new URL("./fixtures/naruto-run.json", import.meta.url), "utf8")) as {
		imdb: (AlignImdbEpisode & { score: number })[]
		tmdb: AlignTmdbEpisode[]
	}
	const a = alignEpisodes(naruto.imdb, naruto.tmdb)
	assert.equal(a.pairs.size, 220)
	// TMDB numbers Naruto on across its seasons, so its number is the absolute episode: every pair agrees.
	const byId = new Map(naruto.tmdb.map((e) => [e.tmdb_id, e]))
	for (const e of naruto.imdb) assert.equal(byId.get(a.pairs.get(e.imdb_episode_id) as number)?.episode_number, e.episode_number)
})

test("seasons cut differently are read across, by titles and the gaps between them", () => {
	// IMDb: 3 seasons of 2; TMDB: 2 seasons of 3. Titles differ except two.
	const imdb = imdbRun([["Ichi", "Ni"], ["San", "Shi"], ["Go", "Zero"]])
	const tmdb = tmdbRun([["One", "Two", "Three"], ["Four", "Five", "Zero"]])
	assert.deepEqual(paired(imdb, tmdb), { Ichi: "One", Ni: "Two", San: "Three", Shi: "Four", Go: "Five", Zero: "Zero" })
})

test("a gap with more episodes on one side stays unpaired; an episode never takes a neighbour's identity", () => {
	// TMDB splits the opener in two, so between "Start" and "End" IMDb has 2 episodes and TMDB 3.
	const imdb = imdbRun([["Start", "Opener", "Middle", "End"]])
	const tmdb = tmdbRun([["Start", "Opener (1)", "Opener (2)", "Mitte", "End"]])
	assert.deepEqual(paired(imdb, tmdb), { Start: "Start", Opener: null, Middle: null, End: "End" })
})

test("a stray title match out of order across seasons is not an anchor, and decides no position", () => {
	// "Reunion" is IMDb's S1 E2 and TMDB's S2 E2: the other titles say the runs line up otherwise.
	const imdb = imdbRun([["A", "Reunion", "C"], ["D", "E"]])
	const tmdb = tmdbRun([["A", "B", "C"], ["D", "Reunion"]])
	assert.deepEqual(paired(imdb, tmdb), { A: "A", Reunion: null, C: "C", D: "D", E: null })
})

test("a whole season numbered alike pairs by number, unless an anchor contradicts it", () => {
	const imdb = imdbRun([["Majin", "Kakusei", "Zero"], ["Uno", "Alpha", "Tres"]])
	const tmdb = tmdbRun([["Demon", "Knight", "Zero"], ["Alpha", "Beta", "Gamma"]])
	assert.deepEqual(paired(imdb, tmdb), {
		Majin: "Demon",
		Kakusei: "Knight",
		Zero: "Zero",
		// "Alpha" is TMDB's first and IMDb's second: season 2 is numbered differently, so only the title pairs.
		Uno: null,
		Alpha: "Alpha",
		Tres: null,
	})
})

test("a season listed in another order keeps its title pairs (Firefly's broadcast order)", () => {
	const imdb = imdbRun([["Serenity", "The Train Job", "Bushwhacked"]])
	const tmdb = tmdbRun([["The Train Job", "Bushwhacked", "Serenity"]])
	assert.deepEqual(paired(imdb, tmdb), { Serenity: "Serenity", "The Train Job": "The Train Job", Bushwhacked: "Bushwhacked" })
})

test("IMDb's episode 0 is a special, not part of the run", () => {
	const tmdb = tmdbRun([["Episode 1", "Episode 2"]])
	const imdb: AlignImdbEpisode[] = [
		{ imdb_episode_id: "tt900", season_number: 1, episode_number: 0, name: "Christmas Special" },
		{ imdb_episode_id: "tt901", season_number: 1, episode_number: 1, name: "Episode #1.1" },
		{ imdb_episode_id: "tt902", season_number: 1, episode_number: 2, name: "Episode #1.2" },
	]
	const a = alignEpisodes(imdb, tmdb)
	assert.equal(a.pairs.has("tt900"), false)
	assert.equal(a.pairs.get("tt901"), 1101)
	assert.equal(a.pairs.get("tt902"), 1102)
})

test("a stored IMDb id wins, and a TMDB episode that stores another id takes no other", () => {
	const imdb = imdbRun([["X", "Y"]], 500)
	const [x, y] = imdb.map((e) => e.imdb_episode_id)
	const tmdb = tmdbRun([["Ex", "Why"]], { Ex: x, Why: "tt-elsewhere" })
	const a = alignEpisodes(imdb, tmdb)
	assert.equal(a.pairs.get(x), 1101)
	assert.equal(a.how.get(x), "id")
	assert.equal(a.pairs.has(y), false)
})

test("near titles: wording differences match, a part or an added number never does", () => {
	assert.equal(nearTitle("The Freelancer (No. 145)", "The Freelancer"), true)
	assert.equal(nearTitle("Road Rules All Stars: Five Easy Pieces", "Five Easy Pieces"), true)
	assert.equal(nearTitle("Ko‘olauloa", "Koʻolauloa"), true)
	assert.equal(nearTitle("Opener (1)", "Opener"), false)
	assert.equal(nearTitle("Finale", "Finale, Part 2"), false)
	assert.equal(nearTitle("Episode 3", "Episode 3"), false)
})

test("a season number is no evidence when the sites cut the run differently before it", () => {
	// Review scenario: IMDb 3 seasons of 4, TMDB 2+2+4+4. TMDB S3 holds IMDb S2's episodes; titles say nothing.
	const imdb = imdbRun([
		["Ichi", "Ni", "San", "Shi"],
		["Go", "Roku", "Nana", "Hachi"],
		["Ku", "Ju", "Juichi", "Juni"],
	])
	const tmdb = tmdbRun([
		["Episode 1", "Episode 2"],
		["Episode 1", "Episode 2"],
		["Episode 1", "Episode 2", "Episode 3", "Episode 4"],
		["Episode 1", "Episode 2", "Episode 3", "Episode 4"],
	])
	const result = paired(imdb, tmdb)
	// Equal runs pair by position (IMDb S3 E1 is TMDB S4 E1), never by season number (TMDB S3 E1).
	assert.equal(result.Ku, "Episode 1")
	const a = alignEpisodes(imdb, tmdb)
	const ku = imdb.find((e) => e.name === "Ku")!.imdb_episode_id
	assert.equal(a.pairs.get(ku), 1401)
})

test("a title repeated in two seasons cut differently doesn't jump across them", () => {
	// "Reunion" is IMDb's S2 E2 and S3 E1; TMDB has it as S1 E4 and S2 E3, where the cuts differ.
	const imdb = imdbRun([["A", "B", "C"], ["D", "Reunion"], ["Reunion", "F"]])
	const tmdb = tmdbRun([["A", "B", "C", "D"], ["Reunion", "Reunion", "F"]])
	const a = alignEpisodes(imdb, tmdb)
	const ids = imdb.map((e) => e.imdb_episode_id)
	// Order and equal gaps pair them where they are; season-keyed titles add nothing across the different cuts.
	assert.equal(a.pairs.get(ids[4]), 1201)
	assert.equal(a.pairs.get(ids[5]), 1202)
	for (const how of a.how.values()) assert.notEqual(how, "reordered")
})
