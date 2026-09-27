// PROTOTYPE - throwaway. Round 2 of #177: a Taste page where a person sees and understands their own taste,
// and would want to revisit and show others. Eight variants on one route (?variant=<key>), labeled
// "existing" (existing components, new presentation) or "bolder".
// Data: ?as=me (the default) reads the signed-in person's ratings, Wishlist, skipped and watched titles
// read-only; signed out, or with ?as=demo, it shows round 1's demo member. Nothing is written anywhere.
import {
	type LinksFunction,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { useLoaderData, useSearchParams } from "@remix-run/react"
import { getTasteReport } from "~/server/prototype-rec-taste-2.server"
import { DataBadge, SWITCHER_POSITION } from "~/ui/prototype-rec-taste-2/kit"
import css from "~/ui/prototype-rec-taste-2/taste2.css?url"
import { VARIANTS } from "~/ui/prototype-rec-taste-2/variants"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"

export const links: LinksFunction = () => [{ rel: "stylesheet", href: css }]

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	const { payload, headers } = await getTasteReport(request)
	headers.set("Cache-Control", "private, no-store")
	return json(payload, { headers })
}

export const meta = () => [
	{ title: "Your taste, round 2 prototype · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

// Switching variants only changes ?variant=, so keep the report instead of recomputing it.
export const shouldRevalidate = ({
	currentUrl,
	nextUrl,
}: { currentUrl: URL; nextUrl: URL }) =>
	currentUrl.searchParams.get("as") !== nextUrl.searchParams.get("as")

export default function RecTaste2Prototype() {
	const data = useLoaderData<typeof loader>()
	const [params] = useSearchParams()
	const key = params.get("variant") ?? Object.keys(VARIANTS)[0]
	const variant = VARIANTS[key] ?? Object.values(VARIANTS)[0]
	return (
		<>
			<variant.View key={key} data={data} />
			<DataBadge who={data.report.who} />
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
