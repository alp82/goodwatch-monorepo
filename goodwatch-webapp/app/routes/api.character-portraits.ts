// Character portraits from TheTVDB (server/character-portraits.server.ts):
//   ?type=show&id=1396                       every portrait of a title
//   ?q=walter                                characters whose name, or a word of it, starts with the text
//   ?person=17419[&name=Bryan+Cranston][&limit=16]   the characters a person plays, one per title (the name is looked
//                                            up when left out: Discover's address carries only the id)
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { validPersonId } from "~/server/person-id"

const CACHE = "public, max-age=300, s-maxage=3600, stale-while-revalidate=3600"
const DEFAULT_ROLES = 16

/** Title ids fit the same Crate INTEGER columns as person ids. */
const validTitleId = validPersonId

export async function loader({ request }: LoaderFunctionArgs) {
	const p = new URL(request.url).searchParams
	const headers = { "Cache-Control": CACHE }
	const portraits = await import("~/server/character-portraits.server")

	const q = p.get("q")
	if (q !== null)
		return json(
			{ characters: await portraits.searchCharacters(q) },
			{ headers },
		)

	if (p.has("person")) {
		const personId = Number(p.get("person"))
		if (!validPersonId(personId))
			return json({ error: "Bad person" }, { status: 400 })
		const name =
			p.get("name")?.trim() ||
			(await import("~/server/person.server").then((m) =>
				m.getPersonName(personId),
			)) ||
			""
		const limit = Math.min(
			portraits.PERSON_ROLES_LIMIT,
			Math.max(1, Number(p.get("limit")) || DEFAULT_ROLES),
		)
		const roles = await portraits.getPersonRoles({ personId, name })
		return json({ name, characters: roles.slice(0, limit) }, { headers })
	}

	const type = p.get("type")
	const id = Number(p.get("id"))
	if ((type !== "movie" && type !== "show") || !validTitleId(id))
		return json({ error: "Bad title" }, { status: 400 })
	return json(
		{ portraits: await portraits.getTitlePortraits(type, id) },
		{ headers },
	)
}
