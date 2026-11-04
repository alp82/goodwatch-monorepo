// One title's tropes for its Tropes section and sub-page (ui/details/tropes/). Read-only.
//   GET ?type=movie|show&id=<tmdb id>               the index: every trope, write-ups for the signature ones only
//   GET ?type=movie|show&id=<tmdb id>&part=texts    every write-up, by trope id
//   GET ?type=movie|show&id=<tmdb id>&part=teaser   the title page's two signature cards and the count
//   GET ?trope=<TV Tropes page url>                 that trope's description opening, for an opened trope
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { tropePageUrl } from "~/server/profile/trope-pages"
import {
	loadTropeOpening,
	titleTropes,
	titleTropesTeaser,
} from "~/ui/details/tropes/title-tropes.server"
import { tropeTextsOf, tropesIndexOf } from "~/ui/details/tropes/tropes-data"

const headers = { "Cache-Control": "public, max-age=300" }

export async function loader({ request }: LoaderFunctionArgs) {
	const q = new URL(request.url).searchParams
	try {
		const trope = q.get("trope")
		if (trope) {
			if (tropePageUrl(trope) !== trope)
				return json({ error: "trope=<TV Tropes page url>" }, { status: 400 })
			return json({ opening: await loadTropeOpening(trope) }, { headers })
		}
		const type = q.get("type")
		const id = Number(q.get("id"))
		const part = q.get("part") ?? "index"
		if (
			(type !== "movie" && type !== "show") ||
			!Number.isInteger(id) ||
			id < 1
		)
			return json(
				{ error: "type=movie|show and id=<tmdb id>" },
				{ status: 400 },
			)
		if (part !== "index" && part !== "texts" && part !== "teaser")
			return json({ error: "part=index|texts|teaser" }, { status: 400 })
		// The teaser is kept on its own (title-tropes.server.ts), so it doesn't read the whole list.
		const body =
			part === "teaser"
				? await titleTropesTeaser(type, id)
				: part === "texts"
					? tropeTextsOf(await titleTropes(type, id))
					: tropesIndexOf(await titleTropes(type, id))
		return json(body, { headers })
	} catch (error) {
		console.error("Title tropes failed:", error)
		return json({ error: "Tropes unavailable" }, { status: 503 })
	}
}
