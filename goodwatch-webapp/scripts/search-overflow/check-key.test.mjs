import assert from "node:assert/strict";
import { test } from "node:test";
import { checkOverflowKey } from "./check-key.mjs";
const env = {
	OPENROUTER_DECISION_MODELS_API_KEY: "private-test-key",
	OPENROUTER_DECISION_MODELS_MONTHLY_BUDGET_USD: "1",
};
const data = {
	is_management_key: false,
	limit: 1,
	limit_reset: "monthly",
	limit_remaining: 0.8,
	usage: 0.2,
	usage_monthly: 0.2,
};
test("read-only key check verifies the cap without printing the credential", async () => {
	const result = await checkOverflowKey(env, async (url, init) => {
		assert.equal(url, "https://openrouter.ai/api/v1/key");
		assert.equal(init.headers.Authorization, "Bearer private-test-key");
		assert.equal(init.method, undefined);
		assert.equal(init.redirect, "error");
		return Response.json({ data });
	});
	assert.equal(result.limit, 1);
	assert.equal(
		JSON.stringify(result).includes(env.OPENROUTER_DECISION_MODELS_API_KEY),
		false,
	);
});
for (const bad of [
	{ is_management_key: true },
	{ limit: null },
	{ limit: 10 },
	{ limit: 0 },
	{ limit_reset: null },
	{ limit_reset: "daily" },
]) {
	test("reject unsafe key metadata " + JSON.stringify(bad), async () => {
		await assert.rejects(
			checkOverflowKey(env, async () =>
				Response.json({ data: { ...data, ...bad } }),
			),
		);
	});
}
test("unconfigured checker cannot use the shared application key", async () => {
	await assert.rejects(
		checkOverflowKey({ OPENROUTER_API_KEY: "shared" }, async () => {
			throw Error("Unexpected call");
		}),
	);
});

test("a monthly guardrail assigned directly to the key supplies its separate cap", async () => {
	const result = await checkOverflowKey(env, async () =>
		Response.json({
			data: {
				...data,
				limit: null,
				limit_reset: null,
				budgets: [
					{
						scope: "api_key",
						limit_usd: 1,
						reset_interval: "monthly",
						remaining_usd: 0.6,
					},
					{
						scope: "workspace",
						limit_usd: 30,
						reset_interval: "monthly",
						remaining_usd: 25,
					},
				],
			},
		}),
	);
	assert.equal(result.limit, 1);
	assert.equal(result.limitReset, "monthly");
	assert.equal(result.limitSource, "key-guardrail");
	assert.equal(result.remaining, 0.6);
});
for (const budget of [
	{ scope: "workspace", limit_usd: 1, reset_interval: "monthly" },
	{ scope: "member", limit_usd: 1, reset_interval: "monthly" },
	{ scope: "api_key", limit_usd: 1, reset_interval: "daily" },
	{ scope: "api_key", limit_usd: 5, reset_interval: "monthly" },
	{ scope: "api_key", limit_usd: 0, reset_interval: "monthly" },
]) {
	test("shared, daily or over-cap budget cannot replace the key monthly cap: " +
		JSON.stringify(budget), async () => {
		await assert.rejects(
			checkOverflowKey(env, async () =>
				Response.json({
					data: {
						...data,
						limit: null,
						limit_reset: null,
						budgets: [budget],
						effective_budget: budget,
					},
				}),
			),
		);
	});
}
