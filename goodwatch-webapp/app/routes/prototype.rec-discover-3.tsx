// PROTOTYPE - throwaway. #179 round 3: Discover and Search as one page, no tabs. Every variant uses the settled bar
// (studio row, mobile slab, round 2's `motion` For you control with `split`'s glow and the fingerprint explanation).
// Six variants (?variant=<key>) differ in how a query turns browsing into searching. ?q=<captured query> starts in
// search, ?sort=<key> and ?foryou=0 set the starting state. ?as=me (default) reads the signed-in person read-only,
// ?as=demo shows round 1's demo member, ?as=<uuid> works on localhost only. Data comes from round 1's loader;
// search lists are round 1's captured ones, so typing never runs a paid search.
import { type LinksFunction, type LoaderFunctionArgs, json } from "@remix-run/node"
import { useLoaderData, useSearchParams } from "@remix-run/react"
import { getDiscoverData } from "~/server/prototype-rec-discover.server"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import fb2css from "~/ui/prototype-rec-filter-bar-2/fb2.css?url"
import disccss from "~/ui/prototype-rec-discover/disc.css?url"
import disc2css from "~/ui/prototype-rec-discover-2/disc2.css?url"
import css from "~/ui/prototype-rec-discover-3/disc3.css?url"
import { VARIANTS } from "~/ui/prototype-rec-discover-3/variants3"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	const { payload, headers } = await getDiscoverData(request)
	headers.set("Cache-Control", "private, no-store")
	return json(payload, { headers })
}

export const links: LinksFunction = () => [
	{ rel: "stylesheet", href: fb2css },
	{ rel: "stylesheet", href: disccss },
	{ rel: "stylesheet", href: disc2css },
	{ rel: "stylesheet", href: css },
]
export const meta = () => [{ title: "Discover and Search prototype · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

// Variant and query live in the URL but don't need new data; only a different person does.
export const shouldRevalidate = ({ currentUrl, nextUrl }: { currentUrl: URL; nextUrl: URL }) => currentUrl.searchParams.get("as") !== nextUrl.searchParams.get("as")

export default function RecDiscover3Prototype() {
	const data = useLoaderData<typeof loader>()
	const [params, setParams] = useSearchParams()
	const key = params.get("variant") ?? Object.keys(VARIANTS)[0]
	const variant = VARIANTS[key] ?? Object.values(VARIANTS)[0]
	const as = params.get("as") ?? "me"
	const who = data.who
	return (
		<div className="min-h-screen bg-gray-950 pt-12 text-gray-200 lg:pt-0">
			<variant.View key={`${key}-${as}`} data={data} />
			<PrototypeSwitcher variants={Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, `${v.name} · ${v.style}`]))} position="top-[4.5rem] right-2 scale-75 origin-top-right" />
			<div className="fixed top-[7.2rem] right-2 z-50 origin-top-right scale-75">
				<select
					aria-label="Whose taste"
					value={who.mode === "demo" ? "demo" : as}
					onChange={(e) => {
						const p = new URLSearchParams(params)
						p.set("as", e.target.value)
						setParams(p, { replace: true, preventScrollReset: true })
					}}
					className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-black ring-2 ring-fuchsia-500"
				>
					{who.mode === "me" && as !== "me" && <option value={as}>Taste: dev account, {who.rated} ratings</option>}
					<option value="me">{who.mode === "me" && as === "me" ? `Taste: yours, ${who.rated} ratings` : "Taste: yours (sign in)"}</option>
					<option value="demo">{who.fellBack ? "Taste: demo (not signed in)" : "Taste: demo member"}</option>
				</select>
			</div>
		</div>
	)
}
