import {
	createCipheriv,
	createDecipheriv,
	createHmac,
	randomBytes,
} from "node:crypto"
import type { Cluster } from "ioredis"
import { getRedisCluster } from "../../utils/cache"
import { counter } from "../metrics/registry.server.ts"
import { runsSearch } from "../role.server.ts"
import { searchAdmission } from "../search-runtime/admission.server.ts"
import { type CatalogTitle, summary } from "./data.server.ts"
import { readToolEnabled } from "./policy.server.ts"
import { prepareSearchView } from "./search-view.server.ts"
import type { SearchView } from "./search-view.ts"
import type { ReadArgs } from "./tools.server.ts"

export interface RankedBatch {
	titles: CatalogTitle[]
	ranked: boolean
	messages: string[]
	chargedNano: number
}
export type RankedSearch = (
	userId: string,
	origin: string,
	args: ReadArgs,
	signal?: AbortSignal,
) => Promise<Record<string, unknown>>
type Redis = Pick<Cluster, "eval" | "get">
interface Snapshot extends RankedBatch {
	id: string
	queryHash: string
	queryCiphertext?: string
	view?: SearchView
}
const usage = counter(
	"goodwatch_mcp_ranked_requests_total",
	"MCP ranked calls by bounded outcome.",
	["outcome"],
	16,
)
const cost = counter(
	"goodwatch_mcp_ranked_cost_nano_total",
	"MCP search cost reported by combinedSearch, including conservative estimates; cache and paging cost zero.",
	[],
	1,
)
const unknownCost = counter(
	"goodwatch_mcp_ranked_cost_unknown_total",
	"MCP searches that failed before returning a quantified cost; consult shared spending.",
	[],
	1,
)

// Each member's keys share one Cluster slot. The server clock chooses the UTC quota day.
const clock = `local seconds = tonumber(ARGV[2]); if seconds < 0 then seconds = tonumber(redis.call('TIME')[1]) end
local day = math.floor(seconds / 86400)
local reset = (day + 1) * 86400
local used = tonumber(redis.call('HGET', KEYS[1], 'day') or '-1') == day and tonumber(redis.call('HGET', KEYS[1], 'used') or '0') or 0
`
const claim = `${clock}
local cached = redis.call('GET', KEYS[3])
if cached then return {'cached', cached, used, reset} end
if redis.call('EXISTS', KEYS[2]) == 1 then return {'member_busy', '', used, reset} end
if used >= 20 then return {'quota_exceeded', '', used, reset} end
redis.call('SET', KEYS[2], ARGV[1], 'PX', 30000)
return {'claimed', '', used, reset}
`
const start = `${clock}
if redis.call('GET', KEYS[2]) ~= ARGV[1] then return {'lease_lost', '', used, reset} end
if used >= 20 then return {'quota_exceeded', '', used, reset} end
used = used + 1
redis.call('HSET', KEYS[1], 'day', day, 'used', used)
redis.call('EXPIREAT', KEYS[1], reset + 1)
return {'started', '', used, reset}
`
const quota = `${clock} return {'quota', '', used, reset}`
type Verdict = [string, string, number, number]
const quotaData = (v: Verdict) => ({
	limit: 20,
	used: Number(v[2]),
	remaining: Math.max(0, 20 - Number(v[2])),
	resets_at: new Date(Number(v[3]) * 1000).toISOString(),
})
const failure = (status: string, v?: Verdict) => ({
	status,
	ranked: false,
	message:
		(
			{
				member_busy:
					"You already have a smarter match in flight. Try again after it finishes.",
				quota_exceeded:
					"Your 20 uncached smarter matches for this UTC day are used. Cached queries and existing pages remain free.",
				search_busy:
					"Search is busy right now. Try again in a moment; no member query was charged.",
				wrong_role:
					"Smarter matching is temporarily unavailable on this server.",
				search_cancelled:
					"Search was cancelled before a new smarter match started.",
				cursor_expired:
					"This result page has expired. Start a new smarter match explicitly; paging never reruns a search.",
				invalid_cursor: "This cursor does not match the search or member.",
				ranked_disabled: "Smarter matching is disabled for this member.",
				ranked_unavailable:
					"Smarter matching is temporarily unavailable. No unmetered search is allowed.",
			} as Record<string, string>
		)[status] ??
		"Smarter matching did not complete. Its admitted attempt still counts; do not automatically retry.",
	...(v ? { quota: quotaData(v) } : {}),
})

export function createRankedSearch(
	options: {
		redis?: () => Redis | null
		run?: (
			query: string,
			userId: string,
			signal: AbortSignal,
		) => Promise<RankedBatch>
		/** Isolated UTC rollover tests only; runtime always uses Valkey's TIME. */
		clock?: () => number
	} = {},
): RankedSearch {
	return async (userId, origin, args, signal) => {
		const finish = (outcome: string, result: Record<string, unknown>) => {
			usage.inc([outcome])
			return result
		}
		if (!readToolEnabled(userId, "ranked_search"))
			return finish("disabled", failure("ranked_disabled"))
		if (!runsSearch()) return finish("wrong_role", failure("wrong_role"))
		if (signal?.aborted) return finish("cancelled", failure("search_cancelled"))
		const storageKey = process.env.SEARCH_STORAGE_KEY ?? ""
		const redis = (options.redis ?? getRedisCluster)()
		if (!redis || !/^[a-fA-F0-9]{64}$/.test(storageKey))
			return finish("unavailable", failure("ranked_unavailable"))
		const digest = (value: string) =>
			createHmac("sha256", Buffer.from(storageKey, "hex"))
				.update(value)
				.digest("hex")
		const prefix = `mcp-ranked:{${digest(userId)}}`
		const query = (args.query ?? "")
			.normalize("NFC")
			.trim()
			.toLowerCase()
			.replace(/\s+/gu, " ")
		const queryHash = digest(query)
		const keys = [
			`${prefix}:quota`,
			`${prefix}:active`,
			`${prefix}:query:${queryHash}`,
		]
		const owner = randomBytes(16).toString("hex")
		// Preserve query links across cursor-only pages without storing the raw query in Valkey.
		const key = Buffer.from(storageKey, "hex")
		const sealQuery = (value: string, id = owner) => {
			const iv = randomBytes(12)
			const cipher = createCipheriv("aes-256-gcm", key, iv)
			cipher.setAAD(Buffer.from(`${prefix}:${id}:page-query`))
			const encrypted = Buffer.concat([
				cipher.update(value, "utf8"),
				cipher.final(),
			])
			return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
				"base64url",
			)
		}
		const queryOf = (snapshot: Snapshot) => {
			if (!snapshot.queryCiphertext) return args.query?.trim() ?? ""
			const bytes = Buffer.from(snapshot.queryCiphertext, "base64url")
			const cipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12))
			cipher.setAAD(Buffer.from(`${prefix}:${snapshot.id}:page-query`))
			cipher.setAuthTag(bytes.subarray(12, 28))
			return Buffer.concat([
				cipher.update(bytes.subarray(28)),
				cipher.final(),
			]).toString("utf8")
		}
		const time = () => (options.clock ? Math.floor(options.clock() / 1000) : -1)
		const evalVerdict = async (script: string) =>
			(await redis.eval(script, keys.length, ...keys, owner, time())) as Verdict
		const page = async (
			input: Snapshot,
			offset: number,
			v: Verdict,
			cached: boolean,
			chargedNano = 0,
		) => {
			let snapshot = input
			if (snapshot.view) {
				if (
					(args.for_you !== undefined &&
						args.for_you !== snapshot.view.for_you) ||
					(args.exclude_seen !== undefined &&
						args.exclude_seen !== snapshot.view.exclude_seen)
				)
					return failure("invalid_cursor", v)
			} else {
				// One stable, member-bound view per filter combination. Changing filters reuses the
				// 60s raw query cache without another paid search; cursor pages never re-rank.
				const id = digest(
					`${snapshot.id}:${args.for_you ?? true}:${args.exclude_seen ?? false}`,
				).slice(0, 32)
				const viewKey = `${prefix}:view:${id}`
				let value = await redis.get(viewKey)
				if (!value) {
					const prepared = await prepareSearchView(
						snapshot.titles,
						userId,
						args,
					)
					const view: Snapshot = {
						...snapshot,
						...prepared,
						id,
						queryCiphertext: sealQuery(queryOf(snapshot), id),
					}
					value = (await redis.eval(
						"local v = redis.call('GET', KEYS[1]); if v then return v end redis.call('SET', KEYS[1], ARGV[1], 'PX', 900000) redis.call('SET', KEYS[2], ARGV[1], 'PX', 900000) return ARGV[1]",
						2,
						viewKey,
						`${prefix}:page:${id}`,
						JSON.stringify(view),
					)) as string
				}
				snapshot = JSON.parse(value)
			}
			const limit = args.limit ?? 40
			return {
				query: queryOf(snapshot),
				...snapshot.view,
				total: snapshot.titles.length,
				returned: Math.min(limit, Math.max(0, snapshot.titles.length - offset)),
				items: snapshot.titles
					.slice(offset, offset + limit)
					.map((title) => summary(title, origin)),
				next_cursor:
					offset + limit < snapshot.titles.length
						? `ranked:${snapshot.id}:${offset + limit}`
						: null,
				ranked: snapshot.ranked,
				messages: snapshot.messages,
				cached,
				charged_nano: chargedNano,
				quota: quotaData(v),
			}
		}
		let release: (() => void) | null = null
		let claimed = false
		let heartbeat: NodeJS.Timeout | undefined
		const background = new Set<Promise<unknown>>()
		const track = (work: Promise<unknown>) => {
			background.add(work)
			void work.then(
				() => background.delete(work),
				() => background.delete(work),
			)
		}
		const abort = new AbortController()
		const stop = () => abort.abort()
		signal?.addEventListener("abort", stop, { once: true })
		if (signal?.aborted) stop()
		try {
			if (args.cursor) {
				const match = /^ranked:([a-f0-9]{32}):([0-9]{1,8})$/.exec(args.cursor)
				if (!match) return finish("invalid_cursor", failure("invalid_cursor"))
				const value = await redis.get(`${prefix}:page:${match[1]}`)
				if (!value) return finish("expired", failure("cursor_expired"))
				const snapshot: Snapshot = JSON.parse(value)
				if (query && snapshot.queryHash !== queryHash)
					return finish("invalid_cursor", failure("invalid_cursor"))
				return finish(
					"page",
					await page(
						snapshot,
						Number(match[2]),
						await evalVerdict(quota),
						true,
					),
				)
			}
			if (query.length < 2)
				return finish("invalid_query", {
					status: "invalid_query",
					message: "Smarter matching requires at least two characters.",
				})
			const v = await evalVerdict(claim)
			if (v[0] === "cached")
				return finish("cached", await page(JSON.parse(v[1]), 0, v, true))
			if (v[0] !== "claimed") return finish(v[0], failure(v[0], v))
			claimed = true
			release = searchAdmission.enter()
			if (!release) return finish("search_busy", failure("search_busy", v))
			if (abort.signal.aborted)
				return finish("cancelled", failure("search_cancelled", v))
			const admitted = await evalVerdict(start)
			if (admitted[0] !== "started")
				return finish(admitted[0], failure(admitted[0], admitted))
			heartbeat = setInterval(() => {
				void redis
					.eval(
						"if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end return redis.call('PEXPIRE', KEYS[1], 30000)",
						1,
						keys[1],
						owner,
					)
					.then((owned) => {
						if (owned !== 1) stop()
					}, stop)
			}, 5000)
			heartbeat.unref()
			let batch: RankedBatch
			try {
				const run =
					options.run ??
					(await import("./ranked-engine.server.ts")).runRankedSearch
				batch = await searchAdmission.track(track, () =>
					run(query, userId, abort.signal),
				)
			} catch {
				unknownCost.inc([])
				return finish("failed", failure("search_failed", admitted))
			}
			cost.inc([], batch.chargedNano)
			const snapshot: Snapshot = {
				...batch,
				id: owner,
				queryHash,
				queryCiphertext: sealQuery(args.query?.trim() ?? ""),
			}
			const saved = await redis.eval(
				"if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end redis.call('SET', KEYS[2], ARGV[2], 'PX', 60000) redis.call('SET', KEYS[3], ARGV[2], 'PX', 900000) return 1",
				3,
				keys[1],
				keys[2],
				`${prefix}:page:${owner}`,
				owner,
				JSON.stringify(snapshot),
			)
			if (saved !== 1)
				return finish("unavailable", failure("ranked_unavailable", admitted))
			return finish(
				"uncached",
				await page(snapshot, 0, admitted, false, batch.chargedNano),
			)
		} catch {
			return finish("unavailable", failure("ranked_unavailable"))
		} finally {
			release?.()
			const cleanup = async () => {
				if (heartbeat) clearInterval(heartbeat)
				signal?.removeEventListener("abort", stop)
				if (claimed)
					await redis
						.eval(
							"if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0",
							1,
							keys[1],
							owner,
						)
						.catch(() => {})
			}
			if (background.size) {
				void (async () => {
					while (background.size) await Promise.allSettled([...background])
					await cleanup()
				})()
			} else await cleanup()
		}
	}
}
export const rankedSearch = createRankedSearch()
