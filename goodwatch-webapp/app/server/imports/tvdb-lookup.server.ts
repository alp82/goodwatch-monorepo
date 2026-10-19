import { setTimeout as delay } from "node:timers/promises"
import { z } from "zod"
import {
	BackendTimeoutError,
	TMDB_TIMEOUT_DEFAULT_MS,
	timeoutSetting,
	withBackendTimeout,
} from "../../utils/backend-timeout.ts"

const id = z.number().int().safe().positive()
const resultSchema = z
	.object({
		tv_results: z.array(z.object({ id })).optional(),
		tv_episode_results: z.array(z.object({ id, show_id: id })).optional(),
	})
	.refine(
		(result) =>
			result.tv_results !== undefined ||
			result.tv_episode_results !== undefined,
	)
	.transform((result) => ({
		tv_results: result.tv_results ?? [],
		tv_episode_results: result.tv_episode_results ?? [],
	}))
export type TvdbLookupResult = z.output<typeof resultSchema>
export type TvdbLookup = (
	id: number,
	kind?: "show" | "episode",
) => Promise<TvdbLookupResult>
export class TvdbLookupUnavailable extends Error {
	constructor() {
		super("The TVDB lookup is unavailable; retry this import later.")
	}
}
export class TvdbLookupBudgetExceeded extends Error {
	constructor() {
		super(
			"This preview reached its lookup limit. Run the import again to match more.",
		)
	}
}
export class TvdbLookupPending extends TvdbLookupBudgetExceeded {
	constructor() {
		super()
		this.message = "GoodWatch is still matching this title."
	}
}
export function tvdbLookupProblem(error: unknown) {
	return {
		outcome: "unmatched" as const,
		code:
			error instanceof TvdbLookupPending
				? "tvtime_lookup_pending"
				: error instanceof TvdbLookupBudgetExceeded
					? "tvtime_lookup_budget_exhausted"
					: "tvtime_lookup_unavailable",
		reason:
			error instanceof TvdbLookupBudgetExceeded
				? error.message
				: "TMDB's TVDB lookup is unavailable; retry this import later.",
	}
}
interface LookupOptions {
	now?: () => number
	wait?: (ms: number) => Promise<void>
	concurrency?: number
	budgetMs?: number
	maxRequests?: number
}
export const TVDB_LOOKUP_LIMITS = {
	concurrency: 4,
	budgetMs: 30_000,
	maxRequests: 2_000,
	maxAttempts: 3,
} as const
/** One transport per preview. Failures are never retained as identity evidence. */
export function createTvdbLookup(options: LookupOptions = {}): TvdbLookup {
	const now = options.now ?? Date.now
	const wait =
		options.wait ??
		(async (ms) => {
			await delay(ms)
		})
	const pending = new Map<number, Promise<TvdbLookupResult>>()
	const concurrency = options.concurrency ?? TVDB_LOOKUP_LIMITS.concurrency
	const deadline = now() + (options.budgetMs ?? TVDB_LOOKUP_LIMITS.budgetMs)
	const maxRequests = options.maxRequests ?? TVDB_LOOKUP_LIMITS.maxRequests
	let requests = 0
	let active = 0
	const queue: Array<() => void> = []
	const acquire = async () => {
		if (active < concurrency) {
			active++
			return
		}
		await new Promise<void>((resolve) => queue.push(resolve))
	}
	const release = () => {
		const next = queue.shift()
		if (next) next()
		else active--
	}
	const remaining = () => {
		const ms = deadline - now()
		if (ms <= 0 || requests >= maxRequests) throw new TvdbLookupBudgetExceeded()
		return ms
	}
	let cooldownUntil = 0
	const load = async (tvdbId: number): Promise<TvdbLookupResult> => {
		await acquire()
		try {
			for (
				let attempt = 0;
				attempt < TVDB_LOOKUP_LIMITS.maxAttempts;
				attempt++
			) {
				remaining()
				while (cooldownUntil > now()) {
					const pause = cooldownUntil - now()
					if (pause >= remaining()) throw new TvdbLookupBudgetExceeded()
					await wait(pause)
				}
				const timeLeft = remaining()
				const requestTimeout = timeoutSetting(
					"TMDB_TIMEOUT_MS",
					TMDB_TIMEOUT_DEFAULT_MS,
				)
				const timeoutMs = Math.min(timeLeft, requestTimeout)
				requests++
				const query = new URLSearchParams({
					api_key: process.env.TMDB_API_KEY ?? "",
					language: "en-US",
					external_source: "tvdb_id",
				})
				const result = await withBackendTimeout(
					"TMDB TVDB lookup",
					timeoutMs,
					async (signal) => {
						const response = await fetch(
							`https://api.themoviedb.org/3/find/${tvdbId}?${query}`,
							{ signal },
						)
						if (response.status === 429) {
							const retryAfter = response.headers.get("Retry-After")
							const seconds =
								retryAfter !== null && /^\d+(?:\.\d+)?$/.test(retryAfter.trim())
									? Number(retryAfter) * 1000
									: Number.NaN
							const date =
								retryAfter === null ? Number.NaN : Date.parse(retryAfter)
							const pause = Number.isFinite(seconds)
								? seconds
								: Number.isFinite(date)
									? Math.max(0, date - now())
									: 500 * 2 ** attempt
							cooldownUntil = Math.max(cooldownUntil, now() + pause)
							await response.body?.cancel()
							return null
						}
						if (!response.ok) {
							await response.body?.cancel()
							throw new TvdbLookupUnavailable()
						}
						return resultSchema.parse(await response.json())
					},
				).catch((error: unknown) => {
					if (
						error instanceof BackendTimeoutError &&
						timeLeft <= requestTimeout
					)
						throw new TvdbLookupBudgetExceeded()
					throw error
				})
				if (result) return result
			}
			throw new TvdbLookupUnavailable()
		} finally {
			release()
		}
	}
	return (tvdbId) => {
		let request = pending.get(tvdbId)
		if (!request) {
			request = load(tvdbId).catch((error: unknown) => {
				pending.delete(tvdbId)
				if (error instanceof TvdbLookupBudgetExceeded) throw error
				throw new TvdbLookupUnavailable()
			})
			pending.set(tvdbId, request)
		}
		return request
	}
}
