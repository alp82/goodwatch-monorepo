import { createHash } from "node:crypto"
import { setTimeout as sleep } from "node:timers/promises"
import { z } from "zod"
import { getRedisCluster } from "../../utils/cache.ts"
import { type RateVerdict, rateLimiter } from "../rate-limit.server.ts"
import {
	ResolutionBudget,
	type ResolutionContext,
	ResolutionStopped,
} from "./resolution-job.server.ts"
import { resolutionStore } from "./resolution-store.server.ts"
const id = z.number().int().positive()
const schemas = {
	find: z
		.object({
			tv_results: z.array(z.object({ id })).optional(),
			tv_episode_results: z.array(z.object({ id, show_id: id })).optional(),
		})
		.refine(
			(v) => v.tv_results !== undefined || v.tv_episode_results !== undefined,
		)
		.transform((v) => ({
			tv_results: v.tv_results ?? [],
			tv_episode_results: v.tv_episode_results ?? [],
		})),
	search: z.object({
		results: z.array(
			z.object({
				id,
				title: z.string().optional(),
				original_title: z.string().optional(),
				release_date: z.string().optional(),
			}),
		),
		total_pages: z.number().int().min(0).max(500),
	}),
	movie: z.object({
		id,
		title: z.string(),
		original_title: z.string(),
		original_language: z.string().optional(),
		release_date: z.string(),
		alternative_titles: z.object({
			titles: z
				.array(
					z.object({ title: z.string(), iso_3166_1: z.string().optional() }),
				)
				.max(5000),
		}),
		translations: z.object({
			translations: z
				.array(
					z.object({
						iso_3166_1: z.string().optional(),
						iso_639_1: z.string().optional(),
						data: z.object({ title: z.string().optional() }),
					}),
				)
				.max(5000),
		}),
		release_dates: z.object({
			results: z
				.array(
					z.object({
						iso_3166_1: z.string(),
						release_dates: z
							.array(
								z.object({ release_date: z.string(), type: z.number().int() }),
							)
							.max(5000),
					}),
				)
				.max(500),
		}),
	}),
}
let active = 0
const queue: (() => void)[] = []
async function acquire() {
	if (active < 4) {
		active++
		return
	}
	await new Promise<void>((r) => queue.push(r))
}
function release() {
	const next = queue.shift()
	if (next) next()
	else active--
}
export function createResolutionTmdb(
	options: {
		fetch?: typeof fetch
		now?: () => number
		wait?: (ms: number) => Promise<void>
		take?: () => Promise<RateVerdict>
		cache?: boolean
	} = {},
) {
	const now = options.now ?? Date.now
	const wait =
		options.wait ??
		(async (ms) => {
			await sleep(ms)
		})
	let cooldown = 0
	const rateKey = createHash("sha256")
		.update(process.env.TMDB_API_KEY ?? "")
		.digest("hex")
		.slice(0, 24)
	const cooldownKey = `import-tmdb:{${rateKey}}:cooldown`
	async function check(ctx: ResolutionContext) {
		if (ctx.localCheck) ctx.localCheck()
		else await ctx.check()
	}

	async function pause(ctx: ResolutionContext, ms: number) {
		if (ms >= ctx.job.deadline - now()) throw new ResolutionBudget()
		for (let left = ms; left > 0; ) {
			await check(ctx)
			const delay = Math.min(left, 1000)
			await wait(delay)
			left -= delay
		}
	}
	return {
		async get(
			ctx: ResolutionContext,
			path: string,
			params: Record<string, string> = {},
		) {
			const schema = /^\/find\/\d+$/.test(path)
				? schemas.find
				: path === "/search/movie"
					? schemas.search
					: /^\/movie\/\d+$/.test(path)
						? schemas.movie
						: null
			if (!schema) throw Error("Unsupported import lookup")
			const cacheKey = `cache/${ctx.job.root}/${createHash("sha256")
				.update(path + JSON.stringify(params))
				.digest("hex")}`
			if (options.cache !== false) {
				const local = ctx.lookupCache?.get(cacheKey)
				if (local !== undefined) {
					await check(ctx)
					return local
				}
				const hit = await resolutionStore.read(cacheKey)
				if (hit) {
					await check(ctx)
					return hit.value
				}
			}
			await acquire()
			try {
				for (let attempt = 0; attempt < 3; attempt++) {
					await check(ctx)
					try {
						const shared = Number(await getRedisCluster()?.get(cooldownKey))
						if (Number.isFinite(shared)) cooldown = Math.max(cooldown, shared)
					} catch {}
					if (cooldown > now()) await pause(ctx, cooldown - now())
					for (;;) {
						const permit = await (options.take?.() ??
							rateLimiter.take("import-tmdb", rateKey, [
								{ limit: 20, seconds: 1 },
							]))
						if (permit.allowed) break
						await pause(ctx, permit.retryAfterSeconds * 1000)
					}
					await ctx.attempt()
					await check(ctx)
					const url = new URL(`https://api.themoviedb.org/3${path}`)
					for (const [k, v] of Object.entries({
						api_key: process.env.TMDB_API_KEY ?? "",
						language: "en-US",
						...params,
					}))
						url.searchParams.set(k, v)
					try {
						const response = await (options.fetch ?? fetch)(url, {
							signal: AbortSignal.any([
								ctx.signal,
								AbortSignal.timeout(
									Math.min(5000, Math.max(1, ctx.job.deadline - now())),
								),
							]),
						})
						if (response.status === 429) {
							const raw = response.headers.get("Retry-After") ?? ""
							const seconds = /^\d+(?:\.\d+)?$/.test(raw)
								? Number(raw) * 1000
								: Number.NaN
							const date = Date.parse(raw)
							cooldown = Math.max(
								cooldown,
								now() +
									(Number.isFinite(seconds)
										? seconds
										: Number.isFinite(date)
											? Math.max(0, date - now())
											: 500 * 2 ** attempt),
							)
							await response.body?.cancel()
							try {
								await getRedisCluster()?.set(
									cooldownKey,
									String(cooldown),
									"PX",
									Math.max(1, cooldown - now()),
								)
							} catch {}
							continue
						}
						if (!response.ok) {
							await response.body?.cancel()
							throw Error("Provider unavailable")
						}
						const value = schema.parse(await response.json())
						await check(ctx)
						if (options.cache !== false) {
							if (ctx.deferCache) ctx.deferCache(cacheKey, value)
							else await ctx.commit(cacheKey, value)
						}
						return value
					} catch (error) {
						if (ctx.signal.aborted) throw new ResolutionStopped()
						if (
							error instanceof ResolutionBudget ||
							error instanceof ResolutionStopped
						)
							throw error
						if (attempt === 2) throw Error("Provider unavailable")
						await pause(ctx, 500 * 2 ** attempt)
					}
				}
				throw Error("Provider unavailable")
			} finally {
				release()
			}
		},
	}
}
export const resolutionTmdb = createResolutionTmdb()
