import { type LoaderFunctionArgs, json } from "@remix-run/node"
import {
	parseMediaType,
	parseTitleId,
	rarestPairs,
} from "~/domain/fingerprint-effects/population"

export async function loader({ request }: LoaderFunctionArgs) {
	const params = new URL(request.url).searchParams
	const type = parseMediaType(params)
	const id = parseTitleId(params, "id")
	const {
		getFingerprintPopulation,
		loadFingerprintTitle,
		FINGERPRINT_CACHE_CONTROL,
	} = await import("~/server/fingerprint-population.server")
	const population = await getFingerprintPopulation(type)
	const title =
		population.titles.find((t) => t.tmdbId === id) ??
		(await loadFingerprintTitle(type, id))
	if (!title) throw new Response("Title not found", { status: 404 })
	return json(rarestPairs(population, title.scores), {
		headers: { "Cache-Control": FINGERPRINT_CACHE_CONTROL },
	})
}
