// PROTOTYPE - throwaway. Round 6 of the Explorer (#180). Owner feedback on round 5: make it look far more polished and
// modern (keep the islands, but go for real wow instead of icons), make zooming smooth and never stuck midway, reach a
// title in a couple of wheel notches, and open titles as overlays over the live map instead of switching the view.
// Every variant is the same living map: islands drawn in WebGL (glowing shorelines, fog, a surface made from their
// titles, tinted by their posters), round 4's grouping and round 5's fractal of posters, a camera that glides and
// springs to readable levels. They differ in how a title comes forward. Variants (?variant=<key>): near, focus,
// drawer, peek, pin. ?as=me (the default when signed in) uses the member's ratings, Wishlist, history, and services
// read-only; ?as=demo, or signed out, uses the Taste prototype's demo member; ?as=<uuid> works on localhost in
// development. Nothing is written anywhere.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { type ShouldRevalidateFunctionArgs, useLoaderData, useSearchParams } from "@remix-run/react"
import { getExplorer5 } from "~/server/prototype-rec-explorer-5.server"
import { useExplorer4 } from "~/ui/prototype-rec-explorer-4/useExplorer4"
import { GROUPINGS, type Loaded4 } from "~/ui/prototype-rec-explorer-4/wire4"
import { Styles6 } from "~/ui/prototype-rec-explorer-6/chrome6"
import { VARIANTS6 } from "~/ui/prototype-rec-explorer-6/variants6"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return json(await getExplorer5(request))
}

export const meta = () => [{ title: "Explorer prototype, round 6 · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]
export const links = () => [
	{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Gabarito:wght@400..900&display=swap" },
]
// The page fetches its own maps; only another profile or country reloads the page data.
export const shouldRevalidate = ({ currentUrl, nextUrl }: ShouldRevalidateFunctionArgs) =>
	currentUrl.searchParams.get("as") !== nextUrl.searchParams.get("as") || currentUrl.searchParams.get("country") !== nextUrl.searchParams.get("country")

const ALL_GROUPS = GROUPINGS.map((g) => g.id)

export default function RecExplorer6Prototype() {
	const data = useLoaderData<typeof loader>() as unknown as Loaded4
	const [params] = useSearchParams()
	const key = params.get("variant") ?? "near"
	const variant = VARIANTS6[key] ?? VARIANTS6.near
	const ex = useExplorer4(data, ALL_GROUPS)
	return (
		<>
			<Styles6 />
			<variant.View key={key} ex={ex} />
			<PrototypeSwitcher
				variants={Object.fromEntries(Object.entries(VARIANTS6).map(([k, v]) => [k, `${v.name} (${v.style})`]))}
				position="bottom-[5.75rem] left-2 right-2 justify-between lg:bottom-3 lg:left-1/2 lg:right-auto lg:-translate-x-1/2 lg:justify-start scale-90 origin-bottom"
			/>
		</>
	)
}
