// The profile header's facts, all from the shell and the taste print, so the owner's visitor view cuts them by the
// same visibility rule: the fact line (movies and shows seen, then the watch time), the join date ("On GoodWatch
// since"), and the fingerprint's key facts the orbit opens (the strongest families, the top attributes). When a fact is
// missing (watch time hidden), the next one from the pool takes its place, so the line keeps three where it can.
import { tastePath } from "~/domain/member-paths"
import { type ProfilePart, type ProfileShell, seesPart } from "~/domain/profile"
import { FAMILY_NAMES } from "~/domain/taste-attributes"
import { monthYear } from "../ProfileFrame"
import { count } from "../parts"
import type { WhorlAttribute } from "../taste/Whorl"
import { FAMILY_ORDER, type FamilyId } from "../taste/model"

export type HeaderFactKey = "movies" | "shows" | "time" | "episodes" | "scores"

/** One fact: `value` in bold ("344 days") and a short `label` ("watch time"). */
export interface HeaderFact {
	key: HeaderFactKey
	value: string
	label: string
	/** The tab it opens, when there is one. */
	to?: string
	/** The parts the viewer must see for the fact to show. */
	parts: ProfilePart[]
}

/** The facts in the order the line shows them; the last two fill in for a missing one. */
const ORDER: HeaderFactKey[] = ["movies", "shows", "time", "episodes", "scores"]

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
	if (c.seen > 0) {
		out.push({
			key: "movies",
			value: plural(c.seenMovies, "movie", "movies"),
			label: "seen",
			to: seenTo,
			parts: ["seen"],
		})
		out.push({
			key: "shows",
			value: plural(Math.max(0, c.seen - c.seenMovies), "show", "shows"),
			label: "seen",
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
	if (c.episodes > 0)
		out.push({
			key: "episodes",
			value: plural(c.episodes, "episode", "episodes"),
			label: "watched",
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
	return out
}

/** Movies seen, shows seen and the watch time the viewer may see, missing ones filled from the pool. */
export function headerFacts(
	shell: ProfileShell,
	query: { as: string } | undefined,
): HeaderFact[] {
	const all = shellFacts(shell, query).filter((fact) =>
		fact.parts.every((part) => seesPart(shell, part)),
	)
	return ORDER.flatMap((key) => all.find((f) => f.key === key) ?? []).slice(
		0,
		3,
	)
}

/** The join date's month, "October 2026", for "On GoodWatch since October 2026"; null when the viewer may not see it. */
export const joinedMonth = (shell: ProfileShell) =>
	shell.since ? monthYear(shell.since) : null

// ---------- The fingerprint's key facts ----------

export interface FamilyPull {
	id: FamilyId
	name: string
	/** 0..1 against the strongest family. */
	strength: number
}

/** How strongly the member seeks each family's attributes (the mean of the positive edges), in fingerprint order. */
export function familyPulls(print: WhorlAttribute[]): FamilyPull[] {
	const raw = FAMILY_ORDER.map((id) => {
		const attrs = print.filter((a) => a.family === id)
		const pull = attrs.reduce((sum, a) => sum + Math.max(0, a.edge), 0)
		return { id, pull: attrs.length ? pull / attrs.length : 0 }
	})
	const max = Math.max(...raw.map((f) => f.pull), 0.0001)
	return raw.map((f) => ({
		id: f.id,
		name: FAMILY_NAMES[f.id].name,
		strength: f.pull / max,
	}))
}

export interface KeyFacts {
	/** The strongest families, strongest first: at most three, none below a third of the strongest. */
	families: FamilyPull[]
	/** Every family's pull, in fingerprint order, for bars. */
	pulls: FamilyPull[]
	/** The most sought attributes, strongest first. */
	attributes: WhorlAttribute[]
}

export function keyFacts(print: WhorlAttribute[]): KeyFacts {
	const pulls = familyPulls(print)
	return {
		pulls,
		families: [...pulls]
			.sort((a, b) => b.strength - a.strength)
			.filter((f, i) => i === 0 || f.strength >= 0.34)
			.slice(0, 3),
		attributes: print
			.filter((a) => a.edge > 0)
			.sort((a, b) => b.edge - a.edge)
			.slice(0, 3),
	}
}
