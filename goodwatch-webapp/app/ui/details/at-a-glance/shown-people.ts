// What of a people list At a glance's rows show before anything is pressed, for the title page's document
// (people-prefetch.server.ts). Pure, so a test can hold it.
import type { PeoplePage } from "~/utils/title-people"
import { DEPARTMENT_SHOWS } from "./rows"

/** A person's characters a cast row shows: its one line is cut long before. */
const SHOWN_ROLES = 6

/**
 * A first page cut to what the rows show. The cast: the first `castRows` rows (Starring before "Show more"), each with
 * the characters its line has room for; its next page starts after them. The crew: each department's first people as
 * Made by lists them (key jobs lead, as in the server's order); the whole list comes when a department opens
 * (CrewCredits). A search answer is kept whole.
 */
export function shownPage(
	query: { kind: "cast" | "crew"; q?: string },
	page: PeoplePage,
	castRows: number,
): PeoplePage {
	if (query.q) return page
	if (query.kind === "crew") {
		const taken = new Map<string, number>()
		const rows = page.rows.filter((r) => {
			const n = taken.get(r.group) ?? 0
			taken.set(r.group, n + 1)
			return n < DEPARTMENT_SHOWS
		})
		return { ...page, rows }
	}
	const rows = page.rows
		.slice(0, castRows)
		.map((r) => ({ ...r, roles: r.roles.slice(0, SHOWN_ROLES) }))
	return {
		...page,
		rows,
		nextOffset:
			rows.length < page.rows.length
				? page.offset + rows.length
				: page.nextOffset,
	}
}
