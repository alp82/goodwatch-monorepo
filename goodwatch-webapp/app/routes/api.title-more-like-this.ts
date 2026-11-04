// The titles of a title page's More like this shelves that the page's loader doesn't send. Read-only, no SQL of its
// own: every part reads a cache the site already keeps.
//   GET ?part=similar&type=movie|show&id=<tmdb id>
//     the related map's nearest titles (its cached pack), with card fields (the title cards display cache)
//   GET ?part=person&person=<tmdb person id>&as=Directing|Writing|Sound|Acting|Creator&type=movie|show&id=<tmdb id>
//     the person's other titles in that department (Acting: billed in the first eight; Creator: credited as creator),
//     most voted first (the person page's cached profile)
//   GET ?part=genre&genre=<TMDB genre>&type=movie|show&id=<tmdb id>&exclude=<tmdb ids>
//     the genre row the title page would show for that one genre (the title snapshot and the title cards cache)
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { genreRow } from "~/server/genre-row/genre-row.server"
import { getPersonProfile } from "~/server/person.server"
import { relatedMapPack } from "~/server/related-map.server"
import {
	type As,
	ROLES,
	type ShelfAnswer,
} from "~/ui/details/more-like-this/shelf-data"
import { similarShelfTitles } from "~/ui/details/more-like-this/similar-shelf.server"
import { titleKey } from "~/utils/title-key"

const SHELF = 24
const headers = { "Cache-Control": "public, max-age=300" }

async function similar(
	type: "movie" | "show",
	id: number,
): Promise<ShelfAnswer> {
	let pack: Awaited<ReturnType<typeof relatedMapPack>>
	try {
		pack = await relatedMapPack(type, id)
	} catch (error) {
		console.error("More like this, similar:", error)
		return { titles: [], unavailable: true }
	}
	return { titles: await similarShelfTitles(pack, type, id) }
}

async function person(
	personId: number,
	as: As,
	type: "movie" | "show",
	id: number,
): Promise<ShelfAnswer> {
	const profile = await getPersonProfile(personId)
	if (!profile) return { titles: [] }
	const titles = profile.credits
		.filter(
			(c) =>
				(as === "Creator"
					? c.jobs.includes("Creator")
					: as === "Acting"
						? c.roles.includes("Acting") && (c.billing ?? 99) <= 8
						: c.roles.includes(as)) &&
				c.poster_path &&
				!(c.media_type === type && c.tmdb_id === id) &&
				// Upcoming titles without a score sort last, but stay: what they make next is part of the reason.
				(c.votes > 0 || (c.release_year ?? 0) >= new Date().getFullYear()),
		)
		.sort((a, b) => b.votes - a.votes)
		.slice(0, SHELF)
		.map((c) => ({
			type: c.media_type,
			tmdbId: c.tmdb_id,
			title: c.title,
			year: c.release_year,
			poster: c.poster_path,
			// As on the person page: a score from a handful of votes is hidden.
			goodwatch: c.votes >= 200 ? c.score : null,
		}))
	return { titles, name: profile.name }
}

async function genre(
	type: "movie" | "show",
	id: number,
	name: string,
	exclude: number[],
): Promise<ShelfAnswer> {
	const row = await genreRow({
		mediaType: type,
		tmdbId: id,
		genres: [name],
		exclude: exclude.map((x) => titleKey(type, x)),
		later: Promise.resolve([]),
		budgetMs: 4000,
	})
	if (!row || row === "late") return { titles: [] }
	return {
		heading: row.heading,
		path: row.path,
		titles: row.titles.map((t) => ({
			type,
			tmdbId: t.tmdb_id,
			title: t.title,
			year: t.release_year,
			poster: t.poster_path,
			goodwatch: t.goodwatch_overall_score_normalized_percent,
		})),
	}
}

export async function loader({ request }: LoaderFunctionArgs) {
	const q = new URL(request.url).searchParams
	const part = q.get("part")
	const type = q.get("type")
	const id = Number(q.get("id"))
	if ((type !== "movie" && type !== "show") || !Number.isInteger(id) || id < 1)
		return json({ error: "type=movie|show and id=<tmdb id>" }, { status: 400 })
	try {
		if (part === "similar") return json(await similar(type, id), { headers })
		if (part === "person") {
			const personId = Number(q.get("person"))
			const as = q.get("as") ?? "Directing"
			if (!Number.isInteger(personId) || personId < 1)
				return json({ error: "person=<tmdb person id>" }, { status: 400 })
			if (!ROLES.includes(as as As))
				return json({ error: `as=${ROLES.join("|")}` }, { status: 400 })
			return json(await person(personId, as as As, type, id), { headers })
		}
		if (part === "genre") {
			const name = q.get("genre") ?? ""
			if (!name) return json({ error: "genre=<TMDB genre>" }, { status: 400 })
			const exclude = (q.get("exclude") ?? "")
				.split(",")
				.map(Number)
				.filter((x) => Number.isInteger(x) && x > 0)
			return json(await genre(type, id, name, exclude), { headers })
		}
		return json({ error: "part=similar|person|genre" }, { status: 400 })
	} catch (error) {
		console.error("More like this:", error)
		return json({ error: "Unavailable" }, { status: 503 })
	}
}
