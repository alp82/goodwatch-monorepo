import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import {
	type TasteTabData,
	loadTasteTab,
	notFound,
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
	return buildMeta({ pageMeta, items: [] })
}

export async function loader({ request }: LoaderFunctionArgs) {
	const { userId, enabled } = await tastePageViewer(request)
	if (!enabled) notFound()
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
