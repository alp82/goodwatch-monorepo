// Taste group names: two traits and a noun, short enough for a Discover row title, a TV guide entry, and one line on a
// title page on a phone ("Dark, tense crime"). The traits are what sets the group apart from the person's other groups;
// the noun is the most specific kind of title that still describes the group. No place, no "stories about" clause.
import { familyOf } from "./families.server"
import { KEYS, type RatedTitle } from "./person.server"
import { adjective, capitalize } from "./words.server"

/** A name's length the engine aims for: names past it are taken only when no shorter one describes the group. */
export const NAME_LENGTH = 28
// A title this far below the catalog on an attribute a name claims (z) is not described by that name.
const AGAINST_NAME = -1
// A title at least this far above the catalog on a World attribute (z) is that kind of title.
const KIND_Z = 0.5

/** Attribute keys by how much the group stands out from the person's other groups, most first. */
export type Standout = { key: string; weight: number }[]

interface Kind {
	noun: string
	/** Whether the title is this kind: its genre, or a World attribute it carries. */
	has: (title: RatedTitle) => boolean
	/** Attributes the noun already says, so a trait doesn't repeat them ("tense thrillers"). */
	says: string[]
	/** Humor traits say what kind of funny before it ("absurd comedies"). */
	comedy?: boolean
}

const carries = (key: string) => {
	const at = KEYS.indexOf(key)
	return (title: RatedTitle) => title.z[at] >= KIND_Z
}
const genre =
	(...names: string[]) =>
	(title: RatedTitle) =>
		names.some((name) => title.facts.genres.includes(name))
type Test = (title: RatedTitle) => boolean
const either =
	(...tests: Test[]): Test =>
	(title) =>
		tests.some((test) => test(title))
const both =
	(a: Test, b: Test): Test =>
	(title) =>
		a(title) && b(title)

/**
 * The nouns a name can end in, most specific first: by the share of the catalog's reference pool each describes, from
 * documentaries (1 percent) to dramas (48 percent), as of October 2026. "Stories" describes every title and comes last.
 */
const KINDS: Kind[] = [
	{ noun: "documentaries", has: genre("Documentary"), says: ["educational"] },
	{ noun: "westerns", has: genre("Western"), says: [] },
	{ noun: "sports stories", has: carries("sports"), says: ["sports"] },
	{
		noun: "family movies",
		has: both(genre("Family"), (title) => title.facts.mediaType === "movie"),
		says: [],
	},
	{ noun: "horror", has: genre("Horror"), says: ["scare"] },
	{
		noun: "animation",
		has: either(genre("Animation"), (title) => title.facts.anime),
		says: [],
	},
	{
		noun: "biopics",
		// A documentary about a real life isn't a biopic.
		has: both(carries("biographical"), (title) => !genre("Documentary")(title)),
		says: ["biographical"],
	},
	{
		noun: "sci-fi",
		has: either(genre("Science Fiction"), carries("futuristic")),
		says: ["futuristic"],
	},
	{
		noun: "war stories",
		has: either(genre("War"), carries("warfare")),
		says: ["warfare"],
	},
	{
		noun: "period pieces",
		has: either(genre("History"), carries("historical")),
		says: ["historical"],
	},
	{
		noun: "fantasy",
		has: either(genre("Fantasy"), carries("fantasy")),
		says: ["fantasy"],
	},
	{
		noun: "romances",
		has: either(genre("Romance"), carries("romance")),
		says: ["romance"],
	},
	{ noun: "comedies", has: genre("Comedy"), says: [], comedy: true },
	{
		noun: "action",
		has: genre("Action", "Action & Adventure"),
		says: ["adrenaline"],
	},
	{
		noun: "mysteries",
		has: either(genre("Mystery"), carries("mystery")),
		says: ["mystery"],
	},
	{
		noun: "crime",
		has: either(genre("Crime"), carries("crime")),
		says: ["crime"],
	},
	{
		noun: "thrillers",
		// A tense crime or mystery story is a thriller too.
		has: either(
			genre("Thriller"),
			both(
				carries("tension"),
				either(genre("Crime", "Mystery"), carries("crime"), carries("mystery")),
			),
		),
		says: ["tension"],
	},
	{
		noun: "adventures",
		has: genre("Adventure", "Action & Adventure", "Action"),
		says: [],
	},
	{ noun: "dramas", has: genre("Drama"), says: [] },
	{ noun: "stories", has: () => true, says: [] },
]

// Attributes whose adjective makes a poor trait: World ones that read as "crime-focused" (a noun says those), and one
// too long to fit.
const NO_TRAIT = new Set([
	"crime",
	"warfare",
	"sports",
	"family_dynamics",
	"showbiz",
	"gaming",
	"pop_culture",
	"technology_and_humanity",
	"pastiche",
])
// Shorter or plainer words for a name than the portrait's adjectives.
const NAME_WORDS: Record<string, string> = {
	bleakness: "dark",
	slow_burn: "slow-burn",
	spectacle: "epic",
	wholesome: "warm",
	contemporary_realism: "everyday",
	situational_comedy: "funny",
	physical_comedy: "funny",
	cringe_humor: "funny",
	absurdist_humor: "funny",
}
// Humor traits before "comedies": what kind of funny.
const COMIC_WORDS: Record<string, string> = {
	situational_comedy: "situational",
	wit_wordplay: "witty",
	physical_comedy: "slapstick",
	cringe_humor: "awkward",
	absurdist_humor: "absurd",
	satire_parody: "satirical",
	dark_humor: "dark",
}
// The traits a name is built from: the first few of the standout that can be traits, paired in this order.
const TRAITS = 4
const PAIRS = [
	[0, 1],
	[0, 2],
	[1, 2],
	[0, 3],
	[1, 3],
	[2, 3],
]

const word = (key: string, kind: Kind) =>
	(kind.comedy ? COMIC_WORDS[key] : undefined) ??
	NAME_WORDS[key] ??
	adjective(key)
// Two words that repeat each other ("dark, darkly funny", "funny, darkly funny").
const stems = (w: string) => w.split(/[ -]/).map((part) => part.slice(0, 4))
const clash = (x: string, y: string) =>
	stems(x).some((stem) => stems(y).includes(stem))
// A World trait says what the titles are about, so it goes right before the noun: "Dark, psychological stories".
const aboutness = (key: string) => (familyOf(key) === "world" ? 1 : 0)

interface Candidate {
	name: string
	keys: string[]
	kind: Kind
}

/** The names a group can take, best first: per noun, most specific first, two traits ("Dark, tense crime"), then one. */
function candidates(order: Standout): Candidate[] {
	const traits = order.filter((o) => !NO_TRAIT.has(o.key))
	const names: Candidate[] = []
	for (const kind of KINDS) {
		const usable = traits
			.filter((t) => !kind.says.includes(t.key))
			.slice(0, TRAITS)
		for (const [i, j] of PAIRS) {
			if (!usable[i] || !usable[j]) continue
			const [a, b] = [usable[i], usable[j]].sort(
				(p, q) => aboutness(p.key) - aboutness(q.key),
			)
			const [x, y] = [word(a.key, kind), word(b.key, kind)]
			if (clash(x, y)) continue
			names.push({
				name: `${capitalize(x)}, ${y} ${kind.noun}`,
				keys: [a.key, b.key],
				kind,
			})
		}
		if (usable[0])
			names.push({
				name: `${capitalize(word(usable[0].key, kind))} ${kind.noun}`,
				keys: [usable[0].key],
				kind,
			})
	}
	return names
}

/** The group's titles a name describes: of its kind, and none strongly against a trait the name claims. */
function describedBy(members: RatedTitle[], candidate: Candidate) {
	const at = candidate.keys.map((key) => KEYS.indexOf(key))
	return members.filter(
		(r) => candidate.kind.has(r) && at.every((k) => r.z[k] >= AGAINST_NAME),
	)
}

/**
 * The group's name and the titles it describes. The most specific noun with a name not taken that describes three in
 * four of the group's titles decides; of its names, the first with two traits that fits NAME_LENGTH, else the first
 * with one trait that fits, else the shortest. With no such name, the one that describes the most. Null when no name
 * describes two.
 */
export function nameGroup(
	order: Standout,
	members: RatedTitle[],
	taken: Set<string>,
) {
	const most = Math.max(2, Math.ceil(0.75 * members.length))
	type Named = { name: string; members: RatedTitle[] }
	// A name that fits beats longer ones, and the first that fits wins: the names with two traits come first.
	const rank = ({ name }: Candidate) =>
		name.length <= NAME_LENGTH ? 0 : name.length
	let chosen: (Named & { kind: Kind; rank: number }) | null = null
	let best: Named | null = null
	for (const candidate of candidates(order)) {
		if (chosen && candidate.kind !== chosen.kind) break
		if (taken.has(candidate.name)) continue
		const named = {
			name: candidate.name,
			members: describedBy(members, candidate),
		}
		if (
			named.members.length >= most &&
			(!chosen || rank(candidate) < chosen.rank)
		)
			chosen = { ...named, kind: candidate.kind, rank: rank(candidate) }
		if (!best || named.members.length > best.members.length) best = named
	}
	const name = chosen ?? best
	if (!name || name.members.length < 2) return null
	taken.add(name.name)
	return { name: name.name, members: name.members }
}
