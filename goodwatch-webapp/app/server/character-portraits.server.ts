// Reads TheTVDB character portraits (Crate `tvdb_character`, see docs/tvdb-pipelines.md) for the title page's cast,
// the character quick view, the person page, Discover and the search panel. Each read is one small statement over the
// table (a title's rows, a person's rows, or the names that start with a text), then one lookup of the titles' display
// fields; every answer is cached in Redis. The matching and ranking rules are domain/character-portraits.ts.
import {
	type CharacterPortrait,
	type CharacterRole,
	byRenown,
	characterNamePatterns,
	characterQuery,
	foldName,
	isSelfRole,
	onePerTitle,
	rankCharacterMatches,
} from "~/domain/character-portraits"
import { cached } from "~/utils/cache"
import { query } from "~/utils/crate"

export type { CharacterPortrait, CharacterRole }

type MediaType = "movie" | "show"

type PortraitRow = {
	media_type: MediaType
	media_tmdb_id: number
	character_name: string | null
	person_name: string | null
	person_tmdb_id: number | null
	image_url: string
	actor_image_url: string | null
}

const COLUMNS =
	"media_type, media_tmdb_id, character_name, person_name, person_tmdb_id, image_url, actor_image_url"

const toPortrait = (r: PortraitRow): CharacterPortrait => ({
	mediaType: r.media_type,
	tmdbId: r.media_tmdb_id,
	character: (r.character_name ?? "").trim(),
	personName: (r.person_name ?? "").trim(),
	personTmdbId: r.person_tmdb_id,
	image: r.image_url,
	actorImage: r.actor_image_url,
})

/** Portraits change with TheTVDB's crawl, a few times a day at most. */
const TTL_MINUTES = 6 * 60
/** The most portraits a title has: a long-running show lists a few thousand guest roles. */
const TITLE_LIMIT = 3000
/** Name matches a lookup ranks: enough for a three-letter text, before the titles' popularity orders them. */
const SEARCH_CANDIDATES = 1000
export const SEARCH_LIMIT = 12
/** A person's roles kept, one per title. */
export const PERSON_ROLES_LIMIT = 200

// ---------------------------------------------------------------- one title

/** Every character portrait of one title. */
export async function getTitlePortraits(
	mediaType: MediaType,
	tmdbId: number,
): Promise<CharacterPortrait[]> {
	const { portraits } = await cached({
		name: "character-portraits-title-v1",
		params: { mediaType, tmdbId },
		ttlMinutes: TTL_MINUTES,
		target: readTitlePortraits,
	})
	return portraits
}

async function readTitlePortraits({
	mediaType,
	tmdbId,
}: { mediaType: MediaType; tmdbId: number }) {
	const rows = await query<PortraitRow>(
		`SELECT ${COLUMNS} FROM tvdb_character
		  WHERE media_type = ? AND media_tmdb_id = ? AND image_url IS NOT NULL
		  LIMIT ${TITLE_LIMIT}`,
		[mediaType, tmdbId],
	)
	return { portraits: rows.map(toPortrait) }
}

// ---------------------------------------------------------------- the titles' display fields

type TitleRow = {
	tmdb_id: number
	title: string
	release_year: number | null
	poster_path: string | null
	popularity: number | null
	imdb_user_score_rating_count: number | null
}

/** Each portrait with its title; portraits of titles missing from the catalog are left out. */
async function withTitles(
	portraits: CharacterPortrait[],
): Promise<CharacterRole[]> {
	const found = new Map<string, TitleRow>()
	await Promise.all(
		(["movie", "show"] as const).map(async (type) => {
			const ids = [
				...new Set(
					portraits.filter((p) => p.mediaType === type).map((p) => p.tmdbId),
				),
			]
			if (!ids.length) return
			const rows = await query<TitleRow>(
				`SELECT tmdb_id, title, release_year, poster_path, popularity, imdb_user_score_rating_count
				   FROM ${type} WHERE tmdb_id = ANY(?)`,
				// node-crate sends arrays as JSON arrays; its parameter type only names scalars.
				[ids as never],
			)
			for (const r of rows) found.set(`${type}-${r.tmdb_id}`, r)
		}),
	)
	return portraits.flatMap((p) => {
		const t = found.get(`${p.mediaType}-${p.tmdbId}`)
		if (!t) return []
		return [
			{
				...p,
				title: t.title,
				year: t.release_year,
				posterPath: t.poster_path,
				popularity: t.popularity ?? 0,
				votes: t.imdb_user_score_rating_count ?? 0,
			},
		]
	})
}

// ---------------------------------------------------------------- search

/**
 * Characters whose name, or a word of it, starts with the text ("walter", "white", "walter wh"), from the most popular
 * titles first. Nothing for text shorter than two characters.
 */
export async function searchCharacters(text: string): Promise<CharacterRole[]> {
	const q = characterQuery(text)
	if (!q) return []
	const { characters } = await cached({
		name: "character-search-v1",
		params: { q },
		ttlMinutes: TTL_MINUTES,
		target: readCharacterMatches,
	})
	return characters
}

async function readCharacterMatches({ q }: { q: string }) {
	const [start, word] = characterNamePatterns(q)
	const rows = await query<PortraitRow>(
		`SELECT ${COLUMNS} FROM tvdb_character
		  WHERE image_url IS NOT NULL AND (character_name ILIKE ? OR character_name ILIKE ?)
		  LIMIT ${SEARCH_CANDIDATES}`,
		[start, word],
	)
	const roles = await withTitles(rows.map(toPortrait))
	return { characters: rankCharacterMatches(roles, q, SEARCH_LIMIT) }
}

// ---------------------------------------------------------------- one person

/**
 * The characters a person plays, one per title, best known first. Matched by TMDB person id, or by the actor's name
 * (lowercase, trimmed), since TheTVDB's rows rarely carry the TMDB id.
 */
export async function getPersonRoles({
	personId,
	name,
}: { personId: number; name: string }): Promise<CharacterRole[]> {
	const { roles } = await cached({
		name: "character-person-roles-v1",
		params: { personId, name: name.trim().toLowerCase() },
		ttlMinutes: TTL_MINUTES,
		target: readPersonRoles,
	})
	return roles
}

async function readPersonRoles({
	personId,
	name,
}: { personId: number; name: string }) {
	const byName = name ? " OR lower(trim(person_name)) = ?" : ""
	const rows = await query<PortraitRow>(
		`SELECT ${COLUMNS} FROM tvdb_character
		  WHERE image_url IS NOT NULL AND character_name IS NOT NULL
		    AND (person_tmdb_id = ?${byName})
		  LIMIT ${TITLE_LIMIT}`,
		name ? [personId, name] : [personId],
	)
	const own = rows
		.map(toPortrait)
		.filter((p) => foldName(p.character) !== "" && !isSelfRole(p.character))
	const roles = (await withTitles(own)).sort(byRenown)
	return { roles: onePerTitle(roles).slice(0, PERSON_ROLES_LIMIT) }
}
