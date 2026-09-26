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

// A single name inside a phrase ("funny tom") only offers people, so it needs a famous person.
const MIN_SINGLE_POPULARITY = 5
const PER_SINGLE_NAME = 8
// Ordinary words that are also names of famous people. A single-name match on these is skipped.
const ORDINARY = new Set(
	`love black white king stone young hill wood bell hope joy rich west north south long little small green brown gray grey rose may will mark grant rock bright noble day knight star walker hunter fox wolf bird lane page ford frank sweet dark law faith grace story hart heart snow winter summer spring fall rain storm river lake ocean sea sky moon sun night light power strong wise gold silver diamond price cash money banks church temple bishop pope priest judge major cook baker butler taylor mason carpenter smith miller fisher gardner shepherd porter marshall sheriff cop killer crime war peace hero heroes action drama comedy horror thriller romance romantic funny sad scary dark epic space time love family kids child children girl girls boy boys woman women man men lady queen prince princess witch vampire zombie ghost monster dragon robot alien cowboy cowboys pirate ninja spy detective doctor nurse teacher lawyer soldier fighter boxer dancer singer music musical dance school college high city town country island mountain desert jungle forest road car cars train plane ship boat house home world earth life death dead alive blood fire ice water wind storm new old big best top good bad great true real classic modern short sweet fast slow hard easy happy`.split(
		" ",
	),
)

interface Index {
	full: Map<string, NamedPerson>
	single: Map<string, NamedPerson[]>
}
let index: Promise<Index> | null = null
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
			const single = new Map<string, NamedPerson[]>()
			for (const r of rows) {
				const parts = words(r.name)
				const person = {
					id: r.tmdb_id,
					name: r.name,
					popularity: r.popularity,
					profile: r.profile_path,
					department: r.known_for_department ?? "",
				}
				if (r.popularity >= MIN_SINGLE_POPULARITY)
					for (const part of new Set(parts)) {
						if (part.length < 3 || ORDINARY.has(part)) continue
						const list = single.get(part) ?? []
						list.push(person)
						single.set(part, list)
					}
				// Single-word names ("Zendaya") are left to the whole-query person search.
				if (parts.length < 2) continue
				const key = parts.join(" ")
				const old = map.get(key)
				if (old && old.popularity >= r.popularity) continue
				map.set(key, person)
			}
			for (const [part, list] of single)
				single.set(
					part,
					list
						.sort((a, b) => b.popularity - a.popularity)
						.slice(0, PER_SINGLE_NAME),
				)
			return { full: map, single }
		})
		index.catch(() => {
			index = null
		})
	}
	return index
}

/**
 * Full names in the query, longest first and never overlapping, plus the words left over.
 * `offered` are famous people one leftover word could name ("tom" in "funny tom"); they are
 * offered, never used to narrow the search on their own. `personId` narrows to one person
 * the visitor picked; their name words are removed from the leftover words.
 */
export async function peopleInQuery(q: string, personId?: number) {
	const { full: map, single } = await nameIndex()
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
	const offered: NamedPerson[] = []
	tokens.forEach((t, i) => {
		if (used[i]) return
		for (const p of single.get(t) ?? []) {
			if (p.id === personId) {
				people.push(p)
				used[i] = true
			}
			if (!offered.some((o) => o.id === p.id)) offered.push(p)
		}
	})
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
	return { people, rest, offered: offered.filter((o) => !people.includes(o)) }
}

/** Title keys ("movie:550") every one of the people is credited on, in front of or behind the camera. */
export async function sharedCredits(ids: number[]) {
	const sets = await Promise.all(
		ids.map(async (id) => {
			const [acting, crew] = await Promise.all([
				// Appearances as themselves (talk shows, award shows) are not their titles, and neither
				// are TV guest spots: TMDB bills guests after the regular cast, from about 290 on.
				query<{ media_tmdb_id: number; media_type: string }>(
					"SELECT media_tmdb_id, media_type FROM person_appeared_in WHERE person_tmdb_id = ? AND NOT coalesce(character, '') ~* '^(self|himself|herself|themselves)\\b.*' AND (media_type = 'movie' OR coalesce(order_default, 0) < 100) LIMIT 3000",
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
