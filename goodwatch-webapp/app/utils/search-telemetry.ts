// Shareable URLs intentionally contain the query; telemetry must not retain it.
export function redactSearchUrl(value: string) {
	return value.replace(/([?&](?:q|query)=)[^&#\s"<>]*/gi, "$1[redacted]");
}
export function redactSearchTelemetry<T>(value: T): T {
	if (typeof value === "string") return redactSearchUrl(value) as T;
	if (Array.isArray(value)) return value.map(redactSearchTelemetry) as T;
	if (value && typeof value === "object")
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [
				key,
				/^(q|query|search_term)$/i.test(key) ? "[redacted]" : redactSearchTelemetry(item),
			]),
		) as T;
	return value;
}
