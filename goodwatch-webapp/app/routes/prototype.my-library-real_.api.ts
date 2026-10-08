// DEVELOPMENT HARNESS (issue #385): what /prototype/my-library-real asks for in place of the member's endpoints.
// Each answer comes from the app's own server function, for the sample member (server/prototype-my-library.server.ts).
import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { libraryChoiceOf } from "~/domain/my-library"
import {
	harness,
	installHarnessMember,
} from "~/server/prototype-my-library.server"
import {
	parseKeys,
	parseWatchNextOptions,
} from "~/server/watch-next-request.server"
import { withLegacyWatched } from "~/types/user-data"
import { memberOf, seenOf } from "~/ui/prototype-my-library/setup"

const headers = { "Cache-Control": "private, no-store" }

function install(request: Request) {
	const params = new URL(request.url).searchParams
	installHarnessMember(
		memberOf(params.get("member")),
		seenOf(params.get("seen")),
	)
	return params
}

export async function loader({ request }: LoaderFunctionArgs) {
	const params = install(request)
	const url = new URL(request.url)
	const what = params.get("what")
	if (what === "library")
		return json(
			await harness.library(
				libraryChoiceOf(params),
				Number(params.get("offset") ?? 0),
			),
			{ headers },
		)
	if (what === "movies" || what === "cards") {
		const options = parseWatchNextOptions(url, true)
		if (!options)
			return json({ error: "Bad options" }, { status: 400, headers })
		if (what === "movies")
			return json(await harness.movies(options), { headers })
		const keys = parseKeys(params.get("keys")) ?? []
		return json(
			{ titles: await harness.movieCards(keys, options) },
			{ headers },
		)
	}
	if (what === "user-data")
		return json(withLegacyWatched(await harness.userData()), { headers })
	if (what === "tonight")
		return json({ pick: await harness.tonight() }, { headers })
	return json({ error: "Unknown" }, { status: 400, headers })
}

export async function action({ request }: ActionFunctionArgs) {
	const params = install(request)
	if (params.get("what") !== "rate")
		return json({ error: "Unknown" }, { status: 400, headers })
	const body = (await request.json()) as {
		tmdb_id: number
		media_type: "movie" | "show"
		score: number | null
	}
	return json(await harness.rate(body.tmdb_id, body.media_type, body.score), {
		headers,
	})
}
