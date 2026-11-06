// Character portraits: TheTVDB's pictures of the characters in a title (Crate `tvdb_character`), shown beside the
// actor's photo in the cast list, the character quick view, the person page's Characters shelf, Discover's roles strip
// and the search panel's Characters group. The pure rules live here: how a cast member finds their portrait, how a
// typed text becomes the character name lookup, and how matches are ranked. Reading is character-portraits.server.ts.
//
// TheTVDB rarely carries a TMDB person id (`person_tmdb_id` is set on about a quarter of the rows), so a portrait
// belongs to a cast member by TMDB id when it has one and otherwise by the actor's name, folded.

export type CharacterPortrait = {
	mediaType: "movie" | "show"
	tmdbId: number
	character: string
	personName: string
	personTmdbId: number | null
	/** TheTVDB character portrait, a full URL to a 2:3 picture (about 300×450). */
	image: string
	/** TheTVDB actor photo, a full URL, the fallback when the cast has no TMDB photo. */
	actorImage: string | null
}

/** A portrait with the title it belongs to, as search and a person's roles list it. */
export type CharacterRole = CharacterPortrait & {
	title: string
	year: number | null
	posterPath: string | null
	popularity: number
	/** IMDb rating count of the title: how well known it is. */
	votes: number
}

/** Every role of a person that the browser asks for at once (Discover's strip): the server's whole list. */
export const ALL_PERSON_ROLES = 200

/**
 * The query key of a person's roles in the browser's cache (ui/character-quick-view/portraits.ts). Discover's loader
 * fills it for the page's first view (server/character-portraits.server.ts).
 */
export const personRolesKey = (personId: number, name: string) =>
	["character-person-roles", personId, name] as const

/** TheTVDB portraits are 2:3. */
export const PORTRAIT_WIDTH = 300
export const PORTRAIT_HEIGHT = 450

/** Lowercase, without accents or punctuation, single spaces: "Zoë  D'Amato" → "zoe d amato". */
export function foldName(text: string): string {
	return text
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/[^\p{L}\p{N} ]/gu, " ")
		.replace(/\s+/g, " ")
		.trim()
}

/** The shortest text a character lookup answers, as the search panel's titles. */
export const MIN_CHARACTER_QUERY = 2
const MAX_CHARACTER_QUERY = 60

/** The text a character lookup uses (lowercase, single spaces), or null when it is too short. */
export function characterQuery(text: string): string | null {
	const q = text.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim()
	if (q.length < MIN_CHARACTER_QUERY) return null
	return q.slice(0, MAX_CHARACTER_QUERY).trimEnd()
}

/** The text as a LIKE literal: `%`, `_` and the escape character itself match only themselves. */
export function escapeLike(text: string): string {
	return text.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/**
 * The two ILIKE patterns of a lookup: the name starts with the text ("walter" → Walter White), or one of its words does
 * ("white" → Walter White). Names in the crawl can start with a space, which the second pattern covers.
 */
export function characterNamePatterns(query: string): [string, string] {
	const text = escapeLike(query)
	return [`${text}%`, `% ${text}%`]
}

/** Roles that name no character: the actor as themselves, a narrator. */
export function isSelfRole(character: string): boolean {
	return /^(self|himself|herself|themselves|themself|narrator)\b/.test(
		foldName(character),
	)
}

/**
 * How much a name's match counts in search, on top of how well known its title is: 4 when the text is a whole word of
 * the name ("jon" → Jon Snow, "snow" → Jon Snow), 2 when the name starts with it ("jon" → Jonathan Byers), 1 when only
 * a later word does ("jon" → Morgan Jones). Folded name and folded text.
 */
export function matchBoost(name: string, query: string): number {
	if (
		name === query ||
		name.startsWith(`${query} `) ||
		name.endsWith(` ${query}`) ||
		name.includes(` ${query} `)
	)
		return 4
	return name.startsWith(query) ? 2 : 1
}

/**
 * The SQL twin of matchBoost over the trimmed name, so that the read ranks before its cutoff
 * (character-portraits.server.ts): the ILIKE patterns of a whole word (the name itself, its first, last or a middle
 * word), then of the name's start.
 */
export function matchBoostPatterns(query: string): {
	word: [string, string, string, string]
	start: string
} {
	const text = escapeLike(query)
	return {
		word: [text, `${text} %`, `% ${text}`, `% ${text} %`],
		start: `${text}%`,
	}
}

/** A match's search score: how well known its title is (IMDb ratings), times how well the name matches. */
export const matchScore = (votes: number, boost: number) => boost * (votes + 1)

/**
 * Search matches, best first: no self roles, one row per character and title, then by matchScore (the best known
 * titles first, a whole-word match counting four times and a name start twice), then the most popular.
 */
export function rankCharacterMatches(
	matches: CharacterRole[],
	query: string,
	limit: number,
): CharacterRole[] {
	const q = foldName(query)
	const seen = new Set<string>()
	const kept: { role: CharacterRole; score: number }[] = []
	for (const role of matches) {
		const name = foldName(role.character)
		if (!name || isSelfRole(role.character)) continue
		const key = `${role.mediaType}-${role.tmdbId}-${name}`
		if (seen.has(key)) continue
		seen.add(key)
		kept.push({ role, score: matchScore(role.votes, matchBoost(name, q)) })
	}
	return kept
		.sort((a, b) => b.score - a.score || b.role.popularity - a.role.popularity)
		.slice(0, limit)
		.map((k) => k.role)
}

/**
 * Of several portraits in one title (an actor with two roles, or two rows for one role), the one whose character
 * matches one of the cast credit's character names, else the first.
 */
export function pickRole<T extends { character: string }>(
	portraits: T[],
	characters: string[] = [],
): T | undefined {
	const wanted = characters.map(foldName).filter(Boolean)
	return (
		portraits.find((p) => {
			const name = foldName(p.character)
			return (
				Boolean(name) &&
				wanted.some((w) => name.includes(w) || w.includes(name))
			)
		}) ?? portraits[0]
	)
}

/** A person's roles, one per title (the first of each, so keep them best known first). */
export function onePerTitle<T extends { mediaType: string; tmdbId: number }>(
	roles: T[],
): T[] {
	const seen = new Set<string>()
	return roles.filter((r) => {
		const key = `${r.mediaType}-${r.tmdbId}`
		if (seen.has(key)) return false
		seen.add(key)
		return true
	})
}

/** A person's roles, best known first: the most rated titles, then the most popular. */
export function byRenown(a: CharacterRole, b: CharacterRole): number {
	return b.votes - a.votes || b.popularity - a.popularity
}

/** A lookup from a title's portraits to the portrait of each cast member. */
export function portraitLookup(portraits: CharacterPortrait[]) {
	const byId = new Map<number, CharacterPortrait[]>()
	const byName = new Map<string, CharacterPortrait[]>()
	for (const p of portraits) {
		if (p.personTmdbId)
			byId.set(p.personTmdbId, [...(byId.get(p.personTmdbId) ?? []), p])
		const name = foldName(p.personName)
		if (name) byName.set(name, [...(byName.get(name) ?? []), p])
	}
	/** The portrait of a cast member: by TMDB person id, then by name; with several, the one whose character matches. */
	return (member: {
		id: number
		name: string | null
		roles?: string[]
	}): CharacterPortrait | undefined => {
		const list =
			byId.get(member.id) ??
			(member.name ? byName.get(foldName(member.name)) : undefined)
		return list?.length ? pickRole(list, member.roles) : undefined
	}
}
