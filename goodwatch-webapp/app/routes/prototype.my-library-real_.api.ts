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
import { signalOf } from "~/domain/newly-available"
import {
	harness,
	installHarnessMember,
} from "~/server/prototype-my-library.server"
import { parseShowAction } from "~/server/show-tracking.server"
import { TrackingConflictError } from "~/server/tracking.server"
import {
	parseKeys,
	parseWatchNextOptions,
} from "~/server/watch-next-request.server"
import { withLegacyWatched } from "~/types/user-data"
import {
	landedOf,
	memberOf,
	seenOf,
} from "~/ui/prototype-my-library/setup"

const headers = { "Cache-Control": "private, no-store" }

async function install(request: Request) {
	const params = new URL(request.url).searchParams
	const now = installHarnessMember(
		memberOf(params.get("member")),
		seenOf(params.get("seen")),
		landedOf(params.get("landed")),
	)
	await harness.ready()
	return { params, now }
}

export async function loader({ request }: LoaderFunctionArgs) {
	const { params, now } = await install(request)
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
	// As /api/tonight answers a member: the pick, and what landed on their services when something did.
	if (what === "tonight") {
		const [pick, landed] = await Promise.all([
			harness.tonight(),
			harness.landed().then(signalOf),
		])
		return json({ pick, ...(landed ? { landed } : {}) }, { headers })
	}
	if (what === "new-episodes")
		return json(summaryOf((await harness.newShows(now)).shows), { headers })
	// As GET /api/tracking/show answers a member: the show's state, watches and episode list.
	if (what === "tracking-show") {
		const id = params.get("id") ?? ""
		if (!/^[1-9]\d{0,9}$/.test(id))
			return json({ error: "Send ?id=<show id>" }, { status: 400, headers })
		return json(await harness.tracking(Number(id)), { headers })
	}
	return json({ error: "Unknown" }, { status: 400, headers })
}

export async function action({ request }: ActionFunctionArgs) {
	const { params, now } = await install(request)
	// My movies is open: the visit, as POST /api/newly-available records it.
	if (params.get("what") === "newly-available") {
		await harness.visitMovies()
		return json({ ok: true }, { headers })
	}
	// My shows is open: the visit, as POST /api/new-episodes records it.
	if (params.get("what") === "new-episodes") {
		await harness.visit(now)
		return json(NOTHING_NEW, { headers })
	}
	// One action on a show's tracking, as POST /api/tracking/show applies it for a member.
	if (params.get("what") === "tracking-show") {
		const body = parseShowAction(await request.json().catch(() => null))
		if (!body)
			return json(
				{ error: "Send { id, event, actionId }" },
				{ status: 400, headers },
			)
		try {
			return json(await harness.track(body), { headers })
		} catch (error) {
			if (error instanceof TrackingConflictError)
				return json({ error: error.message }, { status: 409, headers })
			throw error
		}
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
