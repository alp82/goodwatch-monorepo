// PROTOTYPE - throwaway. Round 6 of #177: the Taste page with three tabs (?view=sides|crowd|fingerprint).
// Sides of you goes back toward round 2's richness (contradiction hero, backdrops, poster-forward sides)
// while keeping round 5's merge: every side carries the edge just past it and more of this on the person's
// services. Four variants via the switcher (?variant=<key>), each labeled "existing" or "bolder".
// You vs everyone is round 4's, unchanged. Fingerprint is #181's families view, refined.
// Data: round 4's cached report plus the fingerprint page's cached payload (trimmed to what the tab shows);
// ?as=me (the default) reads the signed-in person's data read-only; signed out, or ?as=demo, the demo member.
import { type LinksFunction, type LoaderFunctionArgs, json } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { getFingerprintPage } from "~/server/prototype-rec-fingerprint.server"
import { getTasteReport4 } from "~/server/prototype-rec-taste-4.server"
import { SWITCHER_POSITION } from "~/ui/prototype-rec-taste-2/kit"
import { DataToggle } from "~/ui/prototype-rec-taste-4/page"
import { trimFingerprint } from "~/ui/prototype-rec-taste-6/model"
import { TastePage6 } from "~/ui/prototype-rec-taste-6/page"
import css6 from "~/ui/prototype-rec-taste-6/taste6.css?url"
import { VARIANTS } from "~/ui/prototype-rec-taste-6/variants"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"

export const links: LinksFunction = () => [{ rel: "stylesheet", href: css6 }]

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	// One after the other: both build on round 2's cached report, so the second reuses the first's.
	const { payload, headers } = await getTasteReport4(request)
	const { payload: fp } = await getFingerprintPage(request)
	headers.set("Cache-Control", "private, no-store")
	return json({ ...payload, fp: trimFingerprint(fp) }, { headers })
}

export const meta = () => [
	{ title: "Your taste, round 6 prototype · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

// Tabs and variants only change the rendering; keep the data.
export const shouldRevalidate = ({ currentUrl, nextUrl }: { currentUrl: URL; nextUrl: URL }) =>
	currentUrl.searchParams.get("as") !== nextUrl.searchParams.get("as")

export default function RecTaste6Prototype() {
	const data = useLoaderData<typeof loader>()
	return (
		<>
			<TastePage6 data={data} />
			<DataToggle who={data.report.who} />
			<PrototypeSwitcher
				variants={Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, `${v.name} (${v.style})`]))}
				position={SWITCHER_POSITION}
			/>
		</>
	)
}
