// Metamorphic checks: changing word order must not change independent filters.
function permutations(parts) {
	return parts.length
		? parts.flatMap((part, i) =>
				permutations(parts.filter((_, j) => i !== j)).map((rest) => [
					part,
					...rest,
				]),
			)
		: [[]]
}
export function generatedCases() {
	const scenarios = [
		{
			parts: ["80s", "Tom Hanks style", "Netflix", "80+"],
			expect: {
				minYear: "1980",
				maxYear: "1989",
				people: "31",
				services: "8",
				score: "80",
			},
		},
		{
			parts: ["90s", "Brad Pitt vibes", "Netflix", "80+"],
			expect: {
				minYear: "1990",
				maxYear: "1999",
				people: "287",
				services: "8",
				score: "80",
			},
		},
		{
			parts: ["80s", "matrix vibes", "Netflix", "80+"],
			expect: {
				minYear: "1980",
				maxYear: "1989",
				similar: "1000000000603",
				services: "8",
				score: "80",
			},
		},
		{
			parts: ["90s", "inception vibes", "Netflix", "80+"],
			expect: {
				minYear: "1990",
				maxYear: "1999",
				similar: "1000000027205",
				services: "8",
				score: "80",
			},
		},
		{
			parts: ["80s", "anime shows", "Netflix", "80+"],
			expect: {
				minYear: "1980",
				maxYear: "1989",
				anime: "only",
				type: "show",
				services: "8",
				score: "80",
			},
		},
		{
			parts: ["under 90 minutes", "funny", "Netflix", "Tom Hanks"],
			expect: { maxRuntime: "89", moods: "funny", services: "8", people: "31" },
		},
	]
	return scenarios.flatMap((scenario) =>
		permutations(scenario.parts).map((parts) => ({
			group: "Generated · word order",
			query: parts.join(" "),
			expect: scenario.expect,
			residualEquals: "",
			exact: true,
			sourceFile: "generated-cases.mjs",
		})),
	)
}
