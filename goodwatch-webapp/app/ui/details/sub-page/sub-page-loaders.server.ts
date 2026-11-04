// The loaders of a title's sub-pages (routes/movie.$movieKey_.*, show.$showKey_.*): the frame's data
// (sub-page.server.ts) and each sub-page's own content, all of it in the first HTML. A part that ran out of time or
// failed loads in the browser, and the answer carries INCOMPLETE_PAGE_HEADERS so no cache keeps the page.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { INCOMPLETE_PAGE_HEADERS } from "~/server/incomplete-page"
import { prefetchGlancePeople } from "~/ui/details/at-a-glance/people-prefetch.server"
import type { FpRanks } from "~/ui/details/fingerprint-section/print-model"
import { fingerprintRanks } from "~/ui/details/fingerprint-section/ranks.server"
import { tropesPageState } from "~/ui/details/tropes/title-tropes.server"
import { mergeDehydratedStates } from "~/utils/title-extras"
import { type SubPageData, loadSubPage } from "./sub-page.server"

type Type = "movie" | "show"

/** How long the document waits for At a glance's cast and crew lists. */
const PEOPLE_BUDGET_MS = 1500

export type FingerprintPageData = SubPageData & { ranks: FpRanks | null }
export type TropesPageData = SubPageData & { tropes: number | null }
export type GlancePageData = SubPageData

const answer = <T extends SubPageData>(data: T) =>
	data.complete ? json(data) : json(data, { headers: INCOMPLETE_PAGE_HEADERS })

export async function fingerprintPageLoader(
	args: LoaderFunctionArgs,
	type: Type,
) {
	const data = await loadSubPage(args, type, "fingerprint")
	// Where each feeling ranks among popular titles; none when the population isn't there in time.
	const ranks = await fingerprintRanks(
		data.media.mediaType,
		data.media.fingerprint?.scores,
	)
	return answer<FingerprintPageData>({ ...data, ranks })
}

/** The title's id as its address names it (loadSubPage checks it and moves a wrong one). */
const idOf = (args: LoaderFunctionArgs, type: Type) => {
	const id = Number(
		(
			(type === "movie" ? args.params.movieKey : args.params.showKey) ?? ""
		).split("-")[0],
	)
	return Number.isSafeInteger(id) && id > 0 ? id : null
}

export async function tropesPageLoader(args: LoaderFunctionArgs, type: Type) {
	// The tropes need only the title's id: they load alongside the title.
	const id = idOf(args, type)
	const tropesWork = id ? tropesPageState(type, id) : null
	const data = await loadSubPage(args, type, "tropes")
	const tropes = await (tropesWork ??
		tropesPageState(data.media.mediaType, data.media.details.tmdb_id))
	return answer<TropesPageData & { dehydratedState: unknown }>({
		...data,
		tropes: tropes.total,
		dehydratedState: mergeDehydratedStates(tropes.state),
		complete: data.complete && tropes.complete,
	})
}

export async function glancePageLoader(args: LoaderFunctionArgs, type: Type) {
	// The cast and crew lists need only the title's id: they load alongside the title.
	const id = idOf(args, type)
	const people = (type: Type, id: number) =>
		prefetchGlancePeople({ type, id, budgetMs: PEOPLE_BUDGET_MS })
	const peopleWork = id ? people(type, id) : null
	const data = await loadSubPage(args, type, "at-a-glance")
	const glance = await (peopleWork ??
		people(data.media.mediaType, data.media.details.tmdb_id))
	return answer<GlancePageData & { dehydratedState: unknown }>({
		...data,
		dehydratedState: mergeDehydratedStates(glance.state),
		complete: data.complete && glance.complete,
	})
}
