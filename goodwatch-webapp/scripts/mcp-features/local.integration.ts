import assert from "node:assert/strict"
import Redis from "ioredis"
import { createReadMcpHandler } from "../../app/server/mcp/endpoint.server"
process.env.CRATE_HOSTS = "127.0.0.1"
process.env.CRATE_PORT = "15767"
process.env.CRATE_USER = process.env.MCP_TEST_CRATE_USER ?? "crate"
process.env.CRATE_PASS = process.env.MCP_TEST_CRATE_PASS ?? ""
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
	member = "mcp-taste-features-A",
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
	if (response.status !== 200)
		return {
			http: response.status,
			challenge: response.headers.get("www-authenticate"),
		}
	const text = await response.text()
	const message = text.startsWith("event:")
		? JSON.parse(text.split("data: ")[1].split("\n")[0])
		: JSON.parse(text)
	return message.error
		? { isError: true, error: message.error }
		: message.result
}
async function call(
	name: string,
	args: Record<string, unknown> = {},
	member = "mcp-taste-features-A",
) {
	const result = await rpc(name, args, member)
	assert.equal(result.isError, false, JSON.stringify(result))
	assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent)
	return result.structuredContent
}
const titles = [2000, 2001, 2002, 2003, 2024].map((id) => ({
	title_id: `movie:${id}`,
	title_name: "Ignored display metadata",
	year: 1800,
}))
const idsOnly = titles.map(({ title_id }) => ({ title_id }))
try {
	const { resetUserDataCache } = await import(
		"../../app/server/userData.server"
	)
	const { resetUserSettingsCache } = await import(
		"../../app/server/user-settings.server"
	)
	for (const member of [
		"mcp-taste-features-A",
		"mcp-features-B",
		"mcp-features-no-handle",
	]) {
		await resetUserDataCache({ user_id: member })
		await resetUserSettingsCache({ user_id: member })
	}
	if (process.argv.includes("--replay-only")) {
		const created = await call("create_list", {
			action_id: "create-five",
			list_name: "Local top five",
			titles: idsOnly,
			visibility: "unlisted",
		})
		assert.equal(created.replayed, true)
		const current = await call("get_list", { list_id: created.list_id })
		assert.equal(current.items.at(-1).id, "movie:2004")
		assert.equal(created.after.items.at(-1).id, "movie:2024")
		const range = await call("log_watch", {
			title_id: "show:1399",
			season: 1,
			episode: 1,
			episode_end: 4,
			action_id: "range-four",
		})
		assert.equal(range.replayed, true)
		assert.equal(range.after.watch_count, 4)
		assert.equal(
			(await call("get_show_progress", { title_id: "show:1399" }))
				.episodes_watched,
			6,
		)
		const settings = await call("set_settings", {
			country: "GB",
			language: "de",
			action_id: "settings-both",
		})
		assert.equal(settings.replayed, true)
		assert.equal(settings.after.country, "GB")
		assert.equal((await call("get_settings")).country, "US")
		console.log(
			"PASS: fresh-process list, range and settings retries replay historical receipts without reapplying",
		)
	} else {
		const people = await call("search_people", {
			query: "Local Feature Person",
			limit: 1,
		})
		assert.equal(people.items[0].person_id, 910001)
		assert.match(people.items[0].url, /\/person\/910001-local-feature-person$/)
		const more = await call("search_people", {
			query: "Local Feature Person",
			cursor: people.next_cursor,
			limit: 1,
		})
		assert.equal(more.items[0].person_id, 910002)
		assert.equal(more.next_cursor, null)
		const person = await call("get_person", { person_id: 910001, limit: 1 })
		assert.equal(person.total, 6)
		assert.equal(person.items[0].id, "show:1399")
		assert.equal(person.sort, "for_you")
		assert.equal(person.for_you_applied, true)
		assert.ok(person.items[0].match >= 50)
		assert.match(person.items[0].match_label, /% taste match$/)
		assert.ok(person.items[0].link.startsWith("[Local "))
		assert.ok(
			"runtime_minutes" in person.items[0] && "poster_url" in person.items[0],
		)
		assert.match(person.page_url, /\/person\/910001-/)
		const byScore = await call("get_person", {
			person_id: 910001,
			sort: "score",
			limit: 1,
		})
		assert.equal(byScore.items[0].id, "movie:2000")
		const newest = await call("get_person", {
			person_id: 910001,
			sort: "newest",
			limit: 1,
		})
		assert.equal(newest.items[0].id, "movie:2003")
		assert.equal(newest.items[0].poster_url, null)
		assert.equal(newest.items[0].match, null)
		const unseen = await call("get_person", {
			person_id: 910001,
			exclude_seen: true,
		})
		assert.equal(unseen.total, 4)
		assert.ok(
			!unseen.items.some((item: { id: string }) =>
				["movie:2001", "movie:2002"].includes(item.id),
			),
		)
		for (const [role, total] of [
			["acting", 5],
			["directing", 2],
			["writing", 2],
		])
			assert.equal(
				(await call("get_person", { person_id: 910001, role })).total,
				total,
			)
		const noTaste = await call(
			"get_person",
			{ person_id: 910001 },
			"mcp-features-B",
		)
		assert.ok(
			noTaste.items.every(
				(item: { match: number | null }) => item.match === null,
			),
		)
		assert.equal(
			(await rpc("get_person", { person_id: 99999999 })).structuredContent
				.status,
			"person_not_found",
		)
		console.log(
			"PASS: indexed people search/paging, real person links, role filters, taste/defaults, full-list sorts and unseen filtering",
		)

		const initial = await call("get_settings")
		assert.equal(initial.country, "DE")
		assert.equal(initial.language, "browser")
		assert.deepEqual(initial.service_ids, [8, 9])
		const changed = await call("set_settings", {
			country: "GB",
			language: "de",
			action_id: "settings-both",
		})
		assert.equal(changed.after.country, "GB")
		assert.equal(changed.after.language, "de")
		assert.deepEqual(changed.after.service_ids, [8, 9])
		assert.equal((await call("get_settings")).language, "de")
		const countryOnly = await call("set_settings", {
			country: "US",
			action_id: "settings-country",
		})
		assert.equal(countryOnly.after.language, "de")
		const languageOnly = await call("set_settings", {
			language: "fr",
			action_id: "settings-language",
		})
		assert.equal(languageOnly.after.country, "US")
		assert.equal(
			(
				await call("set_settings", {
					language: "fr",
					action_id: "settings-noop",
				})
			).outcome,
			"unchanged",
		)
		assert.equal(
			(await rpc("set_settings", { country: "ZZ", action_id: "bad-country" }))
				.structuredContent.outcome,
			"refused",
		)
		assert.equal(
			(await call("get_settings", {}, "mcp-features-B")).country,
			"DE",
		)
		await call("set_my_services", {
			country: "DE",
			services: [8],
			action_id: "services-preserve-language",
		})
		assert.equal((await call("get_settings")).language, "fr")
		await call("set_settings", {
			country: "US",
			action_id: "settings-final-country",
		})
		assert.deepEqual((await call("get_settings")).service_ids, [8])
		console.log(
			"PASS: settings pair CAS/readback, independent country/language edits, browser default, services parity, idempotency and member isolation",
		)

		assert.equal((await call("get_my_lists")).total, 0)
		const missingHandle = await rpc(
			"create_list",
			{ list_name: "Local top five", titles, action_id: "missing-handle" },
			"mcp-features-no-handle",
		)
		assert.equal(missingHandle.structuredContent.status, "handle_required")
		const createArgs = {
			list_name: "Local top five",
			titles,
			action_id: "create-five",
			visibility: "unlisted",
		}
		const created = await call("create_list", createArgs)
		assert.equal(created.after.items.length, 5)
		assert.equal(created.after.visibility, "unlisted")
		assert.equal(
			created.share_url,
			`http://localhost:3336/u/local_features_a/lists/${created.list_id}`,
		)
		assert.equal(
			(await call("create_list", { ...createArgs, titles: idsOnly })).replayed,
			true,
		)
		const mine = await call("get_my_lists")
		assert.equal(mine.total, 1)
		assert.match(mine.page_url, /\/lists\/mine$/)
		assert.equal(mine.items[0].share_url, created.share_url)
		const list = await call("get_list", { list_id: created.list_id })
		assert.deepEqual(
			list.items.map((item: { id: string }) => item.id),
			idsOnly.map((item) => item.title_id),
		)
		assert.ok(
			list.items.every(
				(item: Record<string, unknown>) =>
					"poster_url" in item && "match" in item && "link" in item,
			),
		)
		const editArgs = {
			list_id: created.list_id,
			add_titles: [
				{ title_id: "movie:2004", title_name: "Ignored", year: 1800 },
			],
			remove_title_ids: ["movie:2024"],
			action_id: "replace-one",
		}
		const edited = await call("update_list_titles", editArgs)
		assert.equal(edited.after.items.at(-1).id, "movie:2004")
		assert.equal(edited.before.items.at(-1).id, "movie:2024")
		assert.equal(edited.share_url, created.share_url)
		assert.equal(
			(
				await call("update_list_titles", {
					...editArgs,
					add_titles: [{ title_id: "movie:2004" }],
				})
			).replayed,
			true,
		)
		assert.equal(
			(await rpc("get_list", { list_id: created.list_id }, "mcp-features-B"))
				.structuredContent.status,
			"list_not_found",
		)
		assert.equal(
			(
				await rpc(
					"update_list_titles",
					{ ...editArgs, action_id: "foreign-list" },
					"mcp-features-B",
				)
			).structuredContent.outcome,
			"refused",
		)
		const duplicate = await rpc("update_list_titles", {
			...editArgs,
			add_titles: [{ title_id: "movie:2000" }],
			remove_title_ids: ["movie:2004"],
			action_id: "duplicate-list-title",
		})
		assert.equal(duplicate.structuredContent.outcome, "refused")
		assert.equal((await call("get_my_lists", {}, "mcp-features-B")).total, 0)
		const { getList, updateList, ShareListError } = await import(
			"../../app/server/share-lists/store.server"
		)
		const stored = (await getList(created.list_id))!
		await assert.rejects(
			updateList(
				"mcp-taste-features-A",
				stored.id,
				{
					title: stored.title,
					promptId: stored.promptId,
					design: stored.design,
					theme: stored.theme,
					items: stored.items.map(
						(item) => `${item.media_type}:${item.tmdb_id}`,
					),
				},
				{
					expectedContentHash: "stale-hash",
					expectedUpdatedAt: stored.updatedAt,
				},
			),
			ShareListError,
		)
		const publicList = await call("create_list", {
			list_name: "Another local five",
			titles: idsOnly,
			action_id: "create-public",
		})
		assert.equal(publicList.after.visibility, "public")
		const firstListPage = await call("get_my_lists", { limit: 1 })
		assert.equal(firstListPage.total, 2)
		assert.equal(firstListPage.items[0].list_id, publicList.list_id)
		assert.equal(
			(
				await call("get_my_lists", {
					limit: 1,
					cursor: firstListPage.next_cursor,
				})
			).items[0].list_id,
			created.list_id,
		)
		const ambiguity = await rpc("create_list", {
			list_name: "Ambiguous local five",
			titles: [{ title_name: "Harbor" }, ...idsOnly.slice(1)],
			action_id: "ambiguous-list",
		})
		assert.equal(ambiguity.structuredContent.outcome, "unresolved")
		assert.equal((await call("get_my_lists")).total, 2)
		const edits = await Promise.allSettled(
			["Concurrent A", "Concurrent B"].map((title) =>
				updateList(
					"mcp-taste-features-A",
					stored.id,
					{
						title,
						promptId: stored.promptId,
						design: stored.design,
						theme: stored.theme,
						items: stored.items.map(
							(item) => `${item.media_type}:${item.tmdb_id}`,
						),
					},
					{
						expectedContentHash: stored.contentHash,
						expectedUpdatedAt: stored.updatedAt,
					},
				),
			),
		)
		assert.equal(
			edits.filter((result) => result.status === "fulfilled").length,
			1,
		)
		assert.equal(
			edits.filter((result) => result.status === "rejected").length,
			1,
		)
		console.log(
			"PASS: five-title create/edit/read/list links, redundant selectors, durable retries, ownership, duplicate rejection, handle prerequisite and stale-edit conflict",
		)

		const rangeArgs = {
			title_id: "show:1399",
			season: 1,
			episode: 1,
			episode_end: 4,
			action_id: "range-four",
		}
		const range = await call("log_watch", {
			...rangeArgs,
			title_name: "Ignored",
			year: 1800,
		})
		assert.equal(range.after.watch_count, 4)
		assert.equal(range.changes.watches_added.length, 4)
		assert.ok(
			range.changes.watches_added.every(
				(w: { date: string | null; pass: number; origin: string }) =>
					w.date === null && w.pass === 1 && w.origin === "season",
			),
		)
		assert.equal((await call("log_watch", rangeArgs)).replayed, true)
		assert.equal(
			(await call("log_watch", { ...rangeArgs, action_id: "range-again" }))
				.outcome,
			"unchanged",
		)
		const whole = await call("log_watch", {
			title_id: "show:1399",
			season: 1,
			whole_season: true,
			date: "2020-02-01",
			action_id: "rest-season",
		})
		assert.equal(whole.changes.watches_added.length, 2)
		assert.ok(
			whole.changes.watches_added.every(
				(w: { date: string | null }) => w.date === "2020-02-01",
			),
		)
		assert.equal(whole.after.watch_count, 6)
		assert.equal(whole.after.status, "seen")
		assert.equal(
			(await call("get_show_progress", { title_id: "show:1399" }))
				.episodes_watched,
			6,
		)
		assert.equal(
			(
				await rpc("log_watch", {
					title_id: "show:1399",
					season: 9,
					whole_season: true,
					action_id: "missing-season",
				})
			).structuredContent.outcome,
			"refused",
		)
		assert.equal(
			(
				await rpc("log_watch", {
					title_id: "movie:2000",
					season: 1,
					whole_season: true,
					action_id: "movie-season",
				})
			).structuredContent.outcome,
			"refused",
		)
		assert.equal(
			(
				await rpc("log_watch", {
					...rangeArgs,
					episode_end: 999,
					action_id: "missing-episode",
				})
			).structuredContent.outcome,
			"refused",
		)
		assert.equal(
			(
				await rpc("log_watch", {
					...rangeArgs,
					date: "2099-01-01",
					action_id: "future-date",
				})
			).structuredContent.outcome,
			"refused",
		)
		const { query } = await import("../../app/utils/crate")
		const receipts = await query<{ n: number }>(
			"SELECT count(*) AS n FROM user_mcp_action WHERE user_id = ? AND action_id = ?",
			["mcp-taste-features-A", "range-four"],
		)
		assert.equal(receipts[0].n, 1)
		assert.equal(
			(
				await call(
					"get_show_progress",
					{ title_id: "show:1399" },
					"mcp-features-B",
				)
			).episodes_watched,
			0,
		)
		console.log(
			"PASS: inclusive ranges and dated whole seasons use one receipt, skip already watched episodes, auto-See, keep unknown dates, reject invalid targets and isolate members",
		)

		for (const [name, args] of [
			["set_settings", { country: "US", action_id: "readonly" }],
			["create_list", { ...createArgs, action_id: "readonly" }],
			["update_list_titles", editArgs],
			["log_watch", rangeArgs],
		] as const) {
			const denied = await rpc(name, args, "mcp-taste-features-A", ["mcp:read"])
			assert.equal(denied.http, 403)
			assert.match(denied.challenge ?? "", /mcp:write/)
		}
		assert.equal(
			(await rpc("set_settings", { language: "de", action_id: "create-five" }))
				.structuredContent.outcome,
			"action_id_conflict",
		)
		console.log(
			"PASS: every new mutation and range parameter requires mcp:write; receipt IDs cannot cross tools",
		)
	}
} finally {
	setRedisClusterForTest(null)
	await valkey.quit()
	const { stopTitleSnapshot } = await import(
		"../../app/server/title-snapshot/index.server"
	)
	const { stopTasteStore } = await import("../../app/server/taste/index.server")
	const { stopTastePortraitCache } = await import(
		"../../app/server/taste-portrait/cache.server"
	)
	stopTitleSnapshot()
	stopTasteStore()
	stopTastePortraitCache()
}
