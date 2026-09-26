// How a search names people. Whole names inside a longer phrase ("funny brad pitt movies") are found in an index of
// popular people and narrow the search to their titles; a single famous name word ("funny tom") only offers people;
// people the whole query names come from the title lookup and are gated by how well the query matches their name.
// No I/O here: people.server.ts loads the index and the credits.
import { fold } from "../search-ranking/text-rules.server.ts"

export interface IndexedPerson {
	id: number
	name: string
	popularity: number
	profile: string | null
	department: string
}

export interface PeopleIndex {
	/** Folded names of two or more words -> the most popular person with that name. */
	fullNames: Map<string, IndexedPerson>
	/** A folded name word -> famous people whose name has that word, most popular first. */
	nameWords: Map<string, IndexedPerson[]>
}

// Longest name tried, in words.
const MAX_NAME_WORDS = 4
// A single name word only offers people this popular (TMDB popularity), at most this many per word.
const MIN_WORD_POPULARITY = 5
const PEOPLE_PER_WORD = 8
// Joining words next to a name belong to the names, not to what the person wants to watch: "brad pitt and george
// clooney heist", "movies with tom hanks".
const JOINING_WORDS: ReadonlySet<string> = new Set([
	"and",
	"with",
	"starring",
	"featuring",
	"feat",
	"by",
	"or",
	"plus",
])
// Ordinary words that are also names of famous people. They never offer people on their own ("funny king").
const ORDINARY_WORDS: ReadonlySet<string> = new Set(
	`love black white king stone young hill wood bell hope joy rich west north south long little small green brown gray
grey rose may will mark grant rock bright noble day knight star walker hunter fox wolf bird lane page ford frank sweet
dark law faith grace story hart heart snow winter summer spring fall rain storm river lake ocean sea sky moon sun night
light power strong wise gold silver diamond price cash money banks church temple bishop pope priest judge major cook
baker butler taylor mason carpenter smith miller fisher gardner shepherd porter marshall sheriff cop killer crime war
peace hero heroes action drama comedy horror thriller romance romantic funny sad scary epic space time family kids child
children girl girls boy boys woman women man men lady queen prince princess witch vampire zombie ghost monster dragon
robot alien cowboy cowboys pirate ninja spy detective doctor nurse teacher lawyer soldier fighter boxer dancer singer
music musical dance school college high city town country island mountain desert jungle forest road car cars train plane
ship boat house home world earth life death dead alive blood fire ice water wind new old big best top good bad great
true real classic modern short fast slow hard easy happy`.split(/\s+/),
)

/** Folded words: lowercase, no diacritics, no possessive 's. The same keys the search ranking uses for names. */
export const nameWords = (text: string): string[] =>
	fold(text).split(" ").filter(Boolean)

/** The index over people rows (already limited to popular, non-adult people). */
export function buildPeopleIndex(people: Iterable<IndexedPerson>): PeopleIndex {
	const fullNames = new Map<string, IndexedPerson>()
	const byWord = new Map<string, IndexedPerson[]>()
	for (const person of people) {
		const parts = nameWords(person.name)
		if (person.popularity >= MIN_WORD_POPULARITY)
			for (const part of new Set(parts)) {
				if (part.length < 3 || ORDINARY_WORDS.has(part)) continue
				const list = byWord.get(part) ?? []
				list.push(person)
				byWord.set(part, list)
			}
		// One-word names ("Zendaya") are left to the title lookup, which sees the whole query.
		if (parts.length < 2) continue
		const key = parts.join(" ")
		const known = fullNames.get(key)
		if (!known || person.popularity > known.popularity)
			fullNames.set(key, person)
	}
	const nameWordIndex = new Map<string, IndexedPerson[]>()
	for (const [word, list] of byWord)
		nameWordIndex.set(
			word,
			list
				.sort((a, b) => b.popularity - a.popularity)
				.slice(0, PEOPLE_PER_WORD),
		)
	return { fullNames, nameWords: nameWordIndex }
}

export interface PeopleInQuery {
	/** Full names found in the query, longest first, never overlapping. */
	named: IndexedPerson[]
	/** The query without the names, their joining words, and a possessive "s": what to rank the titles by. */
	rest: string
	/** Famous people a single leftover word could name ("tom" in "funny tom"). Offered only, never narrowing. */
	offered: IndexedPerson[]
}

export function peopleInQuery(q: string, index: PeopleIndex): PeopleInQuery {
	const tokens = nameWords(q)
	const used = tokens.map(() => false)
	const named: IndexedPerson[] = []
	for (let n = Math.min(MAX_NAME_WORDS, tokens.length); n >= 2; n--)
		for (let i = 0; i + n <= tokens.length; i++) {
			if (used.slice(i, i + n).some(Boolean)) continue
			const person = index.fullNames.get(tokens.slice(i, i + n).join(" "))
			if (!person || named.some((p) => p.id === person.id)) continue
			named.push(person)
			used.fill(true, i, i + n)
		}
	const nextToName = (i: number) => used[i - 1] === true || used[i + 1] === true
	const restWords = tokens.filter(
		(t, i) =>
			!used[i] &&
			// "brad pitt s movies"
			!(t === "s" && used[i - 1]) &&
			!(JOINING_WORDS.has(t) && nextToName(i)),
	)
	const offered: IndexedPerson[] = []
	// A query of one leftover word is itself a name; the title lookup answers that.
	if (restWords.length > 1)
		for (const word of restWords)
			for (const person of index.nameWords.get(word) ?? [])
				if (
					!named.some((p) => p.id === person.id) &&
					!offered.some((p) => p.id === person.id)
				)
					offered.push(person)
	return { named, rest: restWords.join(" "), offered }
}

// Gate levels: people at or above MEDIUM are shown.
export const HIGH_CONFIDENCE = 0.8
export const MEDIUM_CONFIDENCE = 0.55
// A name found inside a phrase, and a famous person one word of the phrase names.
export const NAMED_CONFIDENCE = 1
export const OFFERED_CONFIDENCE = 0.8

/** How sure the query as a whole asks for this person, from 0 to 1. Descriptive queries score 0. */
export function nameMatchConfidence(
	q: string,
	name: string,
	popularity: number,
): number {
	const wanted = nameWords(q)
	const parts = nameWords(name)
	if (!wanted.length || !parts.length) return 0
	// A one-word query is weighed by fame below, even when it is someone's whole name: TMDB credits obscure people
	// as just "Nolan".
	if (wanted.length >= 2 && wanted.join(" ") === parts.join(" ")) return 1
	// The last word may still be typed: a prefix of a name word counts for it.
	const last = wanted.length - 1
	const covered = wanted.every(
		(w, i) =>
			parts.includes(w) ||
			(i === last && w.length >= 3 && parts.some((p) => p.startsWith(w))),
	)
	if (!covered) return 0
	if (wanted.length >= 2) return 0.85
	const fame = Math.min(popularity / 40, 0.3)
	// "nolan": one word equal to a name word; the famous Nolan wins over the others.
	if (parts.includes(wanted[0])) return 0.45 + fame
	return 0.25 + fame
}

// People shown above the titles, at most.
export const MAX_PEOPLE = 8

/**
 * The people to show, most certain first: names found in the phrase, the title lookup's people the whole query names
 * well enough, and famous people offered for one word. A person found twice keeps the higher confidence and the title
 * lookup's entry, which comes with its known-for titles.
 */
export function gatePeople<
	T extends { id: number; name: string; popularity: number },
>(q: string, found: { named: T[]; lookup: T[]; offered: T[] }): T[] {
	const best = new Map<number, { person: T; confidence: number }>()
	const add = (person: T, confidence: number, preferred = false) => {
		const known = best.get(person.id)
		best.set(person.id, {
			person: preferred || !known ? person : known.person,
			confidence: Math.max(confidence, known?.confidence ?? 0),
		})
	}
	for (const p of found.named) add(p, NAMED_CONFIDENCE)
	for (const p of found.offered) add(p, OFFERED_CONFIDENCE)
	for (const p of found.lookup)
		add(p, nameMatchConfidence(q, p.name, p.popularity), true)
	return [...best.values()]
		.filter((c) => c.confidence >= MEDIUM_CONFIDENCE)
		.sort(
			(a, b) =>
				b.confidence - a.confidence ||
				b.person.popularity - a.person.popularity,
		)
		.slice(0, MAX_PEOPLE)
		.map((c) => c.person)
}

/**
 * Whether an acting credit is one of the person's titles. Appearances as themselves (talk shows, award shows) are not,
 * and neither are TV guest spots: TMDB bills a show's guests after its regular cast, from about 290 on.
 */
export function isOwnActingCredit(credit: {
	media_type: string
	character: string | null
	order_default: number | null
}): boolean {
	if (/^(self|himself|herself|themselves)\b/i.test(credit.character ?? ""))
		return false
	return credit.media_type === "movie" || (credit.order_default ?? 0) < 100
}
