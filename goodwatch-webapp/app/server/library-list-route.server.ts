// The loader of a library list page: one status, maybe one kind and one sort, fixed by the page. Watch's list chips
// (/watch/watching, /watch/movies/seen, ...), Taste's Not rated and the old /my-library/:list pages share it. The
// sort, filter and search in the query pick the first step; the browser reads /api/my-library for the steps after.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import {
	type LibraryChoice,
	type LibraryKind,
	type LibrarySort,
	type LibraryStatus,
	libraryChoiceOf,
} from "~/domain/my-library"
import {
	type LibraryPage,
	getLibraryPage,
	withRowServices,
} from "~/server/my-library.server"
import { newOnForLibrary } from "~/server/newly-available.server"
import { getUserIdFromRequest } from "~/utils/auth"

/** What a page fixes. A kind of "all" (or none) keeps the kind control; a sort fixes the order and hides the sort. */
export interface LibraryListSpec {
	status: LibraryStatus
	kind?: LibraryKind
	sort?: LibrarySort | null
}

export interface LibraryListLoaded {
	status: LibraryStatus
	/** The kind the page fixes; null when the member picks it. */
	kind: "movie" | "show" | null
	/** The sort the page fixes; null when the member picks it. */
	sort: LibrarySort | null
	/** Null for a guest. */
	page: LibraryPage | null
	now: number
	viewer: string | null
}

const headers = { "Cache-Control": "private, no-store" }

/** The page's choice: the query's, with what the page fixes on top. */
export function listChoiceOf(
	params: URLSearchParams,
	fixed: Pick<LibraryListLoaded, "status" | "kind" | "sort">,
): LibraryChoice {
	const choice = libraryChoiceOf(params)
	return {
		...choice,
		status: fixed.status,
		kind: fixed.kind ?? choice.kind,
		sort: fixed.sort ?? choice.sort,
	}
}

export async function libraryListLoader(
	{ request }: Pick<LoaderFunctionArgs, "request">,
	spec: LibraryListSpec,
) {
	const fixed = {
		status: spec.status,
		kind: spec.kind && spec.kind !== "all" ? spec.kind : null,
		sort: spec.sort ?? null,
	}
	const userId = (await getUserIdFromRequest({ request })) ?? null
	if (!userId)
		return json<LibraryListLoaded>(
			{ ...fixed, page: null, now: Date.now(), viewer: null },
			{ headers },
		)
	const choice = listChoiceOf(new URL(request.url).searchParams, fixed)
	const page = await withRowServices(
		await getLibraryPage(
			userId,
			choice,
			0,
			await newOnForLibrary(request, userId, choice.status),
		),
		request,
		userId,
	)
	return json<LibraryListLoaded>(
		{ ...fixed, page, now: Date.now(), viewer: userId },
		{ headers },
	)
}
