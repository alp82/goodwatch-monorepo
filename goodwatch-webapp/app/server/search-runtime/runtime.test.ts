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

for (const scenario of [
	{ name: "cached reading", cached: true, key: false, calls: 0, kind: "cached" },
	{ name: "missing provider key", key: false, calls: 0, kind: "basic", reason: "configuration" },
	{ name: "coordination unavailable", key: true, calls: 0, kind: "basic", reason: "coordination" },
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
			lookup: async () => scenario.cached ? { kind: "cached", ciphertext: "test" } : null,
			unseal: () => readings,
			claim: async (): Promise<Claim> => (scenario.reason === "rate" || scenario.reason === "coordination")
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
