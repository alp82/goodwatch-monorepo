import assert from "node:assert/strict"
import { test } from "node:test"
import {
	recoverTvtimeEpisode,
	readTvdbEpisode,
} from "./tvtime-identity.server.ts"

test("a retired TVDB ID recovers through its IMDb identity, under the expected parent", async () => {
	const requests: string[] = []
	const result = await recoverTvtimeEpisode(200, 10, async (path) => {
		requests.push(path)
		return path.startsWith("/tvdb/")
			? { imdbId: "tt1234567", name: "An episode", airDate: "2001-02-03" }
			: { tv_results: [], tv_episode_results: [{ id: 20, show_id: 10 }] }
	})
	assert.deepEqual(result, { id: 20, show_id: 10 })
	assert.deepEqual(requests, ["/tvdb/episode/200", "/find/tt1234567"])
	assert.equal(
		await recoverTvtimeEpisode(200, 11, async (path) =>
			path.startsWith("/tvdb/")
				? { imdbId: "tt1234567" }
				: { tv_episode_results: [{ id: 20, show_id: 10 }] },
		),
		null,
	)
})

test("TVDB metadata must refer to the requested episode and have one IMDb identity", () => {
	const html =
		'<link rel="canonical" href="https://thetvdb.com/series/example/episodes/200"><div data-language="eng" data-title="A &amp; B"></div><strong>Originally Aired</strong><span><a href="/on-today/2001-02-03">date</a></span><a href="https://www.imdb.com/title/tt1234567/">IMDB</a>'
	assert.deepEqual(readTvdbEpisode(html, 200), {
		imdbId: "tt1234567",
		name: "A & B",
		airDate: "2001-02-03",
	})
	assert.equal(readTvdbEpisode(html, 201), null)
	assert.equal(
		readTvdbEpisode(
			html + '<a href="https://www.imdb.com/title/tt9999999/">IMDB</a>',
			200,
		),
		null,
	)
})
