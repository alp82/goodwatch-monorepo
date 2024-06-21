import crypto from "node:crypto";
import Redis from "ioredis";
import type { ClusterNode } from "ioredis/built/cluster";
import type { ClusterOptions } from "ioredis/built/cluster/ClusterOptions";

const clusterNodes: ClusterNode[] = [
	{
		host: process.env.REDIS_HOST || "",
		port: Number.parseInt(process.env.REDIS_PORT || ""),
	},
	{
		host: process.env.REDIS_HOST2 || "",
		port: Number.parseInt(process.env.REDIS_PORT || ""),
	},
	{
		host: process.env.REDIS_HOST3 || "",
		port: Number.parseInt(process.env.REDIS_PORT || ""),
	},
];
const redisOptions: ClusterOptions = {
	dnsLookup: (address, callback) => callback(null, address),
	redisOptions: {
		password: process.env.REDIS_PASS || "",
	},
};

// Create a new Redis client instance
const cluster = new Redis.Cluster(clusterNodes, redisOptions);

cluster.on("error", (err) => {
	console.error("Redis Cluster Error:", err);
});

interface JsonData {
	[key: string]: any;
}

function serializeJson(obj: JsonData): string {
	const sortedKeys = Object.keys(obj).sort();
	const sortedObj: JsonData = {};
	for (const key of sortedKeys) {
		sortedObj[key] = obj[key];
	}
	return JSON.stringify(sortedObj);
}

function generateCacheKey(data: JsonData): string {
	const serializedData = serializeJson(data);
	return crypto.createHash("sha256").update(serializedData).digest("hex");
}

async function cacheSet<CacheData extends JsonData>(
	namespace: string,
	key: string,
	data: CacheData,
	ttl: number,
): Promise<void> {
	const namespaceKey = `${namespace}:${key}`;
	const timestamp = Date.now();
	const jsonData = JSON.stringify({
		data,
		timestamp,
	});
	await cluster.setex(namespaceKey, ttl || 1, jsonData);
}

async function cacheGet<CacheData extends JsonData>(
	namespace: string,
	key: string,
): Promise<CacheData | null> {
	const namespaceKey = `${namespace}:${key}`;
	const result = await cluster.get(namespaceKey);
	return result ? JSON.parse(result) : null;
}

async function cacheDelete(namespace: string, key: string): Promise<number> {
	const namespaceKey = `${namespace}:${key}`;
	return await cluster.del(namespaceKey);
}

export type TargetFunction<Params, Return> = (args: Params) => Promise<Return>;

export interface CachedParams<Params, Return> {
	target: TargetFunction<Params, Return>;
	params: Params;
	name: string;
	ttlMinutes: number;
}

export const cached = async <
	Params extends Partial<Record<keyof Params, unknown>>,
	Return extends JsonData,
>({
	target,
	params,
	name,
	ttlMinutes,
}: CachedParams<Params, Return>): Promise<Return> => {
	const cacheName = `cached-${name}`;
	const cacheKey = generateCacheKey(params);

	// check cache for existing entries within TTL
	const cachedResult = await cacheGet<Return>(cacheName, cacheKey);
	if (cachedResult) {
		const { timestamp, data } = cachedResult;
		if (Date.now() - timestamp < 1000 * 60 * ttlMinutes) {
			const sizeKB = Math.round(Buffer.byteLength(JSON.stringify(data)) / 1024);
			const size =
				sizeKB < 1000 ? `${sizeKB} KB` : `${(sizeKB / 1024).toFixed(2)} MB`;
			if (sizeKB >= 300) {
				console.warn({ cacheName, size, params });
			}
			return data as Return;
		}
	}

	// fetch data if no cache hit
	const results = await target(params);

	// update cache
	try {
		await cacheSet<Return>(cacheName, cacheKey, results, ttlMinutes * 60);
	} catch (error) {
		console.error({ error });
	}

	return results;
};

interface ResetCacheParams {
	params: JsonData;
	name: string;
}

export const resetCache = async ({
	params,
	name,
}: ResetCacheParams): Promise<number> => {
	const cacheName = `cached-${name}`;
	const cacheKey = generateCacheKey(params);
	return await cacheDelete(cacheName, cacheKey);
};
