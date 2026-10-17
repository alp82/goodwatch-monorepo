import assert from "node:assert/strict"
import Redis from "ioredis"
import { createReadMcpHandler } from "../../app/server/mcp/endpoint.server"
process.env.CRATE_HOSTS = "127.0.0.1"
process.env.CRATE_PORT = "15767"
process.env.CRATE_USER = "crate"
process.env.CRATE_PASS = ""
process.env.REDIS_HOST = ""
process.env.TASTE_REDIS_URL = "redis://127.0.0.1:16767"
process.env.TITLE_CARDS_REDIS_URL = ""
process.env.TITLE_SNAPSHOT_REDIS_URL = "redis://127.0.0.1:16767"
const { createRateLimiter } = await import("../../app/server/rate-limit.server")
const valkey = new Redis("redis://127.0.0.1:16767", { maxRetriesPerRequest: 1 })
const localLimiter = createRateLimiter({ redis: () => valkey })
const limiter = {
	take: (name: string, member: string) =>
		localLimiter.take(name, member, [
			{ limit: 500, seconds: 60 },
			{ limit: 2000, seconds: 3600 },
		]),
}
const { cacheScripts, setRedisClusterForTest } = await import(
	"../../app/utils/cache"
)
for (const [name, script] of Object.entries(cacheScripts))
	valkey.defineCommand(name, script)
setRedisClusterForTest(valkey)
const resource = "http://localhost:3336/mcp"
let id = 0
async function rpc(
	name: string,
	args: Record<string, unknown> = {},
	member = "mcp-writer-A",
	scopes = ["mcp:read", "mcp:write"],
) {
	const handle = createReadMcpHandler({
		resource,
		limiter,
		authorization: {
			async verifyAccessToken(token) {
				return {
					token,
					clientId: "local-write-probe",
					scopes,
					expiresAt: Date.now() / 1000 + 60,
					resource: new URL(resource),
					extra: { userId: member },
				}
			},
		},
	})
	const response = await handle(
		new Request(resource, {
			method: "POST",
			headers: {
				Authorization: "Bearer local",
				"Content-Type": "application/json",
				Accept: "application/json, text/event-stream",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: ++id,
				method: "tools/call",
				params: { name, arguments: args },
			}),
		}),
	)
	assert.equal(response.status, 200, await response.clone().text())
	const text = await response.text()
	const message = text.startsWith("event:")
		? JSON.parse(text.split("data: ")[1].split("\n")[0])
		: JSON.parse(text)
	return message.error
		? { isError: true, error: message.error }
		: message.result
}
function assertReplay(value: unknown, original: Record<string, unknown>) {
	assert.deepEqual(value, { ...original, replayed: true })
}
async function call(
	name: string,
	args: Record<string, unknown> = {},
	member = "mcp-writer-A",
) {
	const result = await rpc(name, args, member)
	assert.ok(!result.isError, JSON.stringify(result))
	if (result.structuredContent.title)
		assert.match(result.structuredContent.title.url, /^http:\/\/localhost:3336\/(movie|show)\//)
	assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent)
	return result.structuredContent
}
try {
	const { resetUserDataCache } = await import(
		"../../app/server/userData.server"
	)
	const { resetUserSettingsCache } = await import(
		"../../app/server/user-settings.server"
	)
	for (const member of ["mcp-writer-A", "mcp-writer-B"]) {
		await resetUserDataCache({ user_id: member })
		await resetUserSettingsCache({ user_id: member })
	}
	for (const member of ["mcp-writer-A", "mcp-writer-B"])
		await valkey.del(`mcp-read:{${member}}:60`, `mcp-read:{${member}}:3600`)
	if (process.argv.includes("--replay-only")) {
		const before = await call("get_title", { title_id: "movie:3000" })
		const replay = await call("log_watch", {
			title_id: "movie:3000",
			action_id: "watch-local-movie",
		})
		assert.equal(replay.replayed, true)
		assert.equal(replay.after.watch_count, 1)
		assert.ok(before.member.watch_count >= 3)
		assert.equal(
			(await call("get_title", { title_id: "movie:3000" })).member.watch_count,
			before.member.watch_count,
		)
		console.log(
			"PASS: receipt survives a fresh MCP process and never reapplies the original watch",
		)
	} else {
		const args = { title_id: "movie:3000", action_id: "watch-local-movie" }
		const logged = await call("log_watch", args)
		assert.equal(logged.outcome, "applied")
		assert.equal(logged.replayed, false)
		assert.equal(logged.after.watches.length, 1)
		assert.equal(logged.after.watches[0].date, null)
		assert.equal(logged.after.watches[0].date_note, "No date recorded")
		assertReplay(await call("log_watch", args), logged)
		const peer = await call(
			"get_title",
			{ title_id: "movie:3000" },
			"mcp-writer-B",
		)
		assert.equal(peer.member.watch_count, 0)
		console.log(
			"PASS: movie watches, undated wording, durable exact retry and peer isolation",
		)
		const rateArgs = {
			title_id: "movie:3001",
			score: 8,
			action_id: "rate-local-movie",
		}
		const rated = await call("rate_title", rateArgs)
		assert.equal(rated.before.score, null)
		assert.equal(rated.after.score, 8)
		assert.equal(rated.after.watches.length, 1)
		assert.equal(rated.after.watches[0].origin, "score")
		assert.equal(rated.after.watches[0].date, null)
		assertReplay(await call("rate_title", rateArgs), rated)
		const cleared = await call("rate_title", {
			title_id: "movie:3001",
			score: null,
			action_id: "clear-local-movie",
		})
		assert.equal(cleared.after.score, null)
		assert.equal(cleared.changes.watches_removed.length, 1)
		assert.equal(cleared.after.watches.length, 0)
		console.log(
			"PASS: scores own one undated movie watch; clearing removes only that watch",
		)
		const wantArgs = {
			title_id: "movie:3001",
			want_to_see: true,
			action_id: "want-local-movie",
		}
		const wanted = await call("set_want_to_see", wantArgs)
		assert.equal(wanted.after.want_to_see, true)
		assertReplay(await call("set_want_to_see", wantArgs), wanted)
		const removeWantArgs = {
			title_id: "movie:3001",
			want_to_see: false,
			action_id: "remove-want-local-movie",
		}
		const removedWant = await call("set_want_to_see", removeWantArgs)
		assert.equal(removedWant.before.want_to_see, true)
		assert.equal(removedWant.after.want_to_see, false)
		await call("set_want_to_see", {
			...wantArgs,
			action_id: "want-local-movie-again",
		})
		assertReplay(await call("set_want_to_see", removeWantArgs), removedWant)
		assert.equal(
			(await call("get_title", { title_id: "movie:3001" })).member.want_to_see,
			true,
		)
		console.log(
			"PASS: Want to See setters, exact retries and old removal retries preserve newer choices",
		)
		const touchedBefore = Number(await valkey.get("taste:touched:mcp-writer-A"))
		const hideArgs = {
			title_id: "movie:3001",
			not_interested: true,
			action_id: "hide-local-movie",
		}
		const hidden = await call("set_not_interested", hideArgs)
		assert.equal(hidden.before.want_to_see, true)
		assert.equal(hidden.after.want_to_see, false)
		assert.equal(hidden.after.not_interested, true)
		assert.ok(
			Number(await valkey.get("taste:touched:mcp-writer-A")) > touchedBefore,
		)
		assertReplay(await call("set_not_interested", hideArgs), hidden)
		await call("set_not_interested", {
			...hideArgs,
			not_interested: false,
			action_id: "unhide-local-movie",
		})
		assertReplay(await call("set_not_interested", hideArgs), hidden)
		assert.equal(
			(await call("get_title", { title_id: "movie:3001" })).member
				.not_interested,
			false,
		)
		console.log(
			"PASS: Not interested clears Wishlist, invalidates member/taste caches and replays safely",
		)
		const episode = await call("log_watch", {
			title_id: "show:1399",
			season: 1,
			episode: 3,
			date: "2026-10-13",
			action_id: "episode-local-show",
		})
		assert.equal(
			episode.after.watches.find((w: { episode: number }) => w.episode === 3)
				.date,
			"2026-10-13",
		)
		const showRated = await call("rate_title", {
			title_id: "show:1399",
			score: 9,
			action_id: "rate-local-show",
		})
		assert.equal(showRated.after.status, "watching")
		assert.equal(showRated.changes.watches_added.length, 0)
		const holdArgs = {
			title_id: "show:1399",
			status: "On hold",
			action_id: "hold-local-show",
		}
		const held = await call("set_show_status", holdArgs)
		assert.equal(held.after.status, "on_hold")
		assertReplay(await call("set_show_status", holdArgs), held)
		const dropped = await call("set_show_status", {
			title_id: "show:1399",
			status: "Dropped",
			action_id: "drop-local-show",
		})
		assert.equal(dropped.after.status, "dropped")
		assert.equal(dropped.after.watches.length, 3)
		await call("set_show_status", {
			title_id: "show:1399",
			status: "Watching",
			action_id: "resume-local-show",
		})
		const seenArgs = {
			title_id: "show:1399",
			status: "Seen",
			action_id: "seen-local-show",
		}
		const seen = await call("set_show_status", seenArgs)
		assert.equal(seen.after.status, "seen")
		assert.equal(seen.changes.watches_added.length, 3)
		assert.ok(
			seen.changes.watches_added.every((w: { date: null }) => w.date === null),
		)
		assertReplay(await call("set_show_status", seenArgs), seen)
		const stillSeen = await call("set_show_status", {
			...seenArgs,
			action_id: "seen-local-show-again",
		})
		assert.equal(stillSeen.outcome, "unchanged")
		assert.equal(stillSeen.after.watches.length, 6)
		console.log(
			"PASS: show ratings preserve status; hold/drop/resume and Seen preserve dates and retry safely",
		)
		const secondMovie = await call("log_watch", {
			title_id: "movie:3000",
			date: "2026-10-12",
			action_id: "watch-local-movie-again",
		})
		const lastWatchId = secondMovie.changes.watches_added[0].id
		const undoArgs = {
			title_id: "movie:3000",
			action_id: "remove-local-movie-last",
		}
		const undone = await call("undo_watch", undoArgs)
		assert.equal(undone.changes.watches_removed.length, 1)
		assert.equal(undone.changes.watches_removed[0].id, lastWatchId)
		assert.equal(undone.changes.watches_removed[0].date, "2026-10-12")
		assert.equal(undone.after.watches.length, 1)
		assertReplay(await call("undo_watch", undoArgs), undone)
		await call("log_watch", {
			title_id: "movie:3000",
			action_id: "watch-local-movie-after-remove",
		})
		assertReplay(await call("undo_watch", undoArgs), undone)
		assert.equal(
			(await call("get_title", { title_id: "movie:3000" })).member.watch_count,
			2,
		)
		const episodeRemoval = await call("undo_watch", {
			title_id: "show:1399",
			watch_id: episode.changes.watches_added[0].id,
			action_id: "remove-local-show-episode",
		})
		assert.equal(episodeRemoval.changes.watches_removed[0].episode, 3)
		assert.equal(episodeRemoval.changes.watches_removed[0].date, "2026-10-13")
		console.log(
			"PASS: Remove a watch is bound to the original selected watch across retries, with exact removed date",
		)
		const servicesArgs = {
			country: "US",
			services: ["Netflix", "Prime Video"],
			action_id: "services-local-member",
		}
		const services = await call("set_my_services", servicesArgs)
		assert.equal(services.before.country, "DE")
		assert.deepEqual(services.before.service_ids, [])
		assert.equal(services.after.country, "US")
		assert.deepEqual(services.after.service_ids, [8, 9])
		assertReplay(await call("set_my_services", servicesArgs), services)
		await call("set_my_services", {
			country: "DE",
			services: [8],
			action_id: "services-local-member-new",
		})
		assertReplay(await call("set_my_services", servicesArgs), services)
		const tonight = await call("get_tonight")
		assert.equal(tonight.country, "DE")
		assert.ok(tonight.service_ids.includes(8))
		assert.equal(tonight.service_ids.includes(9), false)
		console.log(
			"PASS: services resolve by name/ID, country and removals are explicit, cached settings are fresh",
		)
		const unknownCountry = await rpc("set_my_services", {
			country: "ZZ",
			services: [8],
			action_id: "unknown-country",
		})
		assert.equal(unknownCountry.isError, true)
		assert.equal(unknownCountry.structuredContent.outcome, "refused")
		assert.equal((await call("get_tonight")).country, "DE")
		const libraryBeforeAmbiguity = await call("get_library")
		const ambiguousRequests = [
			["log_watch", {}],
			["rate_title", { score: 5 }],
			["set_want_to_see", { want_to_see: true }],
			["set_not_interested", { not_interested: true }],
			["set_show_status", { status: "Seen" }],
			["undo_watch", {}],
		] as const
		for (const [name, extra] of ambiguousRequests) {
			const result = await rpc(name, {
				title_name: "Harbor",
				action_id: `ambiguous-${name}`,
				...extra,
			})
			assert.equal(result.structuredContent.status, "ambiguous_title")
			assert.deepEqual(
				result.structuredContent.choices.map(
					(title: { id: string }) => title.id,
				),
				["movie:3000", "movie:3001"],
			)
			assert.equal(result.isError, true)
		}
		assert.deepEqual(await call("get_library"), libraryBeforeAmbiguity)
		const pendingBefore = (await call("get_title", { title_id: "movie:3000" }))
			.member.watch_count
		const pending = await rpc("log_watch", {
			title_id: "movie:3000",
			action_id: "pending-local-movie",
		})
		assert.equal(pending.structuredContent.outcome, "indeterminate")
		assert.equal(pending.structuredContent.title.id, "movie:3000")
		assert.equal(
			(await call("get_title", { title_id: "movie:3000" })).member.watch_count,
			pendingBefore,
		)
		const conflict = await rpc("log_watch", {
			title_id: "movie:3000",
			date: "2026-10-13",
			action_id: "watch-local-movie",
		})
		assert.equal(conflict.structuredContent.outcome, "action_id_conflict")
		const crossToolConflict = await rpc("rate_title", {
			title_id: "movie:3000",
			score: 10,
			action_id: "watch-local-movie",
		})
		assert.equal(
			crossToolConflict.structuredContent.outcome,
			"action_id_conflict",
		)
		const raceArgs = {
			title_id: "movie:3000",
			action_id: "concurrent-local-watch",
		}
		const raced = await Promise.all([
			rpc("log_watch", raceArgs),
			rpc("log_watch", raceArgs),
		])
		for (const result of raced)
			assert.ok(
				["applied", "indeterminate"].includes(result.structuredContent.outcome),
			)
		const completedRace = await call("log_watch", raceArgs)
		assert.equal(completedRace.replayed, true)
		assert.equal(
			(await call("get_title", { title_id: "movie:3000" })).member.watch_count,
			pendingBefore + 1,
		)
		await call(
			"log_watch",
			{ title_id: "movie:3000", action_id: "watch-local-movie" },
			"mcp-writer-B",
		)
		assert.equal(
			(await call("get_title", { title_id: "movie:3000" }, "mcp-writer-B"))
				.member.watch_count,
			1,
		)
		assert.equal(
			(await call("get_title", { title_id: "movie:3000" })).member.watch_count,
			pendingBefore + 1,
		)
		const unknownService = await rpc("set_my_services", {
			country: "DE",
			services: [999999],
			action_id: "unknown-service",
		})
		assert.equal(unknownService.structuredContent.status, "service_not_found")
		const ambiguousService = await rpc("set_my_services", {
			country: "DE",
			services: ["Shared Stream"],
			action_id: "ambiguous-service",
		})
		assert.equal(ambiguousService.structuredContent.status, "ambiguous_service")
		assert.equal(ambiguousService.structuredContent.choices.length, 2)
		assert.ok((await call("get_tonight")).service_ids.includes(8))
		for (const [name, args] of [
			[
				"rate_title",
				{ title_id: "movie:3000", score: 11, action_id: "invalid-score" },
			],
			[
				"log_watch",
				{ title_id: "movie:3000", date: "today", action_id: "invalid-date" },
			],
			[
				"undo_watch",
				{
					title_id: "movie:3000",
					confirmation_id: "not-approval",
					action_id: "invalid-confirmation",
				},
			],
			[
				"set_want_to_see",
				{
					title_id: "movie:3000",
					want_to_see: true,
					user_id: "mcp-writer-B",
					action_id: "invalid-subject-override",
				},
			],
		] as const)
			assert.equal((await rpc(name, args)).isError, true)
		console.log(
			"PASS: every title write rejects ambiguity without changing member data; services also resolve safely",
		)
		console.log(
			"PASS: durable pending actions, concurrent retries, parameter conflicts and per-member action namespaces",
		)
		const separateWrites = await Promise.all([
			call("log_watch", {
				title_id: "movie:3000",
				action_id: "distinct-watch-one",
			}),
			call("log_watch", {
				title_id: "movie:3000",
				action_id: "distinct-watch-two",
			}),
		])
		for (const result of separateWrites)
			assert.equal(result.changes.watches_added.length, 1)
		assert.notEqual(
			separateWrites[0].changes.watches_added[0].id,
			separateWrites[1].changes.watches_added[0].id,
		)
		console.log(
			"PASS: concurrent distinct writes report only their own added watch IDs",
		)
	}
} finally {
	setRedisClusterForTest(null)
	await valkey.quit()
	const { stopTitleSnapshot } = await import(
		"../../app/server/title-snapshot/index.server"
	)
	const { stopTasteStore } = await import("../../app/server/taste/index.server")
	stopTitleSnapshot()
	stopTasteStore()
	const { stopTastePortraitCache } = await import(
		"../../app/server/taste-portrait/cache.server"
	)
	stopTastePortraitCache()
}
