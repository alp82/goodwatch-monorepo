// PROTOTYPE - throwaway. Discover redesign around mood searches and combinable tags, as variants on one route:
// /prototype/discover-mood?variant=0|A|B|C|D. Data is live (guest) through the read-only proxy route; see
// ~/ui/prototype-discover-mood/kit.tsx. Not for production.
import type { MetaFunction } from "@remix-run/node"
import { useSearchParams, type ShouldRevalidateFunction } from "@remix-run/react"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { useProtoDiscover } from "~/ui/prototype-discover-mood/kit"
import * as A from "~/ui/prototype-discover-mood/variants/A"
import * as B from "~/ui/prototype-discover-mood/variants/B"
import * as C from "~/ui/prototype-discover-mood/variants/C"
import * as D from "~/ui/prototype-discover-mood/variants/D"
import * as Today from "~/ui/prototype-discover-mood/variants/Today"

export const meta: MetaFunction = () => [{ title: "PROTOTYPE · Discover mood" }, { name: "robots", content: "noindex" }]
export const shouldRevalidate: ShouldRevalidateFunction = () => false

const VARIANTS = {
	A: { name: A.NAME, View: A.VariantA },
	B: { name: B.NAME, View: B.VariantB },
	C: { name: C.NAME, View: C.VariantC },
	D: { name: D.NAME, View: D.VariantD },
	"0": { name: Today.NAME, View: Today.VariantToday },
} as const

export default function PrototypeDiscoverMood() {
	const [params] = useSearchParams()
	const key = (params.get("variant") ?? "A") as keyof typeof VARIANTS
	const d = useProtoDiscover()
	const { View } = VARIANTS[key] ?? VARIANTS.A
	return (
		<>
			<View d={d} />
			<PrototypeSwitcher
				variants={Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, v.name]))}
				position="top-[4.5rem] right-2 scale-75 origin-top-right md:top-auto md:right-auto md:scale-100 md:bottom-6 md:left-1/2 md:-translate-x-1/2"
			/>
		</>
	)
}
