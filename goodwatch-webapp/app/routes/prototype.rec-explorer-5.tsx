// PROTOTYPE - throwaway. Round 5 of the Explorer (#180). Owner feedback on round 4: islands is super nice; design the
// content more dynamically. Zoomed out: real icons, emojis, logos, flags, colors. Zooming in works like a fractal:
// normal posters, then half-size ones around them, then smaller ones, step by step. The fully zoomed-in view was too
// disconnected from the map: make it immersive and connected.
// Every variant is round 4's islands map with a grouping chosen up front. They differ in the identity zoomed out
// (crest, ground, pin, shore), the fractal's arrangement (orbit, corners, plus), and the cinematic close-up
// (flood, marquee, lens). Variants (?variant=<key>): crest, ground, lens, shore.
// ?as=me (the default when signed in) uses the member's ratings, Wishlist, history, and services read-only; ?as=demo,
// or signed out, uses the Taste prototype's demo member; ?as=<uuid> works on localhost in development. Nothing is
// written anywhere.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import {
	type ShouldRevalidateFunctionArgs,
	useLoaderData,
	useSearchParams,
} from "@remix-run/react"
import { getExplorer5 } from "~/server/prototype-rec-explorer-5.server"
import { Styles } from "~/ui/prototype-rec-explorer-2/kit2"
import { Styles4 } from "~/ui/prototype-rec-explorer-4/chrome"
import { useExplorer4 } from "~/ui/prototype-rec-explorer-4/useExplorer4"
import { GROUPINGS, type Loaded4 } from "~/ui/prototype-rec-explorer-4/wire4"
import { Styles5 } from "~/ui/prototype-rec-explorer-5/chrome5"
import { GENERATED_CSS_5 } from "~/ui/prototype-rec-explorer-5/generated-css"
import { ERA_FONTS } from "~/ui/prototype-rec-explorer-5/identity"
import { VARIANTS } from "~/ui/prototype-rec-explorer-5/variants"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	return json(await getExplorer5(request))
}

export const meta = () => [
	{ title: "Explorer prototype, round 5 · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]
export const links = () => [
	{
		rel: "stylesheet",
		href: "https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&display=swap",
	},
	{ rel: "stylesheet", href: ERA_FONTS },
]
// The page fetches its own maps; only another profile or country reloads the page data.
export const shouldRevalidate = ({
	currentUrl,
	nextUrl,
}: ShouldRevalidateFunctionArgs) =>
	currentUrl.searchParams.get("as") !== nextUrl.searchParams.get("as") ||
	currentUrl.searchParams.get("country") !== nextUrl.searchParams.get("country")

const ALL_GROUPS = GROUPINGS.map((g) => g.id)

export default function RecExplorer5Prototype() {
	const data = useLoaderData<typeof loader>() as unknown as Loaded4
	const [params] = useSearchParams()
	const key = params.get("variant") ?? "crest"
	const variant = VARIANTS[key] ?? VARIANTS.crest
	const ex = useExplorer4(data, ALL_GROUPS)
	return (
		<>
			<Styles />
			<Styles4 />
			<Styles5 />
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: generated static utilities, as round 4 ships them. */}
			<style dangerouslySetInnerHTML={{ __html: GENERATED_CSS_5 }} />
			<variant.View key={key} ex={ex} />
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
