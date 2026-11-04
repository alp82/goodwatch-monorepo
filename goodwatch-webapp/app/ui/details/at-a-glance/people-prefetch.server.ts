// Puts the people the At a glance sub-page shows into its document: the cast list of Starring, the crew of Made by,
// and a show's creators, under the query keys the page's own lists read (people/usePeople.ts). So the sub-page's
// first HTML holds every name it shows, and the browser requests none of them. A list that fails or outlasts the
// budget is left out; the browser then requests it as before.
import {
	type DehydratedState,
	QueryClient,
	dehydrate,
} from "@tanstack/react-query"
import { getTitlePeoplePage } from "~/server/title-people.server"
import { CAST_PAGE_SIZE } from "~/ui/details/people/CastSection"
import { type PeopleQuery, peopleQueryKey } from "~/ui/details/people/usePeople"
import { CREW_PAGE_SIZE } from "./rows"

/** The lists At a glance reads for a title, as usePeople asks for them. */
export function glancePeopleQueries(
	type: "movie" | "show",
	id: number,
): Omit<PeopleQuery, "enabled">[] {
	const base = { mediaType: type, tmdbId: id } as const
	return [
		{ ...base, kind: "cast", pageSize: CAST_PAGE_SIZE },
		{ ...base, kind: "crew", pageSize: CREW_PAGE_SIZE },
		...(type === "show"
			? [{ ...base, kind: "crew" as const, q: "creator", pageSize: 6 }]
			: []),
	]
}

export async function prefetchGlancePeople({
	type,
	id,
	budgetMs,
}: {
	type: "movie" | "show"
	id: number
	/** How long the document waits for the lists. */
	budgetMs: number
}): Promise<{ state: DehydratedState; complete: boolean }> {
	const client = new QueryClient()
	let failed = false
	const work = glancePeopleQueries(type, id).map((query) =>
		getTitlePeoplePage({
			type,
			id,
			kind: query.kind,
			q: query.q ?? "",
			group: query.group ?? "",
			offset: 0,
			limit: query.pageSize ?? 60,
			byName: false,
			letter: "",
		})
			.then((page) =>
				client.setQueryData(peopleQueryKey(query), {
					pages: [page],
					pageParams: [0],
				}),
			)
			.catch((error: unknown) => {
				failed = true
				console.error("At a glance people prefetch failed", {
					error: error instanceof Error ? error.message : error,
				})
			}),
	)
	let timer: ReturnType<typeof setTimeout> | undefined
	const inTime = await Promise.race([
		Promise.all(work).then(() => true),
		new Promise<false>((done) => {
			timer = setTimeout(() => done(false), budgetMs)
		}),
	])
	clearTimeout(timer)
	// Late or failed lists load in the browser, and no cache may keep the page without them.
	return { state: dehydrate(client), complete: inTime && !failed }
}
