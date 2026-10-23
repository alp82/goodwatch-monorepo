// Batch MCP writes (rate_title, set_want_to_see, set_not_interested, set_show_status, log_watch with items, and
// undo_watch with batch_id) against an in-memory member library behind the write ports. Made-up titles only.

// CommonJS packages are loaded before the alias hook, which would otherwise resolve their own relative requires.
import "node-crate"
import "ioredis"
import "react"
import "@remix-run/node"
import "zod"
import ts from "typescript"
import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { test } from "node:test"

// The live writers pull route modules in for their query keys, and Node can't load their JSX: the same stubs as
// watch-log.test.ts. The write ports below replace every Crate and Valkey call.
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		load(
			url: string,
			context: unknown,
			next: (url: string, context: unknown) => unknown,
		): unknown
	}): void
}
registerHooks({
	load(url, context, next) {
		let source: string | undefined
		if (url.endsWith("/routes/api.user-settings.get.tsx")) {
			const original = readFileSync(new URL(url), "utf8")
			source =
				original.slice(
					original.indexOf("// type definitions"),
					original.indexOf("// API endpoint"),
				) +
				original.slice(
					original.indexOf("export const queryKeyUserSettings"),
					original.indexOf("export const useUserSettings"),
				)
		} else if (url.endsWith("/routes/api.onboarding.media.tsx"))
			source = 'export const queryKeyOnboardingMedia = ["onboarding-media"]'
		else if (url.endsWith("/title-snapshot/format.server.ts"))
			source = `${readFileSync(new URL(url), "utf8")}\nexport const getTitleSnapshot = () => null`
		if (source === undefined) return next(url, context)
		return {
			format: "module",
			source: ts.transpileModule(source, {
				compilerOptions: {
					module: ts.ModuleKind.ESNext,
					target: ts.ScriptTarget.ESNext,
				},
			}).outputText,
			shortCircuit: true,
		}
	},
})
import type { UserData } from "../../types/user-data"
import type { CatalogTitle } from "./data.server.ts"
import type { Snapshot, TitleWrite } from "./title-write.server.ts"
import type { WriteArgs } from "./write-tools.server.ts"

const { writeMemberTool } = await import("./writes.server.ts")
const { writeToolDefinitions, itemSchemas } = await import(
	"./write-tools.server.ts"
)
const { summary } = await import("./data.server.ts")
type WritePorts = NonNullable<Parameters<typeof writeMemberTool>[4]>

const origin = "https://goodwatch.test"
const ME = "member-A"
const OTHER = "member-B"

interface Watch {
	id: string
	group_id: string | null
	origin: "single" | "score" | "season" | "press"
	season: number | null
	episode: number | null
}
interface Marks {
	score: number | null
	want_to_see: boolean
	want_to_see_added_at: string | null
	not_interested: boolean
	status: string | null
	watches: Watch[]
}

/** Made-up catalog titles; no member data from production. */
function catalog() {
	const titles: CatalogTitle[] = [
		...Array.from({ length: 60 }, (_, i) => ({
			media_type: "movie" as const,
			tmdb_id: 1000 + i,
			title: `Test Movie ${i}`,
			release_year: 2000 + (i % 20),
		})),
		{ media_type: "movie", tmdb_id: 2001, title: "Twin", release_year: 1999 },
		{ media_type: "movie", tmdb_id: 2002, title: "Twin", release_year: 2011 },
		{
			media_type: "show",
			tmdb_id: 3001,
			title: "Test Show",
			release_year: 2015,
		},
		{
			media_type: "show",
			tmdb_id: 3002,
			title: "Other Show",
			release_year: 2018,
		},
	]
	return new Map(titles.map((t) => [`${t.media_type}:${t.tmdb_id}`, t]))
}

/** A member library in memory behind the write ports, recording every call the batch makes. */
function fakeLibrary() {
	const titles = catalog()
	const library = new Map<string, Marks>()
	const receipts = new Map<
		string,
		{ hash: string; result: Record<string, unknown> }
	>()
	const calls = {
		titlesById: 0,
		resolve: [] as string[],
		userData: 0,
		applyTitleWrite: [] as string[],
		wishlistMany: [] as { action: string; count: number }[],
		notInterestedMany: [] as { action: string; count: number }[],
		deferred: 0,
		resets: 0,
		resetsInsideDeferral: 0,
		taste: 0,
		updateScores: [] as { key: string; score: number | null }[],
		showEvents: [] as string[],
		movieDeletes: [] as string[],
	}
	let deferring = false
	const keyOf = (
		userId: string,
		title: { media_type: string; tmdb_id: number },
	) => `${userId}|${title.media_type}:${title.tmdb_id}`
	const marksOf = (
		userId: string,
		title: { media_type: string; tmdb_id: number },
	) => {
		const key = keyOf(userId, title)
		let marks = library.get(key)
		if (!marks) {
			marks = {
				score: null,
				want_to_see: false,
				want_to_see_added_at: null,
				not_interested: false,
				status: title.media_type === "show" ? "not_started" : null,
				watches: [],
			}
			library.set(key, marks)
		}
		return marks
	}
	const settleMovie = (marks: Marks, id: number) => {
		const own = marks.watches.filter((w) => w.origin !== "score")
		marks.watches = own.length
			? own
			: marks.score !== null
				? [
						{
							id: `score-${id}`,
							group_id: null,
							origin: "score",
							season: null,
							episode: null,
						},
					]
				: []
		marks.status = marks.watches.length ? "seen" : null
	}
	const ports: WritePorts = {
		async readAction(userId, actionId, hash) {
			const row = receipts.get(`${userId}|${actionId}`)
			if (!row) return null
			return row.hash === hash
				? { ...row.result, replayed: true }
				: { outcome: "action_id_conflict" }
		},
		async runAction(userId, actionId, hash, write) {
			const prior = receipts.get(`${userId}|${actionId}`)
			if (prior)
				return prior.hash === hash
					? { ...prior.result, replayed: true }
					: { outcome: "action_id_conflict" }
			const result = {
				...(await write()),
				action_id: actionId,
				replayed: false,
			}
			receipts.set(`${userId}|${actionId}`, { hash, result })
			return result
		},
		async resolve(selector) {
			if (selector.title_id) {
				const title = titles.get(selector.title_id)
				return title ? { title } : { result: { status: "title_not_found" } }
			}
			calls.resolve.push(String(selector.title_name))
			const found = [...titles.values()].filter(
				(t) =>
					t.title === selector.title_name &&
					(selector.year === undefined || t.release_year === selector.year),
			)
			if (!found.length)
				return {
					result: {
						status: "title_not_found",
						message: "No matching catalog title",
					},
				}
			if (found.length > 1)
				return {
					result: {
						status: "ambiguous_title",
						choices: found.map((t) => summary(t, origin)),
						more: false,
					},
				}
			return { title: found[0] }
		},
		async titlesById(keys) {
			calls.titlesById++
			assert.ok(keys.length <= 60)
			const found = new Map<string, CatalogTitle>()
			for (const k of keys) {
				const title = titles.get(`${k.media_type}:${k.tmdb_id}`)
				if (title) found.set(`${k.media_type}:${k.tmdb_id}`, title)
			}
			return found
		},
		async userData() {
			calls.userData++
			return {} as UserData
		},
		async snapshot(userId, title) {
			const marks = marksOf(userId, title)
			return {
				status: marks.status,
				pass: title.media_type === "show" ? 1 : null,
				score: marks.score,
				review: null,
				want_to_see: marks.want_to_see,
				want_to_see_added_at: marks.want_to_see_added_at as never,
				not_interested: marks.not_interested,
				watches: marks.watches.map((w) => ({
					id: w.id,
					record_created_at: "2026-10-01T00:00:00.000Z",
					watched_at: null,
					episode_id: null,
					group_id: w.group_id,
					import_id: null,
					season: w.season,
					episode: w.episode,
					date: null,
					date_precision: "unknown",
					date_note: "No date recorded",
					pass: 1,
					origin: w.origin,
				})),
			} as unknown as Snapshot
		},
		async applyTitleWrite(
			userId,
			_origin,
			name,
			args,
			title,
			_before,
			actionId,
		): Promise<TitleWrite> {
			calls.applyTitleWrite.push(`${name}:${title.media_type}:${title.tmdb_id}`)
			const marks = marksOf(userId, title)
			if (args.title_name === "Explodes") throw new Error("Crate went away")
			if (name === "rate_title") {
				marks.score = args.score ?? null
				marks.not_interested = false
				if (title.media_type === "movie") settleMovie(marks, title.tmdb_id)
			} else if (name === "set_want_to_see") {
				marks.want_to_see = Boolean(args.want_to_see)
			} else if (name === "log_watch") {
				if (title.media_type === "movie") {
					marks.watches.push({
						id: actionId,
						group_id: null,
						origin: "single",
						season: null,
						episode: null,
					})
					marks.want_to_see = false
					settleMovie(marks, title.tmdb_id)
				} else {
					if (!args.whole_season)
						return {
							refused: "An episode watch needs a season and episode number",
						}
					for (let n = 1; n <= 3; n++)
						marks.watches.push({
							id: `${actionId}-${n}`,
							group_id: actionId,
							origin: "season",
							season: args.season ?? 1,
							episode: n,
						})
					marks.status = "watching"
				}
			} else if (name === "set_show_status") {
				if (title.media_type !== "show")
					return { refused: "Only shows have a show status" }
				if (args.status === "Seen") {
					for (let n = 1; n <= 2; n++)
						marks.watches.push({
							id: `${actionId}-${n}`,
							group_id: actionId,
							origin: "press",
							season: 1,
							episode: n,
						})
					marks.status = "seen"
					return { removedWatchId: null, event: "pressSeen" }
				}
				if (args.status === "On hold") {
					marks.status = "on_hold"
					return { removedWatchId: null, event: "hold" }
				}
			}
			return { removedWatchId: null, event: null }
		},
		async wishlistMany({ user_id, titles: list, action }) {
			calls.wishlistMany.push({ action, count: list.length })
			for (const t of list) {
				const marks = marksOf(user_id, t)
				marks.want_to_see = action === "add"
				marks.want_to_see_added_at =
					action === "add"
						? (t.addedAt?.toISOString() ?? "2026-10-18T00:00:00.000Z")
						: null
				if (action === "add") marks.not_interested = false
			}
		},
		async notInterestedMany({ user_id, titles: list, action }) {
			calls.notInterestedMany.push({ action, count: list.length })
			for (const t of list) {
				const marks = marksOf(user_id, t)
				marks.not_interested = action === "add"
				if (action === "add") marks.want_to_see = false
			}
		},
		async deferResets(work) {
			calls.deferred++
			deferring = true
			try {
				return await work()
			} finally {
				deferring = false
			}
		},
		async resetUserData() {
			calls.resets++
			if (deferring) calls.resetsInsideDeferral++
		},
		async markTasteChanged() {
			calls.taste++
		},
		summary,
		async readReceipt(userId, actionId) {
			return receipts.get(`${userId}|${actionId}`)?.result ?? null
		},
		async updateScores({ user_id, tmdb_id, media_type, score }) {
			calls.updateScores.push({ key: `${media_type}:${tmdb_id}`, score })
			const marks = marksOf(user_id, { media_type, tmdb_id })
			marks.score = score
			if (media_type === "movie") settleMovie(marks, tmdb_id)
		},
		async deleteMovieWatch(userId, movieId, watchId) {
			calls.movieDeletes.push(watchId)
			const marks = marksOf(userId, { media_type: "movie", tmdb_id: movieId })
			marks.watches = marks.watches.filter((w) => w.id !== watchId)
			settleMovie(marks, movieId)
			return { status: "applied", refused: null }
		},
		async showEvent(userId, showId, event) {
			calls.showEvents.push(event.type)
			const marks = marksOf(userId, { media_type: "show", tmdb_id: showId })
			if (event.type === "undoGroup")
				marks.watches = marks.watches.filter((w) => w.group_id !== event.group)
			if (event.type === "undoGroup" || event.type === "resume")
				marks.status = marks.watches.length ? "watching" : "not_started"
			if (event.type === "hold") marks.status = "on_hold"
			return { status: "applied", refused: null }
		},
	}
	const set = (userId: string, id: string, values: Partial<Marks>) => {
		const [media_type, raw] = id.split(":")
		Object.assign(marksOf(userId, { media_type, tmdb_id: Number(raw) }), values)
	}
	const get = (userId: string, id: string) => {
		const [media_type, raw] = id.split(":")
		return marksOf(userId, { media_type, tmdb_id: Number(raw) })
	}
	return { ports, calls, set, get, receipts }
}

const write = (
	lib: ReturnType<typeof fakeLibrary>,
	name: Parameters<typeof writeMemberTool>[2],
	args: WriteArgs,
	userId = ME,
) => writeMemberTool(userId, origin, name, args, lib.ports)
const schemaOf = (name: string) => {
	const tool = writeToolDefinitions.find((t) => t.name === name)
	assert.ok(tool)
	return tool.schema
}
type Item = {
	index: number
	status: string
	title?: { id: string; link: string }
	message?: string
	candidates?: { id: string; link: string }[]
	before?: Record<string, unknown>
	after?: Record<string, unknown>
	undo?: { group: string | null; watch_ids: string[]; event: string | null }
}
const itemsOf = (result: Record<string, unknown>) => result.items as Item[]

test("A single-title write keeps its input, receipt and result shape", async () => {
	const input = { action_id: "single-1", title_id: "movie:1001", score: 8 }
	// The schema passes a single call through unchanged, so its receipt hash is the one it always had.
	assert.deepEqual(schemaOf("rate_title").parse(input), input)
	assert.deepEqual(
		schemaOf("log_watch").parse({
			action_id: "s",
			title_id: "show:3001",
			season: 1,
			episode: 2,
		}),
		{ action_id: "s", title_id: "show:3001", season: 1, episode: 2 },
	)
	assert.equal(
		schemaOf("rate_title").safeParse({ action_id: "s", title_id: "movie:1" })
			.success,
		false,
	)
	assert.equal(
		schemaOf("log_watch").safeParse({
			action_id: "s",
			title_id: "show:3001",
			season: 0,
			whole_season: true,
		}).success,
		false,
	)
	const lib = fakeLibrary()
	const result = await write(lib, "rate_title", input)
	assert.equal(result.outcome, "applied")
	assert.equal(result.batch, undefined)
	assert.equal(
		(result.title as { link: string }).link,
		"[Test Movie 1 (2001)](https://goodwatch.test/movie/1001-test-movie-1)",
	)
	assert.equal((result.before as Marks).score, null)
	assert.equal((result.after as Marks).score, 8)
	assert.deepEqual(lib.calls.applyTitleWrite, ["rate_title:movie:1001"])
	assert.equal(lib.calls.deferred, 0)
	const replay = await write(lib, "rate_title", input)
	assert.equal(replay.replayed, true)
	assert.equal(lib.calls.applyTitleWrite.length, 1)
})

test("A batch of 50 Wishlist adds is one multi-row write and one member data reset", async () => {
	const lib = fakeLibrary()
	const items = Array.from({ length: 50 }, (_, i) => ({
		title_id: `movie:${1000 + i}`,
	}))
	const args = { action_id: "batch-50", want_to_see: true, items }
	assert.ok(schemaOf("set_want_to_see").safeParse(args).success)
	const result = await write(lib, "set_want_to_see", args)
	assert.equal(result.outcome, "applied")
	assert.equal(result.batch_id, "batch-50")
	assert.deepEqual(result.summary, {
		total: 50,
		done: 50,
		already_set: 0,
		not_found: 0,
		ambiguous: 0,
		error: 0,
	})
	assert.deepEqual(lib.calls.wishlistMany, [{ action: "add", count: 50 }])
	assert.equal(lib.calls.applyTitleWrite.length, 0)
	assert.equal(lib.calls.titlesById, 1)
	assert.equal(
		lib.calls.userData,
		2,
		"member data is read once before and once after",
	)
	assert.equal(lib.calls.deferred, 1)
	assert.equal(lib.calls.resets, 1)
	for (const [i, item] of itemsOf(result).entries()) {
		assert.equal(item.index, i)
		assert.equal(item.status, "done")
		assert.match(
			item.title?.link ?? "",
			/^\[Test Movie \d+ \(\d{4}\)\]\(https:\/\/goodwatch\.test\/movie\//,
		)
	}
	assert.match(String(result.message), /undo_watch with batch_id "batch-50"/)
})

test("A batch of 50 ratings writes title by title with resets held to one", async () => {
	const lib = fakeLibrary()
	const items = Array.from({ length: 50 }, (_, i) => ({
		title_id: `movie:${1000 + i}`,
		score: (i % 10) + 1,
	}))
	const result = await write(lib, "rate_title", { action_id: "rate-50", items })
	assert.equal((result.summary as { done: number }).done, 50)
	assert.equal(lib.calls.applyTitleWrite.length, 50)
	assert.equal(lib.calls.resets, 1)
	assert.equal(lib.calls.resetsInsideDeferral, 1)
	assert.equal(lib.get(ME, "movie:1009").score, 10)
	// Compact items: what changed, as [before, after], and what undo needs. 50 of them stay small.
	assert.deepEqual(itemsOf(result)[0], {
		index: 0,
		title: {
			id: "movie:1000",
			name: "Test Movie 0",
			year: 2000,
			url: "https://goodwatch.test/movie/1000-test-movie-0",
			link: "[Test Movie 0 (2000)](https://goodwatch.test/movie/1000-test-movie-0)",
		},
		status: "done",
		changes: { score: [null, 1], status: [null, "seen"], watch_count: [0, 1] },
		watches_added: 1,
	})
	assert.ok(JSON.stringify(result).length < 20_000)
})

test("51 items are refused with a message to split, before any write", async () => {
	const items = Array.from({ length: 51 }, (_, i) => ({
		title_id: `movie:${1000 + i}`,
	}))
	const parsed = schemaOf("set_want_to_see").safeParse({
		action_id: "too-many",
		want_to_see: true,
		items,
	})
	assert.equal(parsed.success, false)
	assert.match(
		parsed.error?.issues[0].message ?? "",
		/At most 50 items per call\. Split the list/,
	)
	assert.match(parsed.error?.issues[0].message ?? "", /\/settings\/imports/)
	const lib = fakeLibrary()
	const result = await write(lib, "set_want_to_see", {
		action_id: "too-many",
		want_to_see: true,
		items,
	})
	assert.equal(result.outcome, "refused")
	assert.match(
		String(result.message),
		/Split the list into calls of 50 or fewer.*https:\/\/goodwatch\.test\/settings\/imports/,
	)
	assert.equal(lib.receipts.size, 0, "no receipt is claimed")
	assert.equal(lib.calls.wishlistMany.length, 0)
	assert.equal(
		schemaOf("set_want_to_see").safeParse({
			action_id: "x",
			want_to_see: true,
			items: [],
		}).success,
		false,
	)
	assert.equal(
		schemaOf("set_want_to_see").safeParse({
			action_id: "x",
			title_id: "movie:1",
			want_to_see: true,
			items: [{ title_id: "movie:2" }],
		}).success,
		false,
		"one title or a list, not both",
	)
})

test("Mixed items report each result; not found, ambiguous and invalid items write nothing", async () => {
	const lib = fakeLibrary()
	lib.set(ME, "movie:1003", {
		score: 7,
		watches: [
			{
				id: "score-1003",
				group_id: null,
				origin: "score",
				season: null,
				episode: null,
			},
		],
		status: "seen",
	})
	const items = [
		{ title_id: "movie:1001", score: 9 },
		{ title_name: "Twin" },
		{ title_name: "No Such Film" },
		{ title_id: "movie:1003", score: 7 },
		{ title_id: "movie:999999" },
		{ title_name: "Test Movie 2", year: 2002 },
		{ title_id: "movie:1001", score: 4 },
		{ title_name: "Explodes" },
	]
	const result = await write(lib, "rate_title", {
		action_id: "mixed",
		score: 6,
		items,
	})
	const out = itemsOf(result)
	assert.deepEqual(
		out.map((item) => item.status),
		[
			"done",
			"ambiguous",
			"not_found",
			"already_set",
			"not_found",
			"done",
			"error",
			"not_found",
		],
	)
	assert.equal(result.outcome, "applied")
	assert.deepEqual(result.summary, {
		total: 8,
		done: 2,
		already_set: 1,
		not_found: 3,
		ambiguous: 1,
		error: 1,
	})
	assert.deepEqual(
		out[1].candidates?.map((c) => c.link),
		[
			"[Twin (1999)](https://goodwatch.test/movie/2001-twin)",
			"[Twin (2011)](https://goodwatch.test/movie/2002-twin)",
		],
	)
	assert.match(out[6].message ?? "", /Item 0 already changes this title/)
	// Only the two resolved, new ratings were written; the top-level score filled in item 5.
	assert.deepEqual(lib.calls.applyTitleWrite, [
		"rate_title:movie:1001",
		"rate_title:movie:1002",
	])
	assert.equal(lib.get(ME, "movie:1002").score, 6)
	assert.equal(lib.get(ME, "movie:1001").score, 9)
	assert.equal(lib.get(ME, "movie:2001").score, null)
	assert.equal(lib.get(ME, "movie:2002").score, null)
})

test("An item that fails mid-write is reported as an error and the others are still written", async () => {
	const lib = fakeLibrary()
	// "Explodes" resolves when it is in the catalog: put it there by name through the fake resolver.
	const resolve = lib.ports.resolve
	lib.ports.resolve = async (selector, o) =>
		selector.title_name === "Explodes"
			? {
					title: {
						media_type: "movie",
						tmdb_id: 1040,
						title: "Explodes",
						release_year: 2020,
					},
				}
			: resolve(selector, o)
	const result = await write(lib, "rate_title", {
		action_id: "partial",
		score: 5,
		items: [
			{ title_id: "movie:1001" },
			{ title_name: "Explodes" },
			{ title_id: "movie:1002" },
		],
	})
	assert.deepEqual(
		itemsOf(result).map((i) => i.status),
		["done", "error", "done"],
	)
	assert.match(itemsOf(result)[1].message ?? "", /Could not confirm/)
	assert.equal(lib.get(ME, "movie:1002").score, 5)
	assert.equal(lib.calls.resets, 1)
})

test("Not interested batches refuse seen or rated titles per item and write the rest in one statement", async () => {
	const lib = fakeLibrary()
	lib.set(ME, "movie:1005", { score: 6 })
	const result = await write(lib, "set_not_interested", {
		action_id: "hide",
		not_interested: true,
		items: [
			{ title_id: "movie:1004" },
			{ title_id: "movie:1005" },
			{ title_id: "show:3001" },
		],
	})
	assert.deepEqual(
		itemsOf(result).map((i) => i.status),
		["done", "error", "done"],
	)
	assert.match(
		itemsOf(result)[1].message ?? "",
		/only available before watching or rating/,
	)
	assert.deepEqual(lib.calls.notInterestedMany, [{ action: "add", count: 2 }])
	assert.equal(lib.get(ME, "movie:1005").not_interested, false)
})

test("Invalid items are per-item errors with the single call's own validation", async () => {
	const lib = fakeLibrary()
	const result = await write(lib, "log_watch", {
		action_id: "logs",
		items: [
			{ title_id: "show:3001", season: 1, whole_season: true },
			{ title_id: "show:3002", season: 0, whole_season: true },
			{ title_id: "movie:1010" },
		],
	})
	assert.deepEqual(
		itemsOf(result).map((i) => i.status),
		["done", "error", "done"],
	)
	assert.match(
		itemsOf(result)[1].message ?? "",
		/A whole season needs a regular season/,
	)
	assert.equal(lib.get(ME, "show:3001").watches.length, 3)
})

test("undo_watch with batch_id takes back the member's own batch and keeps newer changes", async () => {
	const lib = fakeLibrary()
	lib.set(ME, "movie:1002", {
		score: 5,
		status: "seen",
		watches: [
			{
				id: "score-1002",
				group_id: null,
				origin: "score",
				season: null,
				episode: null,
			},
		],
	})
	lib.set(ME, "movie:1010", {
		want_to_see: true,
		want_to_see_added_at: "2026-01-02T03:04:05.000Z",
	})
	await write(lib, "rate_title", {
		action_id: "rate-3",
		items: [
			{ title_id: "movie:1001", score: 8 },
			{ title_id: "movie:1002", score: 9 },
			{ title_id: "movie:1003", score: 3 },
		],
	})
	// The member rates one of them again after the batch: undo leaves that newer score.
	lib.set(ME, "movie:1003", { score: 10 })
	const logged = await write(lib, "log_watch", {
		action_id: "log-2",
		items: [
			{ title_id: "movie:1010" },
			{ title_id: "show:3001", season: 1, whole_season: true },
		],
	})
	assert.equal(lib.get(ME, "movie:1010").want_to_see, false)
	assert.ok(itemsOf(logged)[1].undo?.group)

	// Another member can't see or undo this member's batch.
	const foreign = await write(
		lib,
		"undo_watch",
		{ action_id: "steal", batch_id: "rate-3" },
		OTHER,
	)
	assert.equal(foreign.outcome, "refused")
	assert.match(String(foreign.message), /No batch with this batch_id/)
	assert.equal(lib.get(ME, "movie:1001").score, 8)

	const undone = await write(lib, "undo_watch", {
		action_id: "undo-rate",
		batch_id: "rate-3",
	})
	assert.equal(undone.outcome, "applied")
	assert.deepEqual(
		itemsOf(undone).map((i) => i.status),
		["undone", "undone", "changed_since"],
	)
	assert.equal(lib.get(ME, "movie:1001").score, null)
	assert.equal(lib.get(ME, "movie:1002").score, 5)
	assert.equal(lib.get(ME, "movie:1003").score, 10)
	assert.equal(
		lib.calls.resetsInsideDeferral,
		3,
		"one reset per batch and per undo",
	)

	const undoneLog = await write(lib, "undo_watch", {
		action_id: "undo-log",
		batch_id: "log-2",
	})
	assert.deepEqual(
		itemsOf(undoneLog).map((i) => i.status),
		["undone", "undone"],
	)
	assert.deepEqual(lib.get(ME, "movie:1010").watches, [])
	assert.equal(lib.get(ME, "movie:1010").want_to_see, true)
	assert.equal(
		lib.get(ME, "movie:1010").want_to_see_added_at,
		"2026-01-02T03:04:05.000Z",
		"back at its old place",
	)
	assert.deepEqual(lib.get(ME, "show:3001").watches, [])
	assert.ok(lib.calls.showEvents.includes("undoGroup"))

	// A batch is undone once: a later undo, under any action_id, replays the first one. So re-rating a title by
	// hand after the undo can't be taken back by undoing the batch again.
	lib.set(ME, "movie:1001", { score: 8 })
	const scoresBefore = lib.calls.updateScores.length
	const again = await write(lib, "undo_watch", {
		action_id: "undo-rate-2",
		batch_id: "rate-3",
	})
	assert.equal(again.replayed, true)
	assert.deepEqual(
		itemsOf(again).map((i) => i.status),
		["undone", "undone", "changed_since"],
	)
	assert.equal(lib.calls.updateScores.length, scoresBefore)
	assert.equal(lib.get(ME, "movie:1001").score, 8)
	await write(lib, "rate_title", {
		action_id: "one",
		title_id: "movie:1020",
		score: 4,
	})
	const single = await write(lib, "undo_watch", {
		action_id: "undo-one",
		batch_id: "one",
	})
	assert.equal(single.outcome, "refused")
	assert.match(String(single.message), /not a batch/)
})

test("undo_watch takes either a title or a batch_id", () => {
	const schema = schemaOf("undo_watch")
	assert.ok(schema.safeParse({ action_id: "u", title_id: "movie:1" }).success)
	assert.ok(
		schema.safeParse({ action_id: "u", title_id: "movie:1", watch_id: "w" })
			.success,
	)
	assert.ok(schema.safeParse({ action_id: "u", batch_id: "b" }).success)
	assert.equal(
		schema.safeParse({ action_id: "u", batch_id: "b", title_id: "movie:1" })
			.success,
		false,
	)
	assert.equal(schema.safeParse({ action_id: "u" }).success, false)
	assert.deepEqual(schema.parse({ action_id: "u", title_id: "movie:1" }), {
		action_id: "u",
		title_id: "movie:1",
	})
})

test("Show status batches undo a Seen press through its group and On hold through resume", async () => {
	const lib = fakeLibrary()
	lib.set(ME, "show:3002", {
		status: "watching",
		watches: [
			{ id: "w1", group_id: null, origin: "single", season: 1, episode: 1 },
		],
	})
	const result = await write(lib, "set_show_status", {
		action_id: "status",
		items: [
			{ title_id: "show:3001", status: "Seen" },
			{ title_id: "show:3002", status: "On hold" },
			{ title_id: "movie:1001", status: "Seen" },
		],
	})
	assert.deepEqual(
		itemsOf(result).map((i) => i.status),
		["done", "done", "error"],
	)
	assert.equal(itemsOf(result)[1].undo?.event, "hold")
	const undone = await write(lib, "undo_watch", {
		action_id: "undo-status",
		batch_id: "status",
	})
	assert.deepEqual(
		itemsOf(undone).map((i) => i.status),
		["undone", "undone"],
	)
	assert.equal(lib.get(ME, "show:3001").status, "not_started")
	assert.equal(lib.get(ME, "show:3002").status, "watching")
	assert.deepEqual(lib.calls.showEvents, ["undoGroup", "resume"])
})

test("Every batch tool's item schema is its single-call schema", () => {
	for (const name of [
		"rate_title",
		"set_want_to_see",
		"set_not_interested",
		"set_show_status",
		"log_watch",
	] as const)
		assert.ok(itemSchemas[name])
})

test("A write that fails part way but landed is reported done, with undo data", async () => {
	const lib = fakeLibrary()
	const apply = lib.ports.applyTitleWrite
	lib.ports.applyTitleWrite = async (...args) => {
		await apply(...args)
		throw new Error("setGroupDate failed")
	}
	const result = await write(lib, "log_watch", {
		action_id: "half",
		items: [{ title_id: "show:3001", season: 1, whole_season: true }],
	})
	const [item] = itemsOf(result)
	assert.equal(item.status, "done")
	assert.match(item.message ?? "", /failed part way; these changes landed/)
	assert.ok(item.undo?.group)
	const undone = await write(lib, "undo_watch", {
		action_id: "u",
		batch_id: "half",
	})
	assert.deepEqual(
		itemsOf(undone).map((i) => i.status),
		["undone"],
	)
	assert.deepEqual(lib.get(ME, "show:3001").watches, [])
})

test("Undo puts Not interested back only on a title that is still unrated and unwatched", async () => {
	const lib = fakeLibrary()
	lib.set(ME, "movie:1001", { not_interested: true })
	lib.set(ME, "movie:1002", { not_interested: true })
	await write(lib, "set_not_interested", {
		action_id: "unhide",
		not_interested: false,
		items: [{ title_id: "movie:1001" }, { title_id: "movie:1002" }],
	})
	// The member watches one of them since: hiding it again would break the single tool's rule.
	lib.set(ME, "movie:1002", {
		status: "seen",
		watches: [
			{
				id: "w",
				group_id: null,
				origin: "single",
				season: null,
				episode: null,
			},
		],
	})
	const undone = await write(lib, "undo_watch", {
		action_id: "u",
		batch_id: "unhide",
	})
	assert.deepEqual(
		itemsOf(undone).map((i) => i.status),
		["undone", "not_undoable"],
	)
	assert.equal(lib.get(ME, "movie:1001").not_interested, true)
	assert.equal(lib.get(ME, "movie:1002").not_interested, false)
})

test("An undo with nothing to take back makes no reset and no taste rebuild", async () => {
	const lib = fakeLibrary()
	await write(lib, "set_want_to_see", {
		action_id: "w",
		want_to_see: true,
		items: [{ title_id: "movie:1001" }],
	})
	lib.set(ME, "movie:1001", { want_to_see: false })
	const resets = lib.calls.resets
	const taste = lib.calls.taste
	const undone = await write(lib, "undo_watch", {
		action_id: "u",
		batch_id: "w",
	})
	assert.deepEqual(
		itemsOf(undone).map((i) => i.status),
		["already_undone"],
	)
	assert.equal(lib.calls.resets, resets)
	assert.equal(lib.calls.taste, taste)
})

// Discord's adapter uses the real writeMemberTool/runBatch/undoBatch pipeline.
for (const [name, fields] of [
	["rate_title", { score: 9 }],
	["set_want_to_see", { want_to_see: true }],
	["log_watch", { date: "2026-10-23" }],
] as const) {
	test(`Discord ${name}: batch of one, receipt replay, owner-only undo and restored state`, async () => {
		const { createDiscordWriter } = await import("../discord/writes.server.ts")
		const lib = fakeLibrary()
		const titleId = "movie:1001"
		const before = structuredClone(lib.get(ME, titleId))
		let budgetCost = 0
		const discord = createDiscordWriter({
			receipt: lib.ports.readReceipt,
			take: async (_user, windows, cost) => {
				assert.deepEqual(windows, [
					{ limit: 300, seconds: 60 },
					{ limit: 2000, seconds: 3600 },
				])
				budgetCost += cost
				return { allowed: true, store: "memory" }
			},
			write: (userId, origin, tool, args) =>
				writeMemberTool(userId, origin, tool, args, lib.ports),
		})
		const args = {
			action_id: "123456789",
			items: [{ title_id: titleId, ...fields }],
		}
		const result = await discord(ME, origin, name, args)
		assert.equal(result.outcome, "applied")
		assert.equal(result.batch_id, args.action_id)
		assert.equal(result.batch, true)
		const after = structuredClone(lib.get(ME, titleId))
		assert.notDeepEqual(after, before)
		// A Want toggle computed from current state must still replay on an interaction retry.
		const replay = await discord(
			ME,
			origin,
			name,
			name === "set_want_to_see"
				? { ...args, items: [{ title_id: titleId, want_to_see: false }] }
				: args,
		)
		assert.deepEqual(replay, result)
		assert.deepEqual(lib.get(ME, titleId), after)
		assert.equal(budgetCost, 1)
		const undoArgs = { action_id: "987654321", batch_id: args.action_id }
		const foreign = await discord(OTHER, origin, "undo_watch", undoArgs)
		assert.equal(
			foreign.message,
			"Only the person who made this change can undo it.",
		)
		assert.deepEqual(lib.get(ME, titleId), after)
		const undone = await discord(ME, origin, "undo_watch", undoArgs)
		assert.equal(undone.outcome, "applied")
		assert.deepEqual(lib.get(ME, titleId), before)
		assert.equal(budgetCost, 2) // one write plus an undo charged at the receipt's one item
		await discord(ME, origin, "undo_watch", {
			...undoArgs,
			action_id: "another-undo",
		})
		assert.deepEqual(lib.get(ME, titleId), before)
	})
}
