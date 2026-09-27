// PROTOTYPE - throwaway. Round 5 of #177: a Taste page with two tabs. Sides of you merges round 4's Sides and
// Your edges into one view: a sidebar of what defines the person (sides, edges, their best mood, the people
// they keep coming back to) that drives the right side (what they rated highly there, and More of this on
// their services). Five variants via the switcher (?variant=<key>), each labeled "existing" or "bolder".
// You vs everyone is round 4's, unchanged. ?view=sides|crowd picks the tab. Data: round 4's cached report;
// ?as=me (the default) reads the signed-in person's data read-only; signed out, or ?as=demo, the demo member.
import { type LinksFunction, type LoaderFunctionArgs, json } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { getTasteReport4 } from "~/server/prototype-rec-taste-4.server"
import { SWITCHER_POSITION } from "~/ui/prototype-rec-taste-2/kit"
import { DataToggle } from "~/ui/prototype-rec-taste-4/page"
import { TastePage5 } from "~/ui/prototype-rec-taste-5/page"
import css5 from "~/ui/prototype-rec-taste-5/taste5.css?url"
import { VARIANTS } from "~/ui/prototype-rec-taste-5/variants"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"

export const links: LinksFunction = () => [{ rel: "stylesheet", href: css5 }]

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	const { payload, headers } = await getTasteReport4(request)
	headers.set("Cache-Control", "private, no-store")
	return json(payload, { headers })
}

export const meta = () => [
	{ title: "Your taste, round 5 prototype · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

// Tabs and variants only change the rendering; keep the report.
export const shouldRevalidate = ({ currentUrl, nextUrl }: { currentUrl: URL; nextUrl: URL }) =>
	currentUrl.searchParams.get("as") !== nextUrl.searchParams.get("as")

export default function RecTaste5Prototype() {
	const data = useLoaderData<typeof loader>()
	return (
		<>
			<TastePage5 data={data} />
			<DataToggle who={data.report.who} />
			<PrototypeSwitcher
				variants={Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, `${v.name} (${v.style})`]))}
				position={SWITCHER_POSITION}
			/>
		</>
	)
}
