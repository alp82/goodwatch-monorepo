// /new/us/netflix: what arrived on a service in a country in the last 14 days (#489 Part C). Search engines may list
// it once it has titles. The rules: server/new-on-services-page.server.ts and domain/new-on-services.ts.
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { newDeps } from "~/server/new-on-services.server"
import {
	type NewPageData,
	loadServicePage,
} from "~/server/new-on-services-page.server"
import { NewOnServicesPage } from "~/ui/new-on-services/NewOnServicesPage"
import { newOnServicesMeta } from "~/ui/new-on-services/meta"

export const loader = presentCatalogLoader(
	async ({ request, params }: LoaderFunctionArgs) =>
		loadServicePage(
			request,
			params.country ?? "",
			params.service ?? "",
			newDeps,
		),
	{ live: true },
)

export const meta: MetaFunction<typeof loader> = ({ data }) =>
	newOnServicesMeta(data as NewPageData | undefined)

export default function NewOnService() {
	const data = useLoaderData<typeof loader>() as unknown as NewPageData
	return <NewOnServicesPage data={data} />
}
