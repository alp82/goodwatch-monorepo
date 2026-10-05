// PROTOTYPE - throwaway. Round 4 of #177: a Taste page with a minimal subnav of three views. Sides of you and
// You vs everyone are round 2's, kept close to how they were; the third tab holds one of five candidates,
// picked with the variant switcher (?variant=<key>), each labeled "existing" or "bolder".
// ?view=sides|crowd|third picks the tab. Data: ?as=me (the default) reads the signed-in person's ratings and
// lists read-only; signed out, or with ?as=demo, it shows round 1's demo member. Nothing is written anywhere.
import {
	type LinksFunction,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { getTasteReport4 } from "~/server/prototype-rec-taste-4.server"
import { SWITCHER_POSITION } from "~/ui/prototype-rec-taste-2/kit"
import { CANDIDATES } from "~/ui/prototype-rec-taste-4/candidates"
import { DataToggle, TastePage } from "~/ui/prototype-rec-taste-4/page"
import css4 from "~/ui/prototype-rec-taste-4/taste4.css?url"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"

export const links: LinksFunction = () => [{ rel: "stylesheet", href: css4 }]

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	const { payload, headers } = await getTasteReport4(request)
	headers.set("Cache-Control", "private, no-store")
	return json(payload, { headers })
}

export const meta = () => [
	{ title: "Your taste, round 4 prototype · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

// Tabs and candidates only change the rendering; keep the report.
export const shouldRevalidate = ({
	currentUrl,
	nextUrl,
}: { currentUrl: URL; nextUrl: URL }) =>
	currentUrl.searchParams.get("as") !== nextUrl.searchParams.get("as")

export default function RecTaste4Prototype() {
	const data = useLoaderData<typeof loader>()
	return (
		<>
			<TastePage data={data} />
			<DataToggle who={data.report.who} />
			<PrototypeSwitcher
				variants={Object.fromEntries(
					Object.entries(CANDIDATES).map(([k, v]) => [
						k,
						`${v.name} (${v.style})`,
					]),
				)}
				position={SWITCHER_POSITION}
			/>
		</>
	)
}
