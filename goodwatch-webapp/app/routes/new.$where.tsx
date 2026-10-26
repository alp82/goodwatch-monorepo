// /new/us is a country's page for every service; /new/netflix is the link people share, which sends each viewer to
// the page of their own country (#489 Part C). The rules: server/new-on-services-page.server.ts.
import {
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { INCOMPLETE_PAGE_HEADERS } from "~/server/incomplete-page"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { newDeps } from "~/server/new-on-services.server"
import {
	type NewPageData,
	type NewPreviewData,
	loadWherePage,
} from "~/server/new-on-services-page.server"
import { PRIVATE_CACHE_CONTROL } from "~/utils/auth-cookie"
import { NewOnServicesPage } from "~/ui/new-on-services/NewOnServicesPage"
import { NewPreviewPage } from "~/ui/new-on-services/NewPreviewPage"
import { newOnServicesMeta } from "~/ui/new-on-services/meta"

// The loader's Cache-Control (incomplete or private) reaches the document through the site's page headers.
export { pageHeaders as headers } from "~/utils/headers"

export const loader = presentCatalogLoader(
	async ({ request, params }: LoaderFunctionArgs) => {
		const page = await loadWherePage(request, params.where ?? "", newDeps)
		if (page instanceof Response) return page
		// A link preview's page depends on who asks: never stored.
		if (page.kind === "preview")
			return json<NewPreviewData>(page, {
				headers: { "Cache-Control": PRIVATE_CACHE_CONTROL },
			})
		// Without its links the page is incomplete: no cache keeps it.
		return json<NewPageData>(
			page,
			page.incomplete ? { headers: INCOMPLETE_PAGE_HEADERS } : undefined,
		)
	},
	{ live: true },
)

export const meta: MetaFunction<typeof loader> = ({ data }) =>
	newOnServicesMeta(data as NewPageData | NewPreviewData | undefined)

export default function NewInCountry() {
	const data = useLoaderData<typeof loader>() as unknown as
		| NewPageData
		| NewPreviewData
	if (data.kind === "preview") return <NewPreviewPage data={data} />
	return <NewOnServicesPage data={data} />
}
