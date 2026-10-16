// PROTOTYPE (development only, left out of production builds by PROTOTYPES in vite.config.js): four layouts of the member
// Settings pages, regrouped and renamed, on fake member data with the real country and service lists. Nothing saves.
//   /prototype/settings/a  One page with a sticky index
//   /prototype/settings/b  Summary list that opens an editor
//   /prototype/settings/c  Grouped tabs, the closest to today
//   /prototype/settings/d  Tiles with sheets (bolder)
// ← and → switch variants. Add ?shot to hide the switcher for screenshots. Branch: prototype/settings-redesign.
import type { MetaFunction } from "@remix-run/node"
import { useParams } from "@remix-run/react"
import { PrefsProvider } from "~/ui/prototype-settings/parts"
import { PathSwitcher } from "~/ui/prototype-settings/Switcher"
import { VariantA } from "~/ui/prototype-settings/VariantA"
import { VariantB } from "~/ui/prototype-settings/VariantB"
import { VariantC } from "~/ui/prototype-settings/VariantC"
import { VariantD } from "~/ui/prototype-settings/VariantD"

export const meta: MetaFunction = () => [{ title: "Settings prototype | GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

const VARIANTS = {
	a: "One page",
	b: "Summary list",
	c: "Grouped tabs",
	d: "Tiles (bolder)",
}

export default function SettingsPrototype() {
	const { variant = "a" } = useParams()
	const key = variant in VARIANTS ? variant : "a"
	return (
		<PrefsProvider key={key}>
			{key === "a" && <VariantA />}
			{key === "b" && <VariantB />}
			{key === "c" && <VariantC />}
			{key === "d" && <VariantD />}
			<PathSwitcher base="/prototype/settings" variants={VARIANTS} current={key} />
		</PrefsProvider>
	)
}
