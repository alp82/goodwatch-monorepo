// PROTOTYPE - throwaway. Discover redesign around mood searches and combinable tags, as variants on one route:
// /prototype/discover-mood?variant=E…N|0 (round 2) or A|B|C|D (round 1). Data is live (guest) through the read-only proxy route; see
// ~/ui/prototype-discover-mood/kit.tsx. Not for production.
import type { MetaFunction } from "@remix-run/node"
import { useSearchParams, type ShouldRevalidateFunction } from "@remix-run/react"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { useProtoDiscover } from "~/ui/prototype-discover-mood/kit"
import * as A from "~/ui/prototype-discover-mood/variants/A"
import * as B from "~/ui/prototype-discover-mood/variants/B"
import * as C from "~/ui/prototype-discover-mood/variants/C"
import * as D from "~/ui/prototype-discover-mood/variants/D"
import * as E from "~/ui/prototype-discover-mood/variants/E"
import * as F from "~/ui/prototype-discover-mood/variants/F"
import * as G from "~/ui/prototype-discover-mood/variants/G"
import * as H from "~/ui/prototype-discover-mood/variants/H"
import * as I from "~/ui/prototype-discover-mood/variants/I"
import * as J from "~/ui/prototype-discover-mood/variants/J"
import * as K from "~/ui/prototype-discover-mood/variants/K"
import * as L from "~/ui/prototype-discover-mood/variants/L"
import * as M from "~/ui/prototype-discover-mood/variants/M"
import * as N from "~/ui/prototype-discover-mood/variants/N"
import * as Today from "~/ui/prototype-discover-mood/variants/Today"

export const meta: MetaFunction = () => [{ title: "PROTOTYPE · Discover mood" }, { name: "robots", content: "noindex" }]
export const shouldRevalidate: ShouldRevalidateFunction = () => false

const VARIANTS = {
	E: { name: E.NAME, View: E.VariantE },
	F: { name: F.NAME, View: F.VariantF },
	G: { name: G.NAME, View: G.VariantG },
	H: { name: H.NAME, View: H.VariantH },
	I: { name: I.NAME, View: I.VariantI },
	J: { name: J.NAME, View: J.VariantJ },
	K: { name: K.NAME, View: K.VariantK },
	L: { name: L.NAME, View: L.VariantL },
	M: { name: M.NAME, View: M.VariantM },
	N: { name: N.NAME, View: N.VariantN },
	A: { name: A.NAME, View: A.VariantA },
	B: { name: B.NAME, View: B.VariantB },
	C: { name: C.NAME, View: C.VariantC },
	D: { name: D.NAME, View: D.VariantD },
	"0": { name: Today.NAME, View: Today.VariantToday },
} as const
// The switcher cycles round 2 and the baseline; round 1 (A-D) stays reachable by URL.
const CYCLE = ["E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "0"] as const

export default function PrototypeDiscoverMood() {
	const [params] = useSearchParams()
	const key = (params.get("variant") ?? "E") as keyof typeof VARIANTS
	const d = useProtoDiscover()
	const { View } = VARIANTS[key] ?? VARIANTS.E
	return (
		<>
			<View d={d} />
			<PrototypeSwitcher
				variants={Object.fromEntries(CYCLE.map((k) => [k, VARIANTS[k].name]))}
				position="top-[4.5rem] right-2 scale-75 origin-top-right md:top-auto md:right-auto md:scale-100 md:bottom-6 md:left-1/2 md:-translate-x-1/2"
			/>
		</>
	)
}
