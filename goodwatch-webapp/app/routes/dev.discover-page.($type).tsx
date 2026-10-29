// Development only: the real Discover page (DiscoverPage) with the loader data of the live site, for checking the
// page without local databases. The loader asks goodwatch.app for its Discover route data at the same path and
// parameters as a guest (no cookies), and follows the live route's redirects (old parameter names, type paths) to
// this page. Its requests in the browser go through the dev server proxy of scripts/dev-discover-bar.sh. Returns
// 404 in production.
import { type LoaderFunctionArgs, json, redirect } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData } from "@remix-run/react"
import type { BrowseLoaderData } from "~/routes/discover.($type)"
import { DiscoverPage } from "~/ui/discover/DiscoverPage"

const LIVE = "https://goodwatch.app"
const HERE = "/dev/discover-page"

export async function loader({ request, params }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	const url = new URL(request.url)
	const live = new URL(`/discover${params.type ? `/${params.type}` : ""}`, LIVE)
	live.search = url.search
	live.searchParams.set("_data", "routes/discover.($type)")
	const response = await fetch(live, {
		redirect: "manual",
		headers: { "user-agent": "goodwatch-dev-discover-page" },
	})
	const moved = response.headers.get("x-remix-redirect")
	if (moved) {
		const target = new URL(moved, LIVE)
		const path = target.pathname.replace(/^\/discover/, HERE)
		return redirect(`${path}${target.search}`)
	}
	if (!response.ok)
		throw new Response(`goodwatch.app answered ${response.status}`, {
			status: 502,
		})
	return json((await response.json()) as BrowseLoaderData)
}

// As on Discover: filters, sort, For you and the search change only the URL's parameters.
export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	formMethod,
	defaultShouldRevalidate,
}) =>
	formMethod || currentUrl.pathname !== nextUrl.pathname
		? defaultShouldRevalidate
		: false

export default function DevDiscoverPage() {
	const data = useLoaderData<BrowseLoaderData>()
	return <DiscoverPage {...data.browse} />
}
