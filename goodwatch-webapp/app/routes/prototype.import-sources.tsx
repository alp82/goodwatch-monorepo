// PROTOTYPE - throwaway (#617, child of map #365). How does the Imports page offer nineteen sources and walk a member
// through getting each file? Four layouts on one route, inside a static copy of the settings frame:
//   /prototype/import-sources?variant=A|B|C|D&built=today|wave1|wave2|all
// A searchable list, B grid by kind with a side panel, C "Where are you coming from?", D one upload box for all.
// `built` pretends the waves are built that far (default wave2, so wave 3 shows as "coming later").
// Files are read in this browser only (ZIP file names, CSV header, XML root, JSON keys); nothing is uploaded. The
// preview is the shipped SourceImportPreview with sample numbers. No loader data, no endpoint, no persistence.
import { json } from "@remix-run/node"
import { useSearchParams } from "@remix-run/react"
import { BUILT_LABELS, type Built } from "~/ui/prototype-import-sources/sources"
import { StoreProvider } from "~/ui/prototype-import-sources/store"
import {
	VariantA,
	VariantB,
	VariantC,
	VariantD,
} from "~/ui/prototype-import-sources/variants"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"

export async function loader() {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	return json({})
}

export const meta = () => [
	{ title: "Import sources prototype · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

const VARIANTS = {
	A: "Searchable list",
	B: "Grid by kind",
	C: "Where are you coming from?",
	D: "One box for every file",
} as const
type Key = keyof typeof VARIANTS
const COMPONENTS = { A: VariantA, B: VariantB, C: VariantC, D: VariantD }

export default function ImportSourcesPrototype() {
	const [params, setParams] = useSearchParams()
	const asked = params.get("variant") ?? "A"
	const variant: Key = asked in VARIANTS ? (asked as Key) : "A"
	const askedBuilt = params.get("built") ?? "wave2"
	const built: Built =
		askedBuilt in BUILT_LABELS ? (askedBuilt as Built) : "wave2"
	const Variant = COMPONENTS[variant]
	const setBuilt = (next: Built) => {
		const p = new URLSearchParams(params)
		p.set("built", next)
		setParams(p, { replace: true, preventScrollReset: true })
	}
	return (
		<>
			<div className="mx-auto mt-2 flex max-w-7xl flex-wrap items-center gap-2 px-8 text-xs text-fuchsia-200">
				<span className="font-semibold">Prototype · pretend built:</span>
				{(Object.keys(BUILT_LABELS) as Built[]).map((key) => (
					<button
						key={key}
						type="button"
						onClick={() => setBuilt(key)}
						className={`rounded-full border px-2 py-0.5 ${key === built ? "border-fuchsia-400 bg-fuchsia-900/60" : "border-fuchsia-800 hover:bg-fuchsia-950"}`}
					>
						{BUILT_LABELS[key]}
					</button>
				))}
			</div>
			<StoreProvider key={`${variant}-${built}`}>
				<Variant built={built} />
			</StoreProvider>
			<PrototypeSwitcher variants={VARIANTS} />
		</>
	)
}
