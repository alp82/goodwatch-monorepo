import { randomUUID } from "node:crypto";
import { cacheEntryKey, getRedisCluster } from "~/utils/cache";
import {
	computeShowcaseExamples,
	SHOWCASE_ITEMS,
	type ShowcaseExamplesResult,
} from "~/server/showcase-examples.server";

const CACHE_TTL_SECONDS = 24 * 60 * 60;
const LEASE_SECONDS = 5 * 60;
const CACHE_KEY = cacheEntryKey("showcase-examples", { country: "DE" });
// The existing cache key has no hash tag. This tag places the lease in its slot.
const LEASE_KEY = `{${CACHE_KEY}}:warmup`;

export class HomepageWarmupFailure extends Error {
	constructor(
		public readonly reason: string,
		public readonly status = 503,
	) {
		super(reason);
	}
}

function verifyExamples(examples: ShowcaseExamplesResult): void {
	if (examples.length !== SHOWCASE_ITEMS.length) {
		throw new HomepageWarmupFailure("incomplete_result");
	}
	for (const [index, expected] of SHOWCASE_ITEMS.entries()) {
		const item = examples[index];
		if (
			item.tmdb_id !== Number(expected.id) ||
			item.mediaType !== expected.type ||
			typeof item.title !== "string" ||
			!item.title.trim() ||
			!Number.isInteger(item.release_year) ||
			item.release_year <= 0 ||
			(item.poster_path !== null && typeof item.poster_path !== "string") ||
			(item.backdrop_path !== null && typeof item.backdrop_path !== "string") ||
			!Array.isArray(item.streaming_services) ||
			item.streaming_services.some(
				(service) =>
					!Number.isInteger(service.id) ||
					typeof service.name !== "string" ||
					!service.name.trim() ||
					typeof service.logo_path !== "string",
			) ||
			Object.values(item.ratings).some(
				(score) => score !== null && !Number.isFinite(score),
			)
		) {
			throw new HomepageWarmupFailure("incomplete_result");
		}
	}
}

export async function warmAnonymousHomepage() {
	const redis = getRedisCluster();
	if (!redis) throw new HomepageWarmupFailure("redis_unavailable");
	const owner = randomUUID();
	const acquired = await redis.set(LEASE_KEY, owner, "EX", LEASE_SECONDS, "NX");
	if (acquired !== "OK")
		throw new HomepageWarmupFailure("already_running", 409);
	try {
		// Skip both cache levels; this calls the normal database queries and transforms.
		const examples = await computeShowcaseExamples(
			{ country: "DE" },
			{ bypassCache: true },
		);
		verifyExamples(examples);
		const timestamp = Date.now();
		const serialized = JSON.stringify({ data: examples, timestamp });
		const confirmed = await redis.eval(
			`
			if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
			redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
			if redis.call('GET', KEYS[2]) ~= ARGV[2] then return -1 end
			return redis.call('TTL', KEYS[2])
		`,
			2,
			LEASE_KEY,
			CACHE_KEY,
			owner,
			serialized,
			CACHE_TTL_SECONDS,
		);
		if (confirmed !== CACHE_TTL_SECONDS) {
			throw new HomepageWarmupFailure(
				confirmed === 0 ? "lease_lost" : "write_unverified",
			);
		}
		return {
			status: "refreshed" as const,
			country: "DE",
			language: "en",
			item_count: examples.length,
			identities: examples.map((item) => `${item.mediaType}/${item.tmdb_id}`),
			computed_at: new Date(timestamp).toISOString(),
			ttl_seconds: CACHE_TTL_SECONDS,
			write_verified: true,
		};
	} finally {
		// Never release another invocation's lease, including after our lease expires.
		await redis.eval(
			`
			if redis.call('GET', KEYS[1]) == ARGV[1] then
				return redis.call('DEL', KEYS[1])
			end
			return 0
		`,
			1,
			LEASE_KEY,
			owner,
		);
	}
}
