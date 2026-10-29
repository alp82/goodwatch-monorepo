import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { useLoaderData, useLocation } from "@remix-run/react"
import { presentCatalogLoader } from "~/server/media-payload.server"
import {
	type TastePageData,
	loadTastePage,
	tastePageViewer,
} from "~/server/taste-portrait/page.server"
import { NoHandleChrome } from "~/ui/profile/ProfileHeader"
import {
	TastePageBody,
	sideShouldRevalidate,
} from "~/ui/taste/portrait/TastePageBody"
import { type PageMeta, buildMeta } from "~/utils/meta"

export { pageHeaders as headers } from "~/utils/headers"

export const shouldRevalidate = sideShouldRevalidate

export const meta: MetaFunction<typeof loader> = () => {
	const pageMeta: PageMeta = {
		title: "Your taste - GoodWatch",
		description:
			"Your viewer type, what pulls you in movies and shows, your taste groups, and where you part ways with everyone.",
		url: "https://goodwatch.app/taste",
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		alt: "Your taste on GoodWatch",
	}

	// Personal: a guest's server HTML is an empty shell, the page fills from the browser.
	return buildMeta({ pageMeta, items: [], robots: "noindex, follow" })
}

async function canonicalLoader({ request }: LoaderFunctionArgs) {
	const { userId } = await tastePageViewer(request)
	return loadTastePage(request, userId)
}

/**
 * Taste for guests (their taste lives in the browser) and for members without a handle, who get the Taste row and the
 * strip that asks for a handle above it. Members with a handle have their Taste at /u/:handle.
 */
export default function TasteRoute() {
	const data = useLoaderData<typeof loader>() as TastePageData
	const { pathname, search } = useLocation()
	const member = data.kind === "portrait" || data.view !== null
	const body = <TastePageBody data={data} />
	if (!member || data.handle) return body
	return (
		<main className="min-h-screen overflow-x-clip text-white">
			<NoHandleChrome pathname={pathname} search={search} />
			{body}
		</main>
	)
}

export const loader = presentCatalogLoader(canonicalLoader, { live: true })
