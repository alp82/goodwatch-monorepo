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
	/** When the watch was recorded, in milliseconds. */
	created_at?: number
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
		partScores: [] as { key: string; score: number | null }[],
		scoreWatchRemovals: [] as string[],
	}
	/** Season and episode scores, apart from the title's own score: `user|show:id|<store key>`. */
	const parts = new Map<string, number>()
	/** TMDB episode ids by `show|season|episode`; renumbering moves an id to new coordinates. */
	const episodeIds = new Map<string, number>()
	const idOf = (showId: number, season: number, episode: number) =>
		episodeIds.get(`${showId}|${season}|${episode}`) ?? season * 100 + episode
	/** The part's key as user_episode_score has it: "s<season>", or "e<TMDB episode id>". */
	const storeKey = (
		showId: number,
		part: { season: number; episode?: number },
	) =>
		part.episode === undefined
			? `s${part.season}`
			: `e${idOf(showId, part.season, part.episode)}`
	/** Each part score's version: the time its last write stamped, as user_episode_score keeps it. */
	const stamps = new Map<string, string>()
	let clock = 0
	const stamp = () =>
		new Date(Date.UTC(2026, 9, 24, 0, 0, 0, ++clock)).toISOString()
	/** Runs right after a batch writes a part score, as another tab changing it at that moment would. */
	const hooks: {
		afterPartWrite: (() => void) | null
		/** The part write lands, then the call fails, so no record of the write comes back. */
		failAfterPartWrite: boolean
	} = { afterPartWrite: null, failAfterPartWrite: false }
	const partKey = (
		userId: string,
		showId: number,
		part: { season: number; episode?: number },
	) => `${userId}|show:${showId}|${storeKey(showId, part)}`
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
		async snapshot(userId, title, _user, part) {
			const marks = marksOf(userId, title)
			return {
				...(part
					? {
							part_score:
								parts.get(partKey(userId, title.tmdb_id, part)) ?? null,
						}
					: {}),
				status: marks.status,
				pass: title.media_type === "show" ? 1 : null,
				score: marks.score,
				review: null,
				want_to_see: marks.want_to_see,
				want_to_see_added_at: marks.want_to_see_added_at as never,
				not_interested: marks.not_interested,
				watches: marks.watches.map((w) => ({
					id: w.id,
					record_created_at: new Date(
						w.created_at ?? Date.UTC(2026, 9, 1),
					).toISOString(),
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
			if (name === "rate_title" && args.season !== undefined) {
				if (title.media_type !== "show")
					return { refused: "A movie has no seasons or episodes." }
				const key = partKey(userId, title.tmdb_id, {
					season: args.season,
					episode: args.episode,
				})
				let updatedAt: string | null = null
				if (args.score == null) {
					parts.delete(key)
					stamps.delete(key)
				} else {
					parts.set(key, args.score)
					updatedAt = stamp()
					stamps.set(key, updatedAt)
				}
				// Scoring an episode no pass has a watch of marks it watched (#759 follow-up).
				let watchAdded: { id: string; created_at: number } | undefined
				if (
					args.episode !== undefined &&
					args.score != null &&
					!marks.watches.some(
						(w) => w.season === args.season && w.episode === args.episode,
					)
				) {
					watchAdded = {
						id: `score-e${idOf(title.tmdb_id, args.season, args.episode)}`,
						created_at: Date.UTC(2026, 9, 24) + ++clock,
					}
					marks.watches.push({
						id: watchAdded.id,
						group_id: null,
						origin: "score",
						season: args.season,
						episode: args.episode,
						created_at: watchAdded.created_at,
					})
					marks.status = "watching"
				}
				hooks.afterPartWrite?.()
				if (hooks.failAfterPartWrite) throw new Error("Read-back failed")
				return {
					removedWatchId: null,
					event: null,
					...(watchAdded ? { watch_added: watchAdded } : {}),
					part_written: {
						key: storeKey(title.tmdb_id, {
							season: args.season,
							episode: args.episode,
						}),
						score: args.score ?? null,
						updatedAt,
					},
				}
			} else if (name === "rate_title") {
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
		async restorePartScore({ user_id, tmdb_id, key: part, expected, score }) {
			const key = `${user_id}|show:${tmdb_id}|${part}`
			const now = parts.get(key)
			if (score === null ? now === undefined : now === score) return "already"
			if (now !== expected.score || stamps.get(key) !== expected.updatedAt)
				return "changed"
			calls.partScores.push({ key, score })
			if (score === null) {
				parts.delete(key)
				stamps.delete(key)
			} else {
				parts.set(key, score)
				stamps.set(key, stamp())
			}
			return "restored"
		},
		async removeEpisodeScoreWatch({ user_id, tmdb_id, watch_id, created_at }) {
			const marks = marksOf(user_id, { media_type: "show", tmdb_id })
			const watch = marks.watches.find((w) => w.id === watch_id)
			if (!watch || watch.origin !== "score" || watch.created_at !== created_at)
				return false
			calls.scoreWatchRemovals.push(watch_id)
			marks.watches = marks.watches.filter((w) => w !== watch)
			marks.status = marks.watches.length ? "watching" : "not_started"
			return true
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
			if (event.type === "deleteWatch")
				marks.watches = marks.watches.filter((w) => w.id !== event.watchId)
			if (
				event.type === "undoGroup" ||
				event.type === "resume" ||
				event.type === "deleteWatch"
			)
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
	const part = (
		userId: string,
		showId: number,
		season: number,
		episode?: number,
	) => parts.get(partKey(userId, showId, { season, episode })) ?? null
	const setPart = (
		userId: string,
		showId: number,
		season: number,
		episode: number | undefined,
		score: number | null,
	) => {
		const key = partKey(userId, showId, { season, episode })
		if (score === null) {
			parts.delete(key)
			stamps.delete(key)
		} else {
			parts.set(key, score)
			stamps.set(key, stamp())
		}
	}
	/** TMDB renumbers an episode: its id moves to new coordinates, and a new episode takes the old place. */
	const renumber = (
		showId: number,
		season: number,
		from: number,
		to: number,
	) => {
		const id = idOf(showId, season, from)
		episodeIds.set(`${showId}|${season}|${to}`, id)
		episodeIds.set(`${showId}|${season}|${from}`, 9000 + from)
	}
	return { ports, calls, set, get, receipts, part, setPart, hooks, renumber }
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

test("rate_title with a season, or a season and episode, scores only that part of a show (#759)", async () => {
	const rate = schemaOf("rate_title")
	assert.ok(
		rate.safeParse({
			action_id: "p",
			title_id: "show:3001",
			season: 1,
			episode: 2,
			score: 9,
		}).success,
	)
	for (const bad of [
		{ episode: 2 },
		{ season: 0 },
		{ season: 1, episode: 0 },
		{ season: 1.5 },
	])
		assert.equal(
			rate.safeParse({
				action_id: "p",
				title_id: "show:3001",
				score: 9,
				...bad,
			}).success,
			false,
			JSON.stringify(bad),
		)
	const lib = fakeLibrary()
	lib.set(ME, "show:3001", { score: 6 })
	const input = {
		action_id: "part-1",
		title_id: "show:3001",
		season: 1,
		episode: 2,
		score: 9,
	}
	const result = await write(lib, "rate_title", input)
	assert.equal(result.outcome, "applied")
	assert.equal(result.part, "S1 E2")
	assert.equal((result.before as { part_score: unknown }).part_score, null)
	assert.equal((result.after as { part_score: unknown }).part_score, 9)
	// The show's own score stays and taste is not marked changed. The episode is marked watched, with the score's
	// undated watch (#759 follow-up), and the result says so.
	assert.equal(lib.get(ME, "show:3001").score, 6)
	assert.equal((result.after as Marks).score, 6)
	assert.deepEqual(
		lib.get(ME, "show:3001").watches.map((w) => [w.id, w.origin]),
		[["score-e102", "score"]],
	)
	assert.deepEqual(
		(
			result.changes as { watches_added: { id: string }[] }
		).watches_added.map((w) => w.id),
		["score-e102"],
	)
	assert.equal(lib.part(ME, 3001, 1, 2), 9)
	assert.equal(lib.calls.taste, 0)
	const replay = await write(lib, "rate_title", input)
	assert.equal(replay.replayed, true)
	assert.equal(lib.calls.applyTitleWrite.length, 1)
	const season = await write(lib, "rate_title", {
		action_id: "part-2",
		title_id: "show:3001",
		season: 1,
		score: 7,
	})
	assert.equal(season.part, "Season 1")
	assert.equal(lib.part(ME, 3001, 1), 7)
	assert.equal(lib.part(ME, 3001, 1, 2), 9)
	const cleared = await write(lib, "rate_title", {
		action_id: "part-3",
		title_id: "show:3001",
		season: 1,
		score: null,
	})
	assert.equal(cleared.outcome, "applied")
	assert.equal(lib.part(ME, 3001, 1), null)
	// Without a season the call rates the whole show, as before.
	await write(lib, "rate_title", {
		action_id: "whole",
		title_id: "show:3001",
		score: 8,
	})
	assert.equal(lib.get(ME, "show:3001").score, 8)
	assert.equal(lib.part(ME, 3001, 1, 2), 9)
})

test("A rate_title batch scores several episodes of one show, refuses the same part twice, and undoes only what it changed", async () => {
	const lib = fakeLibrary()
	lib.setPart(ME, 3001, 1, 3, 4)
	const result = await write(lib, "rate_title", {
		action_id: "parts-batch",
		items: [
			{ title_id: "show:3001", season: 1, episode: 1, score: 8 },
			{ title_id: "show:3001", season: 1, episode: 2, score: 9 },
			{ title_id: "show:3001", season: 1, episode: 2, score: 5 },
			{ title_id: "show:3001", season: 1, episode: 3, score: 4 },
			{ title_id: "show:3001", score: 7 },
			{ title_id: "show:3002", season: 2, score: 6 },
		],
	})
	assert.deepEqual(
		itemsOf(result).map((item) => item.status),
		["done", "done", "error", "already_set", "done", "done"],
	)
	assert.deepEqual(
		(itemsOf(result)[1] as unknown as { changes: unknown }).changes,
		{ part_score: [null, 9] },
	)
	assert.equal(
		(itemsOf(result)[1] as unknown as { part: unknown }).part,
		"S1 E2",
	)
	assert.equal(lib.get(ME, "show:3001").score, 7)
	assert.equal(lib.part(ME, 3001, 1, 2), 9)
	assert.equal(lib.part(ME, 3002, 2), 6)
	// The whole-show score marks taste changed; the part scores alone would not.
	assert.equal(lib.calls.taste, 1)
	// The member changes one part again after the batch: undo keeps it.
	lib.setPart(ME, 3001, 1, 1, 2)
	const undone = await write(lib, "undo_watch", {
		action_id: "undo-parts",
		batch_id: "parts-batch",
	})
	assert.deepEqual(
		(undone.items as { index: number; status: string; kept?: string[] }[]).map(
			(item) => [item.index, item.status, item.kept],
		),
		[
			[0, "changed_since", ["part_score"]],
			[1, "undone", undefined],
			[4, "undone", undefined],
			[5, "undone", undefined],
		],
	)
	assert.equal(lib.part(ME, 3001, 1, 1), 2)
	assert.equal(lib.part(ME, 3001, 1, 2), null)
	assert.equal(lib.part(ME, 3001, 1, 3), 4)
	assert.equal(lib.part(ME, 3002, 2), null)
	assert.equal(lib.get(ME, "show:3001").score, null)
	assert.deepEqual(lib.calls.partScores, [
		{ key: `${ME}|show:3001|e102`, score: null },
		{ key: `${ME}|show:3002|s2`, score: null },
	])
})

test("A batch's Undo of episode scores removes the watches those scores recorded, and no other (#759 follow-up)", async () => {
	const lib = fakeLibrary()
	// The member ticked S1 E1 before the batch.
	lib.set(ME, "show:3001", {
		status: "watching",
		watches: [
			{ id: "tick-1", group_id: null, origin: "single", season: 1, episode: 1 },
		],
	})
	const result = await write(lib, "rate_title", {
		action_id: "score-watches",
		items: [
			{ title_id: "show:3001", season: 1, episode: 1, score: 8 },
			{ title_id: "show:3001", season: 1, episode: 2, score: 9 },
			{ title_id: "show:3001", season: 1, episode: 3, score: 7 },
			{ title_id: "show:3001", season: 2, score: 6 },
		],
	})
	assert.deepEqual(
		itemsOf(result).map((item) => [
			item.status,
			(item.undo as { score_watch?: { id: string } } | undefined)?.score_watch
				?.id,
		]),
		[
			["done", undefined],
			["done", "score-e102"],
			["done", "score-e103"],
			["done", undefined],
		],
	)
	// The member dates S1 E3's watch: it's theirs now, as on the site.
	const dated = lib
		.get(ME, "show:3001")
		.watches.find((w) => w.id === "score-e103")
	assert.ok(dated)
	dated.origin = "single"
	const undone = await write(lib, "undo_watch", {
		action_id: "undo-score-watches",
		batch_id: "score-watches",
	})
	assert.deepEqual(
		(undone.items as { index: number; status: string; kept?: string[] }[]).map(
			(item) => [item.index, item.status, item.kept],
		),
		[
			[0, "undone", undefined],
			[1, "undone", undefined],
			[2, "partly_undone", ["watch"]],
			[3, "undone", undefined],
		],
	)
	assert.deepEqual(lib.calls.scoreWatchRemovals, ["score-e102"])
	assert.deepEqual(lib.calls.showEvents, [])
	assert.deepEqual(
		lib.get(ME, "show:3001").watches.map((w) => w.id),
		["tick-1", "score-e103"],
	)
	assert.deepEqual(
		[1, 2, 3].map((episode) => lib.part(ME, 3001, 1, episode)),
		[null, null, null],
	)
})

test("A batch's Undo leaves the watch of a score the member cleared and gave again since, though it has the same id (#759 review)", async () => {
	const lib = fakeLibrary()
	await write(lib, "rate_title", {
		action_id: "score-again",
		items: [{ title_id: "show:3001", season: 1, episode: 2, score: 9 }],
	})
	// The member clears the score and scores the episode again: a new watch under the same id.
	await write(lib, "rate_title", {
		action_id: "clear-it",
		title_id: "show:3001",
		season: 1,
		episode: 2,
		score: null,
	})
	const marks = lib.get(ME, "show:3001")
	marks.watches = marks.watches.filter((w) => w.id !== "score-e102")
	await write(lib, "rate_title", {
		action_id: "score-it-again",
		title_id: "show:3001",
		season: 1,
		episode: 2,
		score: 7,
	})
	const replacement = lib
		.get(ME, "show:3001")
		.watches.find((w) => w.id === "score-e102")
	assert.ok(replacement)
	const undone = await write(lib, "undo_watch", {
		action_id: "undo-score-again",
		batch_id: "score-again",
	})
	assert.deepEqual(
		(undone.items as { status: string; kept?: string[] }[]).map((item) => [
			item.status,
			item.kept,
		]),
		[["changed_since", ["watch", "part_score"]]],
	)
	assert.deepEqual(lib.calls.scoreWatchRemovals, [])
	assert.deepEqual(
		lib.get(ME, "show:3001").watches.map((w) => [w.id, w.created_at]),
		[["score-e102", replacement.created_at]],
	)
})

test("A part score names an aired season or episode of a show in TMDB's numbering, and says why it can't", async () => {
	const { writePartScore, readPartScore, restorePartScore } = await import(
		"./title-write.server.ts"
	)
	const { EpisodeScoresUnavailable } = await import(
		"../episode-scores.server.ts"
	)
	const day = Date.UTC(2026, 9, 1)
	const sets: unknown[] = []
	const asked: string[] = []
	const restores: unknown[] = []
	const refusal = (answer: { refused: string } | { written: unknown }) =>
		"refused" in answer ? answer.refused : ""
	let unavailable = false
	const deps = {
		episodes: async () => [
			{ tmdb_id: 501, season_number: 1, episode_number: 1, air_date: day },
			{ tmdb_id: 502, season_number: 1, episode_number: 2, air_date: day },
			{
				tmdb_id: 601,
				season_number: 2,
				episode_number: 1,
				air_date: Date.UTC(2027, 0, 1),
			},
		],
		// Read by its whole key: Crate answers that at once, also right after a write (#759 review).
		score: async (_user: string, _show: number, key: string) => {
			asked.push(key)
			return key === "e502"
				? {
						scope: "episode" as const,
						key: "e502",
						season: 1,
						episode: 2,
						episodeTmdbId: 502,
						score: 6,
						label: null,
						updatedAt: "",
					}
				: null
		},
		set: (async (
			_user: string,
			_show: number,
			target: unknown,
			score: unknown,
		) => {
			if (unavailable) throw new EpisodeScoresUnavailable()
			sets.push([target, score])
			return {
				status: "saved",
				score: { score, updatedAt: "2026-10-24T00:00:00.000Z" },
				previous: null,
			}
		}) as never,
		restore: (async (
			_user: string,
			_show: number,
			target: unknown,
			expected: unknown,
			score: unknown,
		) => {
			restores.push([target, expected, score])
			return "restored"
		}) as never,
		now: () => Date.UTC(2026, 9, 24),
	}
	const show = { media_type: "show" as const, tmdb_id: 3001 }
	// The write answers with what it left: its score and the time it stamped.
	assert.deepEqual(
		await writePartScore("m", show, { season: 1, episode: 2 }, 9, deps),
		{
			written: { key: "e502", score: 9, updatedAt: "2026-10-24T00:00:00.000Z" },
		},
	)
	assert.deepEqual(await writePartScore("m", show, { season: 1 }, 8, deps), {
		written: { key: "s1", score: 8, updatedAt: "2026-10-24T00:00:00.000Z" },
	})
	assert.deepEqual(sets, [
		[{ scope: "episode", episodeTmdbId: 502 }, 9],
		[{ scope: "season", season: 1 }, 8],
	])
	assert.match(
		refusal(
			await writePartScore("m", show, { season: 1, episode: 9 }, 5, deps),
		),
		/no such episode/,
	)
	assert.match(
		refusal(
			await writePartScore("m", show, { season: 2, episode: 1 }, 5, deps),
		),
		/hasn't aired/,
	)
	assert.match(
		refusal(await writePartScore("m", show, { season: 2 }, 5, deps)),
		/no aired episodes/,
	)
	assert.match(
		refusal(
			await writePartScore(
				"m",
				{ media_type: "movie", tmdb_id: 1000 },
				{ season: 1 },
				5,
				deps,
			),
		),
		/movie has no seasons/,
	)
	unavailable = true
	assert.match(
		refusal(await writePartScore("m", show, { season: 1 }, 5, deps)),
		/aren't available yet/,
	)
	assert.equal(sets.length, 2)
	assert.equal(
		await readPartScore("m", show, { season: 1, episode: 2 }, deps),
		6,
	)
	assert.equal(await readPartScore("m", show, { season: 1 }, deps), null)
	assert.equal(
		await readPartScore("m", show, { season: 1, episode: 9 }, deps),
		null,
	)
	assert.deepEqual(asked, ["e502", "s1"])
	// Undo goes by the part's key, never by season and episode again, and hands the store what the write left.
	const left = { score: 9, updatedAt: "2026-10-24T00:00:00.000Z" }
	unavailable = false
	assert.equal(
		await restorePartScore("m", show, "e601", left, 4, deps),
		"restored",
	)
	assert.deepEqual(restores, [["e601", left, 4]])
	assert.match(
		(
			(await restorePartScore(
				"m",
				{ media_type: "movie", tmdb_id: 1000 },
				"s1",
				left,
				4,
				deps,
			)) as { refused: string }
		).refused,
		/movie has no seasons/,
	)
})

test("A batch's receipt keeps what its part write set, and Undo leaves a change made right after it (#759 review)", async () => {
	const lib = fakeLibrary()
	lib.setPart(ME, 3001, 1, 2, 4)
	// Another tab clears the score between the batch's write and its read-back.
	lib.hooks.afterPartWrite = () => lib.setPart(ME, 3001, 1, 2, null)
	const result = await write(lib, "rate_title", {
		action_id: "part-race",
		items: [{ title_id: "show:3001", season: 1, episode: 2, score: 8 }],
	})
	lib.hooks.afterPartWrite = null
	const [item] = itemsOf(result) as unknown as {
		status: string
		changes: unknown
		part_written: { score: number; updatedAt: string }
	}[]
	assert.equal(item.status, "done")
	// What the batch's own write did, not what the other tab left.
	assert.deepEqual(item.changes, { part_score: [4, 8] })
	assert.equal(item.part_written.score, 8)
	const undone = await write(lib, "undo_watch", {
		action_id: "undo-part-race",
		batch_id: "part-race",
	})
	assert.deepEqual(
		(
			undone.items as { status: string; kept?: string[]; message?: string }[]
		).map((each) => [each.status, each.kept, each.message]),
		[
			[
				"changed_since",
				["part_score"],
				"Changed again since the batch, so kept as it is now.",
			],
		],
	)
	// The clear stays: Undo doesn't put 4 back over it.
	assert.equal(lib.part(ME, 3001, 1, 2), null)
	assert.deepEqual(lib.calls.partScores, [])
})

test("Undo of a batch part score leaves the same score set again elsewhere, and takes back its own", async () => {
	const lib = fakeLibrary()
	lib.setPart(ME, 3001, 1, 1, 3)
	await write(lib, "rate_title", {
		action_id: "part-own",
		items: [
			{ title_id: "show:3001", season: 1, episode: 1, score: 8 },
			{ title_id: "show:3001", season: 1, episode: 2, score: 9 },
		],
	})
	// The member sets episode 1 to 8 again on another page: that's theirs now.
	lib.setPart(ME, 3001, 1, 1, 8)
	const undone = await write(lib, "undo_watch", {
		action_id: "undo-part-own",
		batch_id: "part-own",
	})
	assert.deepEqual(
		(undone.items as { status: string }[]).map((each) => each.status),
		["changed_since", "undone"],
	)
	assert.equal(lib.part(ME, 3001, 1, 1), 8)
	assert.equal(lib.part(ME, 3001, 1, 2), null)
})

const undoItems = (undone: Record<string, unknown>) =>
	(
		undone.items as {
			status: string
			kept?: string[]
			notes?: string[]
		}[]
	).map((each) => [each.status, each.kept ?? null, each.notes ?? null])

test("Undo doesn't offer to put back a part score the batch cleared, and the receipt says so (#759 review)", async () => {
	const lib = fakeLibrary()
	lib.setPart(ME, 3001, 1, 2, 4)
	const result = await write(lib, "rate_title", {
		action_id: "part-clear",
		items: [{ title_id: "show:3001", season: 1, episode: 2, score: null }],
	})
	const [item] = itemsOf(result) as unknown as {
		status: string
		changes: unknown
		part_written?: unknown
		undo_note?: string
	}[]
	assert.equal(item.status, "done")
	assert.deepEqual(item.changes, { part_score: [4, null] })
	assert.equal(item.part_written, undefined)
	assert.match(item.undo_note ?? "", /can't put back a cleared/)
	// Another tab sets 9, then clears it: Undo must not bring back 4.
	lib.setPart(ME, 3001, 1, 2, 9)
	lib.setPart(ME, 3001, 1, 2, null)
	const undone = await write(lib, "undo_watch", {
		action_id: "undo-part-clear",
		batch_id: "part-clear",
	})
	assert.deepEqual(undoItems(undone), [
		[
			"not_undoable",
			null,
			[
				"Undo can't put back a cleared season or episode score. Set it again with rate_title.",
			],
		],
	])
	assert.equal(lib.part(ME, 3001, 1, 2), null)
	assert.deepEqual(lib.calls.partScores, [])
})

test("Undo doesn't offer to put back a part score whose write wasn't confirmed (#759 review)", async () => {
	const lib = fakeLibrary()
	lib.setPart(ME, 3001, 1, 2, 4)
	lib.hooks.failAfterPartWrite = true
	const result = await write(lib, "rate_title", {
		action_id: "part-unconfirmed",
		items: [{ title_id: "show:3001", season: 1, episode: 2, score: 8 }],
	})
	lib.hooks.failAfterPartWrite = false
	const [item] = itemsOf(result) as unknown as {
		status: string
		part_written?: unknown
		undo_note?: string
	}[]
	assert.equal(item.status, "done")
	assert.equal(item.part_written, undefined)
	assert.match(item.undo_note ?? "", /wasn't confirmed/)
	const undone = await write(lib, "undo_watch", {
		action_id: "undo-part-unconfirmed",
		batch_id: "part-unconfirmed",
	})
	assert.deepEqual(undoItems(undone), [
		[
			"not_undoable",
			null,
			[
				"This score's write wasn't confirmed, so Undo can't tell it from a later change. Set it again with rate_title.",
			],
		],
	])
	assert.equal(lib.part(ME, 3001, 1, 2), 8)
})

test("Undo puts a part score back on the episode the batch scored, also after TMDB renumbers it (#759 review)", async () => {
	const lib = fakeLibrary()
	lib.setPart(ME, 3001, 1, 2, 4)
	await write(lib, "rate_title", {
		action_id: "part-renumbered",
		items: [{ title_id: "show:3001", season: 1, episode: 2, score: 8 }],
	})
	// The scored episode becomes S1 E5; a new episode takes S1 E2 and gets its own score.
	lib.renumber(3001, 1, 2, 5)
	lib.setPart(ME, 3001, 1, 2, 7)
	const undone = await write(lib, "undo_watch", {
		action_id: "undo-part-renumbered",
		batch_id: "part-renumbered",
	})
	assert.deepEqual(undoItems(undone), [["undone", null, null]])
	assert.equal(lib.part(ME, 3001, 1, 5), 4)
	assert.equal(lib.part(ME, 3001, 1, 2), 7)
	assert.deepEqual((undone.items as { changes?: unknown }[])[0].changes, {
		part_score: [8, 4],
	})
})

test("A batch says which of its changes Undo can't take back, and only when it has some", async () => {
	const lib = fakeLibrary()
	lib.setPart(ME, 3001, 1, 2, 4)
	const cleared = await write(lib, "rate_title", {
		action_id: "clear-note",
		items: [
			{ title_id: "show:3001", season: 1, episode: 2, score: null },
			{ title_id: "show:3001", season: 1, episode: 3, score: 7 },
		],
	})
	assert.match(String(cleared.message), /undo_watch with batch_id "clear-note"/)
	assert.match(
		String(cleared.message),
		/A cleared season or episode score, or a write that wasn't confirmed, can't be taken back; those items say so\./,
	)
	const plain = await write(lib, "rate_title", {
		action_id: "plain-note",
		items: [{ title_id: "show:3001", season: 1, episode: 4, score: 6 }],
	})
	assert.doesNotMatch(String(plain.message), /can't be taken back/)
	const undo = writeToolDefinitions.find((tool) => tool.name === "undo_watch")
	assert.doesNotMatch(String(undo?.description), /every change/)
	assert.match(
		String(undo?.description),
		/except a cleared season or episode score, or a write that wasn't confirmed, which it reports as not_undoable/,
	)
})
