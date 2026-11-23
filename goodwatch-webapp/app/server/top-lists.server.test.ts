import assert from "node:assert/strict"
import { test } from "node:test"
import { stubModules } from "./rating-onboarding.test-support.ts"

const sitemap = (kind: string) =>
	`export default '<!--goodwatch-selection {"attention":[1]}--><loc>https://goodwatch.app/${kind}/1-example</loc>'`
const calls: string[] = []
let failShow = true
Object.assign(globalThis, {
	topListQuery: async (sql: string) => {
		const table = /FROM (\w+)/.exec(sql)?.[1]
		assert.ok(table)
		calls.push(table)
		if (table === "show" && failShow) {
			failShow = false
			throw new Error("temporarily unavailable")
		}
		if (table === "person") return [{ tmdb_id: 1, name: "Creator" }]
		if (table === "person_worked_on") return [{ pid: 1, media_type: "show", mid: 1 }]
		if (table === "person_appeared_in") return []
		return [
			{
				tmdb_id: 1,
				title: table,
				release_year: table === "movie" ? 1980 : new Date().getUTCFullYear(),
			},
		]
	},
})
stubModules({
	"~/utils/crate": "export const query = globalThis.topListQuery",
	"../../public/sitemaps/sitemap_movie_detail_0.xml?raw": sitemap("movie"),
	"../../public/sitemaps/sitemap_show_detail_0.xml?raw": sitemap("show"),
	"../../public/sitemaps/sitemap_people.xml?raw": sitemap("person"),
})
const { getRankedList, getListPeople } = await import("./top-lists.server.ts")

test("title rankings read only their own kind and share in-flight reads with the people list", async () => {
	const [movie, same] = await Promise.all([getRankedList("movie"), getRankedList("movie")])
	assert.equal(movie, same)
	assert.equal(movie.popular, 1)
	assert.deepEqual(calls, ["movie"])
	await assert.rejects(getListPeople(), /temporarily unavailable/)
	assert.deepEqual(calls, ["movie", "show"])
	const [people, other, shows] = await Promise.all([
		getListPeople(),
		getListPeople(),
		getRankedList("show"),
	])
	assert.equal(people, other)
	assert.deepEqual(shows.titles, [])
	assert.equal(people[0].knownFor[0].media_type, "show")
	assert.deepEqual(calls, [
		"movie",
		"show",
		"show",
		"person",
		"person_appeared_in",
		"person_worked_on",
	])
})
