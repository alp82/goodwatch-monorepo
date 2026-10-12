// PROTOTYPE - throwaway. Round 10 of the Explorer: one world. Owner's idea: islands of different groupings should
// combine, so every grouping is on the same map: zoomed out, each grouping as a whole; zoomed in, today's islands;
// the grouping control at the top flies to a grouping's area; the middle is kept for the combination of up to three
// islands. The way of combining is settled (Harbor); the variants on this route (?variant=tabs|menu|legend) are of the
// top bar, see variants10.ts. The map is the
// real Explorer's engine, forked (ui/prototype-rec-explorer-10); the data is the real Explorer's, read-only, through
// its own endpoints and /prototype/rec-explorer-10/api. Needs REC_EXPLORER on. `?mix=mood:dark,decade:1980s` holds
// the picked islands.
import { useSearchParams } from "@remix-run/react"
import explorerCss from "~/ui/explorer/explorer.css?url"
import { Explorer10 } from "~/ui/prototype-rec-explorer-10/Explorer10"
import {
	BARS,
	type BarKey,
	HARBOR,
} from "~/ui/prototype-rec-explorer-10/variants10"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { assetUrl } from "~/utils/asset-url"

export async function loader() {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	return null
}

export const meta = () => [
	{ title: "Explorer prototype, round 10: one world · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]
export const links = () => [
	{ rel: "stylesheet", href: assetUrl(explorerCss) },
]
// The map follows the URL's filters and picked islands itself.
export const shouldRevalidate = () => false

export default function RecExplorer10Prototype() {
	const [params] = useSearchParams()
	const want = params.get("variant") ?? ""
	const bar: BarKey = want in BARS ? (want as BarKey) : "tabs"
	return (
		<>
			<Explorer10 variant={HARBOR} bar={bar} />
			<PrototypeSwitcher
				variants={BARS}
				position="bottom-[5.75rem] left-2 right-2 justify-between lg:bottom-3 lg:left-1/2 lg:right-auto lg:-translate-x-1/2 lg:justify-start scale-90 origin-bottom"
			/>
		</>
	)
}
