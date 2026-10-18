import { presentCatalogLoader } from "~/server/media-payload.server"
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import {
	type TasteTabData,
	loadTasteTab,
	tastePageViewer,
} from "~/server/taste-portrait/page.server"
import { TasteTabFrame } from "~/ui/taste/tabs/TasteTabFrame"
import { YouVsEveryone } from "~/ui/taste/tabs/YouVsEveryone"
import { type PageMeta, buildMeta } from "~/utils/meta"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => {
	const pageMeta: PageMeta = {
		title: "You vs everyone - GoodWatch",
		description:
			"Where your ratings part ways with everyone's: the titles you rate higher and lower than the GoodWatch score.",
		url: "https://goodwatch.app/taste/everyone",
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		alt: "You vs everyone on GoodWatch",
	}
	// Personal: a guest's server HTML is an empty shell, the page fills from the browser.
	return buildMeta({ pageMeta, items: [], robots: "noindex, follow" })
}

async function canonicalLoader({ request }: LoaderFunctionArgs) {
	const { userId } = await tastePageViewer(request)
	return loadTasteTab(request, "everyone", userId)
}

export default function TasteEveryoneRoute() {
	const { view } = useLoaderData<typeof loader>() as TasteTabData<"everyone">
	return (
		<TasteTabFrame tab="everyone" memberView={view}>
			{(view) => <YouVsEveryone view={view} />}
		</TasteTabFrame>
	)
}

export const loader = presentCatalogLoader(canonicalLoader, { live: true })
