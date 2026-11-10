export const HYDRATION_PAGES = [
	{ name: "home", path: "/", heading: "Find something to watch" },
	{ name: "movie", path: "/movie/603-the-matrix", heading: "The Matrix" },
	{ name: "show", path: "/show/1396-breaking-bad", heading: "Breaking Bad" },
	{
		name: "person",
		path: "/person/138-quentin-tarantino",
		heading: "Quentin Tarantino",
	},
	{ name: "discover", path: "/discover", heading: "Discover" },
	{
		name: "share_list",
		path: "/u/alperortac/lists/o1H79d4fVu",
		heading: "The best shows",
	},
];

export function hydrationFailures(expected, result) {
	const failures = [];
	if (result.status !== 200) failures.push(`HTTP ${result.status}`);
	if (!result.hydrated) failures.push("React hydration marker missing");
	if (!result.headings.some((text) => text.includes(expected.heading)))
		failures.push(`Missing route heading: ${expected.heading}`);
	if (
		result.headings.some((text) =>
			/Something went wrong|Page not found/.test(text),
		)
	)
		failures.push("ErrorBoundary replaced the route");
	if (expected.name === "discover" && result.resultCards < 1)
		failures.push("Discover results missing");
	for (const error of [...result.pageErrors, ...result.consoleErrors])
		failures.push(error);
	for (const response of result.failedApiResponses)
		failures.push(`API HTTP ${response.status}: ${response.path}`);
	return failures;
}
