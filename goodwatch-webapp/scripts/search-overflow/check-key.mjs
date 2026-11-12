import { pathToFileURL } from "node:url"

export async function checkOverflowKey(env = process.env, fetcher = fetch) {
	const key = env.SEARCH_OVERFLOW_OPENROUTER_API_KEY?.trim()
	const amount = env.SEARCH_OVERFLOW_MONTHLY_BUDGET_USD ?? ""
	const cap = Number(amount)
	if (
		!key ||
		!/^\d+(\.\d{1,9})?$/.test(amount) ||
		!Number.isFinite(cap) ||
		cap <= 0 ||
		cap * 1e9 > Number.MAX_SAFE_INTEGER
	)
		throw Error("Dedicated overflow key and positive budget are required")
	const response = await fetcher("https://openrouter.ai/api/v1/key", {
		headers: { Authorization: "Bearer " + key },
		redirect: "error",
		signal: AbortSignal.timeout(10000),
	})
	if (!response.ok)
		throw Error(
			"OpenRouter key metadata request failed (HTTP " + response.status + ")",
		)
	const { data } = await response.json()
	if (
		!data ||
		data.is_management_key !== false ||
		data.limit_reset !== "monthly" ||
		!Number.isFinite(data.limit) ||
		data.limit <= 0 ||
		data.limit > cap
	)
		throw Error(
			"Expected an ordinary inference key with a positive monthly limit no greater than the application cap",
		)
	return {
		limit: data.limit,
		limitReset: data.limit_reset,
		remaining: data.limit_remaining,
		usage: data.usage,
		usageMonthly: data.usage_monthly,
		modelRestriction:
			"Confirm the directly assigned Liquid-only guardrail in the dashboard",
	}
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
			)
			process.exitCode = 1
		},
	)
}
