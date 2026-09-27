// PROTOTYPE - throwaway. Round 7 of the Explorer (#180). Owner feedback on round 6: `near` is the direction; vary it
// slightly (how posters are presented, a level of detail that depends on zoom and on distance from where you look),
// and maybe a way to combine islands. Every variant is round 6's `near`: proximity cards over a live map of
// backdrop-collage islands. Four vary the posters and their lens (lit, rise, tiles, frames); two add combining
// (bridge: tap two islands; merge: drag one onto another), where a bridge island rises between the two holding the
// titles they share. Variants (?variant=<key>): lit, rise, tiles, frames, bridge, merge. The sea draws with WebGL2,
// then WebGL1, then Canvas 2D; ?gl=0|1|2 forces one in development. ?as=me (the default when signed in) uses the
// member's ratings, Wishlist, history, and services read-only; ?as=demo, or signed out, the demo member; ?as=<uuid>
// works on localhost in development. Nothing is written anywhere.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { type ShouldRevalidateFunctionArgs, useLoaderData, useSearchParams } from "@remix-run/react"
import { getExplorer5 } from "~/server/prototype-rec-explorer-5.server"
import { useExplorer4 } from "~/ui/prototype-rec-explorer-4/useExplorer4"
import { GROUPINGS, type Loaded4 } from "~/ui/prototype-rec-explorer-4/wire4"
import { Styles6 } from "~/ui/prototype-rec-explorer-6/chrome6"
import { Styles7 } from "~/ui/prototype-rec-explorer-7/chrome7"
import { VARIANTS7 } from "~/ui/prototype-rec-explorer-7/variants7"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return json(await getExplorer5(request))
}

export const meta = () => [{ title: "Explorer prototype, round 7 · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]
export const links = () => [
	{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Gabarito:wght@400..900&display=swap" },
]
export const shouldRevalidate = ({ currentUrl, nextUrl }: ShouldRevalidateFunctionArgs) =>
	currentUrl.searchParams.get("as") !== nextUrl.searchParams.get("as") || currentUrl.searchParams.get("country") !== nextUrl.searchParams.get("country")

const ALL_GROUPS = GROUPINGS.map((g) => g.id)

export default function RecExplorer7Prototype() {
	const data = useLoaderData<typeof loader>() as unknown as Loaded4
	const [params] = useSearchParams()
	const key = params.get("variant") ?? "lit"
	const variant = VARIANTS7[key] ?? VARIANTS7.lit
	const ex = useExplorer4(data, ALL_GROUPS)
	return (
		<>
			<Styles6 />
			<Styles7 />
			<variant.View key={key} ex={ex} />
			<PrototypeSwitcher
				variants={Object.fromEntries(Object.entries(VARIANTS7).map(([k, v]) => [k, `${v.name} (${v.style})`]))}
				position="bottom-[5.75rem] left-2 right-2 justify-between lg:bottom-3 lg:left-1/2 lg:right-auto lg:-translate-x-1/2 lg:justify-start scale-90 origin-bottom"
			/>
		</>
	)
}
