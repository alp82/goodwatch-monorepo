// /new: what arrived on the member's own services in the last 14 days (#489 Part C). Personal, so never listed and
// never stored; a visitor goes to the page of their country. The rules: server/new-on-services-page.server.ts.
import {
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { PRIVATE_CACHE_CONTROL } from "~/utils/auth-cookie"
import { newDeps } from "~/server/new-on-services.server"
import {
	type NewPageData,
	type NewPreviewData,
	loadMemberPage,
} from "~/server/new-on-services-page.server"
import { NewOnServicesPage } from "~/ui/new-on-services/NewOnServicesPage"
import { NewPreviewPage } from "~/ui/new-on-services/NewPreviewPage"
import { newOnServicesMeta } from "~/ui/new-on-services/meta"

// The loader's Cache-Control (incomplete or private) reaches the document through the site's page headers.
export { pageHeaders as headers } from "~/utils/headers"

export const loader = presentCatalogLoader(
	async ({ request }: LoaderFunctionArgs) => {
		const page = await loadMemberPage(request, newDeps)
		if (page instanceof Response) return page
		return json<NewPageData | NewPreviewData>(page, {
			headers: { "Cache-Control": PRIVATE_CACHE_CONTROL },
		})
	},
	{ live: true },
)

export const meta: MetaFunction<typeof loader> = ({ data }) =>
	newOnServicesMeta(data as NewPageData | NewPreviewData | undefined)

export default function NewOnYourServices() {
	const data = useLoaderData<typeof loader>() as unknown as
		| NewPageData
		| NewPreviewData
	if (data.kind === "preview") return <NewPreviewPage data={data} />
	return <NewOnServicesPage data={data} />
}
