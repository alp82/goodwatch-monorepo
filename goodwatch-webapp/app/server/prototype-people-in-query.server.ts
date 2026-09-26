// PROTOTYPE - throwaway. Finds full person names inside a search phrase ("funny brad pitt
// movies") with an in-memory index of popular people, and loads their credits so the search can
// be narrowed to titles with those people. No model and no per-query TMDB call.
import { query } from "~/utils/crate"

// People below this TMDB popularity are not indexed. About 57k people pass.
const MIN_POPULARITY = 1
const MAX_NAME_WORDS = 4
// Joining words that belong to a name, not to what the person wants to watch.
const CONNECTORS = new Set(["and", "with", "starring", "featuring", "feat", "by", "or", "plus"])

export interface NamedPerson {
	id: number
	name: string
	popularity: number
	profile: string | null
	department: string
}

const words = (s: string): string[] =>
	s
		.toLocaleLowerCase()
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.match(/[\p{L}\p{N}]+/gu) ?? []

let index: Promise<Map<string, NamedPerson>> | null = null
function nameIndex() {
	if (!index) {
		index = query<{
			tmdb_id: number
			name: string
			popularity: number
			profile_path: string | null
			known_for_department: string | null
		}>(
			`SELECT tmdb_id, name, popularity, profile_path, known_for_department FROM person WHERE popularity >= ${MIN_POPULARITY} AND NOT coalesce(adult, false) LIMIT 200000`,
		).then((rows) => {
			const map = new Map<string, NamedPerson>()
			for (const r of rows) {
				const key = words(r.name).join(" ")
				// Single-word names ("Zendaya") are left to the whole-query person search.
				if (key.split(" ").length < 2) continue
				const old = map.get(key)
				if (old && old.popularity >= r.popularity) continue
				map.set(key, {
					id: r.tmdb_id,
					name: r.name,
					popularity: r.popularity,
					profile: r.profile_path,
					department: r.known_for_department ?? "",
				})
			}
			return map
		})
		index.catch(() => {
			index = null
		})
	}
	return index
}

/** Full names in the query, longest first and never overlapping, plus the words left over. */
export async function peopleInQuery(q: string) {
	const map = await nameIndex()
	const tokens = words(q)
	const used = new Array(tokens.length).fill(false)
	const people: NamedPerson[] = []
	for (let n = Math.min(MAX_NAME_WORDS, tokens.length); n >= 2; n--) {
		for (let i = 0; i + n <= tokens.length; i++) {
			if (used.slice(i, i + n).some(Boolean)) continue
			const hit = map.get(tokens.slice(i, i + n).join(" "))
			if (!hit) continue
			people.push(hit)
			used.fill(true, i, i + n)
		}
	}
	const next = (i: number) => used[i - 1] || used[i + 1]
	const rest = tokens
		.filter(
			(t, i) =>
				!used[i] &&
				// "brad pitt's" leaves a lone "s" behind.
				!(t === "s" && used[i - 1]) &&
				// "brad pitt and george clooney", "movies with tom hanks"
				!(CONNECTORS.has(t) && next(i)),
		)
		.join(" ")
	return { people, rest }
}

/** Title keys ("movie:550") every one of the people is credited on, in front of or behind the camera. */
export async function sharedCredits(ids: number[]) {
	const sets = await Promise.all(
		ids.map(async (id) => {
			const [acting, crew] = await Promise.all([
				// Appearances as themselves (talk shows, award shows) are not their titles.
				query<{ media_tmdb_id: number; media_type: string }>(
					"SELECT media_tmdb_id, media_type FROM person_appeared_in WHERE person_tmdb_id = ? AND NOT coalesce(character, '') ~* '^(self|himself|herself|themselves)\\b.*' LIMIT 3000",
					[id],
				),
				query<{ media_tmdb_id: number; media_type: string }>(
					"SELECT media_tmdb_id, media_type FROM person_worked_on WHERE person_tmdb_id = ? LIMIT 3000",
					[id],
				),
			])
			return new Set(
				[...acting, ...crew].map((c) => `${c.media_type}:${c.media_tmdb_id}`),
			)
		}),
	)
	if (!sets.length) return []
	return [...sets[0]].filter((key) => sets.every((s) => s.has(key)))
}
