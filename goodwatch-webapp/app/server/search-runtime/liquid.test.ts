import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { SystemOneRequest } from "@typesafe-ai/sdk";
import {
	readLiquid,
	LiquidContractError,
	LIQUID_RESPONSE_MODEL,
	overflowConfiguration,
} from "./liquid.server.ts";

const requests: [SystemOneRequest, SystemOneRequest] = [
	{ state: { request: "quiet movies" }, questions: { mood: { type: "noul" } } },
	{
		state: { request: "quiet movies" },
		questions: { movie: { type: "choice", criteria: { yes: null, no: null } } },
	},
];
function answer(request: SystemOneRequest) {
	return {
		model: LIQUID_RESPONSE_MODEL,
		provider: "Liquid",
		usage: { input_tokens: 100, output_tokens: 0, cost: 0.000002 },
		answers: Object.fromEntries(
			Object.entries(request.questions).map(([key, q]) => [
				key,
				q.type === "noul"
					? { type: "noul", noul: 0.9 }
					: {
							type: "choice",
							choice: "yes",
							confidence: 0.8,
							probabilities: { yes: 0.9, no: 0.1 },
						},
			]),
		),
	};
}
const mockFetch =
	(run: (request: SystemOneRequest) => unknown): typeof fetch =>
	async (_url, init) =>
		Response.json(run(JSON.parse(String(init?.body))));

test("overflow requires its own key and positive precise budget, never the shared key", (t) => {
	const previous = { ...process.env };
	t.after(() => {
		process.env = previous;
	});
	delete process.env.OPENROUTER_DECISION_MODELS_API_KEY;
	process.env.OPENROUTER_API_KEY = "shared-test";
	process.env.OPENROUTER_DECISION_MODELS_MONTHLY_BUDGET_USD = "1";
	assert.equal(overflowConfiguration(), undefined);
	process.env.OPENROUTER_DECISION_MODELS_API_KEY = "dedicated-test";
	for (const invalid of [
		"",
		"0",
		"-1",
		"NaN",
		"Infinity",
		"1e2",
		"1.0000000001",
		"99999999999999999",
	]) {
		process.env.OPENROUTER_DECISION_MODELS_MONTHLY_BUDGET_USD = invalid;
		assert.equal(overflowConfiguration(), undefined, invalid);
	}
	process.env.OPENROUTER_DECISION_MODELS_MONTHLY_BUDGET_USD = "1.000000001";
	assert.deepEqual(overflowConfiguration(), {
		apiKey: "dedicated-test",
		monthlyNano: 1_000_000_001,
	});
});

test("every production benchmark Liquid finalist result decodes identically through the runtime transport offline", async () => {
	const { loadProduction } = await import(
		new URL(
			"../../../scripts/interpretation-bench/production.mjs",
			import.meta.url,
		).href
	);
	const api = await loadProduction();
	const lines = gunzipSync(
		readFileSync(
			new URL(
				"../../../scripts/interpretation-bench/overflow-2026-11-12/confirmation/trials.jsonl.gz",
				import.meta.url,
			),
		),
	)
		.toString()
		.trim()
		.split("\n");
	let count = 0;
	for (const line of lines) {
		const trial = JSON.parse(line);
		if (trial.model !== "liquid-d1.1" || trial.status !== "ok") continue;
		const text = api.normalize(trial.query);
		const production: [SystemOneRequest, SystemOneRequest] = [
			api.attributeRequest(text),
			api.fingerprintRequest(text),
		];
		let index = 0;
		const result = await readLiquid(
			production,
			"dedicated-test",
			new AbortController().signal,
			async (url, init) => {
				assert.equal(url, "https://openrouter.ai/api/alpha/decisions");
				assert.equal(init?.redirect, "error");
				assert.equal(
					(init?.headers as Record<string, string>).Authorization,
					"Bearer dedicated-test",
				);
				const body = JSON.parse(String(init?.body));
				assert.deepEqual(body.provider, {
					only: ["liquid"],
					allow_fallbacks: false,
					max_price: { prompt: "0.02", completion: "0", request: "0" },
				});
				const trace = trial.requestTraces[index++];
				assert.deepEqual(Object.keys(body.questions), trace.questionKeys);
				assert.deepEqual(body.state, production[trace.group].state);
				assert.deepEqual(
					body.questions,
					Object.fromEntries(
						trace.questionKeys.map((k: string) => [
							k,
							production[trace.group].questions[k],
						]),
					),
				);
				return Response.json(trace.response);
			},
		);
		assert.equal(
			index,
			3,
			"all 148 fingerprint questions and the attributes must be retained",
		);
		assert.deepEqual(
			api.readingFields(text, result.readings, false),
			trial.fields,
		);
		assert.ok(Math.abs(result.chargedNano / 1e9 - trial.costUsd) < 1.1e-9);
		count++;
	}
	assert.equal(
		count,
		211,
		"five measured passes of all 42 cases and one warmup",
	);
});

for (const scenario of [
	"missing",
	"extra",
	"model",
	"provider",
	"truncated",
	"probability",
	"distribution",
	"cost",
] as const) {
	test(`native ${scenario} violation is rejected, with known billing retained`, async () => {
		await assert.rejects(
			readLiquid(
				requests,
				"test",
				new AbortController().signal,
				mockFetch((request) => {
					const raw = answer(request);
					if (scenario === "missing") raw.answers = {};
					if (scenario === "extra")
						raw.answers.extra = { type: "noul", noul: 0.5 };
					if (scenario === "model") raw.model = "different-model";
					if (scenario === "provider") raw.provider = "different-provider";
					if (scenario === "truncated")
						Object.assign(raw.usage, { state_tokens_dropped: 1 });
					if (scenario === "probability" && raw.answers.mood)
						raw.answers.mood.noul = 1.1;
					if (scenario === "distribution" && raw.answers.movie)
						raw.answers.movie.probabilities = { yes: 0.9, no: 0.9 };
					if (scenario === "cost") Object.assign(raw.usage, { cost: null });
					return raw;
				}),
			),
			(error) => {
				assert.ok(error instanceof LiquidContractError);
				assert.equal(error.chargedNano, scenario === "cost" ? null : 4000);
				return true;
			},
		);
	});
}

test("at most two HTTP requests are active and no further chunks start after cancellation", async () => {
	const many: [SystemOneRequest, SystemOneRequest] = requests.map((r) => ({
		...r,
		questions: Object.fromEntries(
			Array.from({ length: 300 }, (_, i) => [
				`n${i}`,
				{ type: "noul" as const },
			]),
		),
	})) as typeof requests;
	let active = 0,
		maximum = 0,
		calls = 0;
	await readLiquid(
		many,
		"test",
		new AbortController().signal,
		async (_url, init) => {
			calls++;
			active++;
			maximum = Math.max(maximum, active);
			await new Promise((resolve) => setImmediate(resolve));
			active--;
			return Response.json(answer(JSON.parse(String(init?.body))));
		},
	);
	assert.equal(maximum, 2);
	assert.equal(calls, 6);
	const controller = new AbortController();
	calls = 0;
	await assert.rejects(
		readLiquid(many, "test", controller.signal, async (_url, init) => {
			calls++;
			controller.abort();
			return Response.json(answer(JSON.parse(String(init?.body))));
		}),
	);
	assert.ok(calls <= 2);
});

test("provider rejection sends no retry or later chunk", async () => {
	let calls = 0;
	const many = requests.map((r) => ({
		...r,
		questions: Object.fromEntries(
			Array.from({ length: 300 }, (_, i) => [
				`n${i}`,
				{ type: "noul" as const },
			]),
		),
	})) as typeof requests;
	await assert.rejects(
		readLiquid(many, "test", new AbortController().signal, async () => {
			calls++;
			return new Response(null, { status: 402 });
		}),
	);
	assert.equal(calls, 2);
});
