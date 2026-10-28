// PROTOTYPE (start page lab, round 15): stage l · "Mixes on the stage": j with My movies' mood picker in place of the
// chips: the "Any mood" button and six curated mixes as image tiles right under the search bar (one row, sideways on
// phones); the button opens the whole picker (eight mixes, then Moods, Themes, Styles). Up to three picks combine.
import type { BlockVariant } from "../../lab/types"
import { SpotlightCard } from "./j"
import { JkStage } from "./jk-shared"
import { MixRowPicker } from "./jl-picker"

function MixesStage() {
	return (
		<JkStage
			k="l"
			placement="card"
			module={(f, reg) => <SpotlightCard f={f} reg={reg} />}
			picker={(f, reg) => <MixRowPicker f={f} reg={reg} />}
		/>
	)
}

export const variant: BlockVariant = { key: "l", name: "Mixes on the stage", C: MixesStage }
