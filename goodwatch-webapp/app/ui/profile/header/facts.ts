// The profile header's essence: one count (Scores, or Seen when the scores are hidden) and a few telling facts about
// the member. The loader sends the facts it read from caches (header.server.ts); the ones the shell already holds are
// built here, so the owner's visitor view cuts them all by the same visibility rule.
import { tastePath } from "~/domain/member-paths"
import { type ProfilePart, type ProfileShell, seesPart } from "~/domain/profile"
import { count } from "../parts"

export type HeaderFactKey =
	| "pull"
	| "usual"
	| "crowd"
	| "genre"
	| "days"
	| "decade"

/** One fact: `lead`, then `value` in bold, then `tail` ("drawn to **the surreal**", "**7.4** usual score"). */
export interface HeaderFact {
	key: HeaderFactKey
	lead?: string
	value: string
	tail?: string
	/** The parts the viewer must see for the fact to show. */
	parts: ProfilePart[]
}

/** The header's one count, with the tab it opens. */
export interface HeaderCount {
	n: number
	label: string
	/** The tab it opens; none for the owner's Seen, which lives in Watch. */
	to?: string
}

/** Phones have room for one short fact: the numbers first, the attribute last. */
const PHONE_ORDER: HeaderFactKey[] = [
	"usual",
	"days",
	"genre",
	"decade",
	"crowd",
	"pull",
]

export const phoneFacts = (facts: HeaderFact[]) =>
	[...facts].sort(
		(a, b) => PHONE_ORDER.indexOf(a.key) - PHONE_ORDER.indexOf(b.key),
	)

/** The order facts show in when there is room for only some. */
const ORDER: HeaderFactKey[] = [
	"pull",
	"usual",
	"crowd",
	"days",
	"genre",
	"decade",
]

export function headerCount(
	shell: ProfileShell,
	query: { as: string } | undefined,
): HeaderCount | null {
	const c = shell.counts
	if (seesPart(shell, "scores") && c.rated > 0)
		return {
			n: c.rated,
			label: c.rated === 1 ? "score" : "scores",
			to: tastePath(shell.handle, "scores", query),
		}
	if (seesPart(shell, "seen") && c.seen > 0)
		return {
			n: c.seen,
			label: "seen",
			to:
				shell.viewer === "owner" && !query
					? undefined
					: tastePath(shell.handle, "seen", query),
		}
	return null
}

/** The facts the viewer may see, best first: the loader's, and the ones the shell holds. */
export function headerFacts(
	shell: ProfileShell,
	loaded: HeaderFact[],
): HeaderFact[] {
	const c = shell.counts
	const all: HeaderFact[] = [...loaded]
	if (c.average != null && c.rated >= 5)
		all.push({
			key: "usual",
			value: c.average.toFixed(1),
			tail: "usual score",
			parts: ["scores"],
		})
	const days = Math.round(c.hours / 24)
	if (days >= 1)
		all.push({
			key: "days",
			value: count(days),
			tail: days === 1 ? "day watched" : "days watched",
			parts: ["hours"],
		})
	return all
		.filter((fact) => fact.parts.every((part) => seesPart(shell, part)))
		.sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key))
}
