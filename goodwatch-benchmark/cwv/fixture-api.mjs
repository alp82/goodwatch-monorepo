// Only these public, read-only resources may be captured from the live site. Never capture auth/member endpoints.
export const PUBLIC_API_PATHS = [
	"/api/streaming-providers?country=US&include=",
	"/api/award-marks",
	"/api/character-portraits?type=movie&id=603",
	"/api/character-portraits?type=show&id=1396",
	"/api/title-tropes?type=movie&id=603&part=teaser",
	"/api/title-tropes?type=show&id=1396&part=teaser",
];

export function apiKey(target) {
	const url = new URL(target, "https://fixture.invalid");
	url.searchParams.sort();
	return url.pathname + (url.searchParams.size ? `?${url.searchParams}` : "");
}
const allowed = new Set(PUBLIC_API_PATHS.map(apiKey));

export function validateApiFixtures(fixtures) {
	for (const [key, response] of Object.entries(fixtures)) {
		if (!allowed.has(key))
			throw new Error(`API fixture is not allowlisted: ${key}`);
		if (response.status !== 200 || typeof response.body !== "string")
			throw new Error(`Invalid API fixture: ${key}`);
		const value = JSON.parse(response.body);
		if (key.startsWith("/api/streaming-providers?") && !Array.isArray(value))
			throw new Error("Streaming providers fixture must be an array");
		if (key === "/api/award-marks" && (!value?.movie || !value?.show))
			throw new Error("Award marks fixture must contain movie and show maps");
		if (
			key.startsWith("/api/character-portraits?") &&
			!Array.isArray(value?.portraits)
		)
			throw new Error(
				"Character portraits fixture must contain portraits array",
			);
		if (
			key.startsWith("/api/title-tropes?") &&
			(!Array.isArray(value?.cards) || !Number.isInteger(value?.total))
		)
			throw new Error(
				"Title tropes fixture must contain cards array and total",
			);
	}
	for (const key of allowed)
		if (!Object.hasOwn(fixtures, key))
			throw new Error(`Missing public API fixture: ${key}`);
	return fixtures;
}

export function fixtureApiResponse(target, fixtures) {
	const url = new URL(target, "https://fixture.invalid");
	// Better Auth's anonymous session contract is local only; this endpoint is never captured from production.
	if (
		url.pathname === "/api/auth/get-session" &&
		[...url.searchParams].every(
			([key, value]) =>
				key === "disableCookieCache" && ["true", "false"].includes(value),
		)
	)
		return { status: 200, body: "null" };
	const key = apiKey(target);
	return allowed.has(key) && fixtures[key]
		? fixtures[key]
		: {
				status: 404,
				body: JSON.stringify({ error: "No frozen API response", path: key }),
			};
}
