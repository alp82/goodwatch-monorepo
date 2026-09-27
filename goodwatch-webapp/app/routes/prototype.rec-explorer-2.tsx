// PROTOTYPE - throwaway. Round 2 of the Explorer (#180): browse by steering through taste, never the whole catalog.
// Owner feedback on round 1: atlas is interesting, keep the zoom-level detail changes, but cluster differently, don't
// show every title at once, open new paths and load titles on the fly, and hold 60 fps.
// Variants (?variant=<key>) differ in how titles cluster and how the map reveals itself. The server keeps ~12,000
// titles in memory and streams only what the screen needs (see prototype.rec-explorer-2_.api.ts).
// ?as=me (the default when signed in) uses the member's ratings, Wishlist, history, and services read-only; ?as=demo,
// or signed out, uses the Taste prototype's demo member. Nothing is written anywhere.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import {
	type ShouldRevalidateFunctionArgs,
	useLoaderData,
	useSearchParams,
} from "@remix-run/react"
import { getExplorer2 } from "~/server/prototype-rec-explorer-2.server"
import { Styles, Toast } from "~/ui/prototype-rec-explorer-2/kit2"
import { useExplorer2 } from "~/ui/prototype-rec-explorer-2/useExplorer2"
import { VARIANTS } from "~/ui/prototype-rec-explorer-2/variants"
import type { Loaded } from "~/ui/prototype-rec-explorer-2/wire"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	return json(await getExplorer2(request))
}

export const meta = () => [
	{ title: "Explorer prototype, round 2 · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]
export const links = () => [
	{
		rel: "stylesheet",
		href: "https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;900&display=swap",
	},
]
// Each layout brings its own map data, so only a new variant or profile reloads.
export const shouldRevalidate = ({
	currentUrl,
	nextUrl,
}: ShouldRevalidateFunctionArgs) =>
	currentUrl.searchParams.get("variant") !==
		nextUrl.searchParams.get("variant") ||
	currentUrl.searchParams.get("as") !== nextUrl.searchParams.get("as")

export default function RecExplorer2Prototype() {
	const data = useLoaderData<typeof loader>() as unknown as Loaded
	const [params] = useSearchParams()
	const key = params.get("variant") ?? "zoom"
	const variant = VARIANTS[key] ?? VARIANTS.zoom
	const ex = useExplorer2(data)
	// Wait for this variant's map data before mounting it.
	const ready = data.variant === key || !(key in VARIANTS)
	return (
		<>
			<Styles />
			{ready ? (
				<variant.View key={key} ex={ex} />
			) : (
				<div className="rx2-stage bg-stone-950" />
			)}
			<Toast ex={ex} />
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
