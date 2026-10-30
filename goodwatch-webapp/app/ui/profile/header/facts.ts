// The profile header's facts: a count line (movies and shows seen) and three facts from one set (nav-options.ts
// `facts`). The loader sends the facts it read from caches and one cheap watch-log read (header.server.ts); the ones
// the shell already holds are built here, so the owner's visitor view cuts them all by the same visibility rule. When a
// set's fact is missing, the next one from the pool takes its place, so every header shows three.
import { tastePath } from "~/domain/member-paths"
import { type ProfilePart, type ProfileShell, seesPart } from "~/domain/profile"
import type { NavOptions } from "~/ui/navigation/nav-options"
import { count } from "../parts"

export type HeaderFactKey =
	| "movies"
	| "shows"
	| "time"
	| "episodes"
	| "countries"
	| "languages"
	| "decades"
	| "genre"
	| "director"
	| "actor"
	| "yearSeen"
	| "yearTime"
	| "yearGenre"
	| "scores"
	| "since"

/** One fact: `value` in bold ("344 days") and a short `label` ("watch time"). */
export interface HeaderFact {
	key: HeaderFactKey
	value: string
	label: string
	/** Inline text puts the label first: "favorite director **Céline Sciamma**". */
	labelFirst?: boolean
	/** Shorter words for a phone's small tile ("23 titles", "this year"). */
	short?: { value?: string; label?: string }
	/** The tab it opens, when there is one. */
	to?: string
	/** The parts the viewer must see for the fact to show. */
	parts: ProfilePart[]
}

export type FactSet = NavOptions["facts"]

/** Each set's facts, best first. */
const SETS: Record<FactSet, HeaderFactKey[]> = {
	time: ["movies", "shows", "time"],
	range: ["time", "countries", "decades"],
	people: ["time", "director", "actor"],
	year: ["yearSeen", "yearTime", "yearGenre"],
}

/** The facts that fill in for a missing one, in this order. */
const POOL: HeaderFactKey[] = [
	"time",
	"episodes",
	"countries",
	"languages",
	"decades",
	"genre",
	"director",
	"actor",
	"yearSeen",
	"yearTime",
	"scores",
	"since",
]

/** "344 days", or hours below two days. */
export function watchTime(hours: number) {
	if (hours >= 48) {
		const days = Math.round(hours / 24)
		return `${count(days)} days`
	}
	return `${count(hours)} ${hours === 1 ? "hour" : "hours"}`
}

const plural = (n: number, one: string, many: string) =>
	`${count(n)} ${n === 1 ? one : many}`

/** The facts the shell itself holds: what was seen and how long it took. */
function shellFacts(
	shell: ProfileShell,
	query: { as: string } | undefined,
): HeaderFact[] {
	const c = shell.counts
	const seenTo =
		shell.viewer === "owner" && !query
			? undefined
			: tastePath(shell.handle, "seen", query)
	const out: HeaderFact[] = []
	const shows = Math.max(0, c.seen - c.seenMovies)
	if (c.seen > 0) {
		out.push({
			key: "movies",
			value: plural(c.seenMovies, "movie", "movies"),
			label: "seen",
			short: { value: count(c.seenMovies), label: "movies seen" },
			to: seenTo,
			parts: ["seen"],
		})
		out.push({
			key: "shows",
			value: plural(shows, "show", "shows"),
			label: "seen",
			short: { value: count(shows), label: "shows seen" },
			to: seenTo,
			parts: ["seen"],
		})
	}
	if (c.hours > 0)
		out.push({
			key: "time",
			value: watchTime(c.hours),
			label: "watch time",
			parts: ["hours"],
		})
	if (c.rated > 0)
		out.push({
			key: "scores",
			value: plural(c.rated, "score", "scores"),
			label: "given",
			to: tastePath(shell.handle, "scores", query),
			parts: ["scores"],
		})
	if (shell.since) {
		const [year, month] = shell.since.split("-").map(Number)
		const date = new Date(Date.UTC(year, (month || 1) - 1, 1))
		out.push({
			key: "since",
			value: date.toLocaleDateString("en-US", {
				month: "short",
				year: "numeric",
				timeZone: "UTC",
			}),
			label: "watching since",
			short: { value: String(year), label: "since" },
			parts: [],
		})
	}
	if (c.episodes > 0)
		out.push({
			key: "episodes",
			value: plural(c.episodes, "episode", "episodes"),
			label: "watched",
			parts: ["hours"],
		})
	return out
}

export interface HeaderFacts {
	/** Movies and shows seen, when the set doesn't show them already. Empty when the viewer may not see them. */
	count: HeaderFact[]
	/** Three facts, or fewer when the profile has little to say. */
	facts: HeaderFact[]
}

/** The count line and the set's facts the viewer may see, missing ones filled from the pool. */
export function headerFacts(
	shell: ProfileShell,
	loaded: HeaderFact[],
	set: FactSet,
	query: { as: string } | undefined,
): HeaderFacts {
	const all = new Map<HeaderFactKey, HeaderFact>()
	for (const fact of [...shellFacts(shell, query), ...loaded])
		if (fact.parts.every((part) => seesPart(shell, part)) && !all.has(fact.key))
			all.set(fact.key, fact)
	const wanted = SETS[set]
	const countKeys: HeaderFactKey[] = ["movies", "shows"]
	const showsCount = !wanted.includes("movies")
	const count = showsCount ? countKeys.flatMap((key) => all.get(key) ?? []) : []
	const used = new Set<HeaderFactKey>(showsCount ? countKeys : [])
	const facts: HeaderFact[] = []
	for (const key of [...wanted, ...POOL]) {
		if (facts.length >= 3) break
		const fact = all.get(key)
		if (!fact || used.has(key)) continue
		used.add(key)
		facts.push(fact)
	}
	return { count, facts }
}
