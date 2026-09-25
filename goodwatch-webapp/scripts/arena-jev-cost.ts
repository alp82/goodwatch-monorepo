// Search arena: measure uncached Jev reading cost and latency. Calls the TypeSafe API
// directly with the production request builders; never touches the search store.
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { fetch } from "undici";
import { TypeSafeClient, type SystemOneRequest } from "@typesafe-ai/sdk";
import {
	attributeRequest,
	fingerprintRequest,
} from "~/server/combined-search/reading-retrieval.server";
import { JEV_MODEL } from "~/server/search-runtime/runtime.server";

const NANO = 42;
const client = new TypeSafeClient({
	fetch: fetch as unknown as typeof globalThis.fetch,
	apiKey: process.env.TYPESAFE_API_KEY!,
	baseURL: "https://api.typesafe.ai",
	defaultModel: JEV_MODEL,
	timeout: 15000,
	retry: { maxRetries: 0 },
	logLevel: "off",
});
const call = async (request: SystemOneRequest) => {
	const t = performance.now();
	const r = await client.systemOne({ ...request, model: JEV_MODEL });
	return {
		ms: Math.round(performance.now() - t),
		questions: Object.keys(request.questions).length,
		usage: r.usage,
		bytes: JSON.stringify(request).length,
	};
};
const subset = (req: SystemOneRequest, keys: number) => {
	const dims = [
		...new Set(Object.keys(req.questions).map((k) => k.split(":")[1])),
	].slice(0, keys);
	return {
		...req,
		questions: Object.fromEntries(
			Object.entries(req.questions).filter(([k]) =>
				dims.includes(k.split(":")[1]),
			),
		),
	};
};

const queries = process.argv.slice(2).length
	? process.argv.slice(2)
	: [
			"submarine standoff with a mutiny",
			"cozy mystery in an english village",
			"lighthouse keeper slowly losing his mind in winter",
			"heist crew of retired grandmothers",
			"chess prodigy rivalry in cold war moscow",
		];
const out: unknown[] = [];
let totalTokens = 0;
for (const q of queries) {
	const [attribute, fingerprint] = await Promise.all([
		call(attributeRequest(q)),
		call(fingerprintRequest(q)),
	]);
	totalTokens += attribute.usage.input_tokens + fingerprint.usage.input_tokens;
	const row = { q, attribute, fingerprint };
	out.push(row);
	console.log(JSON.stringify(row));
}
// Scaling: fingerprint with fewer dimensions (2 questions each), one query.
const q = queries[0];
const scaling = [];
for (const dims of [1, 15, 30]) {
	const r = await call(subset(fingerprintRequest(q), dims));
	totalTokens += r.usage.input_tokens;
	scaling.push({ dims, ...r });
	console.log(JSON.stringify({ dims, ...r }));
}
console.log(
	`total input tokens ${totalTokens}, spend $${((totalTokens * NANO) / 1e9).toFixed(5)}`,
);
writeFileSync(
	process.env.OUT || "/dev/null",
	JSON.stringify({ out, scaling, totalTokens }, null, 2),
);
process.exit(0);
