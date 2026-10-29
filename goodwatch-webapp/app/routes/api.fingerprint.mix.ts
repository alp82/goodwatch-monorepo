import { type LoaderFunctionArgs, json } from "@remix-run/node"
import {
	parseEffects,
	parseMediaType,
	parseTitleId,
	pickTitles,
} from "~/domain/fingerprint-effects/population"

export async function loader({ request }: LoaderFunctionArgs) {
	const params = new URL(request.url).searchParams
	const type = parseMediaType(params)
	const exclude = parseTitleId(params, "exclude")
	const effects = parseEffects(params)
	const {
		getFingerprintPopulation,
		loadFingerprintTitle,
		FINGERPRINT_CACHE_CONTROL,
	} = await import("~/server/fingerprint-population.server")
	const population = await getFingerprintPopulation(type)
	const own =
		population.titles.find((t) => t.tmdbId === exclude) ??
		(await loadFingerprintTitle(type, exclude))
	return json(pickTitles(population, effects, exclude, own?.title), {
		headers: { "Cache-Control": FINGERPRINT_CACHE_CONTROL },
	})
}
