// PROTOTYPE - throwaway. Round 3 of the Explorer (#180). Owner feedback on round 2: too much going on (too many posters
// at once, paths too long and repetitive); everything on screen must be meaningful and every turn distinct and
// impactful. So every variant here shows a handful of titles, each with a reason; offers turns picked to be far apart
// from each other in the title analysis, each saying what it changes; never shows a title twice in a session; and
// keeps the path short and visible.
// Variants (?variant=<key>): roads, compass, zoom, doors, lens, leap. The server reuses round 2's in-memory pool and
// nested map (see prototype.rec-explorer-3_.api.ts). ?as=me (the default when signed in) uses the member's ratings,
// Wishlist, history, and services read-only; ?as=demo, or signed out, uses the Taste prototype's demo member;
// ?as=<uuid> works on localhost in development. Nothing is written anywhere.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import {
	type ShouldRevalidateFunctionArgs,
	useLoaderData,
	useSearchParams,
} from "@remix-run/react"
import { getExplorer3 } from "~/server/prototype-rec-explorer-3.server"
import { Styles3, Toast3 } from "~/ui/prototype-rec-explorer-3/kit3"
import { useExplorer3 } from "~/ui/prototype-rec-explorer-3/useExplorer3"
import { VARIANTS } from "~/ui/prototype-rec-explorer-3/variants"
import type { Loaded3 } from "~/ui/prototype-rec-explorer-3/wire"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	return json(await getExplorer3(request))
}

export const meta = () => [
	{ title: "Explorer prototype, round 3 · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]
export const links = () => [
	{
		rel: "stylesheet",
		href: "https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;900&display=swap",
	},
]
// Variants fetch their own turns; only another profile or country reloads the page data.
export const shouldRevalidate = ({
	currentUrl,
	nextUrl,
}: ShouldRevalidateFunctionArgs) =>
	currentUrl.searchParams.get("as") !== nextUrl.searchParams.get("as") ||
	currentUrl.searchParams.get("country") !== nextUrl.searchParams.get("country")

export default function RecExplorer3Prototype() {
	const data = useLoaderData<typeof loader>() as unknown as Loaded3
	const [params] = useSearchParams()
	const key = params.get("variant") ?? "roads"
	const variant = VARIANTS[key] ?? VARIANTS.roads
	const ex = useExplorer3(data)
	return (
		<>
			<Styles3 />
			<variant.View key={key} ex={ex} />
			<Toast3 ex={ex} />
			<PrototypeSwitcher
				variants={Object.fromEntries(
					Object.entries(VARIANTS).map(([k, v]) => [
						k,
						`${v.name} (${v.style})`,
					]),
				)}
				position="bottom-[5.75rem] left-2 right-2 justify-between lg:bottom-3 lg:left-1/2 lg:right-auto lg:-translate-x-1/2 lg:justify-start scale-90 origin-bottom"
			/>
		</>
	)
}
