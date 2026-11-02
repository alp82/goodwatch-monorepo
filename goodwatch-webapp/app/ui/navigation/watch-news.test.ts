import assert from "node:assert/strict"
import { test } from "node:test"
import {
	readyViews,
	upNextSplit,
	upNextViews,
	watchTabsFor,
} from "../watch/watch-views.ts"
import "../../server/title-filter/test-alias.ts"
import { member } from "../../domain/member-paths.ts"
import { areaSheetOf } from "./phone-bar.ts"
const { watchNews, withWatchNews } = await import("./watch-news.ts")

const empty = { count: 0, ids: [], only: null }
const landed = {
	movies: { count: 1, ids: [7], only: { title: "Dune", service: "Netflix" } },
	shows: { count: 2, ids: [1, 3], only: null },
}
const episodes = { shows: 2, ids: [1, 2], only: null }

test("each page gets its news, counting overlapping show news once", () => {
	const news = watchNews(episodes, landed)
	assert.equal(news.shows?.badge, "3")
	assert.equal(news.movies?.badge, "1")
	assert.match(news.movies?.label ?? "", /Dune.*Netflix/)
	const tabs = withWatchNews(watchTabsFor("/watch/for-you"), news)
	assert.equal(tabs.find((t) => t.key === "up-next")?.news, news.shows)
	assert.equal(tabs.find((t) => t.key === "ready")?.news, news.movies)
	assert.equal(tabs.find((t) => t.key === "for-you")?.news, undefined)
	assert.equal(
		upNextSplit(upNextViews("/watch/shows/watching", null, news.shows) ?? [])[0]
			.news,
		news.shows,
	)
	const movies = readyViews("/watch/movies/want", null, news.movies) ?? []
	assert.equal(movies.find((v) => v.key === "tonight")?.news, news.movies)
	assert.equal(movies.find((v) => v.key === "wishlist")?.news, undefined)
})

test("the Watch sheet opened from another area carries the same news", () => {
	const news = watchNews(episodes, landed)
	const sheet = areaSheetOf("watch", "/watch/shows", member("test"))
	assert.ok(sheet)
	const tabs = withWatchNews(sheet.tabs, news)
	assert.equal(tabs.find((t) => t.key === "up-next")?.news?.badge, "3")
	assert.equal(tabs.find((t) => t.key === "ready")?.news?.badge, "1")
	assert.ok(tabs.every((t) => !t.here))
})

test("no news removes badges; either source works by itself and large counts cap", () => {
	assert.deepEqual(watchNews(null, null), {
		shows: undefined,
		movies: undefined,
	})
	assert.equal(watchNews(null, landed).shows?.badge, "2")
	assert.equal(watchNews(episodes, null).shows?.badge, "2")
	assert.equal(
		watchNews(null, {
			shows: empty,
			movies: { count: 120, ids: [], only: null },
		}).movies?.badge,
		"99+",
	)
	const tabs = withWatchNews(
		withWatchNews(watchTabsFor("/watch/shows"), watchNews(episodes, landed)),
		watchNews(null, null),
	)
	assert.ok(tabs.every((t) => !t.news))
})
