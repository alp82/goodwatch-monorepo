import { writeFile } from "node:fs/promises"
import { populationMedians } from "~/domain/fingerprint-effects/population"
import { loadPopulationTitles } from "~/server/fingerprint-population.server"

const [movie, show] = await Promise.all([
	loadPopulationTitles("movie"),
	loadPopulationTitles("show"),
])
const medians = {
	movie: populationMedians(movie),
	show: populationMedians(show),
}
await writeFile(
	new URL(
		"../app/domain/fingerprint-effects/population-medians.ts",
		import.meta.url,
	),
	`// Generated population medians. Rerun from goodwatch-webapp with configured read-only Crate credentials:\n// npx vite-node --config scripts/arena-vite.config.mjs scripts/generate-fingerprint-medians.ts\nimport type { CoreScores } from "~/server/utils/fingerprint"\n\nexport const POPULATION_MEDIANS = ${JSON.stringify(medians, null, 2)} satisfies Record<"movie" | "show", CoreScores>\n`,
)
