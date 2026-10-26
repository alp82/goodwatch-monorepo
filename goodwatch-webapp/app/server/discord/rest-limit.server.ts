import { rateLimiter, type EvalClient } from "../rate-limit.server.ts"
import { getRedisCluster } from "../../utils/cache"

export interface RestBudget {
	/** Reserves one attempt, or returns the milliseconds to wait before trying again. */
	take(): Promise<number>
	/** Extends the shared cooldown after Discord reports a global 429. */
	pause(milliseconds: number): Promise<void>
}

const COOLDOWN_KEY = "discord-rest:{global}:cooldown"
export const REST_COOLDOWN_SCRIPT = `
local remaining = redis.call('PTTL', KEYS[1])
local delay = tonumber(ARGV[1])
if delay > remaining and delay > 0 then
	redis.call('SET', KEYS[1], '1', 'PX', delay)
	remaining = delay
end
return math.max(0, remaining)
`

/** All REST clients and page processes share one budget, without tokens or identities in its keys. */
export function createRestBudget(
	options: {
		limiter?: Pick<typeof rateLimiter, "take">
		redis?: () => EvalClient | null
		now?: () => number
	} = {},
): RestBudget {
	const limiter = options.limiter ?? rateLimiter
	const redis = options.redis ?? (() => getRedisCluster() as EvalClient | null)
	const now = options.now ?? Date.now
	let until = 0
	async function cooldown(delay: number) {
		// Keep the local cooldown even when Valkey fails after a successful shared write.
		until = Math.max(until, now() + delay)
		try {
			const client = redis()
			if (client) {
				const remaining = Number(
					await client.eval(REST_COOLDOWN_SCRIPT, 1, COOLDOWN_KEY, delay),
				)
				if (Number.isFinite(remaining) && remaining > 0)
					until = Math.max(until, now() + remaining)
			}
		} catch {
			// Like the request counter, cooldowns fall back to this process during an outage.
		}
		return Math.max(0, until - now())
	}
	return {
		async take() {
			const remaining = await cooldown(0)
			if (remaining > 0) return remaining
			const verdict = await limiter.take("discord-rest", "global", [
				{ limit: 50, seconds: 1 },
			])
			return verdict.allowed ? 0 : verdict.retryAfterSeconds * 1000
		},
		async pause(milliseconds) {
			await cooldown(Math.ceil(milliseconds))
		},
	}
}

export const discordRestBudget = createRestBudget()
