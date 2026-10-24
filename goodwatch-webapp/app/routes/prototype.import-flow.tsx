// PROTOTYPE - throwaway. The import experience, redone for simplicity and flow. Four structurally different variants
// on stub data, each driven through the happy path and the edge cases by a simulated import (nothing is sent).
//   /prototype/import-flow?variant=A|B|C|D&scenario=<key>   (scenario keys in ui/prototype-import-flow/model.ts)
// The floating bar (or ← →) switches variants; the Case panel picks the scenario and restarts it.
import { json } from "@remix-run/node"
import { useSearchParams } from "@remix-run/react"
import { ScenarioPanel } from "~/ui/prototype-import-flow/ScenarioPanel"
import { VariantA } from "~/ui/prototype-import-flow/VariantA"
import { VariantB } from "~/ui/prototype-import-flow/VariantB"
import { VariantB2 } from "~/ui/prototype-import-flow/VariantB2"
import { VariantB3 } from "~/ui/prototype-import-flow/VariantB3"
import { VariantB4 } from "~/ui/prototype-import-flow/VariantB4"
import { VariantB5 } from "~/ui/prototype-import-flow/VariantB5"
import { VariantB6 } from "~/ui/prototype-import-flow/VariantB6"
import { VariantB7 } from "~/ui/prototype-import-flow/VariantB7"
import { VariantB8 } from "~/ui/prototype-import-flow/VariantB8"
import { VariantC } from "~/ui/prototype-import-flow/VariantC"
import { VariantD } from "~/ui/prototype-import-flow/VariantD"
import { scenarioByKey, useImportSim } from "~/ui/prototype-import-flow/model"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { SettingsPage } from "~/ui/settings/SettingsPage"

export async function loader() {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	return json({})
}

export const meta = () => [
	{ title: "Imports prototype · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

// Round 2 (2026-10-24): the owner picked B ("the best UX so far") and asked for iterations on it. The switcher
// cycles B and its iterations; round 1's A, C, and D still open with ?variant=A|C|D.
/** Round 5: the switcher only cycles how B8's Done screen sums up what changed. */
const VARIANTS = {
	S1: "Rows like the Choose step",
	S2: "Count tiles",
	S3: "One sentence",
	S4: "One line, details folded",
} as const
const SUMMARY = {
	S1: "table",
	S2: "tiles",
	S3: "sentence",
	S4: "fold",
} as const
/** Earlier rounds, still open by URL. */
const EARLIER = {
	B: "Round 1 B, one question at a time",
	B2: "One screen per topic",
	B3: "Summary first, questions optional",
	B4: "Start from where your movies are",
	B5: "Full-screen focus",
	B6: "Imports while you answer",
	B7: "B6 with round 2 feedback",
	B8: "B7 with round 3 feedback",
} as const
const ROUND_1 = {
	A: "One card",
	C: "See what comes in",
	D: "Import now, sort later",
} as const

export default function PrototypeImportFlow() {
	const [params] = useSearchParams()
	const variant = (params.get("variant") ?? "S1") as
		| keyof typeof VARIANTS
		| keyof typeof EARLIER
		| keyof typeof ROUND_1
	const scenario = scenarioByKey(params.get("scenario"))
	const sim = useImportSim(scenario)
	const key = `${variant}:${scenario.key}`
	return (
		<SettingsPage
			title="Imports"
			intro="Bring your ratings, watches, and Want to See from another site or app."
		>
			{variant === "A" && <VariantA key={key} sim={sim} />}
			{variant === "B" && <VariantB key={key} sim={sim} />}
			{variant === "C" && <VariantC key={key} sim={sim} />}
			{variant === "D" && <VariantD key={key} sim={sim} />}
			{variant === "B2" && <VariantB2 key={key} sim={sim} />}
			{variant === "B3" && <VariantB3 key={key} sim={sim} />}
			{variant === "B4" && <VariantB4 key={key} sim={sim} />}
			{variant === "B5" && <VariantB5 key={key} sim={sim} />}
			{variant === "B6" && <VariantB6 key={key} sim={sim} />}
			{variant === "B7" && <VariantB7 key={key} sim={sim} />}
			{variant === "B8" && <VariantB8 key={key} sim={sim} />}
			{variant in SUMMARY && (
				<VariantB8
					key={key}
					sim={sim}
					summary={SUMMARY[variant as keyof typeof SUMMARY]}
				/>
			)}
			<ScenarioPanel sim={sim} />
			<PrototypeSwitcher variants={VARIANTS} />
		</SettingsPage>
	)
}
