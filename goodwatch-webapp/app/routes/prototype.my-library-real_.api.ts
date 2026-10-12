// DEVELOPMENT HARNESS (issue #385): what /prototype/my-library-real asks for in place of the member's endpoints.
// Each answer comes from the app's own server function, for the sample member (server/prototype-my-library.server.ts).
import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { libraryChoiceOf } from "~/domain/my-library"
import { summaryOf } from "~/domain/new-episodes"
import { NOTHING_NEW } from "~/domain/new-episodes-signal"
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
	const now = installHarnessMember(
		memberOf(params.get("member")),
		seenOf(params.get("seen")),
	)
	return { params, now }
}

export async function loader({ request }: LoaderFunctionArgs) {
	const { params, now } = install(request)
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
	if (what === "new-episodes")
		return json(summaryOf((await harness.newShows(now)).shows), { headers })
	return json({ error: "Unknown" }, { status: 400, headers })
}

export async function action({ request }: ActionFunctionArgs) {
	const { params, now } = install(request)
	// My shows is open: the visit, as POST /api/new-episodes records it.
	if (params.get("what") === "new-episodes") {
		await harness.visit(now)
		return json(NOTHING_NEW, { headers })
	}
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
