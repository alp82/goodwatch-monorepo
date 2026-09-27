// PROTOTYPE - throwaway. Question (#175): what should one simpler filter bar look like, shared by
// Discover, Search, the start page and Wishlist, with "On my services", "Not seen yet" and "Sort: For you"
// first-class and everything else behind one disclosure?
// Eight layouts over the same real catalog, switchable via ?variant=<key>. ?as=member|no-services|guest
// simulates who is looking. Filtering is faked in memory; "seen", taste match, and people are made up.
import { json, type LinksFunction, type LoaderFunctionArgs } from "@remix-run/node"
import { useLoaderData, useSearchParams } from "@remix-run/react"
import { getCatalog } from "~/server/prototype-rec-filter-bar.server"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { type Bar, type Viewer, useFilterBar } from "~/ui/prototype-rec-filter-bar/model"
import { VariantDock, VariantGhosts, VariantMarquee } from "~/ui/prototype-rec-filter-bar/variants-bolder"
import { VariantRail, VariantRow, VariantSentence, VariantSide, VariantSticky } from "~/ui/prototype-rec-filter-bar/variants-existing"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return json(await getCatalog(request))
}

export const links: LinksFunction = () => [{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Gabarito:wght@400;700;900&display=swap" }]
export const meta = () => [{ title: "Filter bar prototype · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]
export const shouldRevalidate = () => false

const VARIANTS: Record<string, { name: string; View: (p: { bar: Bar }) => JSX.Element }> = {
	row: { name: "One row + sheet · existing", View: VariantRow },
	sentence: { name: "Sentence bar · existing", View: VariantSentence },
	rail: { name: "Chip rail · existing", View: VariantRail },
	sticky: { name: "Sticky summary · existing", View: VariantSticky },
	side: { name: "Side rail · existing", View: VariantSide },
	marquee: { name: "Marquee sentence · bolder", View: VariantMarquee },
	dock: { name: "Thumb dock · bolder", View: VariantDock },
	ghosts: { name: "Ghosts of hidden titles · bolder", View: VariantGhosts },
}

const VIEWERS: { key: Viewer; label: string }[] = [
	{ key: "member", label: "Member with services" },
	{ key: "no-services", label: "Member, no services" },
	{ key: "guest", label: "Guest" },
]

function Prototype({ viewer, variant }: { viewer: Viewer; variant: string }) {
	const { titles, mine } = useLoaderData<typeof loader>()
	const bar = useFilterBar(titles, mine, viewer)
	const { View } = VARIANTS[variant] ?? VARIANTS.row
	return <View bar={bar} />
}

export default function RecFilterBarPrototype() {
	const [params, setParams] = useSearchParams()
	const variant = params.get("variant") ?? "row"
	const viewer = (VIEWERS.some((v) => v.key === params.get("as")) ? params.get("as") : "member") as Viewer
	return (
		<div className="min-h-screen bg-gray-950 text-gray-200">
			{/* Remount on viewer change so the defaults for that viewer apply. */}
			<Prototype key={`${viewer}-${variant}`} viewer={viewer} variant={variant} />
			<PrototypeSwitcher variants={Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, v.name]))} position="top-[4.5rem] right-2 scale-75 origin-top-right" />
			<div className="fixed top-[7.2rem] right-2 z-50 origin-top-right scale-75">
				<select
					aria-label="Simulate viewer"
					value={viewer}
					onChange={(e) => {
						const p = new URLSearchParams(params)
						p.set("as", e.target.value)
						setParams(p, { replace: true, preventScrollReset: true })
					}}
					className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-black ring-2 ring-fuchsia-500"
				>
					{VIEWERS.map((v) => (
						<option key={v.key} value={v.key}>
							As: {v.label}
						</option>
					))}
				</select>
			</div>
		</div>
	)
}
