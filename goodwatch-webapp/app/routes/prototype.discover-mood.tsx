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
import * as O from "~/ui/prototype-discover-mood/variants/O"
import * as P from "~/ui/prototype-discover-mood/variants/P"
import * as Q from "~/ui/prototype-discover-mood/variants/Q"
import * as R from "~/ui/prototype-discover-mood/variants/R"
import * as S from "~/ui/prototype-discover-mood/variants/S"
import * as T from "~/ui/prototype-discover-mood/variants/T"
import * as U from "~/ui/prototype-discover-mood/variants/U"
import * as V from "~/ui/prototype-discover-mood/variants/V"
import * as W from "~/ui/prototype-discover-mood/variants/W"
import * as X from "~/ui/prototype-discover-mood/variants/X"
import * as R4_1 from "~/ui/prototype-discover-mood/variants/R4-1"
import * as R4_2 from "~/ui/prototype-discover-mood/variants/R4-2"
import * as R4_3 from "~/ui/prototype-discover-mood/variants/R4-3"
import * as R4_4 from "~/ui/prototype-discover-mood/variants/R4-4"
import * as R4_5 from "~/ui/prototype-discover-mood/variants/R4-5"
import * as R4_6 from "~/ui/prototype-discover-mood/variants/R4-6"
import * as R4_7 from "~/ui/prototype-discover-mood/variants/R4-7"
import * as R4_8 from "~/ui/prototype-discover-mood/variants/R4-8"
import * as R4_9 from "~/ui/prototype-discover-mood/variants/R4-9"
import * as R4_10 from "~/ui/prototype-discover-mood/variants/R4-10"
import * as R5_11 from "~/ui/prototype-discover-mood/variants/R5-11"
import * as R5_12 from "~/ui/prototype-discover-mood/variants/R5-12"
import * as R5_13 from "~/ui/prototype-discover-mood/variants/R5-13"
import * as R5_14 from "~/ui/prototype-discover-mood/variants/R5-14"
import * as R5_15 from "~/ui/prototype-discover-mood/variants/R5-15"
import * as R5_16 from "~/ui/prototype-discover-mood/variants/R5-16"
import * as R5_17 from "~/ui/prototype-discover-mood/variants/R5-17"
import * as R5_18 from "~/ui/prototype-discover-mood/variants/R5-18"
import * as R5_19 from "~/ui/prototype-discover-mood/variants/R5-19"
import * as R5_20 from "~/ui/prototype-discover-mood/variants/R5-20"
import { LabShell } from "~/ui/prototype-discover-mood/lab/shell"
import { LabBar } from "~/ui/prototype-discover-mood/lab/LabBar"
import * as Today from "~/ui/prototype-discover-mood/variants/Today"

export const meta: MetaFunction = () => [{ title: "PROTOTYPE · Discover mood" }, { name: "robots", content: "noindex" }]
export const shouldRevalidate: ShouldRevalidateFunction = () => false

const VARIANTS = {
	lab: { name: "Discover lab", View: LabShell },
	"11": { name: R5_11.NAME, View: R5_11.VariantR5_11 },
	"12": { name: R5_12.NAME, View: R5_12.VariantR5_12 },
	"13": { name: R5_13.NAME, View: R5_13.VariantR5_13 },
	"14": { name: R5_14.NAME, View: R5_14.VariantR5_14 },
	"15": { name: R5_15.NAME, View: R5_15.VariantR5_15 },
	"16": { name: R5_16.NAME, View: R5_16.VariantR5_16 },
	"17": { name: R5_17.NAME, View: R5_17.VariantR5_17 },
	"18": { name: R5_18.NAME, View: R5_18.VariantR5_18 },
	"19": { name: R5_19.NAME, View: R5_19.VariantR5_19 },
	"20": { name: R5_20.NAME, View: R5_20.VariantR5_20 },
	"1": { name: R4_1.NAME, View: R4_1.VariantR4_1 },
	"2": { name: R4_2.NAME, View: R4_2.VariantR4_2 },
	"3": { name: R4_3.NAME, View: R4_3.VariantR4_3 },
	"4": { name: R4_4.NAME, View: R4_4.VariantR4_4 },
	"5": { name: R4_5.NAME, View: R4_5.VariantR4_5 },
	"6": { name: R4_6.NAME, View: R4_6.VariantR4_6 },
	"7": { name: R4_7.NAME, View: R4_7.VariantR4_7 },
	"8": { name: R4_8.NAME, View: R4_8.VariantR4_8 },
	"9": { name: R4_9.NAME, View: R4_9.VariantR4_9 },
	"10": { name: R4_10.NAME, View: R4_10.VariantR4_10 },
	O: { name: O.NAME, View: O.VariantO },
	P: { name: P.NAME, View: P.VariantP },
	Q: { name: Q.NAME, View: Q.VariantQ },
	R: { name: R.NAME, View: R.VariantR },
	S: { name: S.NAME, View: S.VariantS },
	T: { name: T.NAME, View: T.VariantT },
	U: { name: U.NAME, View: U.VariantU },
	V: { name: V.NAME, View: V.VariantV },
	W: { name: W.NAME, View: W.VariantW },
	X: { name: X.NAME, View: X.VariantX },
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
// The switcher cycles round 5 (11-20), its parent (8) and the baseline; earlier rounds stay reachable by URL.
const CYCLE = ["11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "8", "0"] as const

export default function PrototypeDiscoverMood() {
	const [params] = useSearchParams()
	const key = (params.get("variant") ?? "lab") as keyof typeof VARIANTS
	const d = useProtoDiscover()
	const { View } = VARIANTS[key] ?? VARIANTS.lab
	return (
		<>
			<View d={d} />
			{key === "lab" || !(key in VARIANTS) ? <LabBar /> : <PrototypeSwitcher
				variants={Object.fromEntries(CYCLE.map((k) => [k, VARIANTS[k].name]))}
				position="top-[4.5rem] right-2 scale-75 origin-top-right md:top-auto md:right-auto md:scale-100 md:bottom-6 md:left-1/2 md:-translate-x-1/2"
			/>}
		</>
	)
}
