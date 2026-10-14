import { presentCatalogLoader } from "~/server/media-payload.server"
import {
	type LoaderFunctionArgs,
	type MetaFunction,
	type TypedResponse,
	json,
	redirect,
} from "@remix-run/node"
import {
	type ShouldRevalidateFunction,
	useLoaderData,
	useNavigate,
	useRouteError,
} from "@remix-run/react"
import { searchText } from "~/domain/discover-search"
import {
	filterQuery,
	filterStateFromParams,
	rewriteLegacyDiscoverParams,
	sortFromParams,
} from "~/domain/filter-state"
import { legacyDiscoverRedirect } from "~/server/discover-legacy-params.server"
import {
	type DiscoverResults as BrowseResults,
	SnapshotNotLoaded,
	discoverFilterDefaults,
	forYouFromParams,
	getDiscoverResults as getBrowseResults,
} from "~/server/discover-results.server"
import { INCOMPLETE_PAGE_HEADERS } from "~/server/incomplete-page"
import { getPersonName } from "~/server/person.server"
import { getViewerContext } from "~/server/viewer.server"
import { DiscoverPage } from "~/ui/discover/DiscoverPage"
import { type InitialBrowse, browseKey } from "~/ui/discover/useDiscoverBrowse"
import { getUserIdFromRequest } from "~/utils/auth"
import { personPath } from "~/utils/helpers"
import { type PageItem, type PageMeta, buildMeta } from "~/utils/meta"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction<typeof loader> = ({ data, location }) => {
	// Discover's search mode: not indexed.
	if (data && searchText(new URLSearchParams(location.search).get("q")))
		return [
			{ title: "Search movies and shows · GoodWatch" },
			{ name: "robots", content: "noindex, follow" },
		]
	const pageMeta: PageMeta = {
		title: "Discover | GoodWatch",
		description:
			"Discover the best movies and tv shows to watch right now. From award-winning Netflix exclusives to classic films on Prime Video, Disney+ and HBO. Find movies and TV shows by genre, mood, or streaming service. Get personalized recommendations based on ratings from IMDb, Rotten Tomatoes, and Metacritic. Updated daily with new releases and trending titles.",
		url: "https://goodwatch.app/discover",
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		alt: "Find your next binge by genre, mood, or streaming service on GoodWatch",
	}

	const items: PageItem[] = []

	return buildMeta({ pageMeta, items })
}

// Title pages used to link cast as /discover/all?withCast=3084, and search engines still
// know thousands of those URLs. A lookup of one person and nothing else is their page now.
const IGNORED_FOR_PERSON = new Set([
	"type",
	"page",
	"sortBy",
	"sortDirection",
	"withCastCombinationType",
	"withCrewCombinationType",
	"country",
	"language",
	"fbclid",
	"gclid",
])

/** The person id when the URL only asks for one cast or crew member, else null. */
function singlePersonLookup(params: URLSearchParams): number | null {
	let personId: number | null = null
	for (const [key, value] of params) {
		if (!value || IGNORED_FOR_PERSON.has(key) || key.startsWith("utm_"))
			continue
		const isPerson = key === "withCast" || key === "withCrew"
		if (isPerson && personId === null && /^\d{1,10}$/.test(value)) {
			personId = Number(value)
			continue
		}
		return null
	}
	return personId
}

const canonicalLoader = async ({
	request,
	params: routeParams,
}: LoaderFunctionArgs) => {
	// Extract page from URL parameters
	const url = new URL(request.url)
	const urlParams = new URLSearchParams(url.search)

	const personId = singlePersonLookup(urlParams)
	if (personId) {
		const name = await getPersonName(personId)
		if (name) return redirect(personPath(personId, name), 301)
	}

	// Old links move to the new parameter names first.
	const moved = await legacyDiscoverRedirect(request)
	if (moved) {
		moved.headers.set("Cache-Control", "private, no-store")
		return moved
	}
	// The type is a filter: /discover/movies is /discover?type=movie.
	if (routeParams.type) {
		const type = ({ movies: "movie", show: "show" } as Record<string, string>)[
			routeParams.type
		]
		if (type && !urlParams.has("type")) urlParams.set("type", type)
		const search = urlParams.toString()
		return redirect(`/discover${search ? `?${search}` : ""}`, {
			status: 301,
			headers: { "Cache-Control": "private, no-store" },
		})
	}
	const userId = (await getUserIdFromRequest({ request })) ?? null
	return browseLoader(request, userId)
}

// Pages the first view loads for ?page=N.
const MAX_INITIAL_PAGES = 5

export interface BrowseLoaderData {
	browse: {
		initial: InitialBrowse | null
		member: boolean
		hasServices: boolean
		savedForYou: boolean
		searchScope: { country: string; services: number[] }
	}
}

async function browseLoader(
	request: Request,
	userId: string | null,
): Promise<BrowseLoaderData | TypedResponse<BrowseLoaderData>> {
	const params = new URL(request.url).searchParams
	// A guest's progress lives in their browser: the first view is the plain guest's, and the browser asks again with it.
	const ctx = await getViewerContext(request, undefined, userId)
	const defaults = discoverFilterDefaults(ctx)
	const state = filterStateFromParams(params, defaults)
	const sort = sortFromParams(params, false)
	const forYou = forYouFromParams(params, ctx)
	const requested = Number.parseInt(params.get("page") ?? "1", 10) || 1
	const count = Math.min(Math.max(1, requested), MAX_INITIAL_PAGES)
	// Search mode: the browser runs the search (its reading streams in), so the first view has no results yet.
	const searching = searchText(params.get("q")) !== null
	let snapshotNotLoaded = false
	let pages: BrowseResults[] | null = null
	try {
		if (!searching)
			pages = await Promise.all(
				Array.from({ length: count }, (_, i) =>
					getBrowseResults(ctx, { state, sort, forYou, page: i + 1 }),
				),
			)
	} catch (error) {
		// Right after a restart: the browser asks /api/discover/results once the snapshot has loaded.
		if (!(error instanceof SnapshotNotLoaded)) throw error
		snapshotNotLoaded = true
	}
	const data: BrowseLoaderData = {
		browse: {
			initial: pages
				? { key: browseKey(filterQuery(state, sort, defaults), forYou, undefined, ctx.language), pages }
				: null,
			member: ctx.viewer.kind === "member",
			hasServices: ctx.services.length > 0,
			savedForYou: ctx.forYou,
			searchScope: { country: ctx.country, services: ctx.services },
		},
	}
	return snapshotNotLoaded
		? json(data, { headers: INCOMPLETE_PAGE_HEADERS })
		: data
}

// Discover's filters, sort, For you, and search query change only the URL's parameters, and the results come from
// /api/discover/results and the search, so the loader doesn't run again for them.
export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	formMethod,
	defaultShouldRevalidate,
}) => {
	if (
		formMethod ||
		currentUrl.pathname !== nextUrl.pathname ||
		// An old link followed from this page still goes through the loader's redirect.
		rewriteLegacyDiscoverParams(nextUrl.searchParams, () => undefined)
	)
		return defaultShouldRevalidate
	return false
}

export function ErrorBoundary() {
	const error = useRouteError()
	const navigate = useNavigate()

	return (
		<div className="max-w-7xl mt-8 mx-auto px-4 flex flex-col gap-5 items-center">
			<h1 className="text-3xl font-bold">Oh no!</h1>
			<p className="py-1 px-3 text-2xl text-gray-300 bg-red-900">
				{error.message}
			</p>
			<button
				type="button"
				className="w-40 px-4 py-2 bg-gray-800 text-gray-100 hover:bg-gray-700 rounded-sm transition-colors"
				onClick={() => navigate("/discover")}
			>
				Go Back
			</button>
		</div>
	)
}

export default function DiscoverRoute() {
	const data = useLoaderData<BrowseLoaderData>()
	return <DiscoverPage {...data.browse} />
}

export const loader = presentCatalogLoader(canonicalLoader, { live: true })
