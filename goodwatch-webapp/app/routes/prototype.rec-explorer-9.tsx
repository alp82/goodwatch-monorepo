// PROTOTYPE - throwaway. Round 9 of the Explorer (#180). Owner feedback on round 8: the combined island must form in
// between the islands it joins, become bigger while the rest get smaller, and focus should drive level of detail and
// saturation. Every variant keeps round 8's way of combining and shares round 9's focus layout (map9.ts): the bridge
// rises between its islands and becomes the main thing on screen, the islands it joins are drawn in against it,
// the rest shrink, move aside and go grey; lighting one island grows it a little. Variants (?variant=<key>): select,
// stretch, preview, gather, neighbors, triple. The sea draws with WebGL2, then WebGL1, then Canvas 2D; ?gl=0|1|2
// forces one in development. ?as=me (the default when signed in) uses the member's ratings, Wishlist, history, and
// services read-only; ?as=demo, or signed out, the demo member; ?as=<uuid> works on localhost in development.
// Nothing is written anywhere; data comes from round 8's API.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import {
	type ShouldRevalidateFunctionArgs,
	useLoaderData,
	useSearchParams,
} from "@remix-run/react"
import { getExplorer5 } from "~/server/prototype-rec-explorer-5.server"
import { useExplorer4 } from "~/ui/prototype-rec-explorer-4/useExplorer4"
import { GROUPINGS, type Loaded4 } from "~/ui/prototype-rec-explorer-4/wire4"
import { Styles6 } from "~/ui/prototype-rec-explorer-6/chrome6"
import { Styles8 } from "~/ui/prototype-rec-explorer-8/chrome8"
import { VARIANTS9 } from "~/ui/prototype-rec-explorer-9/variants9"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	return json(await getExplorer5(request))
}

export const meta = () => [
	{ title: "Explorer prototype, round 9 · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]
export const links = () => [
	{
		rel: "stylesheet",
		href: "https://fonts.googleapis.com/css2?family=Gabarito:wght@400..900&display=swap",
	},
]
export const shouldRevalidate = ({
	currentUrl,
	nextUrl,
}: ShouldRevalidateFunctionArgs) =>
	currentUrl.searchParams.get("as") !== nextUrl.searchParams.get("as") ||
	currentUrl.searchParams.get("country") !== nextUrl.searchParams.get("country")

const ALL_GROUPS = GROUPINGS.map((g) => g.id)

export default function RecExplorer9Prototype() {
	const data = useLoaderData<typeof loader>() as unknown as Loaded4
	const [params] = useSearchParams()
	const key = params.get("variant") ?? "select"
	const variant = VARIANTS9[key] ?? VARIANTS9.select
	const ex = useExplorer4(data, ALL_GROUPS)
	return (
		<>
			<Styles6 />
			<Styles8 />
			<variant.View key={key} ex={ex} />
			<PrototypeSwitcher
				variants={Object.fromEntries(
					Object.entries(VARIANTS9).map(([k, v]) => [k, v.name]),
				)}
				position="bottom-[5.75rem] left-2 right-2 justify-between lg:bottom-3 lg:left-1/2 lg:right-auto lg:-translate-x-1/2 lg:justify-start scale-90 origin-bottom"
			/>
		</>
	)
}
