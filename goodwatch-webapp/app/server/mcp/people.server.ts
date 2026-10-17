import { personPath } from "../../utils/helpers"
import { canonicalTitleId } from "../../utils/title-identity"
import { titleKey } from "../../utils/title-key"
import { searchQuery } from "../combined-search/catalog.server"
import { getPersonCredits } from "../person.server"
import { knownForOf } from "../search-people/people.server"
import { loadTaste } from "../taste/index.server"
import { getMemberViewerContext } from "../viewer.server"
import { page, summary } from "./data.server"
import { titlePath } from "../../utils/helpers"
import { tmdbImageUrl } from "../../utils/tmdb-image"
import { titleLink } from "./links"
import { filmographyView, type Person, personSummary } from "./people"

/** A known-for title as the site's people search reads it (search-people/people.server.ts). */
export interface KnownFor {
	type: "movie" | "show"
	id: number
	title: string
	year: string
	backdrop: string | null
}

/**
 * What a person card shows: the profile photo, up to two known-for titles with ready-made links, and the top
 * known-for title's backdrop for the banner. Known-for titles carry no `id`, so title enrichment leaves them small.
 */
export function personCardFields(
	person: Person,
	knownFor: readonly KnownFor[],
	origin: string,
) {
	const titles = knownFor.slice(0, 2).map((title) => {
		const url = new URL(titlePath(title.type, title.id, title.title), origin)
			.href
		const year = /^\d{4}$/.test(title.year) ? Number(title.year) : null
		return {
			name: title.title,
			year,
			url,
			link: titleLink(title.title, year, url),
		}
	})
	const backdrop = knownFor.find((title) => title.backdrop)?.backdrop
	return {
		profile_url: person.profile_path
			? tmdbImageUrl(person.profile_path, "w185")
			: null,
		known_for: titles,
		backdrop_url: backdrop ? tmdbImageUrl(backdrop, "w780") : null,
	}
}

/** Known-for titles from the site's people search; cards still show without them. */
const knownFor = (ids: number[]) =>
	ids.length
		? knownForOf(ids).catch(() => new Map<number, KnownFor[]>())
		: Promise.resolve(new Map<number, KnownFor[]>())
import type { ReadArgs } from "./tools.server"

export async function readPeople(
	userId: string,
	origin: string,
	args: ReadArgs,
) {
	if (args.person_id === undefined) {
		const offset = Number(args.cursor?.slice(7) ?? 0)
		const limit = args.limit ?? 20
		const rows = await searchQuery<Person>(
			`SELECT tmdb_id, name, known_for_department, profile_path FROM person WHERE MATCH(name, ?) USING best_fields WITH (operator = 'and') ORDER BY popularity DESC NULLS LAST, tmdb_id LIMIT ? OFFSET ?`,
			[args.query, limit + 1, offset],
		)
		const shown = rows.slice(0, limit)
		const known = await knownFor(shown.map((person) => person.tmdb_id))
		return {
			items: shown.map((person) => ({
				...personSummary(person, origin),
				...personCardFields(person, known.get(person.tmdb_id) ?? [], origin),
			})),
			next_cursor: rows.length > limit ? `offset:${offset + limit}` : null,
			// There is no separate people-search page; link the broader existing search view.
			page_url: new URL(
				`/discover?${new URLSearchParams({ q: args.query ?? "" })}`,
				origin,
			).href,
			page_note:
				"GoodWatch has no separate people-search page. Discover searches titles for this text; open a person's url for their filmography.",
		}
	}
	const [person] = await searchQuery<Person>(
		"SELECT tmdb_id, name, known_for_department, profile_path FROM person WHERE tmdb_id = ?",
		[args.person_id],
	)
	if (!person)
		return { status: "person_not_found", message: "No matching catalog person" }
	const [credits, taste, ctx, known] = await Promise.all([
		getPersonCredits(args.person_id),
		loadTaste({ kind: "member", userId }).catch(() => null),
		args.exclude_seen ? getMemberViewerContext(userId, "US") : null,
		knownFor([person.tmdb_id]),
	])
	const percentiles = taste?.percentile(
		credits.map((c) =>
			titleKey(c.media_type, canonicalTitleId(c.media_type, c.tmdb_id)),
		),
	)
	const matches =
		taste?.signal === "some"
			? new Map(
					credits.map((credit, i) => [
						`${credit.media_type}:${canonicalTitleId(credit.media_type, credit.tmdb_id)}`,
						percentiles?.[i] ?? null,
					]),
				)
			: new Map<string, number | null>()
	const items = filmographyView(
		credits,
		args,
		ctx ? [...ctx.seen, ...ctx.skipped] : [],
		matches,
	)
	const selected = page(items, args)
	return {
		...selected,
		person: {
			...personSummary(person, origin),
			...personCardFields(person, known.get(person.tmdb_id) ?? [], origin),
		},
		items: selected.items.map((credit) => ({
			...summary(credit, origin),
			roles: credit.roles,
			characters: credit.characters,
			jobs: credit.jobs,
			goodwatch_score: credit.score,
		})),
		sort: args.sort ?? "for_you",
		for_you_applied:
			(args.sort ?? "for_you") === "for_you" && taste?.signal === "some",
		exclude_seen: args.exclude_seen ?? false,
		availability: "everywhere",
		page_url: new URL(personPath(person.tmdb_id, person.name), origin).href,
		page_note:
			"The person page groups their credits; this tool's sorting and Not seen yet filter can differ.",
	}
}
