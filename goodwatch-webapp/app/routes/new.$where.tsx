// /new/us is a country's page for every service; /new/netflix is the link people share, which sends each viewer to
// the page of their own country (#489 Part C). The rules: server/new-on-services-page.server.ts.
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { newDeps } from "~/server/new-on-services.server"
import {
	type NewPageData,
	loadWherePage,
} from "~/server/new-on-services-page.server"
import { NewOnServicesPage } from "~/ui/new-on-services/NewOnServicesPage"
import { newOnServicesMeta } from "~/ui/new-on-services/meta"

export const loader = presentCatalogLoader(
	async ({ request, params }: LoaderFunctionArgs) =>
		loadWherePage(request, params.where ?? "", newDeps),
	{ live: true },
)

export const meta: MetaFunction<typeof loader> = ({ data }) =>
	newOnServicesMeta(data as NewPageData | undefined)

export default function NewInCountry() {
	const data = useLoaderData<typeof loader>() as unknown as NewPageData
	return <NewOnServicesPage data={data} />
}
