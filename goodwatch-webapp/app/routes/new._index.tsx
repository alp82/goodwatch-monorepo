// /new: what arrived on the member's own services in the last 14 days (#489 Part C). Personal, so never listed and
// never stored; a visitor goes to the page of their country. The rules: server/new-on-services-page.server.ts.
import {
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { newDeps } from "~/server/new-on-services.server"
import {
	type NewPageData,
	loadMemberPage,
} from "~/server/new-on-services-page.server"
import { NewOnServicesPage } from "~/ui/new-on-services/NewOnServicesPage"
import { newOnServicesMeta } from "~/ui/new-on-services/meta"

export const loader = presentCatalogLoader(
	async ({ request }: LoaderFunctionArgs) => {
		const page = await loadMemberPage(request, newDeps)
		if (page instanceof Response) return page
		return json<NewPageData>(page, {
			headers: { "Cache-Control": "private, no-store" },
		})
	},
	{ live: true },
)

export const meta: MetaFunction<typeof loader> = ({ data }) =>
	newOnServicesMeta(data as NewPageData | undefined)

export default function NewOnYourServices() {
	const data = useLoaderData<typeof loader>() as unknown as NewPageData
	return <NewOnServicesPage data={data} />
}
