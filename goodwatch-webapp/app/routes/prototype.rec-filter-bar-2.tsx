// PROTOTYPE - throwaway. Round 2 of the filter bar (#175). The owner picked round 1's "one row + sheet"
// for desktop and asked for much better mobile thumb docks. Three desktop refinements of the row and five
// mobile docks over the same real catalog, switchable via ?variant=<key>. ?as=member|no-services|guest
// simulates who is looking. Filtering is faked in memory with round 1's model; "seen" and match are made up.
import { json, type LinksFunction, type LoaderFunctionArgs } from "@remix-run/node"
import { useLoaderData, useSearchParams } from "@remix-run/react"
import { getCatalog } from "~/server/prototype-rec-filter-bar.server"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { type Bar, type Viewer, useFilterBar } from "~/ui/prototype-rec-filter-bar/model"
// Utilities the running dev server hasn't picked up from these new files yet, compiled locally.
import css from "~/ui/prototype-rec-filter-bar-2/fb2.css?url"
import { PhoneStage } from "~/ui/prototype-rec-filter-bar-2/kit2"
import { DockCapsule, DockGrow, DockSlab, DockSplit, DockStage } from "~/ui/prototype-rec-filter-bar-2/variants-dock"
import { VariantRowGlass, VariantRowLedger, VariantRowStudio } from "~/ui/prototype-rec-filter-bar-2/variants-row"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return json(await getCatalog(request))
}

export const links: LinksFunction = () => [{ rel: "stylesheet", href: css }]
export const meta = () => [{ title: "Filter bar prototype, round 2 · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]
export const shouldRevalidate = () => false

type V = { name: string; View: (p: { bar: Bar }) => JSX.Element; phone?: { title: string; pitch: string; notes: string[] } }

const VARIANTS: Record<string, V> = {
	studio: { name: "Desktop: studio row · existing", View: VariantRowStudio },
	ledger: { name: "Desktop: ledger row · existing", View: VariantRowLedger },
	glass: { name: "Desktop: glass bar · bolder", View: VariantRowGlass },
	slab: {
		name: "Mobile: merged slab · existing",
		View: DockSlab,
		phone: {
			title: "Merged slab",
			pitch: "The filter strip and the bottom nav become one piece of glass. Taste moves into the nav row so nothing floats over the strip.",
			notes: ["Scroll down folds the nav and the hidden line away; the strip stays", "Sort opens a fixed-size menu right above your thumb", "The sheet snaps to half and full, and starts with what's hidden"],
		},
	},
	grow: {
		name: "Mobile: bar grows into sheet · existing",
		View: DockGrow,
		phone: {
			title: "Grows into the sheet",
			pitch: "The dock is the top of the sheet. At rest it's a summary bar on the nav; drag it up for the controls, again for every filter.",
			notes: ["Three snap points: summary, half, full", "Toggles work straight from the summary", "Scroll down hides the nav and the bar settles to the bottom edge"],
		},
	},
	split: {
		name: "Mobile: split dock + count bubble · existing",
		View: DockSplit,
		phone: {
			title: "Split dock",
			pitch: "Everything sits under the right thumb: a pill with the two toggles and filters, a round sort button that fans upward, and a count bubble.",
			notes: ["Tap the bubble to see what's hidden and let it back in", "Sort options fan up from the button with a stagger", "Scroll down hides the nav; the cluster drops to the bottom"],
		},
	},
	capsule: {
		name: "Mobile: morphing capsule · bolder",
		View: DockCapsule,
		phone: {
			title: "Morphing capsule",
			pitch: "One capsule says it all: count, sort, where, and what's hidden. Its edge lights emerald, blue, and amber for the three controls.",
			notes: ["Tap and it opens in place into a control card", "Scroll down and it shrinks to a count bubble under the thumb", "More filters opens a sheet with search and live counts"],
		},
	},
	stage: {
		name: "Mobile: nav becomes the filter bar · bolder",
		View: DockStage,
		phone: {
			title: "Stage bar",
			pitch: "On listing pages the filter bar replaces the bottom nav. Navigation folds into one button; active controls are lit from above.",
			notes: ["The strip above the bar shows what's showing and hidden", "Scroll down slims the bar to icons, it never leaves", "Sort and navigation open as small snap sheets"],
		},
	},
}

const VIEWERS: { key: Viewer; label: string }[] = [
	{ key: "member", label: "Member with services" },
	{ key: "no-services", label: "Member, no services" },
	{ key: "guest", label: "Guest" },
]

function Prototype({ viewer, variant }: { viewer: Viewer; variant: string }) {
	const { titles, mine } = useLoaderData<typeof loader>()
	const bar = useFilterBar(titles, mine, viewer)
	const v = VARIANTS[variant] ?? VARIANTS.studio
	if (v.phone)
		return (
			<PhoneStage {...v.phone}>
				<v.View bar={bar} />
			</PhoneStage>
		)
	return <v.View bar={bar} />
}

export default function RecFilterBar2Prototype() {
	const [params, setParams] = useSearchParams()
	const variant = params.get("variant") ?? "studio"
	const viewer = (VIEWERS.some((v) => v.key === params.get("as")) ? params.get("as") : "member") as Viewer
	return (
		<div className="min-h-screen bg-gray-950 text-gray-200">
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
