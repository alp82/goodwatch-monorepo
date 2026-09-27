// PROTOTYPE - throwaway. Question (#180): what should an "Explorer" page look like, where people browse the
// catalog by steering through a taste space instead of filtering lists?
// Eight variants on one route (?variant=<key>), labeled "existing" (existing components, new layout) or
// "bolder". All share ~2,500 popular titles with their title analysis, scored in the browser against a taste
// vector. ?as=me (the default when signed in) uses the member's ratings, Wishlist, watch history, and services
// read-only; ?as=demo, or signed out, uses the Taste prototype's demo member. Nothing is written anywhere.
import { json, type LoaderFunctionArgs } from "@remix-run/node"
import { useLoaderData, useSearchParams } from "@remix-run/react"
import { useEffect } from "react"
import { getExplorer } from "~/server/prototype-rec-explorer.server"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { ExplorerStyles, Toast } from "~/ui/prototype-rec-explorer/kit"
import { useExplorer } from "~/ui/prototype-rec-explorer/useExplorer"
import { VARIANTS } from "~/ui/prototype-rec-explorer/variants"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return json(await getExplorer(request))
}

export const meta = () => [{ title: "Explorer prototype · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]
export const shouldRevalidate = () => false

export default function RecExplorerPrototype() {
	const data = useLoaderData<typeof loader>()
	const [params] = useSearchParams()
	const key = params.get("variant") ?? "atlas"
	const variant = VARIANTS[key] ?? VARIANTS.atlas
	const ex = useExplorer(data as never, { filterMode: variant.filterMode })
	// Each variant has its own default for filtered titles: dimmed or hidden.
	useEffect(() => ex.setFilterMode(variant.filterMode), [key])
	return (
		<>
			<ExplorerStyles />
			<variant.View key={key} ex={ex} />
			<Toast ex={ex} />
			<PrototypeSwitcher
				variants={Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, `${v.name} (${v.style})`]))}
				position="bottom-[5.75rem] left-2 right-2 justify-between lg:bottom-3 lg:left-1/2 lg:right-auto lg:-translate-x-1/2 lg:justify-start scale-90 origin-bottom"
			/>
		</>
	)
}
