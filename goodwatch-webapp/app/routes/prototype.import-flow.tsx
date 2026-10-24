// PROTOTYPE - throwaway. The import experience, redone for simplicity and flow. Four structurally different variants
// on stub data, each driven through the happy path and the edge cases by a simulated import (nothing is sent).
//   /prototype/import-flow?variant=A|B|C|D&scenario=<key>   (scenario keys in ui/prototype-import-flow/model.ts)
// The floating bar (or ← →) switches variants; the Case panel picks the scenario and restarts it.
import { json } from "@remix-run/node"
import { useSearchParams } from "@remix-run/react"
import { scenarioByKey, useImportSim } from "~/ui/prototype-import-flow/model"
import { ScenarioPanel } from "~/ui/prototype-import-flow/ScenarioPanel"
import { VariantA } from "~/ui/prototype-import-flow/VariantA"
import { VariantB } from "~/ui/prototype-import-flow/VariantB"
import { VariantC } from "~/ui/prototype-import-flow/VariantC"
import { VariantD } from "~/ui/prototype-import-flow/VariantD"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { SettingsPage } from "~/ui/settings/SettingsPage"

export async function loader() {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return json({})
}

export const meta = () => [{ title: "Imports prototype · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

const VARIANTS = {
	A: "One card",
	B: "One question at a time",
	C: "See what comes in",
	D: "Import now, sort later",
} as const

export default function PrototypeImportFlow() {
	const [params] = useSearchParams()
	const variant = (params.get("variant") ?? "A") as keyof typeof VARIANTS
	const scenario = scenarioByKey(params.get("scenario"))
	const sim = useImportSim(scenario)
	const key = `${variant}:${scenario.key}`
	return (
		<SettingsPage title="Imports" intro="Bring your ratings, watches, and Want to See from another site or app.">
			{variant === "A" && <VariantA key={key} sim={sim} />}
			{variant === "B" && <VariantB key={key} sim={sim} />}
			{variant === "C" && <VariantC key={key} sim={sim} />}
			{variant === "D" && <VariantD key={key} sim={sim} />}
			<ScenarioPanel sim={sim} />
			<PrototypeSwitcher variants={VARIANTS} />
		</SettingsPage>
	)
}
