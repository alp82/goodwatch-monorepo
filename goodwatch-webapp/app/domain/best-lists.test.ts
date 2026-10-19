import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import {
	PER_PAGE,
	listCopy,
	pageCount,
	pagePath,
	pageRange,
	parsePeopleSitemap,
	parseTitleSitemap,
	peopleCopy,
	rankTitles,
	requestedPage,
	roleLabel,
} from "./best-lists.ts"

const sitemap = (file: string) =>
	readFileSync(
		new URL(`../../public/sitemaps/${file}`, import.meta.url),
		"utf8",
	)

const xml = (selection: string, locs: string[]) =>
	`<?xml version="1.0" encoding="UTF-8"?>\n<urlset>\n${selection}${locs.map((loc) => `  <url>\n    <loc>https://goodwatch.app${loc}</loc>\n  </url>\n`).join("")}</urlset>`

test("a title sitemap gives every address in its order and the attention IDs", () => {
	const cohort = parseTitleSitemap(
		xml(
			'<!--goodwatch-selection {"policy":1,"core":[155,13],"attention":[42],"attention_month":"2026-10"}-->\n',
			["/movie/155-the-dark-knight", "/movie/13-forrest-gump", "/movie/42"],
		),
		"movie",
	)
	assert.deepEqual(
		[...cohort.paths],
		[
			[155, "/movie/155-the-dark-knight"],
			[13, "/movie/13-forrest-gump"],
			[42, "/movie/42"],
		],
	)
	assert.deepEqual([...cohort.attention], [42])
})

test("a title sitemap without selection state fails instead of listing nothing", () => {
	assert.throws(
		() => parseTitleSitemap(xml("", ["/movie/155"]), "movie"),
		/selection state/,
	)
})

test("a show sitemap ignores addresses of another kind", () => {
	const cohort = parseTitleSitemap(
		xml('<!--goodwatch-selection {"core":[1396],"attention":[]}-->\n', [
			"/show/1396-breaking-bad",
			"/movie/155",
		]),
		"show",
	)
	assert.deepEqual([...cohort.paths.keys()], [1396])
})

test("the committed sitemaps hold the cohort the lists show", () => {
	const movies = parseTitleSitemap(
		sitemap("sitemap_movie_detail_0.xml"),
		"movie",
	)
	const shows = parseTitleSitemap(sitemap("sitemap_show_detail_0.xml"), "show")
	const people = parsePeopleSitemap(sitemap("sitemap_people.xml"))
	assert.equal(movies.paths.size, 700)
	assert.equal(shows.paths.size, 300)
	assert.equal(people.size, 30)
	for (const cohort of [movies, shows])
		for (const id of cohort.attention) assert.ok(cohort.paths.has(id))
	assert.match(people.values().next().value ?? "", /^\/person\/\d+-/)
})

test("titles rank by score, then ratings, then ID, with unscored titles last", () => {
	const t = (tmdb_id: number, score: number | null, votes: number | null) => ({
		tmdb_id,
		goodwatch_overall_score_normalized_percent: score,
		goodwatch_overall_score_voting_count: votes,
	})
	const ranked = rankTitles([
		t(5, null, 9e6),
		t(4, 80, 100),
		t(3, 90, 10),
		t(2, 80, 200),
		t(1, 80, 100),
	])
	assert.deepEqual(
		ranked.map((x) => x.tmdb_id),
		[3, 2, 1, 4, 5],
	)
})

test("pages hold 250 titles and read the page number like the canonical address", () => {
	assert.equal(PER_PAGE, 250)
	assert.equal(pageCount(700), 3)
	assert.equal(pageCount(300), 2)
	assert.equal(pageCount(0), 1)
	assert.deepEqual(pageRange(3, 700), { first: 501, last: 700 })
	assert.equal(requestedPage(""), 1)
	assert.equal(requestedPage("?page=1"), 1)
	assert.equal(requestedPage("?page=2"), 2)
	assert.equal(requestedPage("?page=0"), 1)
	assert.equal(requestedPage("?page=abc"), 1)
	assert.equal(requestedPage("?utm_source=x&page=3"), 3)
	assert.equal(pagePath("movies", 1), "/movies/best")
	assert.equal(pagePath("shows", 2), "/shows/best?page=2")
})

test("a list's copy names its count, its popular titles, and a later page's ranks", () => {
	const first = listCopy("movies", { total: 700, popular: 70, page: 1 })
	assert.equal(first.title, "The Best Movies of All Time, Ranked | GoodWatch")
	assert.equal(first.heading, "The best movies of all time")
	assert.equal(
		first.intro,
		"700 well-known movies, ranked by GoodWatch score: the most-rated movies on GoodWatch, plus 70 that are popular right now. Updated monthly.",
	)
	const later = listCopy("shows", { total: 300, popular: 30, page: 2 })
	assert.equal(
		later.title,
		"The Best TV Shows of All Time, Ranked 251 to 300 | GoodWatch",
	)
	assert.equal(later.heading, "The best TV shows of all time, 251 to 300")
	assert.match(
		later.description,
		/^TV shows 251 to 300 of the 300 best-known TV shows/,
	)
	assert.doesNotMatch(
		listCopy("movies", { total: 700, popular: 0, page: 1 }).intro,
		/plus/,
	)
})

test("the people copy says actors until a director is on the list", () => {
	assert.equal(peopleCopy(["Acting", "Acting"]).heading, "Popular actors")
	assert.equal(
		peopleCopy(["Acting", "Directing"]).heading,
		"Popular actors and directors",
	)
	assert.equal(peopleCopy(["Directing"]).heading, "Popular directors")
	assert.match(peopleCopy(["Acting"]).intro, /has a leading role in several/)
	assert.equal(
		peopleCopy(Array(30).fill("Acting")).title,
		"Popular Actors: Their Best Movies and TV Shows | GoodWatch",
	)
	assert.equal(roleLabel("Acting"), "Actor")
	assert.equal(roleLabel("Directing"), "Director")
	assert.equal(roleLabel("Writing"), "Writing")
	assert.equal(roleLabel(null), "")
})
