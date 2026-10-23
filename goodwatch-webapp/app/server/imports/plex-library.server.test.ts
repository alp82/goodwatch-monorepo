import assert from "node:assert/strict"
import { test } from "node:test"
import { plexLibraryFixture } from "./plex-library-fixture.test-support.ts"

test("Plex schema-failure partial warnings explain the unexpected response without exposing its contents", async (t) => {
	const f = await plexLibraryFixture()
	t.after(f.close)
	f.state.schemaFailure = true
	const parsed = await f.client.readImport("token", "client")
	assert.deepEqual(
		parsed.observations.map((row) => row.key),
		["plex:watch:fixture-server:/status/sessions/history/1"],
	)
	const warnings = parsed.warnings.filter(
		(w) => w.kind === "actionable" && /partial:/.test(w.message),
	)
	assert.equal(warnings.length, 2)
	assert.ok(
		warnings.every((w) =>
			w.message.includes("Plex sent an unexpected response."),
		),
	)
	assert.doesNotMatch(JSON.stringify(warnings), /synthetic-private-value/)
})

test("a failed later history page does not suppress the library fallback for discarded history", async (t) => {
	const f = await plexLibraryFixture()
	t.after(f.close)
	f.history.push({ ...f.history[0], historyKey: "/status/sessions/history/2" })
	f.state.historyPageSize = 1
	f.state.historyFailureAfterFirst = true
	const parsed = await f.client.readImport("token", "client")
	assert.equal(
		parsed.observations.filter((row) => row.kind === "watch").length,
		3,
	)
	assert.ok(
		parsed.observations.some(
			(row) => row.key === "plex:library-watch:fixture-server:10",
		),
	)
	assert.ok(
		!parsed.observations.some((row) => row.key.startsWith("plex:watch:")),
	)
})

test("Plex library fills watched movies missing history, preserves lastViewedAt and imports personal ratings", async (t) => {
	const f = await plexLibraryFixture()
	t.after(f.close)
	const parsed = await f.client.readImport("synthetic-account-token", "client")
	assert.deepEqual(
		parsed.observations.map((row) => [
			row.kind,
			row.tmdbId,
			row.score ?? null,
			row.watchedAt ?? null,
			row.precision ?? null,
		]),
		[
			["watch", 862, null, "2020-09-13T12:26:40.000Z", "moment"],
			["rating", 862, 8, null, null],
			["watch", 655, null, null, "unknown"],
			["watch", 129, null, "2000-01-01T00:00:00.000Z", "moment"],
		],
	)
	assert.ok(
		f.calls
			.filter((call) => call.path.startsWith("/library/"))
			.every((call) => call.token === "synthetic-server-token"),
	)
	assert.doesNotMatch(
		JSON.stringify(parsed),
		/synthetic-.*token|fixture.plex.direct/,
	)
})

test("Plex show scores stay at show scope; episodes and their scores resolve by GUID, and season scores stay visible unsupported", async (t) => {
	const f = await plexLibraryFixture()
	t.after(f.close)
	f.history.splice(0)
	f.library.splice(
		0,
		f.library.length,
		{
			ratingKey: "20",
			type: "show",
			title: "Friends",
			year: 1994,
			Guid: [{ id: "tmdb://1668" }],
			userRating: 9.5,
			leafCount: 1,
			viewedLeafCount: 1,
		},
		{
			ratingKey: "21",
			type: "season",
			title: "Season 4",
			parentRatingKey: "20",
			index: 4,
			userRating: 8.5,
		},
		{
			ratingKey: "22",
			type: "episode",
			title: "Finale",
			grandparentRatingKey: "20",
			parentIndex: 4,
			index: 24,
			Guid: [{ id: "tmdb://101" }, { id: "tvdb://900" }],
			viewCount: 10,
			userRating: 7.5,
			lastViewedAt: 946684800,
		},
		{
			ratingKey: "23",
			type: "episode",
			title: "Pilot",
			grandparentRatingKey: "20",
			parentIndex: 1,
			index: 1,
			Guid: [{ id: "tmdb://102" }],
			viewCount: 1,
		},
	)
	const rows = (await f.client.readImport("token", "client")).observations
	assert.deepEqual(
		rows
			.map((row) => [
				row.kind,
				row.mediaType,
				row.tmdbId,
				row.score ?? null,
				row.season ?? null,
				row.episode ?? null,
			])
			.sort(),
		[
			["rating", "show", 1668, 10, null, null],
			["unsupported", "show", 1668, 8.5, 4, null],
			["episode_rating", "show", 1668, 8, 4, 24],
			["watch", "show", 1668, null, 4, 24],
			["watch", "show", 1668, null, 1, 1],
		].sort(),
	)
	const finale = rows.find(
		(row) => row.kind === "watch" && row.episodeTmdbId === 101,
	)
	assert.equal(finale?.episodeTvdbId, 900)
	const finaleScore = rows.find((row) => row.kind === "episode_rating")
	assert.equal(finaleScore?.scoreScope, "episode")
	assert.equal(finaleScore?.episodeTmdbId, 101)
	assert.equal(finaleScore?.episodeTvdbId, 900)
	assert.equal(finale?.episodeNumbering, "unknown")
	assert.equal(finale?.watchedAt, "2000-01-01T00:00:00.000Z")
	assert.equal(
		rows.find((row) => row.kind === "watch" && row.episodeTmdbId === 102)
			?.precision,
		"unknown",
	)
	assert.match(
		rows.find((row) => row.kind === "unsupported" && row.episode == null)
			?.problem?.reason ?? "",
		/season score can't be matched/i,
	)
	assert.ok(
		!rows.some((row) => row.kind === "show_status"),
		"local library coverage does not establish whole-catalog completion",
	)
})

test("invalid Plex lastViewedAt stays undated with an explanation, never uses addedAt or updatedAt", async (t) => {
	const f = await plexLibraryFixture()
	t.after(f.close)
	f.history.splice(0)
	f.library.splice(0, f.library.length, {
		...f.library[0],
		lastViewedAt: "yesterday",
		addedAt: 1600000000,
		updatedAt: 1700000000,
	})
	const parsed = await f.client.readImport("token", "client")
	const watch = parsed.observations.find((row) => row.kind === "watch")
	assert.equal(watch?.watchedAt, null)
	assert.equal(watch?.precision, "unknown")
	assert.match(
		parsed.warnings.map((w) => w.message).join(" "),
		/invalid last watched date.*undated/i,
	)
})

test("a malformed library item remains visible without losing valid personal data", async (t) => {
	const f = await plexLibraryFixture()
	t.after(f.close)
	f.library.push({
		ratingKey: "99",
		type: "movie",
		title: "Malformed movie",
		viewCount: "yes",
		userRating: 8,
	})
	const parsed = await f.client.readImport("token", "client")
	assert.equal(parsed.observations.filter((row) => !row.problem).length, 4)
	assert.equal(parsed.observations.at(-1)?.problem?.outcome, "invalid")
	assert.equal(parsed.observations.at(-1)?.title, "Malformed movie")
	assert.doesNotMatch(JSON.stringify(parsed), /synthetic-.*token/)
})

test("Plex personal scores use only userRating, round halves up and retain malformed scores for review", async (t) => {
	const f = await plexLibraryFixture()
	t.after(f.close)
	f.history.splice(0)
	f.library.splice(
		0,
		f.library.length,
		...[0, 0.4, 0.5, 1.4, 1.5, 7.49, 7.5, 10, -1, 11, "8", null, undefined].map(
			(userRating, i) => ({
				ratingKey: String(100 + i),
				type: "movie",
				title: `Synthetic movie ${i}`,
				Guid: [{ id: `tmdb://${100 + i}` }],
				userRating,
				rating: 9,
				audienceRating: 8,
				addedAt: 1600000000,
				updatedAt: 1700000000,
			}),
		),
	)
	const parsed = await f.client.readImport("token", "client")
	assert.deepEqual(
		parsed.observations.map((row) => [row.score, row.problem?.outcome ?? null]),
		[
			[1, null],
			[1, null],
			[1, null],
			[2, null],
			[7, null],
			[8, null],
			[10, null],
			[null, "invalid"],
			[null, "invalid"],
			[null, "invalid"],
		],
	)
	assert.ok(
		parsed.observations.every(
			(row) => row.addedAt == null && row.watchedAt == null,
		),
	)
})

test("zero Plex userRating is unrated for movies, shows, seasons and episodes", async (t) => {
	const f = await plexLibraryFixture()
	t.after(f.close)
	f.history.splice(0)
	f.library.splice(
		0,
		f.library.length,
		...["movie", "show", "season", "episode"].map((type, i) => ({
			ratingKey: String(100 + i),
			type,
			title: `Unrated ${type}`,
			Guid: [{ id: `tmdb://${100 + i}` }],
			userRating: 0,
			parentRatingKey: "101",
			grandparentRatingKey: "101",
			parentIndex: 1,
			index: 1,
		})),
	)
	assert.deepEqual(
		(await f.client.readImport("token", "client")).observations,
		[],
	)
})

test("Plex library paging preserves retained history with a partial warning for duplicate, shrinking, oversized or incomplete snapshots", async (t) => {
	for (const mode of [
		"normal",
		"duplicate",
		"shrink",
		"empty",
		"oversized",
		"grow",
	] as const) {
		const f = await plexLibraryFixture()
		t.after(f.close)
		if (mode !== "normal") f.state[mode] = true
		if (mode === "normal" || mode === "grow") {
			const result = await f.client.readImport("token", "client")
			assert.equal(result.observations.length, 4)
			assert.deepEqual(
				f.calls
					.filter((call) => call.path.startsWith("/library/all"))
					.map((call) => call.start),
				[0, 2, 0],
			)
		} else {
			const parsed = await f.client.readImport("token", "client")
			assert.deepEqual(
				parsed.observations.map((row) => row.key),
				["plex:watch:fixture-server:/status/sessions/history/1"],
			)
			assert.match(
				parsed.warnings.map((w) => w.message).join(" "),
				/library.*not.*imported/i,
			)
		}
	}
})

test("show and season library overflow cannot consume the movie and episode watch scan or discard history", async (t) => {
	const f = await plexLibraryFixture()
	t.after(f.close)
	f.state.ratingTotal = 50_001
	const parsed = await f.client.readImport("token", "client")
	assert.equal(
		parsed.observations.filter((row) => row.kind === "watch").length,
		3,
	)
	assert.ok(
		parsed.observations.some(
			(row) =>
				row.key === "plex:watch:fixture-server:/status/sessions/history/1",
		),
	)
	assert.match(
		parsed.warnings.map((w) => w.message).join(" "),
		/show and season.*not.*imported/i,
	)
})

test("failed movie and episode library scans preserve retained history and separately read show ratings", async (t) => {
	const f = await plexLibraryFixture()
	t.after(f.close)
	f.state.faultTypes = "watch"
	f.state.oversized = true
	f.library.push({
		ratingKey: "20",
		type: "show",
		title: "Friends",
		Guid: [{ id: "tmdb://1668" }],
		userRating: 9.5,
	})
	const parsed = await f.client.readImport("token", "client")
	assert.deepEqual(
		parsed.observations.map((row) => [row.kind, row.tmdbId, row.score ?? null]),
		[
			["watch", 862, null],
			["rating", 1668, 10],
		],
	)
	assert.match(
		parsed.warnings.map((w) => w.message).join(" "),
		/partial: the movie and episode library/,
	)
})

test("Plex library pagination uses body totalSize, ignoring a nonexistent total-size header", async (t) => {
	const f = await plexLibraryFixture()
	t.after(f.close)
	f.state.fakeTotalHeader = true
	const parsed = await f.client.readImport("token", "client")
	assert.equal(parsed.observations.length, 4)
	assert.ok(!parsed.warnings.some((w) => /partial:/.test(w.message)))
})

test("library observations exceeding the remaining import space do not discard 50,000 retained plays", async (t) => {
	const f = await plexLibraryFixture()
	t.after(f.close)
	f.history.splice(
		0,
		1,
		...Array.from({ length: 50_000 }, (_, i) => ({
			...f.history[0],
			historyKey: `/status/sessions/history/${i + 1}`,
		})),
	)
	f.state.historyPageSize = 200
	const parsed = await f.client.readImport("token", "client")
	assert.equal(parsed.observations.length, 50_000)
	assert.ok(
		parsed.observations.every((row) => row.key.startsWith("plex:watch:")),
	)
	assert.match(
		parsed.warnings.map((w) => w.message).join(" "),
		/partial:.*Your library has more watched or rated items than one import can hold/,
	)
	assert.doesNotMatch(
		parsed.warnings.map((w) => w.message).join(" "),
		/Try a smaller import/,
	)
})

test("library and retained-history failures are independent and never silently import a partial library", async (t) => {
	for (const failure of ["libraryFailure", "historyFailure"] as const) {
		const f = await plexLibraryFixture()
		t.after(f.close)
		f.state[failure] = true
		const parsed = await f.client.readImport("token", "client")
		if (failure === "libraryFailure") {
			assert.equal(parsed.observations.length, 1)
			assert.match(
				parsed.warnings.map((w) => w.message).join(" "),
				/library could not be read/,
			)
		} else {
			assert.equal(parsed.observations.length, 4)
			assert.ok(
				parsed.observations.some(
					(row) => row.key === "plex:library-watch:fixture-server:10",
				),
			)
			assert.match(
				parsed.warnings.map((w) => w.message).join(" "),
				/history.*imported/i,
			)
		}
	}
})
