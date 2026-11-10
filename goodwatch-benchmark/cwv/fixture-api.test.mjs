import assert from "node:assert/strict";
import { test } from "node:test";
import {
	PUBLIC_API_PATHS,
	apiKey,
	fixtureApiResponse,
	validateApiFixtures,
} from "./fixture-api.mjs";
import { HYDRATION_PAGES, hydrationFailures } from "./hydration-assertions.mjs";

test("only explicit public API snapshots are served; unknown APIs fail and auth session stays anonymous", () => {
	const fixtures = Object.fromEntries(
		PUBLIC_API_PATHS.map((path) => [
			apiKey(path),
			{
				status: 200,
				body: path.includes("streaming-providers")
					? "[]"
					: path.includes("award-marks")
						? '{"movie":{},"show":{}}'
						: path.includes("character-portraits")
							? '{"portraits":[]}'
							: '{"total":0,"cards":[]}',
			},
		]),
	);
	assert.doesNotThrow(() => validateApiFixtures(fixtures));
	const request = "/api/character-portraits?id=603&type=movie";
	assert.equal(
		fixtureApiResponse(request, fixtures),
		fixtures[apiKey(request)],
	);
	assert.deepEqual(fixtureApiResponse("/api/auth/get-session", fixtures), {
		status: 200,
		body: "null",
	});
	assert.deepEqual(
		fixtureApiResponse(
			"/api/auth/get-session?disableCookieCache=true",
			fixtures,
		),
		{ status: 200, body: "null" },
	);
	for (const request of [
		"/api/unknown",
		"/api/character-portraits?id=999&type=movie",
		"/api/auth/get-session?member=1",
		"/api/account-summary",
	])
		assert.equal(fixtureApiResponse(request, fixtures).status, 404);
	assert.throws(
		() =>
			validateApiFixtures({
				...fixtures,
				[apiKey(PUBLIC_API_PATHS[0])]: { status: 200, body: "{}" },
			}),
		/must be an array/,
	);
	assert.throws(
		() =>
			validateApiFixtures({
				...fixtures,
				"/api/account-summary": { status: 200, body: "{}" },
			}),
		/not allowlisted/,
	);
});

test("a 200 ErrorBoundary or later client TypeError cannot pass the hydration smoke", () => {
	const expected = HYDRATION_PAGES.find((page) => page.name === "discover");
	const result = {
		status: 200,
		hydrated: true,
		headings: ["Discover"],
		resultCards: 40,
		pageErrors: [],
		consoleErrors: [],
		failedApiResponses: [],
	};
	assert.deepEqual(hydrationFailures(expected, result), []);
	assert.ok(
		hydrationFailures(expected, {
			...result,
			headings: ["Something went wrong"],
			resultCards: 0,
		}).some((message) => message.includes("ErrorBoundary")),
	);
	assert.ok(
		hydrationFailures(expected, {
			...result,
			consoleErrors: ["TypeError: countryProviders.filter is not a function"],
		}).length,
	);
	assert.ok(
		hydrationFailures(expected, {
			...result,
			failedApiResponses: [{ status: 404, path: "/api/unknown" }],
		}).length,
	);
});
