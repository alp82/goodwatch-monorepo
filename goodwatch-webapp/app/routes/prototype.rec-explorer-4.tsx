// PROTOTYPE - throwaway. Round 4 of the Explorer (#180). Owner feedback on round 3: the paths felt too abstract; go
// back to round 1's zoomable map with better mechanics and a grouping chosen up front; zoomed out shows rough colors,
// zooming in reaches a cinematic view like round 3's leap, with clear controls; show only the last two steps of the
// path plus a history dropdown like a browser's back button.
// Every variant here is one map: pick a grouping (genre, mood, streaming, decade, country, taste distance), see color
// fields sized by how many titles and tinted by fit, zoom in to see a region's best picks as posters, zoom into a
// poster to open it. Variants (?variant=<key>): fields, islands, board, rings.
// ?as=me (the default when signed in) uses the member's ratings, Wishlist, history, and services read-only; ?as=demo,
// or signed out, uses the Taste prototype's demo member; ?as=<uuid> works on localhost in development. Nothing is
// written anywhere.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { type ShouldRevalidateFunctionArgs, useLoaderData, useSearchParams } from "@remix-run/react"
import { getExplorer4 } from "~/server/prototype-rec-explorer-4.server"
import { Styles } from "~/ui/prototype-rec-explorer-2/kit2"
import { Styles4 } from "~/ui/prototype-rec-explorer-4/chrome"
import { useExplorer4 } from "~/ui/prototype-rec-explorer-4/useExplorer4"
import { VARIANTS } from "~/ui/prototype-rec-explorer-4/variants"
import { GROUPINGS, type Loaded4 } from "~/ui/prototype-rec-explorer-4/wire4"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return json(await getExplorer4(request))
}

export const meta = () => [
	{ title: "Explorer prototype, round 4 · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]
export const links = () => [
	{
		rel: "stylesheet",
		href: "https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;900&display=swap",
	},
]
// The page fetches its own maps; only another profile or country reloads the page data.
export const shouldRevalidate = ({ currentUrl, nextUrl }: ShouldRevalidateFunctionArgs) =>
	currentUrl.searchParams.get("as") !== nextUrl.searchParams.get("as") ||
	currentUrl.searchParams.get("country") !== nextUrl.searchParams.get("country")

const ALL_GROUPS = GROUPINGS.map((g) => g.id)

export default function RecExplorer4Prototype() {
	const data = useLoaderData<typeof loader>() as unknown as Loaded4
	const [params] = useSearchParams()
	const key = params.get("variant") ?? "fields"
	const variant = VARIANTS[key] ?? VARIANTS.fields
	const ex = useExplorer4(data, ALL_GROUPS)
	return (
		<>
			<Styles />
			<Styles4 />
			<variant.View key={key} ex={ex} />
			<PrototypeSwitcher
				variants={Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, `${v.name} (${v.style})`]))}
				position="bottom-[5.75rem] left-2 right-2 justify-between lg:bottom-3 lg:left-1/2 lg:right-auto lg:-translate-x-1/2 lg:justify-start scale-90 origin-bottom"
			/>
		</>
	)
}
