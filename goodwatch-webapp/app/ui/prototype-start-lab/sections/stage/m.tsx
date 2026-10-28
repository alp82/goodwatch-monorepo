// PROTOTYPE (start page lab, round 15): stage m · "Mood button": j with My movies' mood picker in place of the chips,
// as My movies has it: one "Any mood" button (then the picks as chips and their count) under the search bar, and the
// whole picker (eight curated mixes, then Moods, Themes, Styles) in its panel. The calmest stage.
import type { BlockVariant } from "../../lab/types"
import { SpotlightCard } from "./j"
import { JkStage } from "./jk-shared"
import { MoodButtonPicker } from "./jl-picker"

function MoodButtonStage() {
	return (
		<JkStage
			k="m"
			placement="card"
			module={(f, reg) => <SpotlightCard f={f} reg={reg} />}
			picker={(f, reg) => <MoodButtonPicker f={f} reg={reg} />}
		/>
	)
}

export const variant: BlockVariant = { key: "m", name: "Mood button", C: MoodButtonStage }
