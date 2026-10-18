// Where a title page sits in the site: its hub and the genre page of its first genre that has one, as
// Movies › Science Fiction or Shows › Animation. The title page adds itself as the last item. On the server, so
// the genre pages' copy stays out of the title page's script.
import { genres as genrePages } from "~/ui/explore/category/genres"
import { type Crumb, crumbLabel } from "~/ui/nav/breadcrumb-trail"

// TMDB's genre names where a genre page's label says it differently.
const PAGE_LABEL: Record<string, string> = { Talk: "Talk Shows" }

/** The hub and genre page above a title, from the title's genres in TMDB's order. */
export function titleBreadcrumb(
	mediaType: "movie" | "show",
	genres: readonly string[] | null | undefined,
): Crumb[] {
	const type = mediaType === "movie" ? "movies" : "shows"
	const hub: Crumb = {
		label: mediaType === "movie" ? "Movies" : "Shows",
		path: `/${type}`,
	}
	for (const genre of genres ?? []) {
		const label = PAGE_LABEL[genre] ?? genre
		const page = Object.values(genrePages).find(
			(candidate) =>
				candidate.label === label &&
				(candidate.type === "all" || candidate.type === type),
		)
		if (page)
			return [
				hub,
				{ label: crumbLabel(page.label), path: `/${type}/genres/${page.path}` },
			]
	}
	return [hub]
}
