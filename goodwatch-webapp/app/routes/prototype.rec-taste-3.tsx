// PROTOTYPE - throwaway. Round 3 of #177: the Taste page as a set of simple sections under a subnav.
// Two independent knobs: ?shell=<key> picks how the subnav works (sticky tabs, a side rail, or one chaptered
// scroll), ?variant=<key> picks the take on Sides (merged with Frontiers) or on You vs everyone.
// ?section=<id> opens a section in the tabbed shells. Data: ?as=me (default, read-only), ?as=demo.
import {
	type LinksFunction,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { getTasteReport3 } from "~/server/prototype-rec-taste-3.server"
import { SWITCHER_POSITION } from "~/ui/prototype-rec-taste-2/kit"
import css2 from "~/ui/prototype-rec-taste-2/taste2.css?url"
import { ProtoBar } from "~/ui/prototype-rec-taste-3/chrome"
import { TastePage } from "~/ui/prototype-rec-taste-3/page"
import css3 from "~/ui/prototype-rec-taste-3/taste3.css?url"
import { VARIANTS } from "~/ui/prototype-rec-taste-3/variants"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"

export const links: LinksFunction = () => [
	{ rel: "stylesheet", href: css2 },
	{ rel: "stylesheet", href: css3 },
	{
		rel: "stylesheet",
		href: "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&display=swap",
	},
]

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	const { payload, headers } = await getTasteReport3(request)
	headers.set("Cache-Control", "private, no-store")
	return json(payload, { headers })
}

export const meta = () => [
	{ title: "Your taste, round 3 prototype · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

// Shell, variant and section only change the rendering; keep the report.
export const shouldRevalidate = ({
	currentUrl,
	nextUrl,
}: { currentUrl: URL; nextUrl: URL }) =>
	currentUrl.searchParams.get("as") !== nextUrl.searchParams.get("as")

export default function RecTaste3Prototype() {
	const data = useLoaderData<typeof loader>()
	return (
		<>
			<TastePage data={data} />
			<ProtoBar who={data.report.who} />
			<PrototypeSwitcher
				variants={Object.fromEntries(
					Object.entries(VARIANTS).map(([k, v]) => [
						k,
						`${v.name} (${v.style})`,
					]),
				)}
				position={SWITCHER_POSITION}
			/>
		</>
	)
}
