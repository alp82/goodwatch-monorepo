import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import {
	type TasteTabData,
	loadTasteTab,
	notFound,
	tastePageViewer,
} from "~/server/taste-portrait/page.server"
import { Fingerprint } from "~/ui/taste/tabs/Fingerprint"
import { TasteTabFrame } from "~/ui/taste/tabs/TasteTabFrame"
import { type PageMeta, buildMeta } from "~/utils/meta"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => {
	const pageMeta: PageMeta = {
		title: "Your fingerprint - GoodWatch",
		description:
			"Your taste in five families of attributes, read from the titles you rated and set against everyone's.",
		url: "https://goodwatch.app/taste/fingerprint",
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		alt: "Your fingerprint on GoodWatch",
	}
	return buildMeta({ pageMeta, items: [] })
}

export async function loader({ request }: LoaderFunctionArgs) {
	const { userId, enabled } = await tastePageViewer(request)
	if (!enabled) notFound()
	return loadTasteTab(request, "fingerprint", userId)
}

export default function TasteFingerprintRoute() {
	const { view } = useLoaderData<typeof loader>() as TasteTabData<"fingerprint">
	return (
		<TasteTabFrame tab="fingerprint" memberView={view}>
			{(view) => <Fingerprint view={view} />}
		</TasteTabFrame>
	)
}
