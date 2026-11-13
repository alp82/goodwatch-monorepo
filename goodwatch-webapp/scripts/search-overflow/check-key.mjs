import { pathToFileURL } from "node:url";

export async function checkOverflowKey(env = process.env, fetcher = fetch) {
	const key = env.OPENROUTER_DECISION_MODELS_API_KEY?.trim();
	const amount = env.OPENROUTER_DECISION_MODELS_MONTHLY_BUDGET_USD ?? "";
	const cap = Number(amount);
	if (
		!key ||
		!/^\d+(\.\d{1,9})?$/.test(amount) ||
		!Number.isFinite(cap) ||
		cap <= 0 ||
		cap * 1e9 > Number.MAX_SAFE_INTEGER
	)
		throw Error("Dedicated overflow key and positive budget are required");
	const response = await fetcher("https://openrouter.ai/api/v1/key", {
		headers: { Authorization: "Bearer " + key },
		redirect: "error",
		signal: AbortSignal.timeout(10000),
	});
	if (!response.ok)
		throw Error(
			"OpenRouter key metadata request failed (HTTP " + response.status + ")",
		);
	const { data } = await response.json();
	if (!data || data.is_management_key !== false)
		throw Error("Expected an ordinary inference key");
	const withinCap = (value) =>
		Number.isFinite(value) && value > 0 && value <= cap;
	// Guardrails assigned to a key appear in budgets, independently of the legacy key-limit fields.
	// Workspace/member limits are shared and cannot stand in for this key's separate monthly allowance.
	const candidates = [];
	if (data.limit_reset === "monthly" && withinCap(data.limit))
		candidates.push({
			limit: data.limit,
			remaining: data.limit_remaining,
			source: "key",
		});
	for (const budget of Array.isArray(data.budgets) ? data.budgets : []) {
		if (
			budget?.scope === "api_key" &&
			budget.reset_interval === "monthly" &&
			withinCap(budget.limit_usd)
		)
			candidates.push({
				limit: budget.limit_usd,
				remaining: budget.remaining_usd,
				source: "key-guardrail",
			});
	}
	const selected = candidates.sort((a, b) => a.limit - b.limit)[0];
	if (!selected)
		throw Error(
			"Expected a positive monthly cap bound to this key, no greater than the application budget",
		);
	return {
		limit: selected.limit,
		limitReset: "monthly",
		limitSource: selected.source,
		remaining: selected.remaining,
		usage: data.usage,
		usageMonthly: data.usage_monthly,
		modelRestriction:
			"Confirm the directly assigned Liquid-only guardrail in the dashboard",
	};
}
if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	checkOverflowKey().then(
		(result) => console.log(JSON.stringify(result, null, 2)),
		() => {
			console.error(
				"Overflow key check failed. Verify the dedicated key, its monthly limit and the configured application budget.",
			);
			process.exitCode = 1;
		},
	);
}
