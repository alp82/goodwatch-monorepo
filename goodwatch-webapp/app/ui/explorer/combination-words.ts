// The words for what a combination holds, and for what an island would leave of it.
import type { CombinationKind } from "~/domain/explorer"

export interface PickedIsland {
	id: string
	name: string
	color: string
	/** Its group's name ("Mood"). */
	group: string
	/** How many titles the island holds. */
	total: number
	/** TMDB paths of its first posters. */
	posters: string[]
	/** How many titles the other picked islands hold without it; null until known, or alone. */
	without?: number | null
}

export const titles = (count: number) =>
	`${count.toLocaleString("en")} ${count === 1 ? "title" : "titles"}`

/** Two islands of one group, today's bridge: "130 titles in both" or "130 titles between them". */
export const sharedLine = (count: number, kind: CombinationKind) =>
	kind === "both" ? `${titles(count)} in both` : `${titles(count)} between them`

/** Groupings where a title sits on one island only: two of their islands in a combination mean either. */
const ONE_ISLAND = new Set(["decade", "country", "taste"])
const ORDER = [
	"mood",
	"style",
	"taste",
	"theme",
	"occasion",
	"decade",
	"country",
]
const lower = (name: string) => name.charAt(0).toLowerCase() + name.slice(1)
const OCCASIONS: Record<string, string> = {
	Party: "for a party",
	Family: "for the family",
	Binge: "for a binge",
	Background: "for the background",
	"Easy watch": "an easy watch",
	"Drop-in": "for dropping in",
}
/** An island as it reads after "titles that are": Funny, about crime, for a party, from the 1990s. */
const phrase = (grouping: string, name: string) =>
	grouping === "theme"
		? `about ${lower(name)}`
		: grouping === "occasion"
			? (OCCASIONS[name] ?? `for ${lower(name)}`)
			: grouping === "decade" ||
					(grouping === "country" && /^United /.test(name))
				? `the ${name}`
				: name

/**
 * A combination of islands from different groups, as a sentence: "15 titles that are Funny, Talky, about crime, from
 * the 1990s, from the United States". Two decades or two countries read "from the 1980s or the 1990s", as the
 * combination holds either.
 */
export function combinationSentence(
	count: number,
	sides: readonly PickedIsland[],
) {
	const groups = new Map<string, string[]>()
	for (const s of sides) {
		const grouping = s.id.slice(0, s.id.indexOf(":"))
		const list = groups.get(grouping) ?? []
		list.push(phrase(grouping, s.name))
		groups.set(grouping, list)
	}
	const parts = [...groups]
		.sort((x, y) => ORDER.indexOf(x[0]) - ORDER.indexOf(y[0]))
		.map(([grouping, list]) => {
			const joined = list.join(ONE_ISLAND.has(grouping) ? " or " : " and ")
			return grouping === "decade" || grouping === "country"
				? `from ${joined}`
				: joined
		})
	return `${titles(count)} that ${count === 1 ? "is" : "are"} ${parts.join(", ")}`
}

/**
 * What an island would leave of the combination, under its name: every island added narrows it. A second island of
 * the first one's group makes today's bridge instead, and keeps its words.
 */
export const sharedNote = (
	count: number,
	kind: CombinationKind,
	bridge: boolean,
) =>
	bridge
		? `${count.toLocaleString("en")} ${kind === "both" ? "in both" : "between"}`
		: `${count.toLocaleString("en")} left`
