import assert from "node:assert/strict";
import { test } from "node:test";
import * as nodeModule from "node:module";
import type { SearchStore, Claim } from "./store.server.ts";
import type { JevStageInput } from "./runtime.server.ts";

// runtime.server.ts imports its neighbours without `.ts`, which Node doesn't resolve, and the real store can't load
// under `node --test` (see runtime-test-store.ts). Only that module's own imports are redirected: the shared test
// alias also rewrites the relative requires inside undici, which then fail. The installed Node types predate
// registerHooks.
type Resolve = (specifier: string, context: { parentURL?: string }) => unknown;
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		resolve(...args: [...Parameters<Resolve>, Resolve]): unknown;
	}): void;
};
const redirects: Record<string, string> = {
	"./telemetry.server": new URL("./telemetry.server.ts", import.meta.url).href,
	"../role.server": new URL("../role.server.ts", import.meta.url).href,
	"./store.server": new URL("./runtime-test-store.ts", import.meta.url).href,
	"../lifecycle.server": new URL("../lifecycle.server.ts", import.meta.url).href,
};
registerHooks({
	resolve(specifier, context, nextResolve) {
		const fromRuntime = context.parentURL?.endsWith(
			"/search-runtime/runtime.server.ts",
		);
		return nextResolve(
			(fromRuntime && redirects[specifier]) || specifier,
			context,
		);
	},
});
const { executeJevStage } = await import("./runtime.server.ts");

test("different invocation origins reuse the same reading key and resolve verified actors before reservation", async (t) => {
	const originalKey = process.env.TYPESAFE_API_KEY;
	process.env.TYPESAFE_API_KEY = "test-key";
	t.after(() => { if (originalKey === undefined) delete process.env.TYPESAFE_API_KEY; else process.env.TYPESAFE_API_KEY = originalKey });
	const keys: string[] = [];
	const origins: unknown[] = [];
	const store = {
		digest: (value: string) => value,
		lookup: async (key: string) => { keys.push(key); return null },
		claimChecks: async () => [[], []],
		claim: async (input: Parameters<SearchStore["claim"]>[0]) => {
			await input.scopes;
			origins.push(typeof input.attribution === "function" ? await input.attribution() : input.attribution);
			return { kind: "basic", reason: "budget" };
		},
	} as unknown as SearchStore;
	for (const [surface, trigger, accountId] of [["start", "typing_pause", null], ["header", "enter", "verified-member"]] as const) {
		await executeJevStage(store, {
			requestText: "quiet films", questionVersion: "test", language: { mode: "english", version: "test" },
			requests: [{ state: { request: "quiet films" }, questions: {} }, { state: {}, questions: {} }],
			visitor: { accountId: Promise.resolve(accountId), networkIdentity: "test", attribution: { consumer: "web", surface, trigger, reported_by: "client", search_id: `${surface}-id` } },
		});
	}
	assert.equal(keys[0], keys[1], "origin and actor never affect reading identity");
	assert.deepEqual(origins, [
		{ version: 1, consumer: "web", surface: "start", trigger: "typing_pause", actor_kind: "guest", search_id: "start-id", reported_by: "client" },
		{ version: 1, consumer: "web", surface: "header", trigger: "enter", actor_kind: "member", search_id: "header-id", reported_by: "client" },
	]);
});

for (const scenario of [
	{ name: "cached reading", cached: true, key: false, calls: 0, kind: "cached" },
	{ name: "missing provider key", key: false, calls: 0, kind: "basic", reason: "configuration" },
	{ name: "coordination unavailable", key: true, calls: 0, kind: "basic", reason: "coordination" },
	{ name: "budget denied claim", key: true, calls: 0, kind: "basic", reason: "budget" },
	{ name: "rate limited claim", key: true, calls: 0, kind: "basic", reason: "rate" },
	{ name: "claimed reading with dispatch failure", key: true, calls: 1, kind: "basic", reason: "storage" },
	{ name: "throwing callback with dispatch failure", key: true, calls: 1, kind: "basic", reason: "storage", throws: true },
]) {
	test(scenario.name, async () => {
		const originalKey = process.env.TYPESAFE_API_KEY;
		if (scenario.key) process.env.TYPESAFE_API_KEY = "test-key";
		else delete process.env.TYPESAFE_API_KEY;
		let calls = 0;
		let dispatches = 0;
		const readings = [{}, {}];
		const store = {
			digest: () => "test-digest",
			claimChecks: async () => [[], []],
			lookup: async () => scenario.cached ? { kind: "cached", ciphertext: "test" } : null,
			unseal: () => readings,
			claim: async (): Promise<Claim> => (scenario.reason === "rate" || scenario.reason === "coordination" || scenario.reason === "budget")
				? { kind: "basic", reason: scenario.reason }
				: { kind: "claimed", id: "test-claim" },
			dispatch: async () => {
				dispatches++;
				assert.equal(calls, 1);
				throw new Error("Storage unavailable");
			},
		} as unknown as SearchStore;
		const input: JevStageInput = {
			requestText: "quiet films",
			questionVersion: "test-v1",
			language: { mode: "english", version: "test-v1" },
			requests: [
				{ state: { request: "quiet films" }, questions: {} },
				{ state: { request: "quiet films" }, questions: {} },
			],
			visitor: { accountId: null, networkIdentity: "test-network" },
			onClaimed: () => {
				calls++;
				if (scenario.throws) throw new Error("Preparation failed");
			},
		};
		try {
			const outcome = await executeJevStage(store, input);
			assert.equal(calls, scenario.calls);
			assert.equal(dispatches, scenario.calls);
			assert.equal(outcome.kind, scenario.kind);
			if (outcome.kind === "basic") assert.equal(outcome.reason, scenario.reason);
			else assert.deepEqual(outcome.readings, readings);
		} finally {
			if (originalKey === undefined) delete process.env.TYPESAFE_API_KEY;
			else process.env.TYPESAFE_API_KEY = originalKey;
		}
	});
}

test("page role starts no connection pings or timers even with a provider key", async (t) => {
	const originalRole = process.env.WEBAPP_ROLE;
	const originalKey = process.env.TYPESAFE_API_KEY;
	process.env.WEBAPP_ROLE = "page";
	process.env.TYPESAFE_API_KEY = "test-key";
	t.after(() => {
		if (originalRole === undefined) delete process.env.WEBAPP_ROLE;
		else process.env.WEBAPP_ROLE = originalRole;
		if (originalKey === undefined) delete process.env.TYPESAFE_API_KEY;
		else process.env.TYPESAFE_API_KEY = originalKey;
	});
	const { Agent } = await import("undici");
	const { keepJevConnectionsWarm } = await import("./runtime.server.ts");
	const unexpected = () => { throw new Error("Unexpected connection ping"); };
	const dispatch = t.mock.method(Agent.prototype, "dispatch", unexpected);
	const interval = t.mock.method(globalThis, "setInterval", unexpected);
	const timeout = t.mock.method(globalThis, "setTimeout", unexpected);
	keepJevConnectionsWarm();
	keepJevConnectionsWarm();
	for (const mock of [dispatch, interval, timeout]) assert.equal(mock.mock.callCount(), 0);
});

test("failed history writes emit anonymous evidence without changing the nonthrowing result", async (t) => {
	const { recordSearchHistory } = await import("./runtime.server.ts");
	const logged = t.mock.method(console, "info", () => {});
	const input = { text: "private input", accountId: "private-account", elapsedMs: 20, chargedNano: 0, outcome: "cached" as const, rankerVersion: "test" };
	assert.deepEqual(await recordSearchHistory(input), { recorded: false, id: null });
	const event = JSON.parse(logged.mock.calls[0].arguments[0]);
	assert.deepEqual(Object.keys(event).sort(), ["at", "event", "recorded"]);
	assert.equal(event.event, "search.history-write.v1");
	assert.equal(event.recorded, false);
	logged.mock.restore();
	t.mock.method(console, "info", () => { throw new Error("logger failure"); });
	assert.deepEqual(await recordSearchHistory(input), { recorded: false, id: null });
});

for (const fail of [false, true]) {
	test(`valid readings return before background finish ${fail ? "rejects" : "completes"}`, async (t) => {
		const { TypeSafeClient } = await import("@typesafe-ai/sdk");
		const { JEV_MODEL } = await import("./runtime.server.ts");
		const { trackedFinish } = await import("./runtime-test-store.ts");
		const originalKey = process.env.TYPESAFE_API_KEY;
		process.env.TYPESAFE_API_KEY = "test-key";
		t.after(() => { if (originalKey === undefined) delete process.env.TYPESAFE_API_KEY; else process.env.TYPESAFE_API_KEY = originalKey; });
		const reading = { model: JEV_MODEL, usage: { input_tokens: 10 }, answers: {} };
		t.mock.method(TypeSafeClient.prototype, "systemOne", async () => reading);
		const warning = t.mock.method(console, "warn", () => { if (fail) throw new Error("logging unavailable"); });
		let release!: () => void;
		const gate = new Promise<void>(resolve => { release = resolve; });
		let completed = false;
		const tracked = trackedFinish(async () => { await gate; completed = true; if (fail) throw new Error("storage unavailable"); });
		const finishes: unknown[][] = [];
		const primes: unknown[][] = [];
		const store = {
			digest: () => "key", lookup: async () => undefined, claimChecks: async () => [[], []],
			claim: async () => ({ kind: "claimed", id: "id" }), dispatch: async () => {},
			// A repeat of the search finds the reading in Redis while settlement still runs.
			prime: async (...args: unknown[]) => { primes.push(args); },
			finish: (...args: unknown[]) => { finishes.push(args); return tracked.finish(); },
		} as unknown as SearchStore;
		try {
			const outcome = await executeJevStage(store, {
				requestText: "quiet movies", questionVersion: "test", language: { mode: "english", version: "test" },
				requests: [{ state: {}, questions: {} }, { state: {}, questions: {} }],
				visitor: { accountId: null, networkIdentity: "test" },
			});
			assert.deepEqual(outcome, { kind: "ready", readings: [reading, reading], chargedNano: 840, interpretationProvider: "typesafe", interpretationModel: JEV_MODEL });
			assert.equal(completed, false);
			assert.deepEqual(finishes, [["id", 840, [reading, reading]]]);
			assert.deepEqual(primes, [["key", [reading, reading]]]);
			// The cache gets its own copy, so later changes to the returned readings can't reach it.
			assert.notEqual(primes[0][1], outcome.kind === "ready" ? outcome.readings : null);
			assert.equal(finishes[0][2], primes[0][1]);
		} finally {
			release();
			await tracked.drain();
			await new Promise(resolve => setImmediate(resolve));
		}
		assert.equal(completed, true);
		if (fail) assert.equal(warning.mock.callCount(), 1);
	});
}

const overflowInput = (): JevStageInput => ({
	requestText: "quiet movies", questionVersion: "overflow-test", language: { mode: "english", version: "test" },
	requests: [{ state: {}, questions: { mood: { type: "noul" } } }, { state: {}, questions: { style: { type: "noul" } } }],
	visitor: { accountId: null, networkIdentity: "test", attribution: { consumer: "web", surface: "start", trigger: "enter", reported_by: "client" } },
	admissionAttemptId: "trusted-attempt",
});
function overflowStore(claim: Claim = { kind: "claimed", id: "overflow-attempt" }) {
	const finishes: unknown[][] = [], keys: string[] = [], claims: Parameters<SearchStore["claim"]>[0][] = [];
	const store = {
		digest: (text: string) => text,
		lookup: async (key: string) => { keys.push(key); return undefined; },
		claimChecks: async () => [[], []],
		claim: async (input: Parameters<SearchStore["claim"]>[0]) => { await input.scopes; claims.push(input); return claim; },
		unseal: () => [{ cached: true }, { cached: true }],
		dispatch: async () => {}, prime: async () => {}, haltPaidAdmissions: async () => {},
		finish: async (...args: unknown[]) => { finishes.push(args); },
	} as unknown as SearchStore;
	return { store, finishes, keys, claims };
}

for (const denied of ["budget", "rate", "busy", "coordination", "storage", "navigation"] as const) {
	test(`ordinary ${denied} denial never activates paid overflow`, async t => {
		const saved = process.env.TYPESAFE_API_KEY; process.env.TYPESAFE_API_KEY = "test";
		t.after(() => { if (saved === undefined) delete process.env.TYPESAFE_API_KEY; else process.env.TYPESAFE_API_KEY = saved; });
		const { executeJevWithOverflow } = await import("./runtime.server.ts");
		const primary = overflowStore({ kind: "basic", reason: denied }), alternate = overflowStore();
		const result = await executeJevWithOverflow(primary.store, overflowInput(), { store: alternate.store, apiKey: "dedicated", read: async () => { throw new Error("Unexpected paid overflow"); } });
		assert.equal(result.kind, "basic"); assert.equal(alternate.keys.length, 0);
	});
}

test("cycle exhaustion selects separately claimed Liquid readings, preserves cache identity and meters once", async t => {
	const saved = process.env.TYPESAFE_API_KEY; process.env.TYPESAFE_API_KEY = "test";
	t.after(() => { if (saved === undefined) delete process.env.TYPESAFE_API_KEY; else process.env.TYPESAFE_API_KEY = saved; });
	const { executeJevWithOverflow } = await import("./runtime.server.ts");
	const { LIQUID_RESPONSE_MODEL, LIQUID_RESERVE_NANO } = await import("./liquid.server.ts");
	const primary = overflowStore({ kind: "basic", reason: "budget", overflowEligible: true }), alternate = overflowStore();
	const input = overflowInput(); let calls = 0, metered = 0, notified = 0;
	input.visitor.beforeUncachedReading = async () => { metered++; }; input.onClaimed = () => { notified++; };
	const readings = input.requests.map(r => ({ model: LIQUID_RESPONSE_MODEL, answers: Object.fromEntries(Object.keys(r.questions).map(k => [k, { type: "noul" as const, noul: 0.9 }])), usage: { input_tokens: 100, output_tokens: 0 } })) as [import("@typesafe-ai/sdk").SystemOneResult<import("@typesafe-ai/sdk").Questions>, import("@typesafe-ai/sdk").SystemOneResult<import("@typesafe-ai/sdk").Questions>];
	const outcome = await executeJevWithOverflow(primary.store, input, {
		store: alternate.store, apiKey: "dedicated", read: async (_requests, key) => {
			assert.equal(key, "dedicated"); calls++; return { readings, chargedNano: 4000 };
		},
	});
	assert.equal(outcome.kind, "ready"); assert.equal(outcome.chargedNano, 4000);
	assert.equal(outcome.interpretationProvider, "openrouter"); assert.equal(outcome.overflowReason, "cycle-budget");
	assert.equal(calls, 1); assert.equal(metered, 1); assert.equal(notified, 1);
	assert.notEqual(primary.keys[0], alternate.keys[0]);
	assert.equal(alternate.claims[0].reserveNano, LIQUID_RESERVE_NANO);
	assert.equal(alternate.claims[0].admissionAttemptId, input.admissionAttemptId);
	assert.equal(alternate.finishes[0][1], 4000);
});

test("fallback disabled, exhausted, cached and unknown-cost outcomes keep their accounting", async t => {
	const saved = process.env.TYPESAFE_API_KEY; process.env.TYPESAFE_API_KEY = "test";
	t.after(() => { if (saved === undefined) delete process.env.TYPESAFE_API_KEY; else process.env.TYPESAFE_API_KEY = saved; });
	const { executeJevWithOverflow } = await import("./runtime.server.ts");
	const { LIQUID_RESERVE_NANO } = await import("./liquid.server.ts");
	const primary = overflowStore({ kind: "basic", reason: "budget", overflowEligible: true });
	const disabled = await executeJevWithOverflow(primary.store, overflowInput());
	assert.equal(disabled.kind, "basic"); assert.equal(disabled.chargedNano, 0);
	for (const claim of [{ kind: "basic", reason: "budget" }, { kind: "cached", ciphertext: "cipher" }, { kind: "claimed", id: "attempt" }] as Claim[]) {
		const alternate = overflowStore(claim); let calls = 0;
		const result = await executeJevWithOverflow(primary.store, overflowInput(), { store: alternate.store, apiKey: "dedicated", read: async () => { calls++; throw new Error("Lost response"); } });
		assert.equal(result.kind, claim.kind === "cached" ? "cached" : "basic");
		assert.equal(result.chargedNano, claim.kind === "claimed" ? LIQUID_RESERVE_NANO : 0);
		assert.equal(calls, claim.kind === "claimed" ? 1 : 0);
		if (claim.kind === "claimed") assert.equal(alternate.finishes[0][1], null);
	}
});

test("a payment-required response may overflow, but integration metering and onClaimed still run once", async t => {
	const saved = process.env.TYPESAFE_API_KEY; process.env.TYPESAFE_API_KEY = "test";
	t.after(() => { if (saved === undefined) delete process.env.TYPESAFE_API_KEY; else process.env.TYPESAFE_API_KEY = saved; });
	const { APIError, TypeSafeClient } = await import("@typesafe-ai/sdk");
	t.mock.method(TypeSafeClient.prototype, "systemOne", async () => { throw new APIError(402, {}, new Headers()); });
	const { executeJevWithOverflow, JEV_RESERVE_NANO } = await import("./runtime.server.ts");
	const primary = overflowStore(), alternate = overflowStore({ kind: "cached", ciphertext: "cipher" });
	const input = overflowInput(); let metered = 0, notified = 0;
	input.visitor.beforeUncachedReading = async () => { metered++; }; input.onClaimed = () => { notified++; };
	const result = await executeJevWithOverflow(primary.store, input, { store: alternate.store, apiKey: "dedicated" });
	assert.equal(result.kind, "cached"); assert.equal(result.overflowReason, "provider-payment-required");
	assert.equal(result.chargedNano, JEV_RESERVE_NANO); assert.equal(primary.finishes[0][1], null);
	assert.equal(metered, 1); assert.equal(notified, 1);
	assert.equal(alternate.claims[0].admissionAttemptId, "overflow-attempt");
});

test("overflow deadline covers body/transport stalls and retains the full estimate", async t => {
	const { executeJevStage } = await import("./runtime.server.ts");
	const { LIQUID_RESERVE_NANO } = await import("./liquid.server.ts");
	const alternate = overflowStore(); let signal: AbortSignal | undefined;
	const result = await executeJevStage(alternate.store, overflowInput(), { apiKey: "dedicated", read: async (_r, _k, abort) => {
		signal = abort; return new Promise(() => {});
	} });
	assert.equal(result.kind, "basic"); if (result.kind === "basic") assert.equal(result.reason, "deadline");
	assert.equal(signal?.aborted, true); assert.equal(result.chargedNano, LIQUID_RESERVE_NANO);
	assert.equal(alternate.finishes[0][1], null);
});

test("cached JEV remains first choice when paid overflow is configured", async () => {
	const { executeJevWithOverflow } = await import("./runtime.server.ts");
	const primary = overflowStore({ kind: "cached", ciphertext: "cipher" }), alternate = overflowStore();
	primary.store.lookup = async () => ({ kind: "cached", ciphertext: "cipher" });
	const result = await executeJevWithOverflow(primary.store, overflowInput(), { store: alternate.store, apiKey: "dedicated", read: async () => { throw new Error("Unexpected paid call"); } });
	assert.equal(result.kind, "cached"); assert.equal(result.interpretationProvider, "typesafe");
	assert.equal(result.chargedNano, 0); assert.equal(alternate.keys.length, 0);
});

test("complete invalid Liquid output settles its known cost without caching", async () => {
	const { executeJevStage } = await import("./runtime.server.ts");
	const { LiquidContractError } = await import("./liquid.server.ts");
	const alternate = overflowStore();
	const result = await executeJevStage(alternate.store, overflowInput(), { apiKey: "dedicated", read: async () => { throw new LiquidContractError(4000); } });
	assert.equal(result.kind, "basic"); if (result.kind === "basic") assert.equal(result.reason, "contract");
	assert.equal(result.chargedNano, 4000); assert.deepEqual(alternate.finishes, [["overflow-attempt", 4000]]);
});

for (const status of [401, 429, 529, 500]) {
	test(`HTTP ${status} from JEV cannot activate paid overflow`, async t => {
		const saved = process.env.TYPESAFE_API_KEY; process.env.TYPESAFE_API_KEY = "test";
		t.after(() => { if (saved === undefined) delete process.env.TYPESAFE_API_KEY; else process.env.TYPESAFE_API_KEY = saved; });
		const { APIError, TypeSafeClient } = await import("@typesafe-ai/sdk");
		t.mock.method(TypeSafeClient.prototype, "systemOne", async () => { throw new APIError(status, {}, new Headers()); });
		const { executeJevWithOverflow } = await import("./runtime.server.ts");
		const primary = overflowStore(), alternate = overflowStore();
		const result = await executeJevWithOverflow(primary.store, overflowInput(), { store: alternate.store, apiKey: "dedicated", read: async () => { throw new Error("Unexpected paid call"); } });
		assert.equal(result.kind, "basic"); assert.equal(alternate.keys.length, 0);
	});
}
