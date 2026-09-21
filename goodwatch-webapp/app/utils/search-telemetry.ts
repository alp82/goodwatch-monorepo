// Shareable URLs intentionally contain the query; telemetry must not retain it.
const queryParam = /([?&](?:q|query)=)[^&#\s"<>]*/gi;
const privateKey = /^(q|query|search_term)$/i;
let lastLargeInput = "";
let lastLargeOutput = "";

export function redactSearchUrl(value: string) {
	// Session replay sends whole DOM snapshots through here, so skip the regex
	// for the many strings that can't contain a query parameter.
	if (!value.includes("=")) return value;
	// Replay snapshots repeat the same multi-megabyte stylesheet text.
	if (value === lastLargeInput) return lastLargeOutput;
	const redacted = value.replace(queryParam, "$1[redacted]");
	if (value.length > 10_000) {
		lastLargeInput = value;
		lastLargeOutput = redacted;
	}
	return redacted;
}

// Returns the same reference when nothing was redacted, to avoid copying
// large telemetry payloads.
// Sentry and PostHog pass extra arguments to their hooks, so only take one.
export function redactSearchTelemetry<T>(value: T): T {
	return redactValue(value, new WeakMap());
}

function redactValue<T>(value: T, seen: WeakMap<object, unknown>): T {
	if (typeof value === "string") return redactSearchUrl(value) as T;
	if (!value || typeof value !== "object") return value;
	// Payloads share subtrees, so visit each object once.
	if (seen.has(value)) return seen.get(value) as T;
	seen.set(value, value);
	const result = redactObject(value, seen);
	seen.set(value, result);
	return result;
}

function redactObject<T extends object>(
	value: T,
	seen: WeakMap<object, unknown>,
): T {
	if (Array.isArray(value)) {
		let copy: unknown[] | undefined;
		for (let i = 0; i < value.length; i++) {
			const item = redactValue(value[i], seen);
			if (item === value[i]) continue;
			copy ??= value.slice();
			copy[i] = item;
		}
		return (copy ?? value) as T;
	}
	{
		let copy: Record<string, unknown> | undefined;
		for (const [key, item] of Object.entries(value)) {
			const redacted = privateKey.test(key)
				? "[redacted]"
				: redactValue(item, seen);
			if (redacted === item) continue;
			copy = copy ?? { ...(value as Record<string, unknown>) };
			copy[key] = redacted;
		}
		return (copy ?? value) as T;
	}
}
