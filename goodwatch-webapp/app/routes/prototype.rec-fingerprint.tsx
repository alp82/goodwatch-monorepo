// PROTOTYPE - throwaway. #181: a page whose star is the person's aggregated fingerprint (the 74 attribute
// scores from the title analysis of what they rated, weighted by how they rated it, against everyone).
// Eight variants on one route (?variant=<key>), labeled "existing" (existing components, new presentation)
// or "bolder". Data: ?as=me (the default) reads the signed-in person's ratings and lists read-only; signed
// out, or with ?as=demo, it shows the demo member. Nothing is written anywhere.
import {
	type LinksFunction,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { useLoaderData, useSearchParams } from "@remix-run/react"
import { getFingerprintPage } from "~/server/prototype-rec-fingerprint.server"
import css from "~/ui/prototype-rec-fingerprint/fingerprint.css?url"
import { VARIANTS } from "~/ui/prototype-rec-fingerprint/variants"
import { DataBadge, SWITCHER_POSITION } from "~/ui/prototype-rec-taste-2/kit"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"

export const links: LinksFunction = () => [{ rel: "stylesheet", href: css }]

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	const { payload, headers } = await getFingerprintPage(request)
	headers.set("Cache-Control", "private, no-store")
	return json(payload, { headers })
}

export const meta = () => [
	{ title: "Your fingerprint, prototype · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

// Switching variants only changes ?variant=, so keep the data instead of recomputing it.
export const shouldRevalidate = ({
	currentUrl,
	nextUrl,
}: { currentUrl: URL; nextUrl: URL }) =>
	currentUrl.searchParams.get("as") !== nextUrl.searchParams.get("as")

export default function RecFingerprintPrototype() {
	const data = useLoaderData<typeof loader>()
	const [params] = useSearchParams()
	const key = params.get("variant") ?? Object.keys(VARIANTS)[0]
	const variant = VARIANTS[key] ?? Object.values(VARIANTS)[0]
	return (
		<>
			<variant.View key={key} data={data} />
			<DataBadge who={data.who} />
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
