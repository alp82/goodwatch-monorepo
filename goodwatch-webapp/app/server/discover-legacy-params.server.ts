// Old Discover links carry today's parameter names (withGenres, minScore, withStreamingProviders, sortBy, and so on).
// Once the new filter bar serves Discover, they redirect to the new names so shared links, bookmarks, and search
// engines keep landing on the same list.
import { redirect } from "@remix-run/node"
import { rewriteLegacyDiscoverParams } from "~/domain/filter-state"
import { getGenresAll } from "~/server/genres.server"

/** A permanent redirect to the same page with the new parameter names, or null when the URL has no old ones. */
export async function legacyDiscoverRedirect(
	request: Request,
): Promise<Response | null> {
	const url = new URL(request.url)
	const needsGenres = url.searchParams.has("withGenres")
	const genres = needsGenres ? await getGenresAll() : []
	const rewritten = rewriteLegacyDiscoverParams(
		url.searchParams,
		(id) => genres.find((genre) => genre.id === id)?.name,
	)
	if (!rewritten) return null
	const search = rewritten.toString()
	return redirect(`${url.pathname}${search ? `?${search}` : ""}`, 301)
}
